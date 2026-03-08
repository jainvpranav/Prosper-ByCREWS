-- =============================================================================
-- PROSPER HEALTH PLATFORM — INCREMENTAL MIGRATION
-- Questionnaire Schema Update (v2)
-- Target: Supabase Dashboard → SQL Editor
--
-- What this migration does:
--   1. Adds four new columns to public.user_profiles:
--        height_cm, weight_kg, bmi, skin_type
--      (collected in Q3 and Q4 of the onboarding questionnaire)
--
--   2. Creates public.health_questionnaire table:
--      Stores every field from Q5–Q17 of the onboarding questionnaire,
--      exactly matching the payloads sent to /predict (cardiovascular) and
--      /cancer/all (cancer risk) ML API endpoints.
--
-- Safe to run on an existing Supabase instance:
--   - Uses ALTER TABLE … ADD COLUMN IF NOT EXISTS
--   - Uses CREATE TABLE IF NOT EXISTS
--   - Uses CREATE POLICY IF NOT EXISTS (via DO block)
-- =============================================================================

-- =============================================================================
-- STEP 1 — Extend public.user_profiles with Q3/Q4 fields
-- =============================================================================

alter table public.user_profiles
    add column if not exists height_cm   smallint         null check (height_cm between 80 and 250),
    add column if not exists weight_kg   numeric(5,1)     null check (weight_kg between 20 and 300),
    add column if not exists bmi         numeric(4,1)     null check (bmi between 5 and 100),
    add column if not exists skin_type   smallint         null check (skin_type between 1 and 6);

comment on column public.user_profiles.height_cm  is 'Q3 — Height in centimetres';
comment on column public.user_profiles.weight_kg  is 'Q3 — Weight in kilograms';
comment on column public.user_profiles.bmi        is 'Q3 — Body Mass Index (derived: weight_kg / (height_m)^2)';
comment on column public.user_profiles.skin_type  is 'Q4 — Fitzpatrick skin phototype (1=Very fair … 6=Dark)';

-- =============================================================================
-- STEP 2 — Create public.health_questionnaire
-- One row per user. Stores ALL fields from Q5–Q17 of the health assessment.
-- Fields mirror the exact payloads sent to the /predict and /cancer/all APIs.
-- =============================================================================

create table if not exists public.health_questionnaire (
    questionnaire_id     uuid            primary key default gen_random_uuid(),
    user_id              uuid            not null references public.users(user_id) on delete cascade,

    -- -------------------------------------------------------------------------
    -- SECTION 2 — HEART HEALTH (Q5–Q9)  → sent to /predict
    -- -------------------------------------------------------------------------

    -- Q5: Smoking
    smoker               smallint        null check (smoker in (0, 1)),
    cigsperday           smallint        null check (cigsperday >= 0),

    -- Q6: Blood pressure / hypertension
    hypertension         smallint        null check (hypertension in (0, 1)),
    bp_medication        smallint        null check (bp_medication in (0, 1)),

    -- Q7: Pre-existing conditions
    diabetes             smallint        null check (diabetes in (0, 1)),
    prev_stroke          smallint        null check (prev_stroke in (0, 1)),

    -- Q8: Blood pressure readings (optional)
    bp_knowledge         varchar(10)     null check (bp_knowledge in ('yes', 'no', 'unknown')),
    systolic_bp          smallint        null check (systolic_bp between 60 and 250),
    diastolic_bp         smallint        null check (diastolic_bp between 40 and 150),

    -- Q9: Blood test values (all optional)
    cholesterol          smallint        null check (cholesterol between 50 and 600),
    glucose              smallint        null check (glucose between 40 and 500),
    resting_hr           smallint        null check (resting_hr between 30 and 220),

    -- -------------------------------------------------------------------------
    -- SECTION 3 — CANCER SHARED (Q10–Q14)  → sent to /cancer/all
    -- -------------------------------------------------------------------------

    -- Q10: Sun/skin exposure (three toggles)
    uv_exposure_high     boolean         not null default false,
    sunburn_history      boolean         not null default false,
    geography_high_uv    boolean         not null default false,

    -- Q11: Family cancer history (gender-gated in UI, stored regardless)
    family_history_breast    boolean     not null default false,   -- female
    family_history_ovarian   boolean     not null default false,   -- female
    family_history_prostate  boolean     not null default false,   -- male
    family_history_skin      boolean     not null default false,   -- both
    family_history_blood     boolean     not null default false,   -- both
    family_history_brca2     boolean     not null default false,   -- male

    -- Q12: Prior medical history
    prior_chemotherapy   boolean         not null default false,
    prior_radiation      boolean         not null default false,
    prior_skin_cancer    boolean         not null default false,
    immunosuppressed     boolean         not null default false,

    -- Q13: Blood cancer symptoms (set 1)
    persistent_fatigue          boolean not null default false,
    unexplained_weight_loss     boolean not null default false,
    night_sweats                boolean not null default false,

    -- Q14: Blood cancer symptoms (set 2)
    frequent_infections         boolean not null default false,
    easy_bruising_bleeding      boolean not null default false,
    swollen_lymph_nodes         boolean not null default false,

    -- -------------------------------------------------------------------------
    -- SECTION 4A — FEMALE ONLY (F_Q15–F_Q17)
    -- -------------------------------------------------------------------------

    -- F_Q15: BRCA gene mutation knowledge
    brca_known           boolean         null,   -- null = question not reached / not applicable

    -- F_Q16: Menopause status and HRT
    menopause            boolean         null,
    hrt_use              boolean         null,

    -- -------------------------------------------------------------------------
    -- SECTION 4B — MALE ONLY (M_Q15–M_Q17)
    -- -------------------------------------------------------------------------

    -- M_Q15: Prostate risk factors
    race_high_risk       boolean         null,   -- African/Caribbean/African-American descent
    urinary_symptoms     boolean         null,
    diet_high_red_meat   boolean         null,

    -- M_Q16: PSA test result
    psa_known            numeric(6,2)    null check (psa_known >= 0),

    -- -------------------------------------------------------------------------
    -- SECTION 4 SHARED — LIFESTYLE (F_Q17 / M_Q17)
    -- -------------------------------------------------------------------------

    alcohol_weekly_units smallint        null check (alcohol_weekly_units >= 0),
    activity_choice      varchar(20)     null check (activity_choice in ('active', 'somewhat', 'low', 'sedentary')),

    -- -------------------------------------------------------------------------
    -- DERIVED FIELDS (computed by app layer before storage)
    -- -------------------------------------------------------------------------

    physical_activity_low boolean        null,   -- true when activity_choice in ('low','sedentary')
    obesity               boolean        null,   -- true when bmi >= 30 (from user_profiles.bmi)

    -- -------------------------------------------------------------------------
    -- Metadata
    -- -------------------------------------------------------------------------

    completed_at         timestamptz     not null default now(),
    modified_at          timestamptz     not null default now(),

    constraint uq_health_questionnaire_user_id unique (user_id)
);

comment on table public.health_questionnaire is
    'One row per user storing all answers from the 17-question health onboarding assessment (Q5-Q17). '
    'Fields map directly to the /predict (cardiovascular) and /cancer/all ML API payloads.';

comment on column public.health_questionnaire.smoker              is 'Q5 — 1=currently smokes, 0=does not';
comment on column public.health_questionnaire.cigsperday          is 'Q5 — cigarettes per day (null when smoker=0)';
comment on column public.health_questionnaire.hypertension        is 'Q6 — doctor-diagnosed high blood pressure';
comment on column public.health_questionnaire.bp_medication       is 'Q6 — currently on BP medication (null when hypertension=0)';
comment on column public.health_questionnaire.diabetes            is 'Q7 — diagnosed with diabetes';
comment on column public.health_questionnaire.prev_stroke         is 'Q7 — prior stroke diagnosis';
comment on column public.health_questionnaire.bp_knowledge        is 'Q8 — whether user knows their BP reading';
comment on column public.health_questionnaire.systolic_bp         is 'Q8 — systolic blood pressure mmHg (null if not known)';
comment on column public.health_questionnaire.diastolic_bp        is 'Q8 — diastolic blood pressure mmHg (null if not known)';
comment on column public.health_questionnaire.cholesterol         is 'Q9 — total cholesterol mg/dL (optional)';
comment on column public.health_questionnaire.glucose             is 'Q9 — blood glucose mg/dL (optional)';
comment on column public.health_questionnaire.resting_hr          is 'Q9 — resting heart rate bpm (optional)';
comment on column public.health_questionnaire.uv_exposure_high    is 'Q10 — works outdoors / uses tanning beds';
comment on column public.health_questionnaire.sunburn_history     is 'Q10 — history of blistering sunburn';
comment on column public.health_questionnaire.geography_high_uv   is 'Q10 — lives near equator or high altitude';
comment on column public.health_questionnaire.family_history_breast   is 'Q11 — family breast cancer (female only)';
comment on column public.health_questionnaire.family_history_ovarian  is 'Q11 — family ovarian cancer (female only)';
comment on column public.health_questionnaire.family_history_prostate is 'Q11 — family prostate cancer (male only)';
comment on column public.health_questionnaire.family_history_skin     is 'Q11 — family skin cancer / melanoma';
comment on column public.health_questionnaire.family_history_blood    is 'Q11 — family leukaemia / lymphoma / myeloma';
comment on column public.health_questionnaire.family_history_brca2    is 'Q11 — BRCA2 mutation in family (male only)';
comment on column public.health_questionnaire.prior_chemotherapy  is 'Q12 — previous chemotherapy';
comment on column public.health_questionnaire.prior_radiation     is 'Q12 — previous radiation treatment';
comment on column public.health_questionnaire.prior_skin_cancer   is 'Q12 — previous skin cancer diagnosis';
comment on column public.health_questionnaire.immunosuppressed    is 'Q12 — organ transplant / HIV / immunosuppressive meds';
comment on column public.health_questionnaire.persistent_fatigue       is 'Q13 — persistent unexplained fatigue';
comment on column public.health_questionnaire.unexplained_weight_loss  is 'Q13 — unexplained weight loss ≥5 kg';
comment on column public.health_questionnaire.night_sweats             is 'Q13 — regular drenching night sweats';
comment on column public.health_questionnaire.frequent_infections      is 'Q14 — infections more often than usual';
comment on column public.health_questionnaire.easy_bruising_bleeding   is 'Q14 — bruising or bleeding very easily';
comment on column public.health_questionnaire.swollen_lymph_nodes      is 'Q14 — swollen lumps in neck/armpit/groin';
comment on column public.health_questionnaire.brca_known          is 'F_Q15 — carries BRCA1/BRCA2 mutation (female only)';
comment on column public.health_questionnaire.menopause           is 'F_Q16 — has gone through menopause (female only)';
comment on column public.health_questionnaire.hrt_use             is 'F_Q16 — currently on HRT (female, post-menopause only)';
comment on column public.health_questionnaire.race_high_risk      is 'M_Q15 — African/Caribbean/African-American descent (male only)';
comment on column public.health_questionnaire.urinary_symptoms    is 'M_Q15 — urinary symptoms (male only)';
comment on column public.health_questionnaire.diet_high_red_meat  is 'M_Q15 — frequent red/processed meat intake (male only)';
comment on column public.health_questionnaire.psa_known           is 'M_Q16 — PSA value ng/mL (male only, null if not tested)';
comment on column public.health_questionnaire.alcohol_weekly_units is 'Q17 — standard drinks per week';
comment on column public.health_questionnaire.activity_choice     is 'Q17 — self-reported activity level';
comment on column public.health_questionnaire.physical_activity_low is 'Derived — true when activity_choice is low or sedentary';
comment on column public.health_questionnaire.obesity             is 'Derived — true when user_profiles.bmi >= 30';

-- Index for lookups by user
create index if not exists ix_health_questionnaire_user_id
    on public.health_questionnaire (user_id);

-- =============================================================================
-- STEP 3 — Enable Row Level Security and add permissive policy
-- =============================================================================

alter table public.health_questionnaire enable row level security;

-- Use DO block so the policy creation is idempotent
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename  = 'health_questionnaire'
          and policyname = 'Allow all for service role'
    ) then
        execute $policy$
            create policy "Allow all for service role"
            on public.health_questionnaire
            for all
            using (true)
            with check (true)
        $policy$;
    end if;
end;
$$;

-- =============================================================================
-- VERIFICATION — run these selects after applying the migration to confirm
-- =============================================================================
/*
-- 1. Confirm new columns in user_profiles
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'user_profiles'
  and column_name  in ('height_cm', 'weight_kg', 'bmi', 'skin_type')
order by ordinal_position;

-- 2. Confirm health_questionnaire columns (expect 45 columns)
select count(*) as total_columns
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'health_questionnaire';

-- 3. Confirm RLS is enabled
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename  = 'health_questionnaire';
*/
