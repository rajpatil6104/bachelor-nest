'use client';

import { useCallback, useEffect, useState } from 'react';
import { getReviews } from '@/lib/db';
import { Review } from '@/lib/types';
import ReviewList from './ReviewList';
import ReviewForm from './ReviewForm';
import Stars from './Stars';

export default function ReviewsSection({ listingId }: { listingId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = useCallback(() => {
    getReviews(listingId).then(setReviews);
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  const count = reviews.length;
  const avg = count
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : 0;

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {count > 0 ? (
          <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Stars value={avg} className="text-sm" />
            <span className="font-semibold text-zinc-900 dark:text-white">{avg}</span>
            <span>({count})</span>
          </span>
        ) : (
          <span className="text-sm text-zinc-500">No ratings yet</span>
        )}
      </div>
      <div className="mt-4">
        <ReviewList reviews={reviews} />
      </div>
      <ReviewForm listingId={listingId} onSubmitted={load} />
    </div>
  );
}
