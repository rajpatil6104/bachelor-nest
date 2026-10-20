'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteListing, getOwnerListings, getOwnerInquiries, getOwnerStats, setInquiryStatus } from '@/lib/db';
import { notifyEvent } from '@/lib/notify';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import OwnerGate from '@/components/owner/OwnerGate';
import {
  Inquiry,
  Listing,
  ListingStats,
  ROOM_LABELS,
  TYPE_LABELS,
  availableBeds,
  listingAvailableBeds,
} from '@/lib/types';

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [listingStats, setListingStats] = useState<Record<string, ListingStats>>({});
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'owner')) {
      router.replace('/login?next=/owner');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    Promise.all([getOwnerListings(user.id), getOwnerInquiries(user.id)]).then(
      ([l, inq]) => {
        setListings(l);
        // Rejected visit cards are not kept in the owner's inbox
        setInquiries(inq.filter((i) => i.status !== 'rejected'));
        setLoading(false);
      }
    );
    // Analytics are decorative — never let them break the dashboard
    // (e.g. before migration_analytics.sql has been run).
    getOwnerStats(user.id)
      .then(setListingStats)
      .catch(() => setListingStats({}));
  }, [user]);

  const stats = useMemo(() => {
    const totalBeds = listings.reduce((s, l) => s + l.rooms.reduce((a, r) => a + r.total_beds, 0), 0);
    const freeBeds = listings.reduce((s, l) => s + listingAvailableBeds(l), 0);
    const occupied = totalBeds - freeBeds;
    return {
      buildings: listings.length,
      active: listings.filter((l) => l.status === 'approved').length,
      totalBeds,
      freeBeds,
      occupancy: totalBeds ? Math.round((occupied / totalBeds) * 100) : 0,
    };
  }, [listings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) =>
      `${l.title} ${l.locality} ${l.city}`.toLowerCase().includes(q)
    );
  }, [listings, query]);

  const adjustOccupied = async (listingId: string, roomId: string, delta: number) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId
          ? {
              ...l,
              rooms: l.rooms.map((r) => {
                if (r.id !== roomId) return r;
                const next = Math.min(r.total_beds, Math.max(0, r.occupied_beds + delta));
                return { ...r, occupied_beds: next };
              }),
            }
          : l
      )
    );
    const sb = getSupabase();
    if (sb) {
      const room = listings
        .find((l) => l.id === listingId)
        ?.rooms.find((r) => r.id === roomId);
      if (room) {
        const next = Math.min(room.total_beds, Math.max(0, room.occupied_beds + delta));
        await sb.from('rooms').update({ occupied_beds: next }).eq('id', roomId);
      }
    }
  };

  const moderateInquiry = async (id: string, status: 'accepted' | 'rejected' | 'done') => {
    setActing(id);
    try {
      await setInquiryStatus(id, status);
      void notifyEvent(
        status === 'accepted'
          ? 'visit_accepted'
          : status === 'rejected'
            ? 'visit_rejected'
            : 'visit_done',
        { inquiryId: id }
      );
      setInquiries((prev) =>
        status === 'rejected'
          ? prev.filter((i) => i.id !== id) // rejected card disappears
          : prev.map((i) => (i.id === id ? { ...i, status } : i))
      );
    } finally {
      setActing(null);
    }
  };

  const removeListing = async (id: string) => {
    setRemoving(true);
    try {
      await deleteListing(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
      setNotice('Listing removed permanently.');
    } catch {
      setNotice('Could not remove the listing. Please try again.');
    } finally {
      setRemoving(false);
      setConfirmRemoveId(null);
    }
  };

  if (authLoading || loading) return <p className="p-8 text-zinc-500">Loading your dashboard…</p>;
  if (!user || user.role !== 'owner') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔑</div>
        <h1 className="mt-4 text-xl font-bold">Owners only</h1>
        <p className="mt-2 text-sm text-zinc-500">Log in with an owner account to manage your properties.</p>
        <Link href="/login?next=/owner"
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700">
          Log in
        </Link>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Buildings', value: String(stats.buildings), icon: '🏢', tint: 'bg-zinc-100 dark:bg-zinc-800' },
    { label: 'Active Listings', value: String(stats.active), icon: '✅', tint: 'bg-teal-50 dark:bg-teal-950' },
    { label: 'Total Beds', value: String(stats.totalBeds), icon: '🛏️', tint: 'bg-red-50 dark:bg-red-950' },
    { label: 'Available Beds', value: String(stats.freeBeds), icon: '🛌', tint: 'bg-sky-50 dark:bg-sky-950' },
    { label: 'Occupancy Rate', value: `${stats.occupancy}%`, icon: '%', tint: 'bg-purple-50 dark:bg-purple-950' },
  ];

  return (
    <OwnerGate>
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-3xl font-bold">Buildings</h1>

      {notice && (
        <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          {notice}
        </p>
      )}

      <Link
        href="/owner/add"
        className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-4 text-lg font-bold text-white hover:bg-red-600"
      >
        + Add PG/Flat/Hostel
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <p className="text-3xl font-bold">{s.value}</p>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${s.tint}`}>{s.icon}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Visit requests */}
      {inquiries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold">
            📅 Visit requests{' '}
            <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
              {inquiries.filter((i) => i.status === 'pending').length} pending
            </span>
          </h2>
          <div className="mt-3 space-y-3">
            {inquiries.map((inq) => (
              <div key={inq.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm">
                  <p className="font-semibold">{inq.listing_title}</p>
                  <p className="text-zinc-500">
                    {inq.preferred_date ? `Wants to visit on ${inq.preferred_date}` : 'No date specified'}
                    {inq.message ? ` · “${inq.message}”` : ''}
                  </p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    inq.status === 'pending'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                      : inq.status === 'accepted'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : inq.status === 'done'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}>
                    {inq.status === 'done' ? 'visit completed' : inq.status}
                  </span>
                </div>
                {inq.status === 'pending' && (
                  <div className="flex gap-2">
                    <Link
                      href={`/chat?listing=${inq.listing_id}&with=${inq.tenant_id}`}
                      className="rounded-full border border-brand-300 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-950"
                    >
                      💬 Chat
                    </Link>
                    <button onClick={() => moderateInquiry(inq.id, 'rejected')} disabled={acting === inq.id}
                      className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950">
                      Decline
                    </button>
                    <button onClick={() => moderateInquiry(inq.id, 'accepted')} disabled={acting === inq.id}
                      className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      {acting === inq.id ? 'Saving…' : 'Accept'}
                    </button>
                  </div>
                )}
                {inq.status === 'accepted' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">Did the visit happen?</span>
                    <button onClick={() => moderateInquiry(inq.id, 'done')} disabled={acting === inq.id}
                      className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {acting === inq.id ? 'Saving…' : '✓ Yes, visited'}
                    </button>
                  </div>
                )}
                {inq.status === 'done' && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    ✓ Visit confirmed — the tenant can now review this stay.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buildings list */}
      <div className="mt-8">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search buildings…"
            className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-11 pr-4 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        {filtered.length === 0 && (
          <div className="mt-6 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-orange-50 text-5xl dark:bg-orange-950">
              🏢
            </div>
            <h2 className="mt-4 text-2xl font-bold">List your first property</h2>
            <p className="mx-auto mt-2 max-w-md text-zinc-500">
              Get started by adding your property. Once listed, you'll unlock leads,
              visit requests, chats, and more.
            </p>
            <Link href="/owner/add"
              className="mt-6 inline-block rounded-2xl bg-red-500 px-8 py-3 font-bold text-white hover:bg-red-600">
              + Add PG/Flat/Hostel
            </Link>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {filtered.map((l) => (
            <div key={l.id}
              className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex gap-4 p-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-navy-800">
                  {l.photos[0] ? (
                    <img src={l.photos[0]} alt={l.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl">🏠</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                        {TYPE_LABELS[l.type]}
                      </span>
                      <h3 className="mt-1 truncate font-bold">{l.title}</h3>
                      <p className="truncate text-sm text-zinc-500">
                        {l.locality}, {l.city} ·{' '}
                        <span className="font-semibold text-green-600">
                          {listingAvailableBeds(l)} {l.type === 'flat' ? 'spaces' : 'beds'} free
                        </span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      l.status === 'approved'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : l.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 px-4 pb-4">
                {l.rooms.map((r) => (
                  <div key={r.id}
                    className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
                    <div className="text-sm">
                      <span className="font-medium">{r.label || ROOM_LABELS[r.room_type]}</span>
                      <span className="text-zinc-500">
                        {' '}· ₹{r.rent_per_bed.toLocaleString('en-IN')}
                        {l.type === 'flat' || l.type === 'room' ? '/mo' : '/bed'} · {availableBeds(r)} of {r.total_beds} free
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Occupied: {r.occupied_beds}</span>
                      <button onClick={() => adjustOccupied(l.id, r.id, -1)} disabled={r.occupied_beds === 0}
                        className="h-8 w-8 rounded-full border border-zinc-300 font-bold disabled:opacity-30 dark:border-zinc-600"
                        aria-label="Decrease occupied">−</button>
                      <button onClick={() => adjustOccupied(l.id, r.id, 1)} disabled={r.occupied_beds === r.total_beds}
                        className="h-8 w-8 rounded-full border border-zinc-300 font-bold disabled:opacity-30 dark:border-zinc-600"
                        aria-label="Increase occupied">+</button>
                    </div>
                  </div>
                ))}
                {listingStats[l.id] && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-zinc-50 px-4 py-2.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <span>👁️ {listingStats[l.id].views} views</span>
                    <span>♡ {listingStats[l.id].saves} saves</span>
                    <span>📅 {listingStats[l.id].inquiries} enquiries</span>
                    <span>✅ {listingStats[l.id].visitsDone} visits done</span>
                    {listingStats[l.id].avgRating != null && (
                      <span>⭐ {listingStats[l.id].avgRating} ({listingStats[l.id].reviewCount} reviews)</span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link href={`/listing/${l.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    View public listing →
                  </Link>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <Link href={`/owner/edit/${l.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    ✏️ Edit
                  </Link>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  {confirmRemoveId === l.id ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-red-600">Remove permanently?</span>
                      <button onClick={() => removeListing(l.id)} disabled={removing}
                        className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                        {removing ? 'Removing…' : 'Yes, remove'}
                      </button>
                      <button onClick={() => setConfirmRemoveId(null)} disabled={removing}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-600">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmRemoveId(l.id)}
                      className="text-sm font-medium text-red-600 hover:underline">
                      🗑️ Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </OwnerGate>
  );
}
