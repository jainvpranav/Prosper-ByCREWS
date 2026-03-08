-- =============================================================================
-- Seed Data for Supabase — Demo user for development
-- Run this in Supabase SQL Editor after running supabase_schema.sql
-- =============================================================================

-- Demo user matching the hardcoded DEMO_USER_ID in the app
INSERT INTO public.users (user_id, email, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@prosper.health',
  '$argon2id$v=19$m=65536,t=3,p=4$placeholder_hash_for_dev'
)
ON CONFLICT (user_id) DO NOTHING;
