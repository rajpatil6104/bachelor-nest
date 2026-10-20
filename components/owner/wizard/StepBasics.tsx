import { inputCls, TYPE_CARDS, WizardDraft } from './types';
import LocationPicker from '@/components/LocationPicker';

export function validateBasics(d: WizardDraft): string | null {
  if (!d.title.trim()) return 'Give your property a name.';
  if (!d.city.trim()) return 'City is required.';
  if (!d.address.trim()) return 'Address is required.';
  if (d.proofDocs.length === 0) return 'Please upload a proof of address (electricity bill, tax receipt…).';
  return null;
}

export default function StepBasics({
  draft,
  update,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
}) {
  function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    );
    update({ proofDocs: [...draft.proofDocs, ...files].slice(0, 2) });
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-red-500">Step 1 of 6 · Basics</p>
        <h2 className="mt-1 text-3xl font-bold italic">Let's start with the basics.</h2>
        <p className="mt-1 text-zinc-500">A name, what kind of property it is, and where to find it.</p>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-bold">Property identity</h3>
        <p className="text-sm text-zinc-500">Two things tenants will see first</p>

        <label className="mb-1 mt-4 block font-semibold">
          What do you call this property? <span className="text-red-500">*</span>
        </label>
        <input
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. Shlok PG"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-zinc-400">This is what tenants will see at the top of your listing.</p>

        <label className="mb-2 mt-5 block font-semibold">
          What kind of property is it? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TYPE_CARDS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update({ type: t.value })}
              className={`rounded-2xl border-2 p-4 text-left transition ${
                draft.type === t.value
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-950'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <p className="font-bold text-navy-900 dark:text-white">{t.title}</p>
              <p className="text-xs text-zinc-500">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-bold">Location</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">City <span className="text-red-500">*</span></label>
            <input value={draft.city} onChange={(e) => update({ city: e.target.value })}
              placeholder="e.g. Pune" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Locality / Area</label>
            <input value={draft.locality} onChange={(e) => update({ locality: e.target.value })}
              placeholder="e.g. Chinchwad" className={inputCls} />
          </div>
        </div>
        <label className="mb-1 mt-3 block text-sm font-medium">Full address <span className="text-red-500">*</span></label>
        <textarea value={draft.address} onChange={(e) => update({ address: e.target.value })}
          rows={2} placeholder="Flat / building, street, landmark…" className={inputCls} />
        <label className="mb-1 mt-3 block text-sm font-medium">Description</label>
        <textarea value={draft.description} onChange={(e) => update({ description: e.target.value })}
          rows={3} placeholder="What makes your place good for bachelors?" className={inputCls} />
        <label className="mb-1 mt-4 block text-sm font-medium">
          Location pin <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <p className="mb-2 text-sm text-zinc-500">
          Bachelors can find you on the map view. Find your address, then drag the pin if it's slightly off.
        </p>
        <LocationPicker
          lat={draft.lat}
          lng={draft.lng}
          addressHint={`${draft.address}, ${draft.locality}, ${draft.city}, India`}
          onChange={(lat, lng) => update({ lat, lng })}
        />
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-bold">Proof of address</h3>
        <p className="text-sm text-zinc-500">Electricity bill, property tax receipt, lease deed — anything with the address</p>
        <label className="mb-1 mt-4 block font-semibold">
          Upload document <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-xs text-zinc-400">Up to 2 files accepted.</p>
        <div className="flex gap-3">
          <label className="flex h-36 w-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-300 bg-red-50 text-red-500 dark:border-red-800 dark:bg-red-950">
            <span className="text-2xl">↑</span>
            <span className="text-sm font-semibold">Tap to upload</span>
            <span className="text-xs">PNG · JPG</span>
            <input type="file" accept="image/*" multiple onChange={handleProofSelect} className="hidden" />
          </label>
          {draft.proofDocs.map((f, i) => (
            <div key={i} className="relative flex h-36 w-36 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-center dark:border-zinc-700 dark:bg-zinc-800">
              <span className="truncate text-xs">{f.name}</span>
              <button
                type="button"
                onClick={() => update({ proofDocs: draft.proofDocs.filter((_, j) => j !== i) })}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                ×
              </button>
            </div>
          ))}
          {draft.proofDocs.length === 0 && (
            <div className="flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 p-2 text-center text-xs text-zinc-400 dark:border-zinc-700">
              Optional — add a second proof if you have one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
