-- BachelorNest FIX migration: 42P17 infinite recursion in RLS policies
-- Run this in the Supabase SQL editor if you already ran migration_owner_kyc.sql
-- and now see { code: "42P17" } ("infinite recursion detected in policy").
--
-- Root cause: the admin policies ON public.profiles queried public.profiles
-- inside their own USING clause. Every evaluation re-entered the same policy,
-- recursing forever — which broke ALL database queries (listings, rooms, …).
--
-- Fix: a SECURITY DEFINER helper that checks the admin role while bypassing
-- RLS, so the check can never recurse. Every admin policy is pointed at it.

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

-- ---- profiles: drop the recursive policies, recreate via is_admin() ----
drop policy if exists "admins read all profiles" on public.profiles;
drop policy if exists "admins moderate kyc" on public.profiles;

create policy "admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "admins moderate kyc"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---- normalize the older admin policies to the same helper ----
-- (Same behavior as before; just recursion-proof and consistent.)
drop policy if exists "admins read all listings" on public.listings;
drop policy if exists "admins moderate listings" on public.listings;
drop policy if exists "admins read all rooms" on public.rooms;

create policy "admins read all listings"
  on public.listings for select
  using (public.is_admin());

create policy "admins moderate listings"
  on public.listings for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins read all rooms"
  on public.rooms for select
  using (public.is_admin());
