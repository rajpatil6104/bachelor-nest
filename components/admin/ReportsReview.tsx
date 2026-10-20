'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getReports, setListingStatus, setReportStatus } from '@/lib/db';
import { ListingReport } from '@/lib/types';

// Admin queue for tenant-reported listings: resolve (looked into it),
// dismiss (not a problem), or take the listing down entirely.
export default function ReportsReview() {
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    getReports()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const openCount = reports.filter((r) => r.status === 'open').length;

  async function act(
    report: ListingReport,
    action: 'resolved' | 'dismissed' | 'takedown'
  ) {
    setActing(report.id);
    setNote('');
    try {
      if (action === 'takedown') {
        await setListingStatus(report.listing_id, 'rejected');
        await setReportStatus(report.id, 'resolved');
        setNote('Listing taken down and report resolved.');
      } else {
        await setReportStatus(report.id, action);
        setNote(action === 'resolved' ? 'Report resolved.' : 'Report dismissed.');
      }
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, status: action === 'dismissed' ? 'dismissed' : 'resolved' }
            : r
        )
      );
    } catch {
      setNote('Something went wrong. Please try again.');
    } finally {
      setActing(null);
    }
  }

  if (loading) return null;
  if (reports.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">
        🚩 Listing reports{' '}
        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
          {openCount} open
        </span>
      </h2>
      {note && (
        <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          {note}
        </p>
      )}
      <div className="mt-3 space-y-3">
        {reports.map((r) => (
          <div
            key={r.id}
            className={`rounded-2xl border p-4 ${
              r.status === 'open'
                ? 'border-red-200 bg-white dark:border-red-900 dark:bg-zinc-900'
                : 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="text-sm">
                <Link
                  href={`/listing/${r.listing_id}`}
                  className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  {r.listing_title}
                </Link>
                <p className="mt-0.5 text-zinc-500">
                  <span className="font-medium text-red-600">{r.reason}</span>
                  {' · '}reported by {r.reporter_name}
                  {' · '}
                  {new Date(r.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                {r.details && (
                  <p className="mt-1 italic text-zinc-600 dark:text-zinc-400">
                    “{r.details}”
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.status === 'open'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : r.status === 'resolved'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {r.status}
              </span>
            </div>
            {r.status === 'open' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => act(r, 'takedown')}
                  disabled={acting === r.id}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Take down listing
                </button>
                <button
                  onClick={() => act(r, 'resolved')}
                  disabled={acting === r.id}
                  className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  ✓ Resolved
                </button>
                <button
                  onClick={() => act(r, 'dismissed')}
                  disabled={acting === r.id}
                  className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
