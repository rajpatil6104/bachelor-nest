-- Owner analytics (run once in the Supabase SQL editor).
-- 1) A simple view counter on listings.
-- 2) owner_listing_stats(): per-listing saves / inquiries / completed
--    visits / review aggregates for the signed-in owner. SECURITY
--    DEFINER because owners can't read other users' favorites/inquiries
--    under RLS — the function only returns rows for listings owned by
--    auth.uid(), so an owner can never see anyone else's numbers.

alter table public.listings
  add column if not exists view_count int not null default 0;

create or replace function public.increment_listing_view(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings
  set view_count = view_count + 1
  where id = p_listing_id and status = 'approved';
$$;

-- Views come from public listing pages, so anon visitors count too.
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

create or replace function public.owner_listing_stats()
returns table (
  listing_id uuid,
  saves bigint,
  inquiries bigint,
  visits_done bigint,
  review_count bigint,
  avg_rating numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id,
    (select count(*) from public.favorites f where f.listing_id = l.id),
    (select count(*) from public.inquiries i where i.listing_id = l.id),
    (select count(*) from public.inquiries i
       where i.listing_id = l.id and i.status = 'done'),
    (select count(*) from public.reviews r where r.listing_id = l.id),
    (select avg(r.rating) from public.reviews r where r.listing_id = l.id)
  from public.listings l
  where l.owner_id = auth.uid();
$$;

grant execute on function public.owner_listing_stats() to authenticated;
