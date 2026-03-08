/**
 * app/api/profile/route.ts
 * Server-side API route — bridges the 'use client' profile form to profileService
 *
 * GET  /api/profile?userId=<id>  — fetch a user's full profile
 * POST /api/profile              — upsert profile + auto-generate risk assessment
 */

import { NextRequest, NextResponse } from 'next/server';
import { upsertProfile, getProfileByUser } from '@/lib/profileService';
import { saveRiskAssessment } from '@/lib/riskAssessmentService';

// GET /api/profile?userId=<uuid>
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
    }

    const profile = await getProfileByUser(userId, {
      requestedByUserId: userId,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
      purpose: 'Treatment',
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[API /profile GET]', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// POST /api/profile
// Body: { userId: string, ...ProfileInput }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...profileData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required in request body' }, { status: 400 });
    }

    const profileId = await upsertProfile(userId, profileData, {
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    // After profile save, auto-generate risk assessment using the classifier
    let assessmentId: string | null = null;
    try {
      assessmentId = await generateRiskAssessment(userId, profileData);
      console.log('[API /profile POST] Risk assessment generated:', assessmentId);
    } catch (raErr) {
      // Non-blocking — profile save still succeeds
      console.error('[API /profile POST] Risk assessment generation failed:', raErr);
    }

    return NextResponse.json({ success: true, profileId, assessmentId }, { status: 200 });
  } catch (err) {
    console.error('[API /profile POST]', err);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}

/**
 * Derive classifier inputs from profile data, call the ML classifier,
 * and save the result as a risk assessment.
 */
async function generateRiskAssessment(
  userId: string,
  profileData: Record<string, unknown>,
): Promise<string> {
  const classifierUrl = process.env.CLASSIFIER_API_URL;
  if (!classifierUrl) {
    throw new Error('CLASSIFIER_API_URL not configured');
  }

  // Map profile form fields → classifier input features
  const age = Number(profileData.age) || 30;
  const gender = String(profileData.gender ?? 'Male');
  const smoking = String(profileData.smoking ?? 'Never');
  const familyHistory = Array.isArray(profileData.familyHistory) ? profileData.familyHistory : [];

  const classifierInput = {
    age,
    bmi: 25, // default if not collected
    resting_hr: 72,
    systolic_bp: 120,
    diastolic_bp: 80,
    cholesterol: 200,
    glucose: 100,
    cigsperday: smoking === 'Current' ? 10 : 0,
    gender,
    smoker: smoking === 'Current' ? 1 : 0,
    hypertension: familyHistory.includes('Hypertension') ? 1 : 0,
    diabetes: familyHistory.includes('Diabetes') ? 1 : 0,
    bp_medication: 0,
    prev_stroke: familyHistory.includes('Stroke') ? 1 : 0,
  };

  const res = await fetch(classifierUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(classifierInput),
  });

  if (!res.ok) {
    throw new Error(`Classifier returned ${res.status}`);
  }

  const prediction = await res.json();
  const riskScore = Math.round((prediction.risk_probability ?? 0.5) * 100);

  // Derive disposition labels from profile data
  const hasCardiacFamily = familyHistory.includes('Heart Disease') || familyHistory.includes('Stroke');
  const geneticDisposition = hasCardiacFamily ? 'High' : familyHistory.length > 0 ? 'Moderate' : 'Low';
  
  const activityLevel = String(profileData.activityLevel ?? 'Moderate');
  const lifestyleImpact = smoking === 'Current' ? 'Critical' :
    activityLevel === 'Sedentary' ? 'Critical' :
    activityLevel === 'Light' ? 'Moderate' : 'Low';

  const conditions = String(profileData.conditions ?? '');
  const medicalHistoryRisk = conditions.length > 10 ? 'Moderate' : 'Low Risk';

  // Build top factors from classifier SHAP values
  const topFactors = (prediction.top_factors ?? []).slice(0, 4).map(
    (f: { feature: string; impact: number }) => ({
      factorName: f.feature.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      contributionPct: Math.min(Math.round(Math.abs(f.impact) * 100), 100),
    })
  );

  // Generate 6-month projection (simple linear improvement model)
  const projections = Array.from({ length: 7 }, (_, i) => ({
    monthOffset: i,
    predictedScore: Math.max(Math.round(riskScore * (1 - i * 0.06)), 10),
    baselineScore: riskScore,
  }));

  // Build AI insight from classifier result
  const riskCategory = prediction.risk_category ?? 'Unknown';
  const aiInsight = `Based on your health profile, your cardiac risk is ${riskCategory} (${riskScore}%). ` +
    (riskScore > 50
      ? 'Significant improvements can be achieved through lifestyle modifications including increased physical activity, dietary changes, and regular monitoring.'
      : 'Your risk factors are manageable. Maintain your current healthy habits and schedule regular checkups to stay on track.');

  return saveRiskAssessment(userId, {
    overallRiskScore: riskScore,
    geneticDisposition,
    lifestyleImpact,
    medicalHistoryRisk,
    aiInsightSummary: aiInsight,
    riskFactors: topFactors.length > 0 ? topFactors : [
      { factorName: 'Age', contributionPct: 30 },
      { factorName: 'Family History', contributionPct: 25 },
      { factorName: 'Lifestyle', contributionPct: 25 },
      { factorName: 'Vitals', contributionPct: 20 },
    ],
    projections,
  }, { ipAddress: undefined });
}
