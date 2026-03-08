/**
 * lib/profileService.ts
 * CRUD for user_profiles and all sub-tables (family_history, lifestyle_data, diet_data, medical_data)
 *
 * HIPAA Notes:
 *  - MedicalData fields (Medications, Allergies, Conditions) are encrypted
 *    with AES-256-GCM via lib/phi.ts before INSERT/UPDATE
 *  - Decryption happens only here, in the application layer — never in the database
 *  - All mutations are audit-logged via lib/auditLogger.ts
 *  - Access reads are logged (logAccess) for §164.312(b) compliance
 *
 * Migrated from SQL Server (mssql) → Supabase (PostgreSQL).
 */

import { getSupabase } from './supabase';
import { encryptPHI, decryptPHI } from './phi';
import { logChange, logAccess } from './auditLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileInput {
  // Basics
  age: number | string;  // form may send empty string
  gender: string;
  activityLevel: string;
  city: string;
  // Family History (multi-select)
  familyHistory: string[];
  // Lifestyle
  smoking: string;
  alcohol: string;
  sleep: string;
  // Diet
  foodPreference: string;
  dietQuality: string;
  // Medical (PHI — will be encrypted)
  medications: string;
  allergies: string;
  conditions: string;
  lastCheckup: string;
}

export interface FullProfile {
  profileId: string;
  userId: string;
  age: number | null;
  gender: string | null;
  activityLevel: string | null;
  city: string | null;
  profileComplete: boolean;
  familyHistory: string[];
  lifestyle: { smokingStatus: string | null; alcoholUse: string | null; sleepRange: string | null } | null;
  diet: { foodPreference: string | null; dietQuality: string | null } | null;
  medical: {
    medications: string | null;   // decrypted
    allergies: string | null;     // decrypted
    conditions: string | null;    // decrypted
    lastCheckup: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// UPSERT (creates or fully replaces a user's profile data)
// Called when the user completes the multi-step profile form.
// ---------------------------------------------------------------------------

export async function upsertProfile(
  userId: string,
  data: ProfileInput,
  options?: { ipAddress?: string }
): Promise<string> {
  const supabase = getSupabase();

  // 1. Upsert UserProfiles (core row)
  // Sanitize age: form may send empty string which PostgreSQL rejects for smallint
  const sanitizedAge = (data.age === '' || data.age === undefined || data.age === null)
    ? null
    : typeof data.age === 'string' ? parseInt(data.age, 10) || null : data.age;

  const { data: profileRow, error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        age: sanitizedAge,
        gender: data.gender || null,
        activity_level: data.activityLevel || null,
        city: data.city || null,
        profile_complete: true,
        modified_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('profile_id')
    .single();

  if (profileError || !profileRow) {
    throw new Error(`[ProfileService] Failed to upsert profile: ${profileError?.message}`);
  }

  const profileId = profileRow.profile_id;

  // 2. Replace FamilyHistory (delete + re-insert)
  await supabase.from('family_history').delete().eq('profile_id', profileId);
  if (data.familyHistory.length > 0) {
    const familyRows = data.familyHistory.map((condition) => ({
      profile_id: profileId,
      condition,
    }));
    await supabase.from('family_history').insert(familyRows);
  }

  // 3. Upsert LifestyleData
  await supabase
    .from('lifestyle_data')
    .upsert(
      {
        profile_id: profileId,
        smoking_status: data.smoking,
        alcohol_use: data.alcohol,
        sleep_range: data.sleep,
        modified_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    );

  // 4. Upsert DietData
  await supabase
    .from('diet_data')
    .upsert(
      {
        profile_id: profileId,
        food_preference: data.foodPreference,
        diet_quality: data.dietQuality,
        modified_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    );

  // 5. Upsert MedicalData — encrypt PHI fields before storing
  const encMedications = encryptPHI(data.medications);
  const encAllergies = encryptPHI(data.allergies);
  const encConditions = encryptPHI(data.conditions);

  await supabase
    .from('medical_data')
    .upsert(
      {
        profile_id: profileId,
        medications_enc: encMedications,
        allergies_enc: encAllergies,
        conditions_enc: encConditions,
        last_checkup: data.lastCheckup,
        modified_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    );

  await logChange({
    tableName: 'user_profiles',
    recordId: profileId,
    operation: 'UPDATE',
    changedByUserId: userId,
    newValues: { age: data.age, gender: data.gender, activityLevel: data.activityLevel, city: data.city },
    ipAddress: options?.ipAddress,
  });

  return profileId;
}

// ---------------------------------------------------------------------------
// GET — full profile with decrypted PHI
// ---------------------------------------------------------------------------

export async function getProfileByUser(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string; purpose?: string }
): Promise<FullProfile | null> {
  const supabase = getSupabase();

  // Fetch base profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('profile_id, age, gender, activity_level, city, profile_complete')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) return null;

  // Fetch sub-tables in parallel
  const [fhResult, lsResult, dietResult, medResult] = await Promise.all([
    supabase
      .from('family_history')
      .select('condition')
      .eq('profile_id', profile.profile_id),

    supabase
      .from('lifestyle_data')
      .select('smoking_status, alcohol_use, sleep_range')
      .eq('profile_id', profile.profile_id)
      .single(),

    supabase
      .from('diet_data')
      .select('food_preference, diet_quality')
      .eq('profile_id', profile.profile_id)
      .single(),

    supabase
      .from('medical_data')
      .select('medications_enc, allergies_enc, conditions_enc, last_checkup')
      .eq('profile_id', profile.profile_id)
      .single(),
  ]);

  // Decrypt PHI fields
  const med = medResult.data ?? null;

  // Log the access
  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'user_profiles',
    recordId: profile.profile_id,
    ipAddress: options?.ipAddress,
    purpose: options?.purpose ?? 'Treatment',
  });

  return {
    profileId: profile.profile_id,
    userId,
    age: profile.age,
    gender: profile.gender,
    activityLevel: profile.activity_level,
    city: profile.city,
    profileComplete: profile.profile_complete,
    familyHistory: (fhResult.data ?? []).map((r) => r.condition),
    lifestyle: lsResult.data
      ? {
          smokingStatus: lsResult.data.smoking_status,
          alcoholUse: lsResult.data.alcohol_use,
          sleepRange: lsResult.data.sleep_range,
        }
      : null,
    diet: dietResult.data
      ? {
          foodPreference: dietResult.data.food_preference,
          dietQuality: dietResult.data.diet_quality,
        }
      : null,
    medical: med
      ? {
          medications: decryptPHI(med.medications_enc),
          allergies: decryptPHI(med.allergies_enc),
          conditions: decryptPHI(med.conditions_enc),
          lastCheckup: med.last_checkup,
        }
      : null,
  };
}
