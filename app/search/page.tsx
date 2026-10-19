'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ListingCard from '@/components/ListingCard';
import { createAlert, getListings } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Listing, ListingType, RoomType, SearchFilters } from '@/lib/types';

function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertSaved, setAlertSaved] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);

  const [city, setCity] = useState(params.get('city') ?? '');
  const [maxBudget, setMaxBudget] = useState(params.get('maxBudget') ?? '');
  const [type, setType] = useState<ListingType | ''>((params.get('type') as ListingType) ?? '');
  const [roomType, setRoomType] = useState<RoomType | ''>((params.get('roomType') as RoomType) ?? '');

  useEffect(() => {
    setLoading(true);
    const filters: SearchFilters = {
      city: city || undefined,
      maxBudget: maxBudget ? Number(maxBudget) : undefined,
      type: type || undefined,
      roomType: roomType || undefined,
    };
    getListings(filters).then((data) => {
      setListings(data);
      setLoading(false);
    });
  }, [city, maxBudget, type, roomType]);

  async function handleCreateAlert() {
    if (!user) {
      router.push('/login?next=/search');
      return;
    }
    if (user.role !== 'tenant' || !city.trim()) return;
    setAlertBusy(true);
    try {
      await createAlert(user.id, {
        city: city.trim(),
        maxBudget: maxBudget ? Number(maxBudget) : undefined,
        roomType: roomType || undefined,
      });
      setAlertSaved(true);
      setTimeout(() => setAlertSaved(false), 3500);
    } finally {
      setAlertBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Find your stay</h1>

      {/* Filters */}
      <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <input
          value={maxBudget}
          onChange={(e) => setMaxBudget(e.target.value)}
          type="number"
          placeholder="Max budget ₹/mo"
          className="rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ListingType | '')}
          className="rounded-xl border border-zinc-200 px-3 py-2 outline-none dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">All types</option>
          <option value="pg">PG</option>
          <option value="hostel">Hostel</option>
          <option value="room">Room</option>
          <option value="flat">Flat</option>
          <option value="coliving">Co-living</option>
        </select>
        <select
          value={roomType}
          onChange={(e) => setRoomType(e.target.value as RoomType | '')}
          className="rounded-xl border border-zinc-200 px-3 py-2 outline-none dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">Any sharing</option>
          <option value="single">Single</option>
          <option value="double">Double sharing</option>
          <option value="triple">Triple sharing</option>
          <option value="dorm">Dorm</option>
        </select>
      </div>

      {/* Results */}
      <div className="mt-6 flex items-center justify-between">
        {loading ? (
          <p className="text-sm text-zinc-500">Searching…</p>
        ) : (
          <p className="text-sm text-zinc-500">
            {listings.length} stay{listings.length === 1 ? '' : 's'} found
          </p>
        )}
        <button
          onClick={handleCreateAlert}
          disabled={alertBusy || !city.trim()}
          title={city.trim() ? 'Get notified when matching stays appear' : 'Enter a city first'}
          className="rounded-full border border-brand-600 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-950"
        >
          {alertSaved ? '🔔 Alert saved!' : '🔔 Alert me about new stays'}
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-zinc-500">Searching…</p>
      ) : listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          No stays match your filters. Try widening the budget or city — or save an
          alert above and we&apos;ll watch for new ones.
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => (
              <ListingCard key={l.id} listing={l} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="p-8 text-zinc-500">Loading…</p>}>
      <SearchResults />
    </Suspense>
  );
}
