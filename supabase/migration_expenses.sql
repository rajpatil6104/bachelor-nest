-- Expense splitter (run once in the Supabase SQL editor).
-- A user creates a "home" (group), adds flatmates by name — flatmates
-- don't need accounts; the creator manages the group. Expenses split
-- equally among the group's members; settlements record pay-backs.

create table if not exists public.expense_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.expense_groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.expense_groups(id) on delete cascade,
  title text not null,
  amount int not null check (amount > 0),
  paid_by uuid not null references public.expense_members(id) on delete cascade,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.expense_groups(id) on delete cascade,
  from_member uuid not null references public.expense_members(id) on delete cascade,
  to_member uuid not null references public.expense_members(id) on delete cascade,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.expense_groups enable row level security;
alter table public.expense_members enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;

drop policy if exists "creators manage own expense groups" on public.expense_groups;
create policy "creators manage own expense groups" on public.expense_groups
  for all to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Child rows are reachable only through a group the caller created
drop policy if exists "group owners manage members" on public.expense_members;
create policy "group owners manage members" on public.expense_members
  for all to authenticated
  using (exists (
    select 1 from public.expense_groups g
    where g.id = group_id and g.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.expense_groups g
    where g.id = group_id and g.created_by = auth.uid()
  ));

drop policy if exists "group owners manage expenses" on public.expenses;
create policy "group owners manage expenses" on public.expenses
  for all to authenticated
  using (exists (
    select 1 from public.expense_groups g
    where g.id = group_id and g.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.expense_groups g
    where g.id = group_id and g.created_by = auth.uid()
  ));

drop policy if exists "group owners manage settlements" on public.settlements;
create policy "group owners manage settlements" on public.settlements
  for all to authenticated
  using (exists (
    select 1 from public.expense_groups g
    where g.id = group_id and g.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.expense_groups g
    where g.id = group_id and g.created_by = auth.uid()
  ));
