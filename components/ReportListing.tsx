'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createReport, getMyOpenReport } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS, ReportReason } from '@/lib/types';

// "Report this listing" — tenants only. One open report per tenant per
// listing; admins work the queue in /admin → Listing reports.
export default function ReportListing({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('Fake listing');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [already, setAlready] = useState(false);

  useEffect(() => {
    if (user?.role === 'tenant') {
      getMyOpenReport(listingId, user.id).then((r) => {
        if (r) setAlready(true);
      });
    }
  }, [user, listingId]);

  if (user && user.role !== 'tenant') return null;

  if (!user) {
    return (
      <p className="mt-4 text-center text-sm text-zinc-400">
        Something wrong with this listing?{' '}
        <Link href={`/login?next=/listing/${listingId}`} className="font-medium hover:underline">
          Log in to report it
        </Link>
      </p>
    );
  }

  if (done) {
    return (
      <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-center text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
        ✓ Reported — thanks. Our team will review this listing.
      </p>
    );
  }

  if (already) {
    return (
      <p className="mt-4 text-center text-sm text-zinc-400">
        🚩 You've reported this listing — it's under review.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-4 text-center">
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-zinc-400 hover:text-red-600 hover:underline"
        >
          🚩 Report this listing
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createReport({
        listing_id: listingId,
        reporter_id: user!.id,
        reason,
        details: details.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/30"
    >
      <h3 className="font-semibold">🚩 Report this listing</h3>
      <p className="mt-1 text-sm text-zinc-500">
        What's wrong with it? Our team reviews every report.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REPORT_REASONS.map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => setReason(r)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              reason === r
                ? 'bg-red-600 text-white'
                : 'bg-white text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Anything else we should know? (optional)"
        className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Submit report'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-zinc-300 px-5 py-2 text-sm font-semibold dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
