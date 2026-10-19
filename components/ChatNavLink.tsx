'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUnreadCount } from '@/lib/db';
import { useAuth } from '@/lib/auth';

export default function ChatNavLink() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    const load = () => getUnreadCount(user.id).then(setUnread).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user]);

  if (!user || user.role === 'admin') return null;

  return (
    <Link href="/chat" className="relative hover:text-brand-600 dark:hover:text-brand-400">
      💬 Chats
      {unread > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
