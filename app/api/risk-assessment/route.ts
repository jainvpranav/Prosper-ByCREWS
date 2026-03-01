/**
 * app/api/risk-assessment/route.ts
 *
 * GET  /api/risk-assessment?userId=<id>   — fetch latest assessment + projections
 * GET  /api/risk-assessment?userId=<id>&history=true — fetch assessment history list
 * POST /api/risk-assessment               — save a new assessment snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestAssessment,
  getAssessmentHistory,
  saveRiskAssessment,
} from '@/lib/riskAssessmentService';

export async function GET(req: NextRequest) {
  try {
    const userId  = req.nextUrl.searchParams.get('userId');
    const history = req.nextUrl.searchParams.get('history') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') ?? undefined;

    if (history) {
      const assessments = await getAssessmentHistory(userId, {
        requestedByUserId: userId,
        ipAddress: ip,
      });
      return NextResponse.json({ assessments });
    }

    const assessment = await getLatestAssessment(userId, {
      requestedByUserId: userId,
      ipAddress: ip,
    });

    if (!assessment) {
      return NextResponse.json({ assessment: null }, { status: 200 });
    }

    return NextResponse.json({ assessment });
  } catch (err) {
    console.error('[API /risk-assessment GET]', err);
    return NextResponse.json({ error: 'Failed to fetch assessment' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...assessmentData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const assessmentId = await saveRiskAssessment(userId, assessmentData, {
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json({ success: true, assessmentId }, { status: 201 });
  } catch (err) {
    console.error('[API /risk-assessment POST]', err);
    return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 });
  }
}
