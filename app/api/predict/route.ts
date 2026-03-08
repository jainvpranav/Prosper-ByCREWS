/**
 * app/api/predict/route.ts
 * POST /api/predict — Cardiac risk prediction endpoint
 *
 * Accepts 14 health features, validates with Zod, proxies to the
 * deployed FastAPI classifier (Lambda), and returns a structured response
 * with risk score, risk band, and personalised recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  cardiacPredictSchema,
  type ClassifierRawResponse,
  type CardiacPredictResponse,
  type RiskFactor,
} from '@/lib/types/cardiac';

// ---------------------------------------------------------------------------
// Recommendation generator — maps risk band + top factors to actionable advice
// ---------------------------------------------------------------------------

function generateRecommendations(
  riskBand: string,
  topFactors: RiskFactor[]
): string[] {
  const recommendations: string[] = [];

  // Universal recommendations by risk band
  if (riskBand === 'High') {
    recommendations.push(
      'Schedule an appointment with your cardiologist as soon as possible.',
      'Consider a comprehensive cardiac stress test.',
    );
  } else if (riskBand === 'Medium') {
    recommendations.push(
      'Schedule a routine check-up with your primary care physician.',
      'Monitor your blood pressure and cholesterol levels regularly.',
    );
  } else {
    recommendations.push(
      'Continue your healthy lifestyle habits.',
      'Maintain regular annual health screenings.',
    );
  }

  // Factor-specific recommendations
  const factorNames = topFactors.map((f) => f.feature);

  if (factorNames.includes('systolic_bp') || factorNames.includes('diastolic_bp') || factorNames.includes('hypertension')) {
    recommendations.push('Monitor blood pressure daily and consider dietary sodium reduction.');
  }
  if (factorNames.includes('cholesterol')) {
    recommendations.push('Consider a lipid panel test and discuss statin therapy with your doctor.');
  }
  if (factorNames.includes('glucose') || factorNames.includes('diabetes')) {
    recommendations.push('Monitor blood glucose levels and maintain a balanced diet low in refined sugars.');
  }
  if (factorNames.includes('bmi')) {
    recommendations.push('Aim for 150 minutes of moderate aerobic exercise per week.');
  }
  if (factorNames.includes('smoker') || factorNames.includes('cigsperday')) {
    recommendations.push('Consider a smoking cessation program — quitting significantly reduces cardiac risk.');
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    // 2. Validate with Zod
    const parsed = cardiacPredictSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // 3. Resolve classifier URL
    const classifierUrl = process.env.CLASSIFIER_API_URL;
    if (!classifierUrl) {
      console.error('[API /predict] CLASSIFIER_API_URL is not configured');
      return NextResponse.json(
        { error: 'Classifier service is not configured' },
        { status: 503 },
      );
    }

    console.log('[API /predict] Calling classifier at:', classifierUrl);

    // 4. Call the deployed FastAPI classifier
    let classifierResponse: Response;
    try {
      classifierResponse = await fetch(classifierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
    } catch (fetchErr) {
      console.error('[API /predict] Classifier fetch failed:', fetchErr);
      return NextResponse.json(
        { error: 'Unable to reach the classifier service' },
        { status: 502 },
      );
    }

    if (!classifierResponse.ok) {
      const errBody = await classifierResponse.text().catch(() => '');
      console.error(
        `[API /predict] Classifier returned ${classifierResponse.status}:`,
        errBody,
      );
      return NextResponse.json(
        { error: 'Classifier returned an error', upstream_status: classifierResponse.status },
        { status: 502 },
      );
    }

    // 5. Parse classifier response
    const raw: ClassifierRawResponse = await classifierResponse.json();

    // 6. Generate recommendations
    const recommendations = generateRecommendations(
      raw.risk_category,
      raw.top_factors,
    );

    // 7. Build structured response
    const response: CardiacPredictResponse = {
      risk_score: raw.risk_probability,
      risk_band: raw.risk_category,
      at_risk: raw.at_risk,
      threshold_used: raw.threshold_used,
      top_factors: raw.top_factors,
      recommendations,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[API /predict] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
