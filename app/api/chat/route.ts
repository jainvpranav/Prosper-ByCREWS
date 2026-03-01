import { NextRequest, NextResponse } from 'next/server';
import aws4 from 'aws4';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const endpoint = process.env.NEXT_PUBLIC_CHAT_API_URL;
    
    if (!endpoint) {
      return NextResponse.json({ error: 'Chat API URL not configured' }, { status: 500 });
    }

    const url = new URL(endpoint);
    const host = url.hostname;
    const path = url.pathname;

    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    };

    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      return NextResponse.json({ error: 'AWS Credentials not configured' }, { status: 500 });
    }

    const opts: aws4.Request = {
      host,
      path,
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      service: 'execute-api',
      region: process.env.AWS_REGION || 'ap-south-1',
    };

    // Sign the request
    aws4.sign(opts, credentials);

    const response = await fetch(endpoint, {
      method: opts.method,
      headers: opts.headers as HeadersInit,
      body: opts.body as BodyInit,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('AWS API Error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Chat Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
