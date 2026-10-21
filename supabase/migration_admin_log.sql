-- BachelorsNest migration: admin action log (audit trail)
-- Run this in the Supabase SQL editor.
--
-- Records every moderation action — listing approved/rejected, owner
-- KYC verified/rejected, owner suspended/reinstated, owner deleted —
-- with which admin did it and when. Shown in /admin → "Admin activity".
-- Writes are best-effort from the app: if this table is missing, the
-- actions themselves still succeed and simply aren't logged.

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  admin_email text,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

drop policy if exists "admins read action log" on public.admin_actions;
create policy "admins read action log"
  on public.admin_actions for select
  using (public.is_admin());

drop policy if exists "admins write action log" on public.admin_actions;
create policy "admins write action log"
  on public.admin_actions for insert
  with check (public.is_admin() and admin_id = auth.uid());

create index if not exists admin_actions_created_idx
  on public.admin_actions (created_at desc);
