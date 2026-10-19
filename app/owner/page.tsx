'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOwnerListings, getOwnerInquiries, getOwnerProfile, setInquiryStatus } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Inquiry,
  Listing,
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
  const [kycStatus, setKycStatus] = useState('none');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'owner')) {
      router.replace('/login?next=/owner');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    Promise.all([getOwnerListings(user.id), getOwnerInquiries(user.id), getOwnerProfile(user.id)]).then(
      ([l, inq, p]) => {
        setListings(l);
        setInquiries(inq);
        if (p) setKycStatus(p.kyc_status);
        setLoading(false);
      }
    );
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

  const moderateInquiry = async (id: string, status: 'accepted' | 'rejected') => {
    setActing(id);
    try {
      await setInquiryStatus(id, status);
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    } finally {
      setActing(null);
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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-3xl font-bold">Buildings</h1>

      {kycStatus !== 'verified' && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
          <span className="text-xl">🛡️</span>
          <p className="flex-1">
            {kycStatus === 'pending'
              ? 'Identity verification is pending — listings go live after admin approval.'
              : 'Verify your identity to get listings published faster.'}
          </p>
          {kycStatus !== 'pending' && (
            <Link href="/owner/add" className="font-semibold text-amber-700 underline dark:text-amber-300">
              Verify now
            </Link>
          )}
        </div>
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
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}>
                    {inq.status}
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
                <Link href={`/listing/${l.id}`} className="inline-block text-sm font-medium text-brand-600 hover:underline">
                  View public listing →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
