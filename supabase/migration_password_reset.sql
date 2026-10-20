-- BachelorsNest migration: forgot-password reset tokens
-- Run this in the Supabase SQL editor.
--
-- Flow: /api/password-reset/request emails a 6-digit code (stored by the
-- existing email_otps system from migration_email_otp.sql) →
-- /api/password-reset/verify checks the code and mints a single-use reset
-- token stored HERE (hashed) → /api/password-reset/complete exchanges the
-- token for a new password via the Supabase admin API.
--
-- Security: only the token's SHA-256 hash is stored; tokens expire after
-- 10 minutes and are single-use. The table has RLS on with NO policies on
-- purpose — the only access is through the service_role key used by the
-- server-side API routes (lib/supabase-admin.ts), which bypasses RLS.

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.password_resets enable row level security;
-- Intentionally no policies: service_role (server-side) only.

create index if not exists password_resets_token_idx on public.password_resets (token_hash);
create index if not exists password_resets_user_idx on public.password_resets (user_id);
