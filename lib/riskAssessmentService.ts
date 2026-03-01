/**
 * lib/riskAssessmentService.ts
 * CRUD for dbo.RiskAssessments, dbo.RiskFactorContributions, dbo.HealthProjections
 *
 * HIPAA Notes:
 *  - Risk scores are derived data, not raw PHI, but are still linked to UserId
 *  - AiInsightSummary may reference PHI — treat with care and log access
 *  - All writes are audit-logged; reads log access
 */

import { getPool, sql } from './db';
import { logChange, logAccess } from './auditLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskFactorInput {
  factorName: string;      // 'Age' | 'Family History' | 'Vitals' | 'Activity Level'
  contributionPct: number; // 0–100
}

export interface ProjectionPoint {
  monthOffset: number;     // 0–6
  predictedScore: number;  // 0–100
  baselineScore: number;   // 0–100
}

export interface RiskAssessmentInput {
  overallRiskScore: number;
  geneticDisposition?: string;   // 'Low' | 'Moderate' | 'High'
  lifestyleImpact?: string;      // 'Low' | 'Moderate' | 'Critical'
  medicalHistoryRisk?: string;   // 'Low Risk' | 'Moderate' | 'High'
  aiInsightSummary?: string;
  riskFactors?: RiskFactorInput[];
  projections?: ProjectionPoint[];
}

export interface RiskAssessment extends RiskAssessmentInput {
  assessmentId: string;
  userId: string;
  assessedAt: Date;
}

// ---------------------------------------------------------------------------
// SAVE (creates new assessment snapshot — assessments are immutable records)
// ---------------------------------------------------------------------------

export async function saveRiskAssessment(
  userId: string,
  data: RiskAssessmentInput,
  options?: { ipAddress?: string }
): Promise<string> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // Insert base assessment
    const assessmentResult = await new sql.Request(transaction)
      .input('UserId',              sql.UniqueIdentifier, userId)
      .input('OverallRiskScore',    sql.TinyInt, data.overallRiskScore)
      .input('GeneticDisposition',  sql.NVarChar(50), data.geneticDisposition ?? null)
      .input('LifestyleImpact',     sql.NVarChar(50), data.lifestyleImpact ?? null)
      .input('MedicalHistoryRisk',  sql.NVarChar(50), data.medicalHistoryRisk ?? null)
      .input('AiInsightSummary',    sql.NVarChar(sql.MAX), data.aiInsightSummary ?? null)
      .query<{ assessmentId: string }>(`
        INSERT INTO dbo.RiskAssessments
          (UserId, OverallRiskScore, GeneticDisposition, LifestyleImpact, MedicalHistoryRisk, AiInsightSummary)
        OUTPUT INSERTED.AssessmentId AS assessmentId
        VALUES
          (@UserId, @OverallRiskScore, @GeneticDisposition, @LifestyleImpact, @MedicalHistoryRisk, @AiInsightSummary)
      `);

    const assessmentId = assessmentResult.recordset[0].assessmentId;

    // Insert risk factor contributions
    for (const factor of data.riskFactors ?? []) {
      await new sql.Request(transaction)
        .input('AssessmentId',    sql.UniqueIdentifier, assessmentId)
        .input('FactorName',      sql.NVarChar(100), factor.factorName)
        .input('ContributionPct', sql.TinyInt, factor.contributionPct)
        .query(`
          INSERT INTO dbo.RiskFactorContributions (AssessmentId, FactorName, ContributionPct)
          VALUES (@AssessmentId, @FactorName, @ContributionPct)
        `);
    }

    // Insert health projection points
    for (const point of data.projections ?? []) {
      await new sql.Request(transaction)
        .input('AssessmentId',   sql.UniqueIdentifier, assessmentId)
        .input('MonthOffset',    sql.TinyInt, point.monthOffset)
        .input('PredictedScore', sql.TinyInt, point.predictedScore)
        .input('BaselineScore',  sql.TinyInt, point.baselineScore)
        .query(`
          INSERT INTO dbo.HealthProjections (AssessmentId, MonthOffset, PredictedScore, BaselineScore)
          VALUES (@AssessmentId, @MonthOffset, @PredictedScore, @BaselineScore)
        `);
    }

    await transaction.commit();

    await logChange({
      tableName: 'dbo.RiskAssessments',
      recordId: assessmentId,
      operation: 'INSERT',
      changedByUserId: userId,
      newValues: { overallRiskScore: data.overallRiskScore },
      ipAddress: options?.ipAddress,
    });

    return assessmentId;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET — latest assessment with factors + projections
// ---------------------------------------------------------------------------

export async function getLatestAssessment(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<RiskAssessment | null> {
  const pool = await getPool();

  const assessmentResult = await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .query<{
      assessmentId: string; overallRiskScore: number; geneticDisposition: string;
      lifestyleImpact: string; medicalHistoryRisk: string; aiInsightSummary: string; assessedAt: Date;
    }>(`
      SELECT TOP 1
        AssessmentId      AS assessmentId,
        OverallRiskScore  AS overallRiskScore,
        GeneticDisposition AS geneticDisposition,
        LifestyleImpact   AS lifestyleImpact,
        MedicalHistoryRisk AS medicalHistoryRisk,
        AiInsightSummary  AS aiInsightSummary,
        AssessedAt        AS assessedAt
      FROM dbo.RiskAssessments
      WHERE UserId = @UserId
      ORDER BY AssessedAt DESC
    `);

  if (!assessmentResult.recordset[0]) return null;
  const a = assessmentResult.recordset[0];

  const [factorsResult, projectionsResult] = await Promise.all([
    pool.request().input('AssessmentId', sql.UniqueIdentifier, a.assessmentId)
      .query<{ factorName: string; contributionPct: number }>(`
        SELECT FactorName AS factorName, ContributionPct AS contributionPct
        FROM dbo.RiskFactorContributions WHERE AssessmentId = @AssessmentId`),

    pool.request().input('AssessmentId', sql.UniqueIdentifier, a.assessmentId)
      .query<{ monthOffset: number; predictedScore: number; baselineScore: number }>(`
        SELECT MonthOffset AS monthOffset, PredictedScore AS predictedScore, BaselineScore AS baselineScore
        FROM dbo.HealthProjections WHERE AssessmentId = @AssessmentId ORDER BY MonthOffset`),
  ]);

  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'dbo.RiskAssessments',
    recordId: a.assessmentId,
    ipAddress: options?.ipAddress,
    purpose: 'Treatment',
  });

  return {
    assessmentId: a.assessmentId,
    userId,
    overallRiskScore: a.overallRiskScore,
    geneticDisposition: a.geneticDisposition,
    lifestyleImpact: a.lifestyleImpact,
    medicalHistoryRisk: a.medicalHistoryRisk,
    aiInsightSummary: a.aiInsightSummary,
    assessedAt: a.assessedAt,
    riskFactors: factorsResult.recordset,
    projections: projectionsResult.recordset,
  };
}

// ---------------------------------------------------------------------------
// GET history (list of assessments, no deep data)
// ---------------------------------------------------------------------------

export async function getAssessmentHistory(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<Array<{ assessmentId: string; overallRiskScore: number; assessedAt: Date }>> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('UserId', sql.UniqueIdentifier, userId)
    .query<{ assessmentId: string; overallRiskScore: number; assessedAt: Date }>(`
      SELECT
        AssessmentId     AS assessmentId,
        OverallRiskScore AS overallRiskScore,
        AssessedAt       AS assessedAt
      FROM dbo.RiskAssessments
      WHERE UserId = @UserId
      ORDER BY AssessedAt DESC
    `);

  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'dbo.RiskAssessments',
    ipAddress: options?.ipAddress,
    purpose: 'Treatment',
  });

  return result.recordset;
}
