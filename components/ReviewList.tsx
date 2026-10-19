import { Review } from '@/lib/types';
import Stars from './Stars';

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No reviews yet. Be the first bachelor to share your experience!
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
                B
              </div>
              <div>
                <p className="text-sm font-medium">Verified bachelor</p>
                <p className="text-xs text-zinc-500">
                  {new Date(r.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <Stars value={r.rating} className="text-sm" />
          </div>
          {r.comment && (
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{r.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
}
