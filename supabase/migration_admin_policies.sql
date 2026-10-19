-- BachelorNest migration: admin moderation policies
-- Run this in the Supabase SQL editor AFTER schema.sql.
--
-- Gives users with role='admin' (in public.profiles) the ability to
-- review every listing (including pending) and approve/reject them.
-- To make a user an admin, run:
--   update public.profiles set role = 'admin' where id = '<their-user-uuid>';
-- Find the uuid in Supabase → Authentication → Users.

-- SECURITY DEFINER helper: checks the admin role while bypassing RLS.
-- Admin policies MUST use this instead of subquerying public.profiles
-- directly, otherwise the policy recurses into itself (Postgres 42P17)
-- and breaks every query on the database.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Admins can read ALL listings (including pending/rejected)
create policy "admins read all listings"
  on public.listings for select using (public.is_admin());

-- Admins can update any listing (approve / reject)
create policy "admins moderate listings"
  on public.listings for update
  using (public.is_admin())
  with check (public.is_admin());

-- Admins can read rooms of any listing (to review pending ones)
create policy "admins read all rooms"
  on public.rooms for select using (public.is_admin());
