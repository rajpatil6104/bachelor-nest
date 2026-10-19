'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTenantInquiries } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Inquiry } from '@/lib/types';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  done: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

export default function MyVisitsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/visits');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    getTenantInquiries(user.id).finally(() => setLoading(false)).then(setInquiries);
  }, [user]);

  if (authLoading || loading)
    return <p className="p-8 text-zinc-500">Loading your visit requests…</p>;

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">My visits 📅</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Track the visit requests you&apos;ve sent to owners.
      </p>

      {inquiries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          No visit requests yet.{' '}
          <Link href="/search" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Find a stay
          </Link>{' '}
          and book your first visit.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {inquiries.map((inq) => (
            <Link
              key={inq.id}
              href={`/listing/${inq.listing_id}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{inq.listing_title ?? 'Listing'}</h2>
                  <p className="text-sm text-zinc-500">
                    {inq.listing_locality}, {inq.listing_city}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {inq.preferred_date
                      ? `Requested visit: ${inq.preferred_date}`
                      : 'No date specified'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[inq.status] ?? STATUS_STYLE.done}`}
                >
                  {inq.status}
                </span>
              </div>
              {inq.status === 'accepted' && (
                <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                  🎉 The owner accepted! Contact them to fix a time.
                </p>
              )}
              {inq.status === 'rejected' && (
                <p className="mt-2 text-sm text-zinc-500">
                  This one didn&apos;t work out — try another stay nearby.
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
