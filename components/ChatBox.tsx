'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, getMessages, markMessagesRead, sendMessage } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';

export default function ChatBox({
  listingId,
  me,
  myName,
  otherId,
}: {
  listingId: string;
  me: string;
  myName: string;
  otherId: string;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMessages(listingId, me, otherId);
      setMsgs(data);
      markMessagesRead(listingId, me, otherId).catch(() => {});
    } catch {
      /* offline — keep showing what we have */
    }
  }, [listingId, me, otherId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const sb = getSupabase();
    let channel: { unsubscribe: () => void } | null = null;
    if (sb) {
      const ch = sb
        .channel(`chat-${listingId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `listing_id=eq.${listingId}`,
          },
          () => load()
        )
        .subscribe();
      channel = { unsubscribe: () => sb.removeChannel(ch) };
    }
    return () => {
      clearInterval(poll);
      channel?.unsubscribe();
    };
  }, [load, listingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendMessage(listingId, me, myName, otherId, body);
      setText('');
      await load();
    } catch {
      /* keep the text so the user can retry */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-500">
            No messages yet — say hello! 👋
          </p>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  mine
                    ? 'rounded-br-md bg-brand-600 text-white'
                    : 'rounded-bl-md bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                <p>{m.body}</p>
                <p
                  className={`mt-1 text-right text-[10px] ${
                    mine ? 'text-brand-100' : 'text-zinc-400'
                  }`}
                >
                  {new Date(m.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={1000}
          className="flex-1 rounded-xl border border-zinc-300 bg-transparent px-4 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
