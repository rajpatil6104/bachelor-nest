'use client';

import { useEffect } from 'react';
import { recordRecentView } from '@/lib/recent';
import { trackListingView } from '@/lib/db';
import { useAuth } from '@/lib/auth';

// Invisible island on the listing page: remembers this listing in the
// visitor's recently-viewed list (localStorage) and counts one view
// per visitor session for the owner's analytics. Owners viewing their
// own listing don't inflate the count.
export default function RecentTracker({
  listingId,
  ownerId,
}: {
  listingId: string;
  ownerId: string;
}) {
  const { user } = useAuth();

  useEffect(() => {
    recordRecentView(listingId);
    if (user?.id === ownerId) return;
    const key = `bn-viewed-${listingId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage unavailable — count the view anyway.
    }
    void trackListingView(listingId);
  }, [listingId, ownerId, user]);

  return null;
}
