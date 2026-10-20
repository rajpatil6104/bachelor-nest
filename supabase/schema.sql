-- BachelorsNest database schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor (or `supabase db push`).

-- ============ PROFILES (extends Supabase Auth users) ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'tenant', 'admin')),
  full_name text,
  phone text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ LISTINGS ============
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('pg', 'hostel', 'room', 'flat', 'coliving')),
  title text not null,
  description text,
  address text not null,
  city text not null,
  locality text,
  latitude double precision,
  longitude double precision,
  photos text[] not null default '{}',
  amenities text[] not null default '{}',
  house_rules text,
  gender_allowed text not null default 'male'
    check (gender_allowed in ('male', 'female', 'any')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index listings_city_idx on public.listings (city);
create index listings_status_idx on public.listings (status);

-- ============ ROOMS / BEDS (vacancy lives here) ============
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  room_type text not null check (room_type in ('single', 'double', 'triple', 'dorm')),
  total_beds int not null check (total_beds > 0),
  occupied_beds int not null default 0 check (occupied_beds >= 0),
  rent_per_bed int not null check (rent_per_bed >= 0),
  deposit int not null default 0,
  check (occupied_beds <= total_beds)
  -- available_beds = total_beds - occupied_beds (computed in the app)
);
create index rooms_listing_idx on public.rooms (listing_id);

-- ============ INQUIRIES (visit / callback requests) ============
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('visit', 'callback')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'done')),
  preferred_date date,
  message text,
  created_at timestamptz not null default now()
);
create index inquiries_listing_idx on public.inquiries (listing_id);
create index inquiries_tenant_idx on public.inquiries (tenant_id);

-- ============ REVIEWS ============
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (listing_id, tenant_id)
);

-- ============ FAVORITES ============
create table public.favorites (
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, listing_id)
);

-- ============ VACANCY ALERTS ============
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  locality text,
  max_budget int,
  room_type text,
  created_at timestamptz not null default now()
);

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles   enable row level security;
alter table public.listings   enable row level security;
alter table public.rooms      enable row level security;
alter table public.inquiries  enable row level security;
alter table public.reviews    enable row level security;
alter table public.favorites  enable row level security;
alter table public.alerts     enable row level security;

-- Public can read approved listings + their rooms
create policy "approved listings are public"
  on public.listings for select using (status = 'approved');
create policy "rooms of approved listings are public"
  on public.rooms for select using (
    exists (select 1 from public.listings l
            where l.id = rooms.listing_id and l.status = 'approved')
  );

-- Owners manage their own listings and rooms
create policy "owners manage own listings"
  on public.listings for all using (auth.uid() = owner_id);
create policy "owners manage own rooms"
  on public.rooms for all using (
    exists (select 1 from public.listings l
            where l.id = rooms.listing_id and l.owner_id = auth.uid())
  );

-- Profiles: users read own, insert own
create policy "users read own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Tenants: inquiries they created; owners: inquiries on their listings
create policy "tenants manage own inquiries"
  on public.inquiries for all using (auth.uid() = tenant_id);
create policy "owners read inquiries on own listings"
  on public.inquiries for select using (
    exists (select 1 from public.listings l
            where l.id = inquiries.listing_id and l.owner_id = auth.uid())
  );
create policy "owners update inquiry status"
  on public.inquiries for update using (
    exists (select 1 from public.listings l
            where l.id = inquiries.listing_id and l.owner_id = auth.uid())
  );

-- Reviews: public read, tenants write own
create policy "reviews are public"
  on public.reviews for select using (true);
create policy "tenants write own reviews"
  on public.reviews for insert with check (auth.uid() = tenant_id);

-- Favorites & alerts: owner of the row only
create policy "tenants manage own favorites"
  on public.favorites for all using (auth.uid() = tenant_id);
create policy "tenants manage own alerts"
  on public.alerts for all using (auth.uid() = tenant_id);
