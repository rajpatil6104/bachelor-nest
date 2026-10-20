'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTenantAgreements } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Agreement } from '@/lib/types';

export default function MyAgreementsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/agreements');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    getTenantAgreements(user.email)
      .then(setAgreements)
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return <p className="p-8 text-zinc-500">Loading your agreements…</p>;
  }
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">My agreements 📄</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Rental agreements owners have sent to {user.email}. Review the terms
        and accept the ones you're happy with.
      </p>

      {agreements.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          No agreements yet. When an owner sends you one after a visit, it will
          appear here.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {agreements.map((a) => (
            <Link
              key={a.id}
              href={`/agreements/${a.id}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    {a.listing_title}
                    {a.room_label ? ` · ${a.room_label}` : ''}
                  </h2>
                  <p className="text-sm text-zinc-500">{a.property_address}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    ₹{a.monthly_rent.toLocaleString('en-IN')}/month · deposit ₹
                    {a.deposit.toLocaleString('en-IN')} · from {a.start_date} ·{' '}
                    {a.duration_months} months
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    a.status === 'accepted'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                  }`}
                >
                  {a.status === 'accepted' ? '✓ accepted' : 'review & accept'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
