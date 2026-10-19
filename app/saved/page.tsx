'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ListingCard from '@/components/ListingCard';
import { getFavoriteListings } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Listing } from '@/lib/types';

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/saved');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    getFavoriteListings(user.id)
      .then(setListings)
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading)
    return <p className="p-8 text-zinc-500">Loading your saved stays…</p>;

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Saved stays ❤️</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your shortlist — compare and book when you&apos;re ready.
      </p>

      {listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          Nothing saved yet. Tap the ♡ on any listing to build your shortlist.{' '}
          <Link href="/search" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Browse stays
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
