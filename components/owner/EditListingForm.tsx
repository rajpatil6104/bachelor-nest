'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OwnerGate from '@/components/owner/OwnerGate';
import { getListing, updateListing, uploadListingPhotos, RoomEditInput } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  AMENITY_CATEGORIES,
  Listing,
  ROOM_LABELS,
  RoomType,
  SERVICE_OPTIONS,
  TYPE_LABELS,
} from '@/lib/types';

const inputCls =
  'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';
const labelCls = 'mb-1 block text-sm font-semibold';

const ALL_KNOWN = [...AMENITY_CATEGORIES.flatMap((c) => c.items), ...SERVICE_OPTIONS.map((s) => s.id)];
const RENT_CYCLES = ['monthly', 'quarterly', 'half-yearly', 'yearly'] as const;

export default function EditListingForm({ listingId: id }: { listingId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [address, setAddress] = useState('');
  const [rentCycle, setRentCycle] = useState<string>('monthly');
  const [rooms, setRooms] = useState<RoomEditInput[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState('');
  const [rules, setRules] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<{ file: File; preview: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const isCustomUnits = listing?.type === 'flat' || listing?.type === 'room';

  useEffect(() => {
    getListing(id).then((l) => {
      if (!l) {
        setLoadError('Listing not found.');
        return;
      }
      setListing(l);
      setTitle(l.title);
      setDescription(l.description);
      setCity(l.city);
      setLocality(l.locality);
      setAddress(l.address);
      setRentCycle(l.rent_cycle ?? 'monthly');
      setRooms(
        l.rooms.map((r) => ({
          room_type: r.room_type,
          label: r.label ?? '',
          total_beds: r.total_beds,
          occupied_beds: r.occupied_beds,
          rent_per_bed: r.rent_per_bed,
          deposit: r.deposit,
        }))
      );
      setAmenities(l.amenities);
      setRules(l.house_rules);
      setPhotos(l.photos);
    });
  }, [id]);

  const customAmenities = useMemo(
    () => amenities.filter((a) => !ALL_KNOWN.includes(a)),
    [amenities]
  );

  function toggleAmenity(a: string) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function patchRoom(i: number, patch: Partial<RoomEditInput>) {
    setRooms((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function validate(): string | null {
    if (!title.trim()) return 'Please enter a property name.';
    if (!city.trim() || !locality.trim() || !address.trim())
      return 'City, locality and full address are required.';
    if (rooms.length === 0) return 'Add at least one room / space.';
    for (const r of rooms) {
      if (r.rent_per_bed < 0 || r.deposit < 0) return 'Rent and deposit cannot be negative.';
      if (!isCustomUnits) {
        if (r.total_beds < 1) return 'Each room type needs at least 1 bed.';
        if (r.occupied_beds < 0 || r.occupied_beds > r.total_beds)
          return 'Occupied beds must be between 0 and total beds.';
      }
    }
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !listing) return;
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const sb = getSupabase();
      const uploaded = sb
        ? await uploadListingPhotos(user.id, newPhotos.map((p) => p.file))
        : newPhotos.map((p) => p.preview); // demo: session-only previews

      const roomRows: RoomEditInput[] = rooms.map((r) =>
        isCustomUnits
          ? {
              room_type: 'single',
              label: (r.label ?? '').trim() || null,
              total_beds: 1,
              occupied_beds: r.occupied_beds > 0 ? 1 : 0,
              rent_per_bed: r.rent_per_bed,
              deposit: r.deposit,
            }
          : { ...r, label: null }
      );

      await updateListing(
        listing.id,
        {
          title: title.trim(),
          description: description.trim(),
          address: address.trim(),
          city: city.trim(),
          locality: locality.trim(),
          amenities,
          house_rules: rules.trim(),
          rent_cycle: rentCycle,
          photos: [...photos, ...uploaded],
        },
        roomRows
      );
      setSaved(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (!listing && !loadError)) {
    return <p className="p-8 text-center text-sm text-zinc-500">Loading listing…</p>;
  }
  if (loadError || !listing) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-xl font-bold">{loadError || 'Listing not found'}</h1>
        <Link href="/owner" className="mt-6 inline-block font-medium text-brand-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }
  if (user && listing.owner_id !== user.id) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-4 text-xl font-bold">This isn't your listing</h1>
        <p className="mt-2 text-sm text-zinc-500">You can only edit properties you own.</p>
        <Link href="/owner" className="mt-6 inline-block font-medium text-brand-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl dark:bg-green-900">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-bold">Changes saved!</h1>
        <p className="mt-2 text-zinc-500">
          Your listing has been sent for <b>re-verification</b>. It stays hidden
          from tenants until an admin approves the changes — usually within
          24–48 hours.
        </p>
        <Link
          href="/owner"
          className="mt-6 inline-block rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <OwnerGate>
      <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        <div>
          <Link href="/owner" className="text-sm font-medium text-brand-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Edit listing</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
              {TYPE_LABELS[listing.type]}
            </span>{' '}
            · Saving sends it back for admin verification — it will be hidden
            from tenants until approved again.
          </p>
        </div>

        {/* Basics */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Basics</h2>
          <div>
            <label className={labelCls}>Property name</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Locality</label>
              <input value={locality} onChange={(e) => setLocality(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Full address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Rent collection cycle</label>
            <select value={rentCycle} onChange={(e) => setRentCycle(e.target.value)} className={inputCls}>
              {RENT_CYCLES.map((c) => (
                <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Rooms / spaces */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{isCustomUnits ? 'Spaces & pricing' : 'Rooms & beds'}</h2>
          {rooms.map((r, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {isCustomUnits ? r.label || 'Space' : ROOM_LABELS[r.room_type]}
                </span>
                {rooms.length > 1 && (
                  <button type="button" onClick={() => setRooms(rooms.filter((_, idx) => idx !== i))}
                    className="text-sm font-medium text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
              {isCustomUnits ? (
                <>
                  <input value={r.label ?? ''} onChange={(e) => patchRoom(i, { label: e.target.value })}
                    placeholder="Space name — e.g. Master bedroom" className={inputCls} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.occupied_beds === 0}
                      onChange={(e) => patchRoom(i, { occupied_beds: e.target.checked ? 0 : 1 })}
                      className="h-4 w-4" />
                    Available for booking
                  </label>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select value={r.room_type}
                      onChange={(e) => patchRoom(i, { room_type: e.target.value as RoomType })}
                      className={inputCls}>
                      {(Object.keys(ROOM_LABELS) as RoomType[]).map((t) => (
                        <option key={t} value={t}>{ROOM_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Total beds</label>
                    <input type="number" min={1} value={r.total_beds}
                      onChange={(e) => patchRoom(i, { total_beds: Number(e.target.value) })}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Occupied</label>
                    <input type="number" min={0} value={r.occupied_beds}
                      onChange={(e) => patchRoom(i, { occupied_beds: Number(e.target.value) })}
                      className={inputCls} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isCustomUnits ? 'Rent / month (₹)' : 'Rent / bed (₹)'}</label>
                  <input type="number" min={0} value={r.rent_per_bed}
                    onChange={(e) => patchRoom(i, { rent_per_bed: Number(e.target.value) })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Deposit (₹)</label>
                  <input type="number" min={0} value={r.deposit}
                    onChange={(e) => patchRoom(i, { deposit: Number(e.target.value) })}
                    className={inputCls} />
                </div>
              </div>
            </div>
          ))}
          {!isCustomUnits && (
            <button type="button"
              onClick={() => setRooms([...rooms, { room_type: 'double', label: null, total_beds: 4, occupied_beds: 0, rent_per_bed: 7000, deposit: 7000 }])}
              className="rounded-xl border border-dashed border-zinc-300 px-4 py-2 text-sm font-semibold hover:border-brand-500 dark:border-zinc-700">
              + Add room type
            </button>
          )}
          {listing.type === 'flat' && (
            <button type="button"
              onClick={() => setRooms([...rooms, { room_type: 'single', label: '', total_beds: 1, occupied_beds: 0, rent_per_bed: 8000, deposit: 16000 }])}
              className="rounded-xl border border-dashed border-zinc-300 px-4 py-2 text-sm font-semibold hover:border-brand-500 dark:border-zinc-700">
              + Add space
            </button>
          )}
        </section>

        {/* Photos */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Photos</h2>
          <div className="flex flex-wrap gap-3">
            {photos.map((url) => (
              <div key={url} className="relative h-24 w-24 overflow-hidden rounded-xl">
                <img src={url} alt="Listing photo" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove photo"
                  onClick={() => setPhotos(photos.filter((p) => p !== url))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white">
                  ✕
                </button>
              </div>
            ))}
            {newPhotos.map((p, i) => (
              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-xl ring-2 ring-brand-500">
                <img src={p.preview} alt="New listing photo" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove new photo"
                  onClick={() => setNewPhotos(newPhotos.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white">
                  ✕
                </button>
              </div>
            ))}
            {photos.length + newPhotos.length < 8 && (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-2xl text-zinc-400 hover:border-brand-500 dark:border-zinc-700">
                +
                <span className="text-xs font-medium">Add photo</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 8 - photos.length - newPhotos.length);
                    setNewPhotos([...newPhotos, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
                    e.target.value = '';
                  }} />
              </label>
            )}
          </div>
        </section>

        {/* Amenities */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Amenities & services</h2>
          {AMENITY_CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <p className="mb-2 text-sm font-semibold text-zinc-500">{cat.title}</p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((a) => (
                  <button type="button" key={a} onClick={() => toggleAmenity(a)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      amenities.includes(a)
                        ? 'bg-brand-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 text-sm font-semibold text-zinc-500">Services</p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((svc) => (
                <button type="button" key={svc.id} title={svc.desc} onClick={() => toggleAmenity(svc.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    amenities.includes(svc.id)
                      ? 'bg-brand-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}>
                  {svc.id}
                </button>
              ))}
              {customAmenities.map((a) => (
                <button type="button" key={a} onClick={() => toggleAmenity(a)}
                  className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
                  {a} ✕
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={customAmenity} onChange={(e) => setCustomAmenity(e.target.value)}
                placeholder="Add a custom amenity" className={inputCls} />
              <button type="button"
                onClick={() => {
                  const v = customAmenity.trim();
                  if (v && !amenities.includes(v)) setAmenities([...amenities, v]);
                  setCustomAmenity('');
                }}
                className="shrink-0 rounded-xl border border-zinc-300 px-4 font-semibold dark:border-zinc-700">
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Rules */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">House rules</h2>
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3}
            placeholder="e.g. No smoking; Gate closes by 11 PM" className={inputCls} />
          <p className="text-xs text-zinc-400">Separate rules with a semicolon (;).</p>
        </section>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.push('/owner')}
            className="rounded-2xl border border-zinc-300 px-6 py-3.5 font-semibold dark:border-zinc-700">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-2xl bg-red-500 py-3.5 text-lg font-bold text-white hover:bg-red-600 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save & send for verification'}
          </button>
        </div>
      </form>
    </OwnerGate>
  );
}
