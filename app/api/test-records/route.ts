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
    const { data, error } = await supabase
      .from('test_records')
      .select('*')
      .eq('user_id', userId)
      .order('next_due', { ascending: true });

    if (error) throw error;
    
    // Auto-update statuses based on today's date
    const today = new Date();
    const records = data.map(record => {
      if (record.status === 'Completed') return record;
      const nextDue = new Date(record.next_due);
      if (nextDue < today) {
        return { ...record, status: 'Overdue' };
      } else if (nextDue.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000) {
        return { ...record, status: 'Due Soon' };
      }
      return { ...record, status: 'OK' };
    });

    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, type, action, recordId, nextDueOffsetDays } = await req.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (action === 'complete') {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + (nextDueOffsetDays ?? 30));

      if (recordId) {
        // Update existing
        const { error } = await supabase
          .from('test_records')
          .update({
            tested_date: new Date().toISOString().split('T')[0],
            next_due: nextDate.toISOString().split('T')[0],
            status: 'OK'
          })
          .eq('test_id', recordId);
        if (error) throw error;
      } else if (type) {
        // Create new
        const { error } = await supabase
          .from('test_records')
          .insert({
            user_id: userId,
            test_type: type,
            tested_date: new Date().toISOString().split('T')[0],
            next_due: nextDate.toISOString().split('T')[0],
            status: 'OK'
          });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
