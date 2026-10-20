-- BachelorsNest migration: owner email on profiles
-- Run this in the Supabase SQL editor after migration_owner_kyc.sql.
--
-- Stores the owner's email on their profile so the admin panel can send the
-- "you're verified" email. Also grandfathers owners who registered before
-- OTP verification existed — they stay able to log in.

alter table public.profiles
  add column if not exists email text;

update public.profiles
  set kyc_status = 'verified'
  where role = 'owner' and kyc_status = 'none';
