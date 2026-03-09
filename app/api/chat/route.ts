import { NextRequest, NextResponse } from "next/server";
import aws4 from "aws4";
import { getProfileByUser } from "@/lib/profileService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(body, "This is the body");
    const endpoint = process.env.NEXT_PUBLIC_CHAT_API_URL;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Chat API URL not configured" },
        { status: 500 },
      );
    }

    const url = new URL(endpoint);
    const host = url.hostname;
    const path = url.pathname;

    const credentials = {
      accessKeyId: process.env.ACCESS_KEY_ID || "",
      secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
    };

    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      return NextResponse.json(
        { error: "AWS Credentials not configured" },
        { status: 500 },
      );
    }

    // Attempt to enrich prompt with user data if userId is in the body
    let enrichedBody = { ...body };
    if (body.userId) {
      const userProfile = await getProfileByUser(body.userId);
      if (userProfile) {
        enrichedBody = {
          ...body,
          userContext: {
            age: userProfile.age,
            gender: userProfile.gender,
            activityLevel: userProfile.activityLevel,
            familyHistory: userProfile.familyHistory,
            medicalConditions: userProfile.medical?.conditions,
            medications: userProfile.medical?.medications,
            allergies: userProfile.medical?.allergies,
            diet: userProfile.diet,
            lifestyle: userProfile.lifestyle,
          },
        };
      }
    }

    console.log(enrichedBody, "This is the enriched body");

    const opts: aws4.Request = {
      host,
      path,
      method: "POST",
      body: JSON.stringify(enrichedBody),
      headers: {
        "Content-Type": "application/json",
      },
      service: "execute-api",
      region: process.env.REGION || "ap-south-1",
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
      console.error("AWS API Error:", data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Chat Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
