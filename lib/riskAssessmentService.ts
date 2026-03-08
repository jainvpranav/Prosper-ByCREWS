/**
 * lib/riskAssessmentService.ts
 * CRUD for risk_assessments, risk_factor_contributions, health_projections
 *
 * HIPAA Notes:
 *  - Risk scores are derived data, not raw PHI, but are still linked to UserId
 *  - AiInsightSummary may reference PHI — treat with care and log access
 *  - All writes are audit-logged; reads log access
 *
 * Migrated from SQL Server (mssql) → Supabase (PostgreSQL).
 */

import { getSupabase } from './supabase';
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
  cardioResult?: any;            // Full ML JSON from /predict
  cancerResults?: any;           // Full ML JSON from /cancer/all
  riskFactors?: RiskFactorInput[];
  projections?: ProjectionPoint[];
}

export interface RiskAssessment extends RiskAssessmentInput {
  assessmentId: string;
  userId: string;
  assessedAt: string;
}

// ---------------------------------------------------------------------------
// SAVE (creates new assessment snapshot — assessments are immutable records)
// ---------------------------------------------------------------------------

export async function saveRiskAssessment(
  userId: string,
  data: RiskAssessmentInput,
  options?: { ipAddress?: string }
): Promise<string> {
  const supabase = getSupabase();

  // Insert base assessment
  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('risk_assessments')
    .insert({
      user_id: userId,
      overall_risk_score: data.overallRiskScore,
      genetic_disposition: data.geneticDisposition ?? null,
      lifestyle_impact: data.lifestyleImpact ?? null,
      medical_history_risk: data.medicalHistoryRisk ?? null,
      ai_insight_summary: data.aiInsightSummary ?? null,
      cardio_result: data.cardioResult ?? null,
      cancer_results: data.cancerResults ?? null,
    })
    .select('assessment_id')
    .single();

  if (assessmentError || !assessmentRow) {
    throw new Error(`[RiskAssessmentService] Failed to save assessment: ${assessmentError?.message}`);
  }

  const assessmentId = assessmentRow.assessment_id;

  // Insert risk factor contributions
  if (data.riskFactors && data.riskFactors.length > 0) {
    const factorRows = data.riskFactors.map((factor) => ({
      assessment_id: assessmentId,
      factor_name: factor.factorName,
      contribution_pct: factor.contributionPct,
    }));
    const { error: factorError } = await supabase
      .from('risk_factor_contributions')
      .insert(factorRows);

    if (factorError) {
      console.error('[RiskAssessmentService] Failed to insert factors:', factorError.message);
    }
  }

  // Insert health projection points
  if (data.projections && data.projections.length > 0) {
    const projectionRows = data.projections.map((point) => ({
      assessment_id: assessmentId,
      month_offset: point.monthOffset,
      predicted_score: point.predictedScore,
      baseline_score: point.baselineScore,
    }));
    const { error: projectionError } = await supabase
      .from('health_projections')
      .insert(projectionRows);

    if (projectionError) {
      console.error('[RiskAssessmentService] Failed to insert projections:', projectionError.message);
    }
  }

  await logChange({
    tableName: 'risk_assessments',
    recordId: assessmentId,
    operation: 'INSERT',
    changedByUserId: userId,
    newValues: { overallRiskScore: data.overallRiskScore },
    ipAddress: options?.ipAddress,
  });

  return assessmentId;
}

// ---------------------------------------------------------------------------
// GET — latest assessment with factors + projections
// ---------------------------------------------------------------------------

export async function getLatestAssessment(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<RiskAssessment | null> {
  const supabase = getSupabase();

  // Fetch latest assessment
  const { data: assessment, error: assessmentError } = await supabase
    .from('risk_assessments')
    .select('assessment_id, overall_risk_score, genetic_disposition, lifestyle_impact, medical_history_risk, ai_insight_summary, cardio_result, cancer_results, assessed_at')
    .eq('user_id', userId)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .single();

  if (assessmentError || !assessment) {
    if (assessmentError) {
      console.error('[RiskAssessmentService] getLatestAssessment error:', assessmentError.code, assessmentError.message);
    }
    return null;
  }

  // Fetch factors + projections in parallel
  const [factorsResult, projectionsResult] = await Promise.all([
    supabase
      .from('risk_factor_contributions')
      .select('factor_name, contribution_pct')
      .eq('assessment_id', assessment.assessment_id),

    supabase
      .from('health_projections')
      .select('month_offset, predicted_score, baseline_score')
      .eq('assessment_id', assessment.assessment_id)
      .order('month_offset', { ascending: true }),
  ]);

  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'risk_assessments',
    recordId: assessment.assessment_id,
    ipAddress: options?.ipAddress,
    purpose: 'Treatment',
  });

  return {
    assessmentId: assessment.assessment_id,
    userId,
    overallRiskScore: assessment.overall_risk_score,
    geneticDisposition: assessment.genetic_disposition,
    lifestyleImpact: assessment.lifestyle_impact,
    medicalHistoryRisk: assessment.medical_history_risk,
    aiInsightSummary: assessment.ai_insight_summary,
    cardioResult: assessment.cardio_result,
    cancerResults: assessment.cancer_results,
    assessedAt: assessment.assessed_at,
    riskFactors: (factorsResult.data ?? []).map((f) => ({
      factorName: f.factor_name,
      contributionPct: f.contribution_pct,
    })),
    projections: (projectionsResult.data ?? []).map((p) => ({
      monthOffset: p.month_offset,
      predictedScore: p.predicted_score,
      baselineScore: p.baseline_score,
    })),
  };
}

// ---------------------------------------------------------------------------
// GET history (list of assessments, no deep data)
// ---------------------------------------------------------------------------

export async function getAssessmentHistory(
  userId: string,
  options?: { requestedByUserId?: string; ipAddress?: string }
): Promise<Array<{ assessmentId: string; overallRiskScore: number; assessedAt: string }>> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('risk_assessments')
    .select('assessment_id, overall_risk_score, assessed_at')
    .eq('user_id', userId)
    .order('assessed_at', { ascending: false });

  if (error) {
    throw new Error(`[RiskAssessmentService] Failed to fetch history: ${error.message}`);
  }

  await logAccess({
    accessedByUserId: options?.requestedByUserId ?? userId,
    tableName: 'risk_assessments',
    ipAddress: options?.ipAddress,
    purpose: 'Treatment',
  });

  return (data ?? []).map((row) => ({
    assessmentId: row.assessment_id,
    overallRiskScore: row.overall_risk_score,
    assessedAt: row.assessed_at,
  }));
}
