-- Listing reports (run once in the Supabase SQL editor).
-- Tenants report a listing (fake / wrong price / not bachelor-friendly /
-- spam…); admins review the queue in /admin and resolve or dismiss.
-- One OPEN report per tenant per listing, enforced by a partial unique index.
-- Admin policies use public.is_admin() (SECURITY DEFINER) — never subquery
-- profiles from a policy on a table profiles policies depend on (42P17 trap).
-- Defined here too (identical, idempotent) so this file runs standalone.

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

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in (
    'Fake listing', 'Wrong price', 'Wrong photos',
    'Not bachelor-friendly', 'Spam', 'Other'
  )),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create unique index if not exists reports_one_open_per_tenant
  on public.reports (listing_id, reporter_id)
  where status = 'open';

alter table public.reports enable row level security;

drop policy if exists "tenants report listings" on public.reports;
create policy "tenants report listings" on public.reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "tenants read own reports" on public.reports;
create policy "tenants read own reports" on public.reports
  for select to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "admins read all reports" on public.reports;
create policy "admins read all reports" on public.reports
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
