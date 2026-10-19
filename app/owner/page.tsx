'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOwnerListings } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Listing,
  ROOM_LABELS,
  TYPE_LABELS,
  availableBeds,
  listingAvailableBeds,
} from '@/lib/types';

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'owner')) {
      router.replace('/login?next=/owner');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    getOwnerListings(user.id).then((data) => {
      setListings(data);
      setLoading(false);
    });
  }, [user]);

  const adjustOccupied = async (listingId: string, roomId: string, delta: number) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId
          ? {
              ...l,
              rooms: l.rooms.map((r) => {
                if (r.id !== roomId) return r;
                const next = Math.min(r.total_beds, Math.max(0, r.occupied_beds + delta));
                return { ...r, occupied_beds: next };
              }),
            }
          : l
      )
    );

    // Persist to Supabase when configured
    const sb = getSupabase();
    if (sb) {
      const room = listings
        .find((l) => l.id === listingId)
        ?.rooms.find((r) => r.id === roomId);
      if (room) {
        const next = Math.min(room.total_beds, Math.max(0, room.occupied_beds + delta));
        await sb.from('rooms').update({ occupied_beds: next }).eq('id', roomId);
      }
    }
  };

  if (authLoading || loading) return <p className="p-8 text-zinc-500">Loading your listings…</p>;

  if (!user || user.role !== 'owner') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔑</div>
        <h1 className="mt-4 text-xl font-bold">Owners only</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Log in with an owner account to manage your listings.
        </p>
        <Link
          href="/login?next=/owner"
          className="mt-6 inline-block rounded-full bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-700"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Owner dashboard</h1>
          <p className="text-sm text-zinc-500">
            Update bed occupancy — tenants see availability change instantly.
          </p>
        </div>
        <Link
          href="/owner/add"
          className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + Add listing
        </Link>
      </div>

      {listings.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          No listings yet.{' '}
          <Link href="/owner/add" className="text-indigo-600 hover:underline">
            Add your first property
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {listings.map((l) => (
          <div
            key={l.id}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                  {TYPE_LABELS[l.type]}
                </span>
                <h2 className="mt-1 text-lg font-bold">{l.title}</h2>
                <p className="text-sm text-zinc-500">
                  {l.locality}, {l.city} ·{' '}
                  <span className="font-semibold text-green-600">
                    {listingAvailableBeds(l)} beds free
                  </span>
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  l.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {l.status}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {l.rooms.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800"
                >
                  <div className="text-sm">
                    <span className="font-medium">{ROOM_LABELS[r.room_type]}</span>
                    <span className="text-zinc-500">
                      {' '}
                      · ₹{r.rent_per_bed.toLocaleString('en-IN')}/bed · {availableBeds(r)} of{' '}
                      {r.total_beds} free
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Occupied: {r.occupied_beds}</span>
                    <button
                      onClick={() => adjustOccupied(l.id, r.id, -1)}
                      disabled={r.occupied_beds === 0}
                      className="h-8 w-8 rounded-full border border-zinc-300 font-bold disabled:opacity-30 dark:border-zinc-600"
                      aria-label="Decrease occupied"
                    >
                      −
                    </button>
                    <button
                      onClick={() => adjustOccupied(l.id, r.id, 1)}
                      disabled={r.occupied_beds === r.total_beds}
                      className="h-8 w-8 rounded-full border border-zinc-300 font-bold disabled:opacity-30 dark:border-zinc-600"
                      aria-label="Increase occupied"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
