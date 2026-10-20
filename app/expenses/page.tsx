'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createExpenseGroup, getExpenseGroups } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { ExpenseGroup } from '@/lib/types';

const inputCls =
  'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';

export default function ExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [myName, setMyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/expenses');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setMyName((prev) => prev || user.name);
    getExpenseGroups(user.id)
      .then(setGroups)
      .finally(() => setLoading(false));
  }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      setError('Give your home a name — e.g. "Sunrise PG, Room 4".');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const g = await createExpenseGroup(user.id, name.trim(), myName.trim() || user.name);
      router.push(`/expenses/${g.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the group.');
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return <p className="p-8 text-zinc-500">Loading your expense groups…</p>;
  }
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Expense splitter 🧾</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Split rent, groceries and bills with your flatmates — no spreadsheets,
        no awkward math. Flatmates don't need accounts; you add them by name
        and log the expenses.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-6 space-y-3 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="font-bold">Start a new home</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Home name — e.g. Koramangala flat"
            className={inputCls}
          />
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="Your name in the group"
            className={inputCls}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create home'}
        </button>
      </form>

      <h2 className="mt-8 text-lg font-bold">Your homes</h2>
      {groups.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
          No homes yet. Create one above and add your flatmates.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/expenses/${g.id}`}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="font-semibold">🏠 {g.name}</p>
                <p className="text-sm text-zinc-500">
                  Created{' '}
                  {new Date(g.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span className="font-medium text-brand-600">Open →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
