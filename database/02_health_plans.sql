-- =============================================================================
-- Migration: Add Daily Logs, Test Records, and Update Appointments
-- Description: Supports the Personalized Health Plans feature.
-- =============================================================================

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

-- 3. Alter appointments table to support new booking features
-- We add columns without dropping the existing ones to prevent breaking other UI.
alter table public.appointments 
    add column if not exists appointment_type varchar(50) null default 'Regular Check-up',
    add column if not exists booking_mode varchar(50) null default 'In-person',
    add column if not exists doctor_type varchar(100) null;

-- Make existing location columns nullable since urgent/telehealth might not have them initially
alter table public.appointments alter column location_name drop not null;

-- =============================================================================
-- DUMMY DATA SEEDING (Optional)
-- Seeds 30 days of data for the first user found in the system
-- =============================================================================
DO $$
DECLARE
  v_user_id uuid;
  i int;
  v_date date;
  v_weight numeric;
  v_sleep numeric;
  v_stress int;
  v_steps int;
BEGIN
  -- Target the specific user ID provided
  v_user_id := '643f509e-e922-403d-8524-095832345fe5'::uuid;

  IF v_user_id IS NOT NULL THEN
    
    -- Generate 30 days of daily logs (historical)
    FOR i IN 0..30 LOOP
      v_date := current_date - i;
      v_weight := 75.0 - (i * 0.05); -- Gradually sloped
      v_sleep := 6.0 + random() * 2.5; -- 6 to 8.5
      v_stress := floor(random() * 5 + 3); -- 3 to 7
      v_steps := floor(random() * 5000 + 4000); -- 4000 to 9000
      
      INSERT INTO public.daily_logs (
        user_id, log_date, weight_kg, sleep_hours, stress_level, 
        meals_eaten, water_glasses, cigarettes_smoked, alcohol_units, 
        steps, exercise_mins, symptoms
      ) VALUES (
        v_user_id, v_date, v_weight, v_sleep, v_stress, 
        3, 6, 2, 1, 
        v_steps, 30, 'Feeling okay'
      ) ON CONFLICT (user_id, log_date) DO NOTHING;
    END LOOP;

    -- Generate a few test records
    INSERT INTO public.test_records (user_id, test_type, tested_date, next_due, status)
    VALUES 
      (v_user_id, 'Blood Pressure Check', current_date - 15, current_date + 15, 'OK'),
      (v_user_id, 'Cholesterol Panel', current_date - 120, current_date - 5, 'Overdue'),
      (v_user_id, 'BMI Check', current_date - 30, current_date + 2, 'Due Soon');

  END IF;
END $$;
