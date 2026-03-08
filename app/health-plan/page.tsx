/*
================================================================================
SUPABASE MIGRATION REQUIRED: Health Plans & Daily Logs

Run the following SQL in your Supabase SQL Editor carefully to prepare your DB.

```sql
-- 1. Create daily_logs table
create table if not exists public.daily_logs (
    log_id           uuid            primary key default gen_random_uuid(),
    user_id          uuid            not null references public.users(user_id) on delete cascade,
    log_date         date            not null default current_date,
    weight_kg        numeric(5,1)    null,
    sleep_hours      numeric(3,1)    null,
    stress_level     smallint        null check (stress_level between 1 and 10),
    meals_eaten      smallint        null,
    water_glasses    smallint        null,
    cigarettes_smoked smallint       null,
    alcohol_units    smallint        null,
    steps            integer         null,
    exercise_mins    smallint        null,
    symptoms         text            null,
    created_at       timestamptz     not null default now(),
    modified_at      timestamptz     not null default now(),
    
    constraint uq_daily_logs_user_date unique (user_id, log_date)
);

create index if not exists ix_daily_logs_user_date on public.daily_logs (user_id, log_date desc);
alter table public.daily_logs enable row level security;
create policy "Allow all for service role" on public.daily_logs for all using (true) with check (true);

-- 2. Create test_records table
create table if not exists public.test_records (
    test_id          uuid            primary key default gen_random_uuid(),
    user_id          uuid            not null references public.users(user_id) on delete cascade,
    test_type        varchar(100)    not null,
    tested_date      date            null,
    next_due         date            null,
    status           varchar(50)     not null default 'Due Soon' check (status in ('Overdue', 'Due Soon', 'OK', 'Completed')),
    created_at       timestamptz     not null default now(),
    modified_at      timestamptz     not null default now()
);

create index if not exists ix_test_records_user on public.test_records (user_id);
alter table public.test_records enable row level security;
create policy "Allow all for service role" on public.test_records for all using (true) with check (true);

-- 3. Alter existing appointments table
-- Modifying rather than dropping so we don't destroy your hospital coordinates.
alter table public.appointments 
    add column if not exists appointment_type varchar(50) null default 'Regular Check-up',
    add column if not exists booking_mode varchar(50) null default 'In-person',
    add column if not exists doctor_type varchar(100) null;

alter table public.appointments alter column location_name drop not null;
```
================================================================================
*/

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { FloatingChat } from '@/components/FloatingChat';
import { Activity, Calendar, FileText, Heart, Shield, TrendingUp, Loader2 } from 'lucide-react';

import { DailyLogForm } from '@/components/health-plan/DailyLogForm';
import { HealthPlanCards } from '@/components/health-plan/HealthPlanCards';
import { MetricsTracker } from '@/components/health-plan/MetricsTracker';
import { ProgressCharts } from '@/components/health-plan/ProgressCharts';
import { InsurancePlans } from '@/components/health-plan/InsurancePlans';
import { AppointmentBooking } from '@/components/health-plan/AppointmentBooking';

const TABS = [
  { id: 'daily-log', label: 'Weekly Log', icon: FileText },
  { id: 'health-plan', label: 'Health Plans', icon: Heart },
  { id: 'metrics', label: 'Metrics', icon: Activity },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'insurance', label: 'Insurance', icon: Shield },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
] as const;

type TabId = typeof TABS[number]['id'];

export default function HealthPlanPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('daily-log');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <FloatingChat />

      <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">My Health Plan</h1>
          <p className="text-muted-foreground">Manage your daily habits, medical screenings, and specialized health plans.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 border-b border-border pb-px mb-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  isActive 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="min-h-[500px]">
          {activeTab === 'daily-log' && (
            <div className="animate-in fade-in duration-300">
              <DailyLogForm />
            </div>
          )}

          {activeTab === 'health-plan' && (
            <div className="animate-in fade-in duration-300">
              <HealthPlanCards />
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="animate-in fade-in duration-300">
              <MetricsTracker />
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="animate-in fade-in duration-300">
              <ProgressCharts />
            </div>
          )}

          {activeTab === 'insurance' && (
            <div className="animate-in fade-in duration-300">
              <InsurancePlans />
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="animate-in fade-in duration-300">
              <AppointmentBooking />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
