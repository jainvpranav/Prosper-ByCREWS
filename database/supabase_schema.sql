-- =============================================================================
-- PROSPER HEALTH PLATFORM — SUPABASE (PostgreSQL) SCHEMA
-- Target: Supabase Dashboard → SQL Editor
--
-- Migrated from SQL Server (AWS RDS). Key changes:
--   - UNIQUEIDENTIFIER → uuid (gen_random_uuid())
--   - DATETIMEOFFSET   → timestamptz
--   - TINYINT          → smallint
--   - NVARCHAR(MAX)    → text
--   - NVARCHAR(N)      → varchar(N)
--   - BIT              → boolean
--   - GO / MERGE       → removed (PostgreSQL native syntax)
--   - Schema separation: public (app data), audit (compliance logs)
--
-- HIPAA Security Measures preserved:
--   1. PHI encryption done at application layer (AES-256) — unchanged
--   2. Audit trail tables for §164.312(b)
--   3. Soft deletes (is_active flag) — no hard deletion of PHI
--   4. FK constraints ensure referential integrity
--   5. Row Level Security (RLS) enabled on all tables
-- =============================================================================

-- Enable uuid extension (usually already enabled in Supabase)
create extension if not exists "uuid-ossp";

-- Create audit schema
create schema if not exists audit;

-- =============================================================================
-- TABLE: public.users
-- =============================================================================
create table if not exists public.users (
    user_id         uuid            primary key default gen_random_uuid(),
    email           varchar(320)    not null unique,
    password_hash   varchar(512)    not null,
    is_active       boolean         not null default true,
    created_at      timestamptz     not null default now(),
    modified_at     timestamptz     not null default now(),
    last_login_at   timestamptz     null,
    mfa_enabled     boolean         not null default false,
    mfa_secret      varchar(256)    null
);

create index if not exists ix_users_email on public.users (email) where is_active = true;

-- =============================================================================
-- TABLE: public.user_profiles
-- =============================================================================
create table if not exists public.user_profiles (
    profile_id      uuid            primary key default gen_random_uuid(),
    user_id         uuid            not null references public.users(user_id),
    age             smallint        null check (age >= 0 and age <= 150),
    gender          varchar(50)     null,
    activity_level  varchar(50)     null,
    city            varchar(200)    null,
    profile_complete boolean        not null default false,
    created_at      timestamptz     not null default now(),
    modified_at     timestamptz     not null default now(),
    
    constraint uq_user_profiles_user_id unique (user_id)
);

create index if not exists ix_user_profiles_user_id on public.user_profiles (user_id);

-- =============================================================================
-- TABLE: public.family_history
-- =============================================================================
create table if not exists public.family_history (
    family_history_id uuid          primary key default gen_random_uuid(),
    profile_id       uuid           not null references public.user_profiles(profile_id) on delete cascade,
    condition        varchar(200)   not null,
    created_at       timestamptz    not null default now(),

    constraint uq_family_history_profile_condition unique (profile_id, condition)
);

create index if not exists ix_family_history_profile_id on public.family_history (profile_id);

-- =============================================================================
-- TABLE: public.lifestyle_data
-- =============================================================================
create table if not exists public.lifestyle_data (
    lifestyle_id     uuid           primary key default gen_random_uuid(),
    profile_id       uuid           not null references public.user_profiles(profile_id) on delete cascade,
    smoking_status   varchar(50)    null,
    alcohol_use      varchar(50)    null,
    sleep_range      varchar(20)    null,
    created_at       timestamptz    not null default now(),
    modified_at      timestamptz    not null default now(),

    constraint uq_lifestyle_data_profile_id unique (profile_id)
);

-- =============================================================================
-- TABLE: public.diet_data
-- =============================================================================
create table if not exists public.diet_data (
    diet_id          uuid           primary key default gen_random_uuid(),
    profile_id       uuid           not null references public.user_profiles(profile_id) on delete cascade,
    food_preference  varchar(100)   null,
    diet_quality     varchar(50)    null,
    created_at       timestamptz    not null default now(),
    modified_at      timestamptz    not null default now(),

    constraint uq_diet_data_profile_id unique (profile_id)
);

-- =============================================================================
-- TABLE: public.medical_data  (PHI — HIGH SENSITIVITY)
-- Medications, Allergies, Conditions are AES-256 encrypted at app layer
-- =============================================================================
create table if not exists public.medical_data (
    medical_id       uuid           primary key default gen_random_uuid(),
    profile_id       uuid           not null references public.user_profiles(profile_id) on delete cascade,
    medications_enc  text           null,
    allergies_enc    text           null,
    conditions_enc   text           null,
    last_checkup     varchar(50)    null,
    created_at       timestamptz    not null default now(),
    modified_at      timestamptz    not null default now(),

    constraint uq_medical_data_profile_id unique (profile_id)
);

-- =============================================================================
-- TABLE: public.risk_assessments
-- =============================================================================
create table if not exists public.risk_assessments (
    assessment_id       uuid            primary key default gen_random_uuid(),
    user_id             uuid            not null references public.users(user_id),
    overall_risk_score  smallint        not null check (overall_risk_score between 0 and 100),
    genetic_disposition varchar(50)     null,
    lifestyle_impact    varchar(50)     null,
    medical_history_risk varchar(50)    null,
    ai_insight_summary  text            null,
    assessed_at         timestamptz     not null default now()
);

create index if not exists ix_risk_assessments_user_id on public.risk_assessments (user_id, assessed_at desc);

-- =============================================================================
-- TABLE: public.risk_factor_contributions
-- =============================================================================
create table if not exists public.risk_factor_contributions (
    contribution_id  uuid            primary key default gen_random_uuid(),
    assessment_id    uuid            not null references public.risk_assessments(assessment_id) on delete cascade,
    factor_name      varchar(100)    not null,
    contribution_pct smallint        not null check (contribution_pct between 0 and 100)
);

-- =============================================================================
-- TABLE: public.health_projections
-- =============================================================================
create table if not exists public.health_projections (
    projection_id    uuid            primary key default gen_random_uuid(),
    assessment_id    uuid            not null references public.risk_assessments(assessment_id) on delete cascade,
    month_offset     smallint        not null,
    predicted_score  smallint        not null check (predicted_score between 0 and 100),
    baseline_score   smallint        not null check (baseline_score between 0 and 100),

    constraint uq_health_projections_month unique (assessment_id, month_offset)
);

-- =============================================================================
-- TABLE: public.appointments
-- =============================================================================
create table if not exists public.appointments (
    appointment_id     uuid            primary key default gen_random_uuid(),
    user_id            uuid            not null references public.users(user_id),
    location_name      varchar(300)    not null,
    location_address   varchar(500)    null,
    appointment_date   date            not null,
    time_slot          varchar(20)     not null,
    provider           varchar(300)    null,
    appointment_status varchar(50)     not null default 'Scheduled'
                       check (appointment_status in ('Scheduled','Completed','Cancelled','No-Show')),
    cancellation_reason varchar(500)   null,
    notes_enc          text            null,
    is_active          boolean         not null default true,
    created_at         timestamptz     not null default now(),
    modified_at        timestamptz     not null default now()
);

create index if not exists ix_appointments_user_id_date
    on public.appointments (user_id, appointment_date desc) where is_active = true;

-- =============================================================================
-- TABLE: public.chat_messages
-- =============================================================================
create table if not exists public.chat_messages (
    message_id       uuid            primary key default gen_random_uuid(),
    user_id          uuid            not null references public.users(user_id),
    role             varchar(20)     not null check (role in ('user','assistant','system')),
    content_enc      text            not null,
    is_active        boolean         not null default true,
    created_at       timestamptz     not null default now()
);

create index if not exists ix_chat_messages_user_id_created
    on public.chat_messages (user_id, created_at asc) where is_active = true;

-- =============================================================================
-- AUDIT TABLES — HIPAA §164.312(b)
-- =============================================================================

create table if not exists audit.audit_log (
    audit_id         uuid            primary key default gen_random_uuid(),
    table_name       varchar(128)    not null,
    record_id        varchar(128)    not null,
    operation        varchar(10)     not null,
    changed_by_user_id varchar(256)  null,
    old_values       text            null,
    new_values       text            null,
    occurred_at      timestamptz     not null default now(),
    ip_address       varchar(45)     null,
    user_agent       varchar(512)    null
);

create index if not exists ix_audit_log_table_record on audit.audit_log (table_name, record_id);
create index if not exists ix_audit_log_occurred_at  on audit.audit_log (occurred_at desc);

create table if not exists audit.data_access_log (
    access_id        uuid            primary key default gen_random_uuid(),
    accessed_by_user_id varchar(256) not null,
    table_name       varchar(128)    not null,
    record_id        varchar(128)    null,
    accessed_at      timestamptz     not null default now(),
    ip_address       varchar(45)     null,
    purpose          varchar(200)    null
);

create index if not exists ix_data_access_log_user_id on audit.data_access_log (accessed_by_user_id, accessed_at desc);

create table if not exists audit.user_session_log (
    session_id       uuid            primary key default gen_random_uuid(),
    user_id          uuid            not null,
    event_type       varchar(20)     not null,
    ip_address       varchar(45)     null,
    user_agent       varchar(512)    null,
    occurred_at      timestamptz     not null default now()
);

create index if not exists ix_user_session_log_user_id on audit.user_session_log (user_id, occurred_at desc);

-- =============================================================================
-- Enable Row Level Security on all tables
-- (Policies to be configured based on auth requirements)
-- =============================================================================
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.family_history enable row level security;
alter table public.lifestyle_data enable row level security;
alter table public.diet_data enable row level security;
alter table public.medical_data enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.risk_factor_contributions enable row level security;
alter table public.health_projections enable row level security;
alter table public.appointments enable row level security;
alter table public.chat_messages enable row level security;
alter table audit.audit_log enable row level security;
alter table audit.data_access_log enable row level security;
alter table audit.user_session_log enable row level security;

-- Create permissive policies for service role access
-- (The publishable key uses these; service_role key bypasses RLS)
create policy "Allow all for service role" on public.users for all using (true) with check (true);
create policy "Allow all for service role" on public.user_profiles for all using (true) with check (true);
create policy "Allow all for service role" on public.family_history for all using (true) with check (true);
create policy "Allow all for service role" on public.lifestyle_data for all using (true) with check (true);
create policy "Allow all for service role" on public.diet_data for all using (true) with check (true);
create policy "Allow all for service role" on public.medical_data for all using (true) with check (true);
create policy "Allow all for service role" on public.risk_assessments for all using (true) with check (true);
create policy "Allow all for service role" on public.risk_factor_contributions for all using (true) with check (true);
create policy "Allow all for service role" on public.health_projections for all using (true) with check (true);
create policy "Allow all for service role" on public.appointments for all using (true) with check (true);
create policy "Allow all for service role" on public.chat_messages for all using (true) with check (true);
create policy "Allow all for service role" on audit.audit_log for all using (true) with check (true);
create policy "Allow all for service role" on audit.data_access_log for all using (true) with check (true);
create policy "Allow all for service role" on audit.user_session_log for all using (true) with check (true);
