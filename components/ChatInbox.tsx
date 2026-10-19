'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conversation, getConversations, getListing } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import ChatBox from './ChatBox';

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ChatInbox() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [newTitle, setNewTitle] = useState('');

  const selListing = params.get('listing');
  const selOther = params.get('with');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/chat');
  }, [user, authLoading, router]);

  const load = useCallback(() => {
    if (user) getConversations(user.id).then(setConvos).catch(() => {});
  }, [user]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  // Title for a brand-new conversation (no messages yet)
  useEffect(() => {
    if (selListing && selOther && !convos.some((c) => c.listing_id === selListing && c.other_id === selOther)) {
      getListing(selListing).then((l) => setNewTitle(l?.title ?? ''));
    } else {
      setNewTitle('');
    }
  }, [selListing, selOther, convos]);

  if (authLoading || !user) {
    return <p className="p-6 text-center text-sm text-zinc-500">Loading chats…</p>;
  }

  const active = selListing && selOther
    ? convos.find((c) => c.listing_id === selListing && c.other_id === selOther) ?? null
    : null;
  const isNew = !!(selListing && selOther && !active);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">💬 Chats</h1>
      <div className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className={`${selListing ? 'hidden md:block' : 'block'} border-b border-zinc-200 dark:border-zinc-800 md:border-b-0 md:border-r`}>
          {convos.length === 0 && !isNew ? (
            <p className="p-6 text-sm text-zinc-500">
              No chats yet. Open a listing and tap “Chat with owner” to start one.
            </p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
              {convos.map((c) => {
                const selected = c.listing_id === selListing && c.other_id === selOther;
                return (
                  <li key={`${c.listing_id}|${c.other_id}`}>
                    <Link
                      href={`/chat?listing=${c.listing_id}&with=${c.other_id}`}
                      className={`flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${selected ? 'bg-brand-50 dark:bg-brand-950' : ''}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
                        {(c.other_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{c.other_name}</p>
                          <span className="shrink-0 text-xs text-zinc-400">{timeAgo(c.last_at)}</span>
                        </div>
                        <p className="truncate text-xs text-zinc-500">{c.listing_title}</p>
                        <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{c.last_body}</p>
                      </div>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Active thread */}
        <div className={`${selListing ? 'block' : 'hidden md:block'} flex h-[70vh] flex-col`}>
          {active || isNew ? (
            <>
              <div className="flex items-center gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
                <Link href="/chat" className="md:hidden">←</Link>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
                  {((active?.other_name || '?'))[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {active?.other_name ?? (user.role === 'owner' ? 'Bachelor' : 'Owner')}
                  </p>
                  <Link
                    href={`/listing/${selListing}`}
                    className="truncate text-xs text-brand-600 hover:underline"
                  >
                    {active?.listing_title || newTitle || 'View listing'}
                  </Link>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <ChatBox
                  listingId={selListing!}
                  me={user.id}
                  myName={user.name}
                  otherId={selOther!}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-500">
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
