/**
 * lib/profileService.ts
 * CRUD for UserProfiles and all sub-tables (FamilyHistory, LifestyleData, DietData, MedicalData)
 *
 * HIPAA Notes:
 *  - MedicalData fields (Medications, Allergies, Conditions) are encrypted
 *    with AES-256-GCM via lib/phi.ts before INSERT/UPDATE
 *  - Decryption happens only here, in the application layer — never in SQL
 *  - All mutations are audit-logged via lib/auditLogger.ts
 *  - Access reads are logged (logAccess) for §164.312(b) compliance
 */

import { getPool, sql } from './db';
import { encryptPHI, decryptPHI } from './phi';
import { logChange, logAccess } from './auditLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileInput {
  // Basics
  age: number;
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
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Upsert UserProfiles (core row)
    const profileResult = await new sql.Request(transaction)
      .input('UserId', sql.UniqueIdentifier, userId)
      .input('Age', sql.TinyInt, data.age)
      .input('Gender', sql.NVarChar(50), data.gender)
      .input('ActivityLevel', sql.NVarChar(50), data.activityLevel)
      .input('City', sql.NVarChar(200), data.city)
      .query<{ profileId: string }>(`
        MERGE dbo.UserProfiles AS target
        USING (SELECT @UserId AS UserId) AS source ON target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET Age = @Age, Gender = @Gender, ActivityLevel = @ActivityLevel,
                     City = @City, ProfileComplete = 1, ModifiedAt = SYSDATETIMEOFFSET()
        WHEN NOT MATCHED THEN
          INSERT (UserId, Age, Gender, ActivityLevel, City, ProfileComplete)
          VALUES (@UserId, @Age, @Gender, @ActivityLevel, @City, 1)
        OUTPUT INSERTED.ProfileId AS profileId;
      `);

    const profileId = profileResult.recordset[0].profileId;

    // 2. Replace FamilyHistory (delete + re-insert)
    await new sql.Request(transaction)
      .input('ProfileId', sql.UniqueIdentifier, profileId)
      .query(`DELETE FROM dbo.FamilyHistory WHERE ProfileId = @ProfileId`);

    for (const condition of data.familyHistory) {
      await new sql.Request(transaction)
        .input('ProfileId', sql.UniqueIdentifier, profileId)
        .input('Condition', sql.NVarChar(200), condition)
        .query(`INSERT INTO dbo.FamilyHistory (ProfileId, Condition) VALUES (@ProfileId, @Condition)`);
    }

    // 3. Upsert LifestyleData
    await new sql.Request(transaction)
      .input('ProfileId', sql.UniqueIdentifier, profileId)
      .input('SmokingStatus', sql.NVarChar(50), data.smoking)
      .input('AlcoholUse', sql.NVarChar(50), data.alcohol)
      .input('SleepRange', sql.NVarChar(20), data.sleep)
      .query(`
        MERGE dbo.LifestyleData AS target
        USING (SELECT @ProfileId AS ProfileId) AS source ON target.ProfileId = source.ProfileId
        WHEN MATCHED THEN
          UPDATE SET SmokingStatus = @SmokingStatus, AlcoholUse = @AlcoholUse,
                     SleepRange = @SleepRange, ModifiedAt = SYSDATETIMEOFFSET()
        WHEN NOT MATCHED THEN
          INSERT (ProfileId, SmokingStatus, AlcoholUse, SleepRange)
          VALUES (@ProfileId, @SmokingStatus, @AlcoholUse, @SleepRange);
      `);

    // 4. Upsert DietData
    await new sql.Request(transaction)
      .input('ProfileId', sql.UniqueIdentifier, profileId)
      .input('FoodPreference', sql.NVarChar(100), data.foodPreference)
      .input('DietQuality', sql.NVarChar(50), data.dietQuality)
      .query(`
        MERGE dbo.DietData AS target
        USING (SELECT @ProfileId AS ProfileId) AS source ON target.ProfileId = source.ProfileId
        WHEN MATCHED THEN
          UPDATE SET FoodPreference = @FoodPreference, DietQuality = @DietQuality,
                     ModifiedAt = SYSDATETIMEOFFSET()
        WHEN NOT MATCHED THEN
          INSERT (ProfileId, FoodPreference, DietQuality)
          VALUES (@ProfileId, @FoodPreference, @DietQuality);
      `);

    // 5. Upsert MedicalData — encrypt PHI fields before storing
    const encMedications = encryptPHI(data.medications);
    const encAllergies   = encryptPHI(data.allergies);
    const encConditions  = encryptPHI(data.conditions);

    await new sql.Request(transaction)
      .input('ProfileId', sql.UniqueIdentifier, profileId)
      .input('Medications_Enc', sql.NVarChar(sql.MAX), encMedications)
      .input('Allergies_Enc',   sql.NVarChar(sql.MAX), encAllergies)
      .input('Conditions_Enc',  sql.NVarChar(sql.MAX), encConditions)
      .input('LastCheckup',     sql.NVarChar(50), data.lastCheckup)
      .query(`
        MERGE dbo.MedicalData AS target
        USING (SELECT @ProfileId AS ProfileId) AS source ON target.ProfileId = source.ProfileId
        WHEN MATCHED THEN
          UPDATE SET Medications_Enc = @Medications_Enc, Allergies_Enc = @Allergies_Enc,
                     Conditions_Enc = @Conditions_Enc, LastCheckup = @LastCheckup,
                     ModifiedAt = SYSDATETIMEOFFSET()
        WHEN NOT MATCHED THEN
          INSERT (ProfileId, Medications_Enc, Allergies_Enc, Conditions_Enc, LastCheckup)
          VALUES (@ProfileId, @Medications_Enc, @Allergies_Enc, @Conditions_Enc, @LastCheckup);
      `);

    await transaction.commit();

    await logChange({
      tableName: 'dbo.UserProfiles',
      recordId: profileId,
      operation: 'UPDATE',
      changedByUserId: userId,
      newValues: { age: data.age, gender: data.gender, activityLevel: data.activityLevel, city: data.city },
      ipAddress: options?.ipAddress,
    });

    return profileId;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET — full profile with decrypted PHI
// ---------------------------------------------------------------------------

export async function getProfileByUser(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string; purpose?: string }
): Promise<FullProfile | null> {
  const pool = await getPool();

  // Fetch base profile
  const profileResult = await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .query<{ profileId: string; age: number; gender: string; activityLevel: string; city: string; profileComplete: boolean }>(`
      SELECT ProfileId AS profileId, Age AS age, Gender AS gender,
             ActivityLevel AS activityLevel, City AS city, ProfileComplete AS profileComplete
      FROM dbo.UserProfiles
      WHERE UserId = @UserId
    `);

  if (!profileResult.recordset[0]) return null;
  const p = profileResult.recordset[0];

  // Fetch sub-tables in parallel
  const [fhResult, lsResult, dietResult, medResult] = await Promise.all([
    pool.request().input('ProfileId', sql.UniqueIdentifier, p.profileId)
      .query<{ condition: string }>(`SELECT Condition AS condition FROM dbo.FamilyHistory WHERE ProfileId = @ProfileId`),

    pool.request().input('ProfileId', sql.UniqueIdentifier, p.profileId)
      .query<{ smokingStatus: string; alcoholUse: string; sleepRange: string }>(`
        SELECT SmokingStatus AS smokingStatus, AlcoholUse AS alcoholUse, SleepRange AS sleepRange
        FROM dbo.LifestyleData WHERE ProfileId = @ProfileId`),

    pool.request().input('ProfileId', sql.UniqueIdentifier, p.profileId)
      .query<{ foodPreference: string; dietQuality: string }>(`
        SELECT FoodPreference AS foodPreference, DietQuality AS dietQuality
        FROM dbo.DietData WHERE ProfileId = @ProfileId`),

    pool.request().input('ProfileId', sql.UniqueIdentifier, p.profileId)
      .query<{ medications_Enc: string; allergies_Enc: string; conditions_Enc: string; lastCheckup: string }>(`
        SELECT Medications_Enc, Allergies_Enc, Conditions_Enc, LastCheckup AS lastCheckup
        FROM dbo.MedicalData WHERE ProfileId = @ProfileId`),
  ]);

  // Decrypt PHI fields
  const med = medResult.recordset[0] ?? null;

  // Log the access
  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'dbo.UserProfiles',
    recordId: p.profileId,
    ipAddress: options?.ipAddress,
    purpose: options?.purpose ?? 'Treatment',
  });

  return {
    profileId: p.profileId,
    userId,
    age: p.age,
    gender: p.gender,
    activityLevel: p.activityLevel,
    city: p.city,
    profileComplete: p.profileComplete,
    familyHistory: fhResult.recordset.map((r) => r.condition),
    lifestyle: lsResult.recordset[0] ?? null,
    diet: dietResult.recordset[0] ?? null,
    medical: med
      ? {
          medications: decryptPHI(med.medications_Enc),
          allergies:   decryptPHI(med.allergies_Enc),
          conditions:  decryptPHI(med.conditions_Enc),
          lastCheckup: med.lastCheckup,
        }
      : null,
  };
}
