'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'bn-cookie-consent';

// One-time notice, shown until the visitor acknowledges it. The app
// uses only essential sign-in cookies + on-device preferences (see the
// Cookie Policy) — the choice is stored locally and never sent anywhere.
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* storage unavailable — nothing to remember, don't nag */
    }
  }, []);

  if (!visible) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, new Date().toISOString());
    } catch { /* ignore */ }
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:left-auto sm:max-w-sm"
    >
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        🍪 We use cookies only to keep you signed in and remember your
        preferences — no ads, no trackers. See our{' '}
        <Link href="/cookies" className="font-medium text-brand-700 underline dark:text-brand-400">
          Cookie Policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={accept}
        className="mt-3 w-full rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 dark:bg-brand-500 dark:text-navy-950 dark:hover:bg-brand-400"
      >
        Got it
      </button>
    </div>
  );
}
