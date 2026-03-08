/**
 * lib/profileService.ts
 * CRUD for user_profiles and all sub-tables (family_history, lifestyle_data, diet_data, medical_data)
 * Also writes health_questionnaire (Q5–Q17) and the Q3/Q4 fields on user_profiles.
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

  // ── Q3 / Q4 — physical measurements & skin type (new schema fields) ──────
  heightCm?: number | null;
  weightKg?: number | null;
  bmi?: number | null;
  skinType?: number | null;

  // ── Q5–Q17 — health questionnaire answers ────────────────────────────────
  // Heart health (Q5–Q9)
  smoker?: 0 | 1 | null;
  cigsperday?: number | null;
  hypertension?: 0 | 1 | null;
  bpMedication?: 0 | 1 | null;
  diabetes?: 0 | 1 | null;
  prevStroke?: 0 | 1 | null;
  bpKnowledge?: 'yes' | 'no' | 'unknown' | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  cholesterol?: number | null;
  glucose?: number | null;
  restingHr?: number | null;

  // Cancer shared (Q10–Q14)
  uvExposureHigh?: boolean;
  sunburnHistory?: boolean;
  geographyHighUv?: boolean;
  familyHistoryBreast?: boolean;
  familyHistoryOvarian?: boolean;
  familyHistoryProstate?: boolean;
  familyHistorySkin?: boolean;
  familyHistoryBlood?: boolean;
  familyHistoryBrca2?: boolean;
  priorChemotherapy?: boolean;
  priorRadiation?: boolean;
  priorSkinCancer?: boolean;
  immunosuppressed?: boolean;
  persistentFatigue?: boolean;
  unexplainedWeightLoss?: boolean;
  nightSweats?: boolean;
  frequentInfections?: boolean;
  easyBruisingBleeding?: boolean;
  swollenLymphNodes?: boolean;

  // Female only (F_Q15–F_Q17)
  brcaKnown?: boolean | null;
  menopause?: boolean | null;
  hrtUse?: boolean | null;

  // Male only (M_Q15–M_Q17)
  raceHighRisk?: boolean | null;
  urinarySymptoms?: boolean | null;
  dietHighRedMeat?: boolean | null;
  psaKnown?: number | null;

  // Shared lifestyle (F_Q17 / M_Q17)
  alcoholWeeklyUnits?: number | null;
  activityChoice?: 'active' | 'somewhat' | 'low' | 'sedentary' | null;

  // Derived
  physicalActivityLow?: boolean | null;
  obesity?: boolean | null;
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
  // Shortcut alias
  medicalData: FullProfile['medical'];
  medications: string | null;
  allergies: string | null;
  conditions: string | null;
  lastCheckup: string | null;
  // Physical measurements (user_profiles)
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  skinType: number | null;
  // Health questionnaire fields
  smoker: number | null;
  cigsperday: number | null;
  hypertension: number | null;
  bpMedication: number | null;
  diabetes: number | null;
  prevStroke: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  cholesterol: number | null;
  glucose: number | null;
  restingHr: number | null;
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

  // 1. Upsert UserProfiles (core row) — now includes Q3/Q4 physical fields
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
        // Q3 / Q4 — new schema columns
        height_cm: data.heightCm ?? null,
        weight_kg: data.weightKg ?? null,
        bmi: data.bmi ?? null,
        skin_type: data.skinType ?? null,
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

  // 6. Upsert HealthQuestionnaire — Q5–Q17 answers (new table from migration)
  // Only write this row when at least one questionnaire answer has been provided
  const hasQuestionnaireData =
    data.smoker !== undefined ||
    data.hypertension !== undefined ||
    data.uvExposureHigh !== undefined;

  if (hasQuestionnaireData) {
    const { error: qError } = await supabase
      .from('health_questionnaire')
      .upsert(
        {
          user_id: userId,
          // Q5 — smoking
          smoker: data.smoker ?? null,
          cigsperday: data.cigsperday ?? null,
          // Q6 — hypertension
          hypertension: data.hypertension ?? null,
          bp_medication: data.bpMedication ?? null,
          // Q7 — conditions
          diabetes: data.diabetes ?? null,
          prev_stroke: data.prevStroke ?? null,
          // Q8 — blood pressure
          bp_knowledge: data.bpKnowledge ?? null,
          systolic_bp: data.systolicBp ?? null,
          diastolic_bp: data.diastolicBp ?? null,
          // Q9 — blood tests
          cholesterol: data.cholesterol ?? null,
          glucose: data.glucose ?? null,
          resting_hr: data.restingHr ?? null,
          // Q10 — sun/UV
          uv_exposure_high: data.uvExposureHigh ?? false,
          sunburn_history: data.sunburnHistory ?? false,
          geography_high_uv: data.geographyHighUv ?? false,
          // Q11 — family cancer history
          family_history_breast: data.familyHistoryBreast ?? false,
          family_history_ovarian: data.familyHistoryOvarian ?? false,
          family_history_prostate: data.familyHistoryProstate ?? false,
          family_history_skin: data.familyHistorySkin ?? false,
          family_history_blood: data.familyHistoryBlood ?? false,
          family_history_brca2: data.familyHistoryBrca2 ?? false,
          // Q12 — prior medical
          prior_chemotherapy: data.priorChemotherapy ?? false,
          prior_radiation: data.priorRadiation ?? false,
          prior_skin_cancer: data.priorSkinCancer ?? false,
          immunosuppressed: data.immunosuppressed ?? false,
          // Q13
          persistent_fatigue: data.persistentFatigue ?? false,
          unexplained_weight_loss: data.unexplainedWeightLoss ?? false,
          night_sweats: data.nightSweats ?? false,
          // Q14
          frequent_infections: data.frequentInfections ?? false,
          easy_bruising_bleeding: data.easyBruisingBleeding ?? false,
          swollen_lymph_nodes: data.swollenLymphNodes ?? false,
          // Female only
          brca_known: data.brcaKnown ?? null,
          menopause: data.menopause ?? null,
          hrt_use: data.hrtUse ?? null,
          // Male only
          race_high_risk: data.raceHighRisk ?? null,
          urinary_symptoms: data.urinarySymptoms ?? null,
          diet_high_red_meat: data.dietHighRedMeat ?? null,
          psa_known: data.psaKnown ?? null,
          // Shared lifestyle
          alcohol_weekly_units: data.alcoholWeeklyUnits ?? null,
          activity_choice: data.activityChoice ?? null,
          // Derived
          physical_activity_low: data.physicalActivityLow ?? null,
          obesity: data.obesity ?? null,
          modified_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (qError) {
      console.error('[ProfileService] Failed to upsert health_questionnaire:', qError.message);
      // Non-fatal — profile still saved successfully
    }
  }

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

  // Fetch base profile (including Q3/Q4 physical fields)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('profile_id, age, gender, activity_level, city, profile_complete, height_cm, weight_kg, bmi, skin_type')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) return null;

  // Fetch sub-tables in parallel (including health_questionnaire)
  const [fhResult, lsResult, dietResult, medResult, hqResult] = await Promise.all([
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

    supabase
      .from('health_questionnaire')
      .select('smoker, cigsperday, hypertension, bp_medication, diabetes, prev_stroke, systolic_bp, diastolic_bp, cholesterol, glucose, resting_hr')
      .eq('user_id', userId)
      .single(),
  ]);

  // Decrypt PHI fields
  const med = medResult.data ?? null;
  const hq = hqResult.data ?? null;

  // Log the access
  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'user_profiles',
    recordId: profile.profile_id,
    ipAddress: options?.ipAddress,
    purpose: options?.purpose ?? 'Treatment',
  });

  const medicalObj = med
    ? {
        medications: decryptPHI(med.medications_enc),
        allergies: decryptPHI(med.allergies_enc),
        conditions: decryptPHI(med.conditions_enc),
        lastCheckup: med.last_checkup,
      }
    : null;

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
    medical: medicalObj,
    medicalData: medicalObj,
    medications: medicalObj?.medications ?? null,
    allergies: medicalObj?.allergies ?? null,
    conditions: medicalObj?.conditions ?? null,
    lastCheckup: medicalObj?.lastCheckup ?? null,
    // Physical measurements
    heightCm: profile.height_cm ?? null,
    weightKg: profile.weight_kg ?? null,
    bmi: profile.bmi ?? null,
    skinType: profile.skin_type ?? null,
    // Health questionnaire
    smoker: hq?.smoker ?? null,
    cigsperday: hq?.cigsperday ?? null,
    hypertension: hq?.hypertension ?? null,
    bpMedication: hq?.bp_medication ?? null,
    diabetes: hq?.diabetes ?? null,
    prevStroke: hq?.prev_stroke ?? null,
    systolicBp: hq?.systolic_bp ?? null,
    diastolicBp: hq?.diastolic_bp ?? null,
    cholesterol: hq?.cholesterol ?? null,
    glucose: hq?.glucose ?? null,
    restingHr: hq?.resting_hr ?? null,
  };
}
