import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    const classifierUrl = process.env.CLASSIFIER_API_URL;
    if (!classifierUrl) {
      console.error('[API /cancer/all] CLASSIFIER_API_URL is not configured');
      return NextResponse.json(
        { error: 'Classifier service is not configured' },
        { status: 503 },
      );
    }

    const cancerApiUrl = `${classifierUrl.replace(/\/predict\/?$/, '')}/cancer/all`;

    console.log('[API /cancer/all] Calling classifier at:', cancerApiUrl);

    let classifierResponse: Response;
    try {
      classifierResponse = await fetch(cancerApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (fetchErr) {
      console.error('[API /cancer/all] Classifier fetch failed:', fetchErr);
      return NextResponse.json(
        { error: 'Unable to reach the classifier service' },
        { status: 502 },
      );
    }

    if (!classifierResponse.ok) {
      const errBody = await classifierResponse.text().catch(() => '');
      console.error(
        `[API /cancer/all] Classifier returned ${classifierResponse.status}:`,
        errBody,
      );
      return NextResponse.json(
        { error: 'Classifier returned an error', upstream_status: classifierResponse.status },
        { status: 502 },
      );
    }

    const data = await classifierResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[API /cancer/all] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
