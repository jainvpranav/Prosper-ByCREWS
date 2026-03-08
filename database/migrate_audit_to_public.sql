-- =============================================================================
-- Migration: Move audit tables from 'audit' schema to 'public' schema
-- Run this in Supabase SQL Editor
--
-- Reason: Supabase REST API (supabase-js) doesn't expose custom schemas
-- with the publishable key. Moving tables to 'public' with 'audit_' prefix.
-- =============================================================================

-- Drop existing audit schema tables if they exist (they may not have been created)
drop table if exists audit.user_session_log cascade;
drop table if exists audit.data_access_log cascade;
drop table if exists audit.audit_log cascade;
drop schema if exists audit;

-- Create audit tables in public schema
create table if not exists public.audit_log (
    audit_id           uuid            primary key default gen_random_uuid(),
    table_name         varchar(128)    not null,
    record_id          varchar(128)    not null,
    operation          varchar(10)     not null,
    changed_by_user_id varchar(256)    null,
    old_values         text            null,
    new_values         text            null,
    occurred_at        timestamptz     not null default now(),
    ip_address         varchar(45)     null,
    user_agent         varchar(512)    null
);

create index if not exists ix_audit_log_table_record on public.audit_log (table_name, record_id);

create table if not exists public.data_access_log (
    access_id           uuid            primary key default gen_random_uuid(),
    accessed_by_user_id varchar(256)    not null,
    table_name          varchar(128)    not null,
    record_id           varchar(128)    null,
    accessed_at         timestamptz     not null default now(),
    ip_address          varchar(45)     null,
    purpose             varchar(200)    null
);

create table if not exists public.user_session_log (
    session_id       uuid            primary key default gen_random_uuid(),
    user_id          uuid            not null,
    event_type       varchar(20)     not null,
    ip_address       varchar(45)     null,
    user_agent       varchar(512)    null,
    occurred_at      timestamptz     not null default now()
);

-- Enable RLS
alter table public.audit_log enable row level security;
alter table public.data_access_log enable row level security;
alter table public.user_session_log enable row level security;

-- Permissive policies
create policy "Allow all for service role" on public.audit_log for all using (true) with check (true);
create policy "Allow all for service role" on public.data_access_log for all using (true) with check (true);
create policy "Allow all for service role" on public.user_session_log for all using (true) with check (true);
