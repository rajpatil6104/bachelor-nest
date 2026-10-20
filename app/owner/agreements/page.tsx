'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OwnerGate from '@/components/owner/OwnerGate';
import {
  createAgreement,
  deleteAgreement,
  getOwnerAgreements,
  getOwnerListings,
} from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Agreement, Listing, ROOM_LABELS } from '@/lib/types';

const inputCls =
  'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';
const labelCls = 'mb-1 block text-sm font-semibold';

export default function OwnerAgreementsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);

  const [listingId, setListingId] = useState('');
  const [roomIdx, setRoomIdx] = useState(0);
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [rent, setRent] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(11);
  const [terms, setTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setStartDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'owner')) {
      router.replace('/login?next=/owner/agreements');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    Promise.all([getOwnerListings(user.id), getOwnerAgreements(user.id)])
      .then(([l, a]) => {
        setListings(l);
        setAgreements(a);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const listing = useMemo(
    () => listings.find((l) => l.id === listingId) ?? null,
    [listings, listingId]
  );

  function pickListing(id: string) {
    setListingId(id);
    setRoomIdx(0);
    const l = listings.find((x) => x.id === id);
    if (l) {
      setRent(l.rooms[0]?.rent_per_bed ?? 0);
      setDeposit(l.rooms[0]?.deposit ?? 0);
      setTerms(l.house_rules ?? '');
    }
  }

  function pickRoom(idx: number) {
    setRoomIdx(idx);
    const r = listing?.rooms[idx];
    if (r) {
      setRent(r.rent_per_bed);
      setDeposit(r.deposit);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !listing) {
      setError('Pick one of your listings first.');
      return;
    }
    if (!tenantName.trim()) {
      setError("Enter the tenant's name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail.trim())) {
      setError("Enter a valid tenant email — the agreement appears in their account under this email.");
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const room = listing.rooms[roomIdx];
      const agr = await createAgreement({
        listing_id: listing.id,
        owner_id: user.id,
        owner_name: user.name,
        listing_title: listing.title,
        property_address: `${listing.address}, ${listing.locality}, ${listing.city}`,
        room_label: room ? room.label || ROOM_LABELS[room.room_type] : null,
        tenant_name: tenantName.trim(),
        tenant_email: tenantEmail.trim(),
        tenant_phone: tenantPhone.trim() || null,
        monthly_rent: rent,
        deposit,
        start_date: startDate,
        duration_months: duration,
        terms: terms.trim() || null,
      });
      setAgreements((prev) => [agr, ...prev]);
      setNotice(`Agreement sent to ${tenantEmail.trim()} — they'll see it under "My agreements".`);
      setTenantName('');
      setTenantEmail('');
      setTenantPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the agreement.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAgreement(id);
      setAgreements((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setConfirmDeleteId(null);
    }
  }

  if (authLoading || loading) {
    return <p className="p-8 text-zinc-500">Loading agreements…</p>;
  }
  if (!user || user.role !== 'owner') return null;

  return (
    <OwnerGate>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/owner" className="text-sm font-medium text-brand-600 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Rental agreements 📄</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create a digital agreement after a visit works out. The tenant sees it
          in their account, accepts it there, and both of you can download the PDF.
        </p>

        {notice && (
          <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
            {notice}
          </p>
        )}

        {/* Create form */}
        <form
          onSubmit={handleCreate}
          className="mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-lg font-bold">New agreement</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Your listing</label>
              <select
                value={listingId}
                onChange={(e) => pickListing(e.target.value)}
                className={inputCls}
              >
                <option value="">Select a listing…</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} — {l.locality}, {l.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Room / space</label>
              <select
                value={roomIdx}
                onChange={(e) => pickRoom(Number(e.target.value))}
                disabled={!listing}
                className={inputCls}
              >
                {(listing?.rooms ?? []).map((r, i) => (
                  <option key={r.id} value={i}>
                    {r.label || ROOM_LABELS[r.room_type]} — ₹{r.rent_per_bed.toLocaleString('en-IN')}/mo
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Tenant name</label>
              <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputCls} placeholder="e.g. Aman Kumar" />
            </div>
            <div>
              <label className={labelCls}>Tenant email</label>
              <input value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} className={inputCls} placeholder="tenant@example.com" />
              {user.demo && (
                <p className="mt-1 text-xs text-zinc-400">Demo tip: use bachelor@demo.in to test the tenant side.</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Tenant phone (optional)</label>
              <input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className={inputCls} placeholder="10-digit mobile" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className={labelCls}>Monthly rent (₹)</label>
              <input type="number" min={0} value={rent} onChange={(e) => setRent(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Deposit (₹)</label>
              <input type="number" min={0} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Duration (months)</label>
              <input type="number" min={1} max={36} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>House rules & terms</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} className={inputCls}
              placeholder="Prefilled from the listing's house rules — edit if needed. Separate rules with a semicolon (;)." />
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

          <button type="submit" disabled={busy}
            className="rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create & send agreement'}
          </button>
        </form>

        {/* List */}
        <h2 className="mt-8 text-lg font-bold">Your agreements</h2>
        {agreements.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
            No agreements yet. Create your first one above.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {agreements.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm">
                  <p className="font-semibold">{a.listing_title}{a.room_label ? ` · ${a.room_label}` : ''}</p>
                  <p className="text-zinc-500">
                    {a.tenant_name} ({a.tenant_email}) · ₹{a.monthly_rent.toLocaleString('en-IN')}/mo · from {a.start_date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    a.status === 'accepted'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                  }`}>
                    {a.status === 'accepted' ? '✓ accepted' : 'sent — awaiting tenant'}
                  </span>
                  <Link href={`/agreements/${a.id}`} className="rounded-full border border-brand-300 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-950">
                    View
                  </Link>
                  {confirmDeleteId === a.id ? (
                    <>
                      <button onClick={() => handleDelete(a.id)} className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-semibold text-white">
                        Confirm delete
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold dark:border-zinc-600">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(a.id)} className="text-sm font-medium text-red-600 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OwnerGate>
  );
}
