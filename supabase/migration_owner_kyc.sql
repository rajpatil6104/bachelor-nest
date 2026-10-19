-- BachelorNest migration: owner KYC + rent cycle
-- Run this in the Supabase SQL editor after schema.sql.
--
-- Adds rent collection cycle to listings, KYC fields to profiles, and a
-- PRIVATE bucket for owner verification documents (address proof, govt ID).

alter table public.listings
  add column if not exists rent_cycle text not null default 'monthly'
  check (rent_cycle in ('monthly', 'quarterly', 'half-yearly', 'yearly'));

alter table public.profiles
  add column if not exists kyc_status text not null default 'none'
  check (kyc_status in ('none', 'pending', 'verified', 'rejected'));

alter table public.profiles
  add column if not exists kyc_docs text[] not null default '{}';

-- Owners can update their own KYC fields (status/docs only via app logic)
create policy "owners update own kyc"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can read all profiles (to review KYC submissions)
-- NOTE: must use public.is_admin(), never a direct subquery on profiles —
-- a self-referencing policy causes infinite recursion (Postgres 42P17).
create policy "admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Admins can verify / reject KYC
create policy "admins moderate kyc"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Private bucket for verification documents
insert into storage.buckets (id, name, public)
values ('owner-docs', 'owner-docs', false)
on conflict (id) do nothing;

-- Owners upload into their own folder
create policy "owners upload own docs"
  on storage.objects for insert
  with check (
    bucket_id = 'owner-docs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can view their own docs
create policy "owners read own docs"
  on storage.objects for select
  using (
    bucket_id = 'owner-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can view all verification docs
create policy "admins read owner docs"
  on storage.objects for select
  using (
    bucket_id = 'owner-docs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
