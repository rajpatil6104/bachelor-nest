'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyReview, hasCompletedVisit, submitReview } from '@/lib/db';
import { useAuth } from '@/lib/auth';

export default function ReviewForm({
  listingId,
  onSubmitted,
}: {
  listingId: string;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [existing, setExisting] = useState(false);
  const [visited, setVisited] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'tenant') {
      Promise.all([
        getMyReview(listingId, user.id),
        hasCompletedVisit(user.id, listingId),
      ]).then(([r, done]) => {
        if (r) {
          setExisting(true);
          setRating(r.rating);
          setComment(r.comment ?? '');
        }
        setVisited(done);
        setChecked(true);
      });
    }
  }, [user, listingId]);

  if (!user) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm dark:border-zinc-700">
        <Link href={`/login?next=/listing/${listingId}`} className="font-medium text-brand-700 dark:text-brand-300">
          Log in
        </Link>{' '}
        as a bachelor to write a review.
      </div>
    );
  }
  if (user.role !== 'tenant') return null;

  // Reviews unlock only after a completed visit (owner confirmed it happened).
  // A tenant who already reviewed can keep editing theirs.
  if (checked && !existing && !visited) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
        🔒 Reviews unlock after a visit.{' '}
        <Link href="#book-visit" className="font-medium text-brand-700 dark:text-brand-300">
          Book a visit
        </Link>{' '}
        — once the owner confirms the visit happened, you can review this stay.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError('Please pick a star rating.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await submitReview(listingId, user!.id, rating, comment);
      setExisting(true);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your review.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-semibold">
        {existing ? 'Your review (edit anytime)' : 'Write a review'}
      </h3>
      <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            className={`text-3xl transition ${
              i <= (hover || rating)
                ? 'text-amber-500'
                : 'text-zinc-300 dark:text-zinc-700'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="How was the stay? Food, owner, rules, location…"
        className="mt-3 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-3 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? 'Saving…' : existing ? 'Update review' : 'Post review'}
      </button>
    </form>
  );
}
