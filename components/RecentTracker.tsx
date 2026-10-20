'use client';

import { useEffect } from 'react';
import { recordRecentView } from '@/lib/recent';

// Invisible island on the listing page: remembers this listing in the
// visitor's recently-viewed list (localStorage).
export default function RecentTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    recordRecentView(listingId);
  }, [listingId]);
  return null;
}
