'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFavoriteIds, toggleFavorite } from '@/lib/db';
import { useAuth } from '@/lib/auth';

export default function FavoriteButton({
  listingId,
  size = 'md',
}: {
  listingId: string;
  size?: 'md' | 'lg';
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && user.role === 'tenant') {
      getFavoriteIds(user.id).then((ids) => setSaved(ids.includes(listingId)));
    } else {
      setSaved(false);
    }
  }, [user, listingId]);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?next=/listing/${listingId}`);
      return;
    }
    if (user.role !== 'tenant') return;
    setBusy(true);
    try {
      const nowSaved = await toggleFavorite(user.id, listingId);
      setSaved(nowSaved);
    } finally {
      setBusy(false);
    }
  }

  const dims = size === 'lg' ? 'h-11 w-11 text-2xl' : 'h-9 w-9 text-xl';

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-label={saved ? 'Remove from saved' : 'Save this stay'}
      title={saved ? 'Remove from saved' : 'Save this stay'}
      className={`${dims} flex items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:scale-110 disabled:opacity-60 dark:bg-zinc-900/90 ${
        saved ? 'text-red-500' : 'text-zinc-400 hover:text-red-400'
      }`}
    >
      {saved ? '♥' : '♡'}
    </button>
  );
}
