import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // Check if logged today and get all history
    const { data: todayLogs, error: todayErr } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false });

    if (todayErr) throw todayErr;

    const todayDate = new Date();
    let loggedThisWeek = false;
    let streak = 0;

    if (todayLogs && todayLogs.length > 0) {
      const lastLogDate = new Date(todayLogs[0].log_date);
      const diffDays = (todayDate.getTime() - lastLogDate.getTime()) / (1000 * 3600 * 24);
      loggedThisWeek = diffDays < 7;

      streak = 1;
      for (let i = 0; i < todayLogs.length - 1; i++) {
        const d1 = new Date(todayLogs[i].log_date).getTime();
        const d2 = new Date(todayLogs[i+1].log_date).getTime();
        const diff = (d1 - d2) / (1000 * 3600 * 24);
        
        // As long as the gap between logs is less than or equal to 14 days, the streak continues
        if (diff > 0 && diff <= 14) {
          streak++;
        } else {
          break;
        }
      }
    }

    return NextResponse.json({ 
      logs: todayLogs,
      loggedToday: loggedThisWeek, // Kept the key name for frontend compatibility
      streak
    });
  } catch (error: any) {
    console.error('API /daily-logs GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...logFields } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Enforcement: Check if logged within 7 days
    const { data: recentLogs } = await supabase
      .from('daily_logs')
      .select('log_date')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      const lastDate = new Date(recentLogs[0].log_date);
      const now = new Date();
      if ((now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24) < 7) {
        return NextResponse.json({ error: 'Already logged this week' }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from('daily_logs')
      .insert({
        user_id: userId,
        log_date: new Date().toISOString().split('T')[0],
        ...logFields
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already logged this week' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, log: data });
  } catch (error: any) {
    console.error('API /daily-logs POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
