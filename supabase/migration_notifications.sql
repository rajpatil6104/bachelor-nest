-- Email notification helpers (run once in the Supabase SQL editor).
-- Profiles are only readable by their owner under RLS, but notification
-- emails legitimately need the *other* party's email (owner ↔ tenant).
-- These SECURITY DEFINER functions expose exactly one email + name per
-- lookup, keyed by a listing / inquiry the caller is already involved
-- with — no bulk access to the profiles table.

create or replace function public.owner_contact(p_listing_id uuid)
returns table (email text, full_name text)
language sql
security definer
set search_path = public
as $$
  select p.email, p.full_name
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  where l.id = p_listing_id;
$$;

create or replace function public.inquiry_tenant_contact(p_inquiry_id uuid)
returns table (email text, full_name text)
language sql
security definer
set search_path = public
as $$
  select p.email, p.full_name
  from public.inquiries i
  join public.profiles p on p.id = i.tenant_id
  where i.id = p_inquiry_id;
$$;

-- Tenants whose vacancy alerts match a (newly approved) listing: same city,
-- budget covers the cheapest room, and room type matches when specified.
create or replace function public.alert_matches_for_listing(p_listing_id uuid)
returns table (email text, full_name text)
language sql
security definer
set search_path = public
as $$
  select distinct p.email, p.full_name
  from public.alerts a
  join public.profiles p on p.id = a.tenant_id
  join public.listings l on l.id = p_listing_id
  where p.email is not null
    and lower(a.city) = lower(l.city)
    and (a.locality is null or lower(a.locality) = lower(l.locality))
    and (
      a.max_budget is null
      or a.max_budget >= (
        select min(r.rent_per_bed) from public.rooms r where r.listing_id = l.id
      )
    )
    and (
      a.room_type is null
      or exists (
        select 1 from public.rooms r
        where r.listing_id = l.id and r.room_type = a.room_type
      )
    );
$$;

grant execute on function public.owner_contact(uuid) to authenticated;
grant execute on function public.inquiry_tenant_contact(uuid) to authenticated;
grant execute on function public.alert_matches_for_listing(uuid) to authenticated;
