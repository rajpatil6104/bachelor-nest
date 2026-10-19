import { TYPE_LABELS } from '@/lib/types';
import { WizardDraft } from './types';

export default function StepReview({
  draft,
  kycStatus,
  submitting,
  error,
  onSubmit,
  update,
}: {
  draft: WizardDraft;
  kycStatus: string;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
  update: (patch: Partial<WizardDraft>) => void;
}) {
  const units = draft.type === 'flat' ? draft.flatSpaces : draft.type === 'room' ? [draft.roomInfo] : draft.rooms;
  const beds = draft.type === 'flat' || draft.type === 'room'
    ? units.filter((u) => u.available).length
    : units.reduce((s, u) => s + u.total_beds, 0);
  const minRent = Math.min(...units.map((u) => u.rent_per_bed));
  const allAmenities = [...new Set([...draft.amenities, ...draft.services])];
  const needsKyc = kycStatus !== 'verified';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-red-500">Step 6 of 6 · Preview & Publish</p>
        <h2 className="mt-1 text-3xl font-bold italic">Almost there.</h2>
        <p className="mt-1 text-zinc-500">Verify your identity to publish your listing.</p>
      </div>

      <div className="rounded-3xl border-2 border-red-200 bg-white p-6 dark:border-red-900 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">🛡️</span>
          <div>
            <h3 className="font-bold text-red-600">Verify your identity</h3>
            <p className="text-sm text-red-500">Upload any government photo ID to publish your building. Our team reviews it within 24–48 hours.</p>
          </div>
        </div>

        {kycStatus === 'verified' ? (
          <p className="mt-4 rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700 dark:bg-green-950">
            ✓ Identity verified — you can publish directly.
          </p>
        ) : kycStatus === 'pending' ? (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-700 dark:bg-amber-950">
            ⏳ Verification pending — your listing will go live after admin approval.
          </p>
        ) : (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold">
              Upload a government ID <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-zinc-500">Aadhaar, PAN, driving licence, passport or voter ID — JPG/PNG.</p>
            <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 p-6 text-sm font-semibold text-zinc-500 hover:border-brand-500 dark:border-zinc-700">
              {draft.idDoc ? `📄 ${draft.idDoc.name}` : 'Tap to upload your ID'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) update({ idDoc: f });
                  e.target.value = '';
                }}
              />
            </label>
            <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-800">
              <b>Why is KYC required?</b> We verify every owner's identity with a government-issued photo ID.
              This protects tenants and ensures only genuine property owners list on BachelorNest.
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold">What tenants will see</h3>
        <p className="text-sm text-zinc-500">A preview of your listing</p>
        <div className="mt-3 overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-brand-500 to-navy-800">
            {draft.photos[0] ? (
              <img src={draft.photos[0].preview} alt="Cover" className="h-full w-full object-cover" />
            ) : (
              <span className="text-6xl opacity-80">🏠</span>
            )}
            <span className="absolute left-3 top-3 rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white">
              {TYPE_LABELS[draft.type]}
            </span>
            <span className="absolute right-3 top-3 rounded-lg bg-black/50 px-2 py-1 text-xs font-semibold text-white">
              {draft.photos.length} photos
            </span>
            <span className="absolute bottom-3 left-3 text-xl font-bold text-white drop-shadow">
              {draft.title || 'Your property name'}
            </span>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                {draft.type === 'flat' ? `${beds} spaces` : `${beds} beds`}
              </span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                {units.length} room{units.length === 1 ? '' : 's'}
              </span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                {allAmenities.length} amenities
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-sm text-zinc-500">
                FROM<br />
                <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                  ₹{minRent.toLocaleString('en-IN')}
                </span>
                <span className="text-zinc-400">/{draft.type === 'flat' || draft.type === 'room' ? 'mo' : 'bed/mo'}</span>
              </p>
              <p className="text-sm text-zinc-500">
                AMENITIES<br />
                <span className="text-2xl font-bold text-zinc-900 dark:text-white">{allAmenities.length}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="w-full rounded-2xl bg-red-500 py-4 text-lg font-bold text-white hover:bg-red-600 disabled:opacity-50"
      >
        {submitting ? 'Publishing…' : 'Create Building'}
      </button>
      {needsKyc && !draft.idDoc && (
        <p className="text-center text-xs text-zinc-400">You'll need to upload your ID above to publish.</p>
      )}
    </div>
  );
}
