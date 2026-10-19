'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPendingListings, setListingStatus } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import KycReview from '@/components/admin/KycReview';
import {
  Listing,
  ROOM_LABELS,
  TYPE_LABELS,
  availableBeds,
} from '@/lib/types';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.replace('/login?next=/admin');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    getPendingListings()
      .then(setListings)
      .finally(() => setLoading(false));
  }, [user]);

  async function moderate(id: string, status: 'approved' | 'rejected') {
    setActing(id);
    try {
      await setListingStatus(id, status);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setActing(null);
    }
  }

  if (authLoading || loading)
    return <p className="p-8 text-zinc-500">Loading pending listings…</p>;

  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🛡️</div>
        <h1 className="mt-4 text-xl font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Log in with an admin account to review listings.
        </p>
        <Link
          href="/login?next=/admin"
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Review listings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {listings.length} propert{listings.length === 1 ? 'y' : 'ies'} waiting for verification.
        Approved listings go live instantly.
      </p>

      <KycReview />

      {listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
          <div className="text-5xl">✅</div>
          <p className="mt-3 font-medium">All caught up!</p>
          <p className="text-sm text-zinc-500">No pending listings right now.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {listings.map((l) => (
            <div
              key={l.id}
              className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    {TYPE_LABELS[l.type]} · pending
                  </span>
                  <h2 className="mt-2 text-lg font-bold">{l.title}</h2>
                  <p className="text-sm text-zinc-500">
                    {l.address}, {l.locality}, {l.city}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => moderate(l.id, 'rejected')}
                    disabled={acting === l.id}
                    className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => moderate(l.id, 'approved')}
                    disabled={acting === l.id}
                    className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {acting === l.id ? 'Saving…' : 'Approve'}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{l.description}</p>

              {l.photos.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {l.photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`${l.title} photo ${i + 1}`}
                      className="h-20 w-28 shrink-0 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">Rooms</h3>
                  <ul className="mt-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {l.rooms.map((r) => (
                      <li key={r.id}>
                        {ROOM_LABELS[r.room_type]} — {r.total_beds} beds · ₹
                        {r.rent_per_bed.toLocaleString('en-IN')}/bed · deposit ₹
                        {r.deposit.toLocaleString('en-IN')}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Amenities</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {l.amenities.join(', ') || '—'}
                  </p>
                  <h3 className="mt-3 text-sm font-semibold">House rules</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {l.house_rules || '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
