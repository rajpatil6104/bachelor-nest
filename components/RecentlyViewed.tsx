'use client';

import { useEffect, useState } from 'react';
import ListingCard from './ListingCard';
import { getListing } from '@/lib/db';
import { readRecentIds } from '@/lib/recent';
import { Listing } from '@/lib/types';

// "Recently viewed" row on the home page, from the visitor's
// localStorage history. Listings that were deleted or sent back for
// re-verification quietly drop out. Renders nothing when there's no
// history yet.
export default function RecentlyViewed() {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    const ids = readRecentIds();
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(ids.map((id) => getListing(id).catch(() => null))).then((res) => {
      if (cancelled) return;
      setListings(
        res.filter((l): l is Listing => !!l && l.status === 'approved').slice(0, 6)
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (listings.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12">
      <h2 className="mb-6 text-2xl font-bold">Recently viewed 👀</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <ListingCard key={l.id} listing={l} index={i} />
        ))}
      </div>
    </section>
  );
}
