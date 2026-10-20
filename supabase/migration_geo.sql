-- Listing coordinates for the map view (run once in the Supabase SQL editor).
-- Owners set the pin in the listing wizard / edit form. Listings without a
-- pin still appear on the map — the app geocodes locality + city as a
-- fallback (see lib/geo.ts).

alter table public.listings
  add column if not exists lat double precision,
  add column if not exists lng double precision;
