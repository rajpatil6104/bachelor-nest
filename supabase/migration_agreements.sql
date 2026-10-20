-- Digital rental agreements (run once in the Supabase SQL editor).
-- Owners create an agreement for a tenant (identified by email — the
-- tenant sees it under "My agreements" when their account email matches)
-- and the tenant accepts it in-app. The agreement page is print-ready
-- for PDF download.

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_name text not null,
  listing_title text not null,
  property_address text not null,
  room_label text,
  tenant_name text not null,
  tenant_email text not null,
  tenant_phone text,
  monthly_rent int not null,
  deposit int not null default 0,
  start_date date not null,
  duration_months int not null default 11,
  terms text,
  status text not null default 'sent' check (status in ('sent', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.agreements enable row level security;

drop policy if exists "owners manage own agreements" on public.agreements;
create policy "owners manage own agreements" on public.agreements
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Tenants find agreements addressed to their account email
drop policy if exists "tenants read addressed agreements" on public.agreements;
create policy "tenants read addressed agreements" on public.agreements
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.email) = lower(agreements.tenant_email)
    )
  );

-- …and accept them (the app only ever sends the accept transition)
drop policy if exists "tenants accept addressed agreements" on public.agreements;
create policy "tenants accept addressed agreements" on public.agreements
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.email) = lower(agreements.tenant_email)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.email) = lower(agreements.tenant_email)
    )
  );
