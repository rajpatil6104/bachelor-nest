'use client';

import { useEffect, useRef, useState } from 'react';

// Share a listing: WhatsApp (how housing actually gets shared in India),
// copy-link with feedback, and the native share sheet where available.
export default function ShareListing({
  listingId,
  title,
}: {
  listingId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open ]);

  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/listing/${listingId}`
      : `/listing/${listingId}`;
  const text = `Check out ${title} on BachelorsNest — bachelor-friendly stay with live vacancy 🏠`;
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    } catch {
      // Clipboard blocked (permissions) — leave the menu open to retry.
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url });
      setOpen(false);
    } catch {
      // User closed the share sheet — nothing to do.
    }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Share this listing"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 text-lg transition hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700"
      >
        🔗
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className="text-base">💬</span> Share on WhatsApp
          </a>
          <button
            onClick={copyLink}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className="text-base">{copied ? '✅' : '📋'}</span>
            {copied ? 'Link copied!' : 'Copy link'}
          </button>
          {canNativeShare && (
            <button
              onClick={nativeShare}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="text-base">↗️</span> More options…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
