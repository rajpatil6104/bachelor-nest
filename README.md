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
   Then also run `supabase/migration_admin_policies.sql` (admin review),
   `supabase/migration_storage.sql` (photo uploads bucket),
   `supabase/migration_room_labels.sql` (named flat spaces),
   `supabase/migration_messages.sql` (in-app chat),
   `supabase/migration_owner_kyc.sql` (rent cycle, KYC fields, private owner-docs bucket), and
   `supabase/migration_profile_email.sql` (owner email on profiles; grandfathers existing owners as verified).
   If you ran the KYC migration before 2026-10-20 and now see `{ code: "42P17" }`,
   run `supabase/migration_fix_admin_recursion.sql` once to fix it.
3. Go to **Project Settings → API**, copy the **Project URL** and **anon public key**.
4. Copy `.env.example` to `.env.local` and paste the two values.
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

**Tenants** use email + password (`/login`, `/register`). **Owners** go through a
verified onboarding:

1. Register with first name, last name, mobile number, email, password (+ confirm).
2. Enter the 6-digit OTP emailed to them (Supabase sends it automatically).
3. Upload a government ID (image/PDF) as authentication proof.
4. Until an admin verifies them at `/admin`, owners **cannot log in** — the login
   screen tells them verification is pending.
5. When the admin clicks **Verify**, the owner gets a "you're verified, you can
   now add your stays" email (see below) and can log in.

- New signups create a row in `public.profiles` with the chosen role, phone and email.
- Owner pages (`/owner`, `/owner/add`) require a verified owner account.
- Without Supabase, use the **demo login** buttons on the login page (demo owner bypasses verification).
- Phone OTP login can be added later via
  `supabase.auth.signInWithOtp({ phone })` once you configure an SMS provider
  (Twilio/MSG91) in the Supabase dashboard.
- Note: Supabase free tier limits OTP emails per hour — if codes stop arriving
  while testing, wait a bit and resend.

### Getting a 6-digit OTP code instead of a magic link

By default Supabase's OTP email contains a **login link**, not a code — so the
app's OTP screen has nothing to accept. Fix it once in the dashboard:

1. Supabase dashboard → **Authentication → Email Templates** → select **Magic Link**.
2. Set the subject to `Your BachelorNest verification code`.
3. Replace the entire message body with
   `supabase/email-templates/magic-link-otp.html` from this repo and **Save**.

The key change is `{{ .Token }}` (the 6-digit code) instead of
`{{ .ConfirmationURL }}` (the link).

### Owner verification emails (optional)

When an admin verifies an owner, the app emails them from **your Gmail account**
via a small server-side API route (`/api/notify`) — only admins can trigger it,
and the credentials never touch the browser. Without it, verification still
works — the email is skipped and the admin sees a note.

1. In your Google Account, go to **Security** and turn on **2-Step Verification**.
2. Then search **"App passwords"** → create one for **Mail** → Google shows a
   16-letter code. (Never use your real Gmail password here.)
3. Put them in `.env.local` (see `.env.example`):
   `GMAIL_USER=you@gmail.com` and `GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx`
4. Restart `npm run dev`.

Note: regular Gmail accounts can send ~500 emails/day this way — plenty for
verification mails. Keep the App Password secret like any password.
The email is a branded BachelorNest template (navy header, embedded logo,
teal accents, "Log in & add your stays" button). Set `NEXT_PUBLIC_SITE_URL`
in `.env.local` (see `.env.example`) once the app is deployed so the button
links to your live site.

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
