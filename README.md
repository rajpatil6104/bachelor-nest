# 🏠 BachelorNest

A web app where **bachelors find PGs, hostels, rooms & flats** listed directly by
owners — with **live vacancy availability**. Zero brokerage.

## MVP features

**Owners**
1. Add listing — type, address, photos, room types, amenities, house rules
2. Pricing — rent per bed, deposit
3. Vacancy management — +/- occupied beds, tenants see availability update live
4. Dashboard with listing status (pending / approved)

**Bachelors**
5. Search with filters — city, budget, property type, sharing type
6. Listing detail page — rooms table with live bed counts, amenities, rules
7. Availability badges everywhere ("4 beds available" / "Full")
8. Book a visit — date + message, tracked on a "My visits" page with live status
9. Owner visit-request inbox — accept/decline requests from the dashboard
10. Favorites — ♡ on any listing, "Saved" shortlist page
11. Vacancy alerts — save a search as an alert, live match counts, NEW badges on fresh listings

**Trust**
10. Listings go live only after admin verification (`status = 'approved'`) via `/admin`
11. RLS policies so owners only touch their own data

## Quick start (demo mode — no setup needed)

```bash
cd bachelor-nest
npm install
npm run dev
```

Open http://localhost:3000 — the app runs on built-in demo listings.

## Going live with Supabase (free tier is enough)

1. Create a project at https://supabase.com (free).
2. In the Supabase dashboard, open **SQL Editor** and run the whole
   `supabase/schema.sql` file from this repo. It creates all tables + security policies.
3. Go to **Project Settings → API**, copy the **Project URL** and **anon public key**.
4. Copy `.env.local.example` to `.env.local` and paste the two values.
5. Restart `npm run dev`. The app now reads/writes the real database.

### Admin verification panel

New listings are `pending` until approved at `/admin` (Approve / Reject).

- Run `supabase/migration_admin_policies.sql` in the SQL editor (after `schema.sql`)
  so admins can read and moderate every listing.
- Make a user an admin: in SQL editor, run
  `update public.profiles set role = 'admin' where id = '<their-uuid>';`
  (find the uuid in Authentication → Users).
- Without Supabase, use the **Demo admin** button on the login page to try it.

### Login / signup

Email + password auth is built in (`/login`, `/register`) with role selection
(owner vs tenant). It activates automatically once `.env.local` is set.

- New signups create a row in `public.profiles` with the chosen role.
- Owner pages (`/owner`, `/owner/add`) require an owner account.
- Without Supabase, use the **demo login** buttons on the login page.
- For quick testing, turn off email confirmation in Supabase →
  Authentication → Providers → Email → "Confirm email". Otherwise users must
  click the confirmation link before first login.
- Phone OTP login can be added later via
  `supabase.auth.signInWithOtp({ phone })` once you configure an SMS provider
  (Twilio/MSG91) in the Supabase dashboard.

## Project structure

```
app/
  page.tsx              → landing + search hero
  search/page.tsx       → results + filters
  listing/[id]/page.tsx → detail: rooms table, amenities, rules
  owner/page.tsx        → owner dashboard + vacancy +/- controls
  owner/add/page.tsx    → add-listing form
components/             → Navbar, ListingCard, AvailabilityBadge
lib/
  types.ts              → Listing, Room, filters
  supabase.ts           → client (null until env is set)
  db.ts                 → data layer: Supabase when configured, demo data otherwise
  mock-data.ts          → 4 demo listings
supabase/schema.sql     → Postgres tables + RLS policies
```

## Roadmap (v2)

- In-app chat with owners
- Favorites, vacancy alerts (push/email)
- Reviews from tenants
- Photo uploads via Supabase Storage
- Admin verification panel
