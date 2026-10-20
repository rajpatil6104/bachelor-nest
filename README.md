# 🏠 BachelorsNest

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
2. Enter the 6-digit OTP emailed to them from the app's Gmail (see below).
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
- Note: Supabase's "Confirm email" must stay OFF (see OTP section above);
  the app handles email verification itself with the Gmail OTP.

### Owner OTP emails (sent by the app via Gmail — Supabase sends nothing)

Owner registration uses a self-hosted OTP: the app generates the 6-digit code
and emails it from your Gmail. No Supabase email templates or custom SMTP
needed — in fact, you can now **disable** the custom SMTP you added earlier.

1. Run `supabase/migration_email_otp.sql` in the SQL editor. It creates an
   `email_otps` table plus two locked-down functions that store codes as
   SHA-256 hashes (10-minute expiry, single-use, 5 wrong attempts lock,
   max 5 codes per email per hour).
2. In Supabase dashboard → **Authentication → Providers → Email**, turn **OFF**
   "Confirm email". This stops Supabase sending any auth emails and makes
   `signUp` return a session immediately after the OTP is verified.
3. Put `GMAIL_USER` + `GMAIL_APP_PASSWORD` in `.env.local` (see `.env.example`).

How it works: `/api/otp/send` creates the code and emails a branded template →
`/api/otp/verify` checks it → the app creates the account with `signUp`.
The old `supabase/email-templates/magic-link-otp.html` is no longer used.

### Event notification emails (optional)

Visit + alert emails, sent from the same Gmail account by `/api/notify-event`:

- Tenant books a visit → owner gets a "new visit request" email
- Owner accepts / declines / confirms the visit → tenant gets the update
  (the "visit completed" email invites them to review the stay)
- Admin approves a listing → tenants whose vacancy alerts match it
  (city, budget, room type) get a "new stay" email

Run `supabase/migration_notifications.sql` once — it adds the
SECURITY DEFINER contact helpers the route uses (profiles stay private
under RLS; the helpers expose one email at a time for a listing/inquiry
the caller is part of). Uses the same `GMAIL_USER` / `GMAIL_APP_PASSWORD`
env vars; if they're unset, every email silently no-ops and the app is
unaffected.

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
The email is a branded BachelorsNest template (navy header, embedded logo,
teal accents, "Log in & add your stays" button). Set `NEXT_PUBLIC_SITE_URL`
in `.env.local` (see `.env.example`) once the app is deployed so the button
links to your live site.

## Forgot password

Login → "Forgot password?" runs: email → 6-digit code (same self-hosted
OTP system as owner registration, emailed from your Gmail) → verify →
new password → back to login. Two setup items:

1. Run `supabase/migration_password_reset.sql` in the SQL editor (stores
   the single-use, 10-minute reset tokens — hashed, service-role only).
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (and to your host's
   env vars, marked secret): Supabase → Project Settings → API →
   Project API keys → **service_role**. The reset routes use it
   server-side only to set the verified user's new password. Treat it
   like a master key — never commit it, never share it, never expose it
   to the browser.

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
