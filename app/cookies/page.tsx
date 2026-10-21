import type { Metadata } from 'next';
import LegalPage, { LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'The cookies and local storage BachelorsNest uses — only what is needed to sign you in and remember your preferences. No advertising, no trackers.',
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      intro="BachelorsNest keeps this deliberately small: we use cookies and browser storage only to run the site — there are no advertising cookies and no third-party trackers. This page lists exactly what is stored and why."
    >
      <LegalSection heading="Essential: staying signed in">
        <p>
          Our sign-in provider (Supabase) sets session cookies so you stay logged in securely
          between pages and visits. These are strictly necessary — without them, accounts
          cannot work — and they are never used to follow you to other websites.
        </p>
      </LegalSection>

      <LegalSection heading="Functional: your preferences">
        <p>
          Your browser&apos;s local storage remembers your light/dark theme, your choice on
          the cookie notice itself, and small working state (for example, the listings you
          recently viewed, kept on your device only). None of this is sent to us.
        </p>
      </LegalSection>

      <LegalSection heading="Demo mode">
        <p>
          If you use one of the demo logins, the demo session and any sample changes you make
          are stored only in your browser&apos;s local storage, so the demo works without an
          account. Clearing your browser data removes all of it.
        </p>
      </LegalSection>

      <LegalSection heading="Maps">
        <p>
          Pages with a map load map tiles from OpenStreetMap. As with any embedded map, that
          request shows the map provider your IP address and the area being viewed — the map
          cannot work otherwise. We do not add any tracking of our own on top of it.
        </p>
      </LegalSection>

      <LegalSection heading="Managing cookies">
        <p>
          You can block or delete cookies and local storage in your browser settings at any
          time. Blocking the essential sign-in cookies will sign you out and prevent logging
          in; everything else on the site keeps working. Questions: contact.bachelorsnest@gmail.com.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
