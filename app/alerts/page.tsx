'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteAlert, getAlerts, getListings } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { ROOM_LABELS, VacancyAlert } from '@/lib/types';

interface AlertWithMatches extends VacancyAlert {
  matchCount: number | null;
}

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertWithMatches[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/alerts');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await getAlerts(user.id);
      const withMatches = await Promise.all(
        list.map(async (a) => {
          try {
            let matches = await getListings({
              city: a.city,
              maxBudget: a.max_budget ?? undefined,
              roomType: a.room_type ?? undefined,
            });
            if (a.locality) {
              const loc = a.locality.toLowerCase();
              matches = matches.filter(
                (l) =>
                  l.locality.toLowerCase().includes(loc) ||
                  l.address.toLowerCase().includes(loc)
              );
            }
            return { ...a, matchCount: matches.length };
          } catch {
            return { ...a, matchCount: null };
          }
        })
      );
      setAlerts(withMatches);
      setLoading(false);
    })();
  }, [user]);

  async function handleDelete(id: string) {
    await deleteAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function viewUrl(a: VacancyAlert) {
    const p = new URLSearchParams();
    p.set('city', a.city);
    if (a.max_budget) p.set('maxBudget', String(a.max_budget));
    if (a.room_type) p.set('roomType', a.room_type);
    return `/search?${p.toString()}`;
  }

  if (authLoading || loading)
    return <p className="p-8 text-zinc-500">Loading your alerts…</p>;

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Vacancy alerts 🔔</h1>
      <p className="mt-1 text-sm text-zinc-500">
        We watch for new stays matching your criteria — check back here to see
        what appeared.
      </p>

      {alerts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
          No alerts yet. Search for a city on the{' '}
          <Link href="/search" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            search page
          </Link>{' '}
          and hit “Alert me about new stays”.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="font-semibold">
                  {a.city}
                  {a.locality ? ` · ${a.locality}` : ''}
                </p>
                <p className="text-sm text-zinc-500">
                  {a.max_budget ? `Up to ₹${a.max_budget.toLocaleString('en-IN')}/mo` : 'Any budget'}
                  {a.room_type ? ` · ${ROOM_LABELS[a.room_type]}` : ''}
                </p>
                <p className="mt-1 text-sm">
                  {a.matchCount === null ? (
                    <span className="text-zinc-400">Couldn&apos;t check just now</span>
                  ) : a.matchCount > 0 ? (
                    <span className="font-semibold text-green-600">
                      {a.matchCount} matching stay{a.matchCount === 1 ? '' : 's'} right now
                    </span>
                  ) : (
                    <span className="text-zinc-500">No matches yet — we&apos;ll keep watching</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={viewUrl(a)}
                  className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  View matches
                </Link>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-500 hover:border-red-400 hover:text-red-600 dark:border-zinc-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
