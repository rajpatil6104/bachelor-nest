'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createInquiry } from '@/lib/db';
import { notifyEvent } from '@/lib/notify';
import { useAuth } from '@/lib/auth';

export default function BookVisit({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
        <Link href={`/login?next=/listing/${listingId}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Log in
        </Link>{' '}
        to book a visit to this place.
      </div>
    );
  }

  if (user.role !== 'tenant') {
    return null;
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
        ✅ Visit request sent! The owner will accept it soon — track it under{' '}
        <Link href="/visits" className="font-semibold underline">
          My visits
        </Link>
        .
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const inquiryId = await createInquiry({
        listing_id: listingId,
        tenant_id: user!.id,
        kind: 'visit',
        preferred_date: date || undefined,
        message: message || undefined,
      });
      if (inquiryId) void notifyEvent('visit_requested', { inquiryId });
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Could not send the request. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const inputCls =
    'w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <h3 className="font-semibold">📅 Book a visit</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="date"
          required
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message for owner (optional)"
          className={inputCls}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Request visit'}
      </button>
    </form>
  );
}
