import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing config!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test(userId: string) {
  console.log(`Checking DB for userId: ${userId}`);

  // Check user profile
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId);
  
  if (profileErr) console.error("Profile Error:", profileErr.message);
  else console.log("Profile Count:", profile?.length);

  // Check risk_assessments
  const { data: assessment, error: assessmentError } = await supabase
    .from('risk_assessments')
    .select('*')
    .eq('user_id', userId)
    .order('assessed_at', { ascending: false })
    .limit(1);

  if (assessmentError) {
    console.error("Assessment Fetch Error:", assessmentError.message, assessmentError.code);
  } else {
    console.log("Assessment Record:", assessment);
  }
}

test('91c3cbf6-e3c1-4cc0-8418-f31ba51a75a4').catch(console.error);
