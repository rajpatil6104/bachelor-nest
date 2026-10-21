-- BachelorsNest migration: owner suspension (admin policy enforcement)
-- Run this in the Supabase SQL editor.
--
-- Adds the Owners directory enforcement to /admin:
--   * profiles.suspended — set by an admin from the Owners section.
--   * A suspended owner is blocked at login (app-side gate in lib/auth)
--     AND all their listings vanish for tenants, enforced here at the
--     data level: the public read policies on listings + rooms exclude
--     suspended owners, so no page (search, home, listing, sitemap) can
--     ever show them. Owners still see their own listings; admins see all.
--
-- The check goes through a SECURITY DEFINER helper (same pattern as
-- public.is_admin()) so the listings policy never subqueries profiles
-- under the caller's RLS — that was the 42P17 recursion bug.

alter table public.profiles
  add column if not exists suspended boolean not null default false;

create or replace function public.is_suspended(p_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_owner_id and suspended = true
  );
$$;

-- Public reads: approved listings of non-suspended owners only.
drop policy if exists "approved listings are public" on public.listings;
create policy "approved listings are public"
  on public.listings for select
  using (status = 'approved' and not public.is_suspended(owner_id));

drop policy if exists "rooms of approved listings are public" on public.rooms;
create policy "rooms of approved listings are public"
  on public.rooms for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = rooms.listing_id
        and l.status = 'approved'
        and not public.is_suspended(l.owner_id)
    )
  );
