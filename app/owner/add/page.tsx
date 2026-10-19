'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AMENITY_OPTIONS, ListingType, RoomType } from '@/lib/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface RoomInput {
  room_type: RoomType;
  total_beds: number;
  rent_per_bed: number;
  deposit: number;
}

export default function AddListingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'owner')) {
      router.replace('/login?next=/owner/add');
    }
  }, [user, authLoading, router]);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ListingType>('pg');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [houseRules, setHouseRules] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [rooms, setRooms] = useState<RoomInput[]>([
    { room_type: 'double', total_beds: 6, rent_per_bed: 8000, deposit: 8000 },
  ]);

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const addRoom = () =>
    setRooms((prev) => [...prev, { room_type: 'double', total_beds: 4, rent_per_bed: 7000, deposit: 7000 }]);

  const updateRoom = (i: number, patch: Partial<RoomInput>) =>
    setRooms((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const removeRoom = (i: number) => setRooms((prev) => prev.filter((_, j) => j !== i));

  const inputCls =
    'w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const sb = getSupabase();
    if (sb && isSupabaseConfigured() && user) {
      const { data: listing, error } = await sb
        .from('listings')
        .insert({
          owner_id: user.id,
          type, title, description, address, city, locality,
          amenities, house_rules: houseRules, gender_allowed: 'male',
          status: 'pending',
        })
        .select('id')
        .single();
      if (!error && listing) {
        await sb.from('rooms').insert(
          rooms.map((r) => ({ listing_id: listing.id, ...r, occupied_beds: 0 }))
        );
      }
    }
    // Demo mode: just show confirmation
    setSaving(false);
    setDone(true);
    setTimeout(() => router.push('/owner'), 1800);
  }

  if (authLoading) return <p className="p-8 text-zinc-500">Loading…</p>;

  if (!user || user.role !== 'owner') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔑</div>
        <h1 className="mt-4 text-xl font-bold">Owners only</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Log in with an owner account to list your property.
        </p>
        <Link
          href="/login?next=/owner/add"
          className="mt-6 inline-block rounded-full bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-700"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="text-6xl">🎉</div>
        <h1 className="mt-4 text-2xl font-bold">Listing submitted!</h1>
        <p className="mt-2 text-zinc-500">
          Our team will verify the details and photos, then publish it. Redirecting to your
          dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/owner" className="text-sm text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-bold">List your property</h1>
      <p className="text-sm text-zinc-500">Reach thousands of bachelors looking for a stay.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Property title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunrise Boys PG near HSR Layout" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ListingType)} className={inputCls}>
              <option value="pg">PG</option>
              <option value="hostel">Hostel</option>
              <option value="room">Room</option>
              <option value="flat">Flat</option>
              <option value="coliving">Co-living</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">City</label>
            <input required value={city} onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Locality</label>
            <input required value={locality} onChange={(e) => setLocality(e.target.value)}
              placeholder="HSR Layout" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Full address</label>
            <input required value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="14, 5th Cross…" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} placeholder="What makes your place good for bachelors?" className={inputCls} />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {AMENITY_OPTIONS.map((a) => (
              <button type="button" key={a} onClick={() => toggleAmenity(a)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  amenities.includes(a)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">House rules</label>
          <textarea value={houseRules} onChange={(e) => setHouseRules(e.target.value)}
            rows={2} placeholder="e.g. Guests allowed till 9 PM…" className={inputCls} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Rooms & pricing</label>
            <button type="button" onClick={addRoom}
              className="text-sm font-medium text-indigo-600 hover:underline">
              + Add room type
            </button>
          </div>
          {rooms.map((r, i) => (
            <div key={i} className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-5">
              <select value={r.room_type}
                onChange={(e) => updateRoom(i, { room_type: e.target.value as RoomType })}
                className={inputCls}>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
                <option value="dorm">Dorm</option>
              </select>
              <input type="number" min={1} value={r.total_beds}
                onChange={(e) => updateRoom(i, { total_beds: Number(e.target.value) })}
                placeholder="Beds" title="Total beds" className={inputCls} />
              <input type="number" min={0} value={r.rent_per_bed}
                onChange={(e) => updateRoom(i, { rent_per_bed: Number(e.target.value) })}
                placeholder="Rent ₹" title="Rent per bed" className={inputCls} />
              <input type="number" min={0} value={r.deposit}
                onChange={(e) => updateRoom(i, { deposit: Number(e.target.value) })}
                placeholder="Deposit ₹" title="Deposit" className={inputCls} />
              <button type="button" onClick={() => removeRoom(i)}
                className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={saving}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Submitting…' : 'Submit for verification'}
        </button>
        {!isSupabaseConfigured() && (
          <p className="text-center text-xs text-zinc-400">
            Demo mode — connect Supabase in .env.local to save listings for real.
          </p>
        )}
      </form>
    </div>
  );
}
