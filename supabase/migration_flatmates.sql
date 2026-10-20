-- Flatmate matching (run once in the Supabase SQL editor).
-- Tenants post "have a room" / "need a room"; others show interest.
-- Contact emails stay private until the poster accepts an interest —
-- the flatmate_match_contact() helper reveals the other party's email
-- only for an accepted interest the caller is part of.

create table if not exists public.flatmate_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  poster_name text not null,
  kind text not null check (kind in ('have_room', 'need_room')),
  city text not null,
  locality text,
  budget int not null,
  move_in date,
  about text,
  tags text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.flatmate_interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.flatmate_posts(id) on delete cascade,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  seeker_name text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (post_id, seeker_id)
);

alter table public.flatmate_posts enable row level security;
alter table public.flatmate_interests enable row level security;

-- Posts: open posts are public to signed-in users; posters see all their own
drop policy if exists "read open flatmate posts" on public.flatmate_posts;
create policy "read open flatmate posts" on public.flatmate_posts
  for select to authenticated
  using (status = 'open' or auth.uid() = user_id);

drop policy if exists "tenants manage own flatmate posts" on public.flatmate_posts;
create policy "tenants manage own flatmate posts" on public.flatmate_posts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Interests: seekers create (never on their own post)…
drop policy if exists "seekers create interests" on public.flatmate_interests;
create policy "seekers create interests" on public.flatmate_interests
  for insert to authenticated
  with check (
    auth.uid() = seeker_id
    and not exists (
      select 1 from public.flatmate_posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

-- …both parties can read them…
drop policy if exists "interest parties read" on public.flatmate_interests;
create policy "interest parties read" on public.flatmate_interests
  for select to authenticated
  using (
    auth.uid() = seeker_id
    or exists (
      select 1 from public.flatmate_posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

-- …and only the poster can accept/decline
drop policy if exists "posters moderate interests" on public.flatmate_interests;
create policy "posters moderate interests" on public.flatmate_interests
  for update to authenticated
  using (
    exists (
      select 1 from public.flatmate_posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.flatmate_posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

-- Contact reveal: for an ACCEPTED interest, return the OTHER party's
-- email + name to a participant. Null otherwise.
create or replace function public.flatmate_match_contact(p_interest_id uuid)
returns table (email text, full_name text)
language sql
security definer
set search_path = public
as $$
  select p.email, p.full_name
  from public.flatmate_interests i
  join public.flatmate_posts fp on fp.id = i.post_id
  join public.profiles p
    on p.id = case when auth.uid() = i.seeker_id then fp.user_id else i.seeker_id end
  where i.id = p_interest_id
    and i.status = 'accepted'
    and (auth.uid() = i.seeker_id or auth.uid() = fp.user_id);
$$;

grant execute on function public.flatmate_match_contact(uuid) to authenticated;
