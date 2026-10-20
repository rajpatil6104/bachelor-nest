-- BachelorsNest migration: listing photo storage
-- Run this in the Supabase SQL editor AFTER schema.sql.
--
-- Creates a public bucket for property photos. Files are stored under
-- "<owner-uuid>/<unique-name>" so owners can only delete their own.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Anyone can view listing photos
create policy "public read listing photos"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

-- Logged-in users can upload photos into their own folder
create policy "owners upload listing photos"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can delete their own photos
create policy "owners delete own listing photos"
  on storage.objects for delete
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
