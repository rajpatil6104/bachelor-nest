-- BachelorNest migration: self-hosted email OTP
-- Run this in the Supabase SQL editor.
--
-- After running it, turn OFF "Confirm email" in the dashboard at
-- Authentication → Providers → Email. Then Supabase never sends auth emails:
-- the app generates 6-digit codes itself and sends them from your Gmail via
-- /api/otp/send + /api/otp/verify. No Supabase SMTP or email-template setup
-- needed anymore.
--
-- Security: codes are stored as SHA-256 hashes, expire after 10 minutes,
-- are single-use, lock after 5 wrong attempts, and are rate-limited to
-- 5 sends per email per hour. The table has no read/write policies on purpose
-- — only the SECURITY DEFINER functions below can touch it.

create table if not exists public.email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.email_otps enable row level security;
-- Intentionally no policies: only the definer functions below access this table.

create index if not exists email_otps_email_idx on public.email_otps (email);

-- Stores a new code (invalidates older unused ones). Raises 'rate_limited'
-- when an email requested too many codes recently.
create or replace function public.request_email_otp(p_email text, p_code_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- housekeeping: drop long-expired rows
  delete from public.email_otps where expires_at < now() - interval '1 day';

  if (
    select count(*) from public.email_otps
    where email = p_email and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;

  -- a new code invalidates any previous unused ones
  update public.email_otps set used = true
  where email = p_email and used = false;

  insert into public.email_otps (email, code_hash, expires_at)
  values (p_email, p_code_hash, now() + interval '10 minutes');
end;
$$;

-- Checks a code. True only for a fresh, unused, unexpired match with
-- fewer than 5 failed attempts.
create or replace function public.verify_email_otp(p_email text, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.email_otps%rowtype;
begin
  select * into v_row from public.email_otps
  where email = p_email and used = false and expires_at > now()
  order by created_at desc
  limit 1;

  if v_row.id is null then
    return false;
  end if;

  if v_row.attempts >= 5 then
    update public.email_otps set used = true where id = v_row.id;
    return false;
  end if;

  if v_row.code_hash = p_code_hash then
    update public.email_otps set used = true where id = v_row.id;
    return true;
  else
    update public.email_otps set attempts = v_row.attempts + 1 where id = v_row.id;
    return false;
  end if;
end;
$$;
