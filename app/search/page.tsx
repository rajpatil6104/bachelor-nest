'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ListingCard from '@/components/ListingCard';
import { getListings } from '@/lib/db';
import { Listing, ListingType, RoomType, SearchFilters } from '@/lib/types';

function SearchResults() {
  const params = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Find your stay</h1>

      {/* Filters */}
      <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <input
          value={maxBudget}
          onChange={(e) => setMaxBudget(e.target.value)}
          type="number"
          placeholder="Max budget ₹/mo"
          className="rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
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
      {loading ? (
        <p className="mt-8 text-zinc-500">Searching…</p>
      ) : listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          No stays match your filters. Try widening the budget or city.
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-zinc-500">
            {listings.length} stay{listings.length === 1 ? '' : 's'} found
          </p>
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
