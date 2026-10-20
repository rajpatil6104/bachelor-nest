'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RoomType } from '@/lib/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { getOwnerProfile, uploadListingPhotos, uploadOwnerDocs } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import OwnerGate from '@/components/owner/OwnerGate';
import { initialDraft, WizardDraft, WizardRoomInput } from '@/components/owner/wizard/types';
import StepBasics, { validateBasics } from '@/components/owner/wizard/StepBasics';
import StepRooms, { validateRooms } from '@/components/owner/wizard/StepRooms';
import StepMedia, { validateMedia } from '@/components/owner/wizard/StepMedia';
import StepAmenities from '@/components/owner/wizard/StepAmenities';
import StepServices from '@/components/owner/wizard/StepServices';
import StepReview from '@/components/owner/wizard/StepReview';

const STEPS = [
  'Building Details',
  'Flats & Rooms',
  'Media',
  'Amenities',
  'Services & Rules',
  'Preview & Publish',
];

export default function AddListingWizard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState<WizardDraft>(initialDraft());
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const update = (patch: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'owner')) {
      router.replace('/login?next=/owner/add');
      return;
    }
    if (user) {
      // Phone is collected at registration; this is a safety net
      getOwnerProfile(user.id).then((p) => {
        if (p && !p.phone) router.replace('/owner/profile?next=/owner/add');
      });
    }
  }, [user, authLoading, router]);

  function next() {
    setStepError('');
    const err =
      step === 0 ? validateBasics(draft) :
      step === 1 ? validateRooms(draft) :
      step === 2 ? validateMedia(draft) : null;
    if (err) {
      setStepError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  function back() {
    setStepError('');
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0 });
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const sb = getSupabase();
      if (sb && isSupabaseConfigured()) {
        const photoUrls = await uploadListingPhotos(user.id, draft.photos.map((p) => p.file));
        // Proof-of-address docs stay with the listing (owner identity was
        // already verified at registration)
        await uploadOwnerDocs(user.id, draft.proofDocs);

        const amenities = [...new Set([...draft.amenities, ...draft.services])];
        const { data: listing, error } = await sb
          .from('listings')
          .insert({
            owner_id: user.id,
            type: draft.type,
            title: draft.title,
            description: draft.description,
            address: draft.address,
            city: draft.city,
            locality: draft.locality,
            amenities,
            house_rules: draft.rules.join('; '),
            gender_allowed: 'male',
            photos: photoUrls,
            rent_cycle: draft.rentCycle,
            lat: draft.lat,
            lng: draft.lng,
            status: 'pending',
          })
          .select('id')
          .single();
        if (error) throw error;

        const customUnits =
          draft.type === 'flat' ? draft.flatSpaces : draft.type === 'room' ? [draft.roomInfo] : null;
        const toRow = (u: WizardRoomInput) => ({
          listing_id: listing.id,
          room_type: (customUnits ? 'single' : u.room_type) as RoomType,
          label: customUnits ? u.label.trim() || null : null,
          total_beds: customUnits ? 1 : u.total_beds,
          occupied_beds: customUnits && !u.available ? 1 : 0,
          rent_per_bed: u.rent_per_bed,
          deposit: u.deposit,
        });
        const rows = customUnits ? customUnits.map(toRow) : draft.rooms.map(toRow);
        const { error: roomError } = await sb.from('rooms').insert(rows);
        if (roomError) {
          // The listing row is already committed — don't leave an orphan
          // listing with no rooms behind (it renders as "Full" everywhere
          // and can never be booked).
          await sb.from('listings').delete().eq('id', listing.id);
          throw roomError;
        }
      }
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not publish your listing.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return <p className="p-6 text-center text-sm text-zinc-500">Loading…</p>;
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl dark:bg-green-900">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-bold">Building submitted!</h1>
        <p className="mt-2 text-zinc-500">
          Our team will verify your documents and listing. You'll be notified once it's live —
          usually within 24–48 hours.
        </p>
        <Link
          href="/owner"
          className="mt-6 inline-block rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <OwnerGate>
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/owner" className="text-sm text-zinc-500 hover:underline">← Back to dashboard</Link>
      <h1 className="mt-2 text-2xl font-bold">Add New Building</h1>

      {/* Progress */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-red-500 transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-center text-sm text-zinc-500">
        Step {step + 1} of {STEPS.length} · <span className="font-semibold text-red-500">{STEPS[step]}</span>
      </p>

      {stepError && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-950">
          {stepError}
        </p>
      )}

      <div className="mt-6">
        {step === 0 && <StepBasics draft={draft} update={update} />}
        {step === 1 && <StepRooms draft={draft} update={update} />}
        {step === 2 && <StepMedia draft={draft} update={update} />}
        {step === 3 && <StepAmenities draft={draft} update={update} />}
        {step === 4 && <StepServices draft={draft} update={update} />}
        {step === 5 && (
          <StepReview
            draft={draft}
            submitting={submitting}
            error={submitError}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {step < 5 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            className="rounded-2xl border border-zinc-300 px-8 py-3 font-semibold disabled:opacity-40 dark:border-zinc-700"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-2xl bg-red-500 px-10 py-3 font-bold text-white hover:bg-red-600"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
    </OwnerGate>
  );
}
