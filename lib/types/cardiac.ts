/**
 * lib/types/cardiac.ts
 * Shared TypeScript interfaces for the cardiac risk classifier.
 *
 * The 14 input features mirror the Python HealthInput schema exactly
 * (see classifiers/src/server.py — HealthInput pydantic model).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod validation schema — runtime input validation
// ---------------------------------------------------------------------------

export const cardiacPredictSchema = z.object({
  // Demographics
  age: z.number().int().min(1).max(120),
  gender: z.enum(['Male', 'Female']),
  bmi: z.number().min(10).max(80),

  // Clinical — optional, imputed with training median if missing
  resting_hr: z.number().min(30).max(220).nullable().optional(),
  systolic_bp: z.number().min(60).max(250).nullable().optional(),
  diastolic_bp: z.number().min(40).max(150).nullable().optional(),
  cholesterol: z.number().min(50).max(600).nullable().optional(),
  glucose: z.number().min(40).max(500).nullable().optional(),

  // Lifestyle
  smoker: z.number().int().min(0).max(1),
  cigsperday: z.number().min(0).max(100).nullable().optional(),

  // Medical history
  hypertension: z.number().int().min(0).max(1),
  diabetes: z.number().int().min(0).max(1),
  bp_medication: z.number().int().min(0).max(1),
  prev_stroke: z.number().int().min(0).max(1),
});

// ---------------------------------------------------------------------------
// TypeScript types derived from Zod schema
// ---------------------------------------------------------------------------

/** 14-feature input accepted by the classifier */
export type CardiacPredictRequest = z.infer<typeof cardiacPredictSchema>;

/** Single risk-driving factor returned by SHAP */
export interface RiskFactor {
  feature: string;
  impact: number;
  direction: 'increases_risk' | 'decreases_risk';
}

/** Structured response from the /api/predict route */
export interface CardiacPredictResponse {
  risk_score: number;        // 0–1 probability
  risk_band: 'Low' | 'Medium' | 'High';
  at_risk: boolean;
  threshold_used: number;
  top_factors: RiskFactor[];
  recommendations: string[];
}

/** Raw response shape from the Python classifier endpoint */
export interface ClassifierRawResponse {
  risk_probability: number;
  risk_category: 'Low' | 'Medium' | 'High';
  at_risk: boolean;
  threshold_used: number;
  top_factors: RiskFactor[];
}
