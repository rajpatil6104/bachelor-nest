-- BachelorsNest migration: admins can write rooms (needed for admin listing edits)
-- Run this in the Supabase SQL editor.
--
-- Why: until now admins could READ all rooms (to review listings) but had
-- no INSERT/UPDATE/DELETE policy on public.rooms. Saving an admin edit
-- rewrites a listing's rooms (delete + re-insert, same as owner edits),
-- so every admin edit failed at the rooms step with
-- "new row violates row-level security policy" — the form only showed
-- "Could not save your changes."
-- Owners were never affected: "owners manage own rooms" covers them.

drop policy if exists "admins manage rooms" on public.rooms;

create policy "admins manage rooms"
  on public.rooms for all
  using (public.is_admin())
  with check (public.is_admin());
