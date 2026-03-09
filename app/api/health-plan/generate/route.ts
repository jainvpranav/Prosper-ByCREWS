import { NextRequest, NextResponse } from 'next/server';
import aws4 from 'aws4';
import { getProfileByUser } from '@/lib/profileService';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    // Validate request
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const endpoint = process.env.NEXT_PUBLIC_CHAT_API_URL;
    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    };

    // If AWS isn't fully configured, return the polished mock payload
    if (!endpoint || !credentials.accessKeyId || !credentials.secretAccessKey) {
      await new Promise(r => setTimeout(r, 2000));
      const mockAiPlan = {
        aiPlan: `Based on your recent daily logs and clinical data, here is your synthesized daily plan:\n\n### ☀️ Morning Routine\n- **Hydration Kickstart**: Drink 1 large glass (16oz) of water immediately.\n- **Heart-Healthy Breakfast**: Swap processed cereals for oatmeal.\n- **Medication Compliance**: Take your BP medication with food at 8:30 AM.\n\n### 🏃‍♂️ Midday Activity\n- **Movement Snack**: Break up sedentary blocks. Keep moving.\n\n### 🌙 Evening Wind-down\n- **Sleep Hygiene**: Disconnect from screens by 10 PM.`,
        exercise: {
          targetMinutes: 90,
          targetIntensity: "Low to Moderate",
          strengthDays: 1,
          schedule: [
            { days: "Mon / Wed", activity: "20 min light walking" },
            { days: "Tue / Thu", activity: "15 min mobility and stretching" },
            { days: "Fri / Sun", activity: "Rest and recovery" },
            { days: "Saturday", activity: "20 min continuous light cardio" }
          ]
        },
        diet: {
          focus: "Heart-Healthy & Low Sodium",
          foodsToEncourage: ["Oats", "Berries", "Salmon", "Leafy greens"],
          foodsToLimit: ["Processed meats", "High-sodium snacks", "Refined carbs"],
          sodiumTarget: "< 1,500 mg",
          calorieTarget: "Mild Deficit"
        }
      };

      return NextResponse.json({ success: true, plan: mockAiPlan });
    }

    // Call Real Bedrock AI
    const url = new URL(endpoint);
    const host = url.hostname;
    const path = url.pathname;

    const userProfile = await getProfileByUser(userId);

    const systemPrompt = `You are a medical AI assistant. The user needs a highly personalized daily health plan. Output ONLY a valid JSON object with the following structure. Do not wrap in markdown \`\`\`json block.
{
  "aiPlan": "Markdown string containing 3 headers (### ☀️ Morning Routine, ### 🏃‍♂️ Midday Activity, ### 🌙 Evening Wind-down) with actionable advice based on their profile.",
  "exercise": {
    "targetMinutes": <number>,
    "targetIntensity": "<string>",
    "strengthDays": <number>,
    "schedule": [
      { "days": "Mon / Wed", "activity": "<string>" },
      { "days": "Tue / Thu", "activity": "<string>" },
      { "days": "Fri / Sun", "activity": "<string>" },
      { "days": "Saturday", "activity": "<string>" }
    ]
  },
  "diet": {
    "focus": "<string>",
    "foodsToEncourage": ["<string>"],
    "foodsToLimit": ["<string>"],
    "sodiumTarget": "<string>",
    "calorieTarget": "<string>"
  }
}
Base all targets, minutes, and advice strictly on their provided profile data. For instance, high BMI might need more focus but start slow; high resting HR needs low to moderate intensity.`;

    const enrichedBody = {
      inputText: systemPrompt,
      userId: userId,
      userContext: userProfile ? {
        age: userProfile.age,
        gender: userProfile.gender,
        activityLevel: userProfile.activityLevel,
        familyHistory: userProfile.familyHistory,
        medicalConditions: userProfile.medical?.conditions,
        medications: userProfile.medical?.medications,
        allergies: userProfile.medical?.allergies,
        diet: userProfile.diet,
        lifestyle: userProfile.lifestyle,
        smoker: userProfile.smoker,
        hypertension: userProfile.hypertension,
        diabetes: userProfile.diabetes
      } : {}
    };

    const opts: aws4.Request = {
      host,
      path,
      method: 'POST',
      body: JSON.stringify(enrichedBody),
      headers: {
        'Content-Type': 'application/json',
      },
      service: 'execute-api',
      region: process.env.AWS_REGION || 'ap-south-1',
    };

    // Sign the request mapped to API Gateway
    aws4.sign(opts, credentials);

    const response = await fetch(endpoint, {
      method: opts.method,
      headers: opts.headers as HeadersInit,
      body: opts.body as BodyInit,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('AWS API Error:', data);
      throw new Error('Bedrock backend rejected the prompt.');
    }

    const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    const aiText = parsed.response || parsed.message || "Failed to generate.";
    
    let planData;
    try {
      // try to extract JSON if it was wrapped in a markdown block despite instructions
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : aiText;
      planData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', aiText);
      planData = { aiPlan: aiText };
    }

    return NextResponse.json({ success: true, plan: planData });

  } catch (error: any) {
    console.error('API /health-plan/generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate plan securely.' }, { status: 500 });
  }
}
