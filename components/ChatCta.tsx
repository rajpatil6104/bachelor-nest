'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function ChatCta({ listingId, ownerId }: { listingId: string; ownerId: string }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Link
        href={`/login?next=/listing/${listingId}`}
        className="block w-full rounded-xl border border-brand-600 px-6 py-3 text-center font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-950"
      >
        💬 Log in to chat with owner
      </Link>
    );
  }
  if (user.id === ownerId || user.role !== 'tenant') return null;

  return (
    <Link
      href={`/chat?listing=${listingId}&with=${ownerId}`}
      className="block w-full rounded-xl border border-brand-600 px-6 py-3 text-center font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-950"
    >
      💬 Chat with owner
    </Link>
  );
}
