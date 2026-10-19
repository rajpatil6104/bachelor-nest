-- BachelorNest migration: admin moderation policies
-- Run this in the Supabase SQL editor AFTER schema.sql.
--
-- Gives users with role='admin' (in public.profiles) the ability to
-- review every listing (including pending) and approve/reject them.
-- To make a user an admin, run:
--   update public.profiles set role = 'admin' where id = '<their-user-uuid>';
-- Find the uuid in Supabase → Authentication → Users.

-- Admins can read ALL listings (including pending/rejected)
create policy "admins read all listings"
  on public.listings for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can update any listing (approve / reject)
create policy "admins moderate listings"
  on public.listings for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can read rooms of any listing (to review pending ones)
create policy "admins read all rooms"
  on public.rooms for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
