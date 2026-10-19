import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import AvailabilityBadge from '@/components/AvailabilityBadge';
import BookVisit from '@/components/BookVisit';
import FavoriteButton from '@/components/FavoriteButton';
import { getListing } from '@/lib/db';
import { ROOM_LABELS, TYPE_LABELS, availableBeds, listingAvailableBeds } from '@/lib/types';

// This page shows live vacancy data — allow it to block on request-time data
export const instant = false;

export default async function ListingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection(); // vacancy data is live — never prerender this page
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const totalBeds = listingAvailableBeds(listing);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/search" className="text-sm text-brand-600 hover:underline">
        ← Back to search
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-56 items-center justify-center bg-gradient-to-br from-brand-500 to-navy-800">
          <span className="text-7xl opacity-80">🏠</span>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">
              {TYPE_LABELS[listing.type]}
            </span>
            <AvailabilityBadge beds={totalBeds} />
            {listing.avg_rating && (
              <span className="text-sm font-medium text-amber-600">
                ★ {listing.avg_rating} ({listing.review_count} reviews)
              </span>
            )}
          </div>

          <div className="mt-3 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">{listing.title}</h1>
            <FavoriteButton listingId={listing.id} size="lg" />
          </div>
          <p className="mt-1 text-zinc-500">
            {listing.address}, {listing.locality}, {listing.city}
          </p>
          <p className="mt-4 text-zinc-700 dark:text-zinc-300">{listing.description}</p>

          {/* Rooms & availability */}
          <h2 className="mt-8 text-xl font-bold">Rooms & live availability</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 text-left">Room type</th>
                  <th className="px-4 py-2 text-right">Rent/bed</th>
                  <th className="px-4 py-2 text-right">Deposit</th>
                  <th className="px-4 py-2 text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {listing.rooms.map((r) => {
                  const free = availableBeds(r);
                  return (
                    <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-700">
                      <td className="px-4 py-2">{ROOM_LABELS[r.room_type]}</td>
                      <td className="px-4 py-2 text-right">₹{r.rent_per_bed.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-right">₹{r.deposit.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        <span className={free > 0 ? 'text-green-600' : 'text-red-600'}>
                          {free} / {r.total_beds}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Amenities */}
          <h2 className="mt-8 text-xl font-bold">Amenities</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {listing.amenities.map((a) => (
              <span
                key={a}
                className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700 dark:bg-brand-900 dark:text-brand-200"
              >
                ✓ {a}
              </span>
            ))}
          </div>

          {/* House rules */}
          <h2 className="mt-8 text-xl font-bold">House rules</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{listing.house_rules}</p>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            <BookVisit listingId={listing.id} />
            <button className="w-full rounded-xl border border-brand-600 px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-950">
              💬 Chat with owner
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-400">
            Chat activates in a later update — visit booking works now.
          </p>
        </div>
      </div>
    </div>
  );
}
