'use client';

import { useEffect, useState } from 'react';
import { OwnerProfile, getPendingKyc, getSignedDocUrl, setKycStatus } from '@/lib/db';
import { sendVerifiedEmail } from '@/lib/notify';

export default function KycReview() {
  const [profiles, setProfiles] = useState<OwnerProfile[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState('');

  useEffect(() => {
    getPendingKyc().then(async (ps) => {
      setProfiles(ps);
      const urls: Record<string, string> = {};
      for (const p of ps) {
        for (const doc of p.kyc_docs) {
          try {
            urls[doc] = await getSignedDocUrl(doc);
          } catch {
            /* skip unreadable docs */
          }
        }
      }
      setDocUrls(urls);
    });
  }, []);

  async function decide(id: string, status: 'verified' | 'rejected') {
    setActing(id);
    setEmailNote('');
    // Grab the target BEFORE updating state — sending the email inside the
    // setProfiles updater would fire twice in dev (StrictMode double-invokes
    // updaters) and is a side effect where it doesn't belong.
    const target = profiles.find((p) => p.id === id);
    try {
      await setKycStatus(id, status, target?.email ?? undefined);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (target && status === 'verified') {
        const r = await sendVerifiedEmail(target.email, target.full_name);
        setEmailNote(
          r.sent
            ? `✓ Verification email sent to ${target.email}`
            : r.reason === 'not-configured'
              ? 'Owner verified, but the email was skipped: add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local (exactly those names, no NEXT_PUBLIC_ prefix) and restart the dev server.'
              : r.reason === 'no-email'
                ? 'Owner verified, but they have no email on their profile — the email could not be sent.'
                : `Owner verified, but the email could not be sent (${r.reason}). Check the server logs.`
        );
      }
    } finally {
      setActing(null);
    }
  }

  // Keep the section (and the email note) visible even after the last
  // pending owner is handled — otherwise the note above would never be seen.
  if (profiles.length === 0 && !emailNote) return null;

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold">🛡️ Owner identity verification</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {profiles.length} owner{profiles.length === 1 ? '' : 's'} waiting for KYC review.
      </p>
      {emailNote && (
        <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {emailNote}
        </p>
      )}
      <div className="mt-4 space-y-4">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{p.full_name ?? 'Unnamed owner'}</p>
                <p className="text-sm text-zinc-500">
                  {p.email ?? 'No email'} · {p.phone ?? 'No phone'} · {p.role}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => decide(p.id, 'rejected')}
                  disabled={acting === p.id}
                  className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                >
                  Reject
                </button>
                <button
                  onClick={() => decide(p.id, 'verified')}
                  disabled={acting === p.id}
                  className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {acting === p.id ? 'Saving…' : 'Verify'}
                </button>
              </div>
            </div>
            {p.kyc_docs.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {p.kyc_docs.map((doc) => (
                  <div key={doc} className="h-40 w-32 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                    {docUrls[doc] ? (
                      <a href={docUrls[doc]} target="_blank" rel="noreferrer">
                        <img src={docUrls[doc]} alt="Verification document" className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-zinc-400">
                        Loading document…
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
