import Link from 'next/link';
import { Listing, TYPE_LABELS, listingAvailableBeds, minRent } from '@/lib/types';
import AvailabilityBadge from './AvailabilityBadge';
import FavoriteButton from './FavoriteButton';
import NewBadge from './NewBadge';

const GRADIENTS = [
  'from-brand-500 to-navy-800',
  'from-brand-400 to-brand-700',
  'from-navy-700 to-brand-600',
  'from-brand-600 to-navy-900',
];

export default function ListingCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const beds = listingAvailableBeds(listing);
  const rent = minRent(listing);
  const gradient = GRADIENTS[index % GRADIENTS.length];
  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${gradient}`}>
        <span className="text-5xl opacity-80">🏠</span>
        <div className="absolute right-3 top-3">
          <FavoriteButton listingId={listing.id} />
        </div>
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {TYPE_LABELS[listing.type]}
            </span>
            <NewBadge createdAt={listing.created_at} />
          </div>
          <AvailabilityBadge beds={beds} />
        </div>
        <h3 className="font-semibold leading-snug group-hover:text-brand-600">{listing.title}</h3>
        <p className="mt-1 text-sm text-zinc-500">
          {listing.locality}, {listing.city}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm">
            <span className="text-lg font-bold">₹{rent.toLocaleString('en-IN')}</span>
            <span className="text-zinc-500">/month onwards</span>
          </p>
          {listing.avg_rating && (
            <span className="text-sm font-medium text-amber-600">★ {listing.avg_rating}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
