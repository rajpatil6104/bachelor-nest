-- BachelorsNest migration: in-app chat messages
-- Run this in the Supabase SQL editor after schema.sql.
--
-- One conversation = (listing_id, tenant, owner). Names are denormalized onto
-- each message (sender_name) so participants never need cross-profile reads.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_idx
  on public.messages (listing_id, sender_id, receiver_id, created_at desc);

alter table public.messages enable row level security;

-- Participants can read their own conversations
create policy "participants read messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Anyone logged in can send a message as themselves
create policy "participants send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- Receivers can mark messages as read
create policy "receivers mark messages read"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- Live updates for the chat UI
alter publication supabase_realtime add table public.messages;
