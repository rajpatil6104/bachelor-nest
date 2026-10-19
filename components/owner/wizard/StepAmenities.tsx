import { useState } from 'react';
import { AMENITY_CATEGORIES } from '@/lib/types';
import { WizardDraft } from './types';

export default function StepAmenities({
  draft,
  update,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
}) {
  const [custom, setCustom] = useState('');

  const toggle = (a: string) =>
    update({
      amenities: draft.amenities.includes(a)
        ? draft.amenities.filter((x) => x !== a)
        : [...draft.amenities, a],
    });

  function addCustom() {
    const v = custom.trim();
    if (v && !draft.amenities.includes(v)) update({ amenities: [...draft.amenities, v] });
    setCustom('');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-red-500">Step 4 of 6 · Building Amenities</p>
        <h2 className="mt-1 text-3xl font-bold italic">What's in the building?</h2>
        <p className="mt-1 text-zinc-500">Tick the shared facilities tenants will have access to.</p>
      </div>

      {AMENITY_CATEGORIES.map((cat) => (
        <div key={cat.title} className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-lg font-bold">{cat.title}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {cat.items.map((a) => {
              const on = draft.amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle(a)}
                  className={`rounded-2xl border-2 px-4 py-3 text-left font-medium transition ${
                    on
                      ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200'
                      : 'border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {on ? '✓ ' : ''}{a}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-bold">Anything custom?</h3>
        <p className="text-sm text-zinc-500">Add amenities unique to your building — e.g. “rooftop terrace”.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            placeholder="Type and press Add…"
            className="flex-1 rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700"
          />
          <button type="button" onClick={addCustom}
            className="rounded-xl bg-red-100 px-6 font-semibold text-red-600 dark:bg-red-950">
            Add
          </button>
        </div>
        {draft.amenities.filter((a) => !AMENITY_CATEGORIES.some((c) => c.items.includes(a))).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.amenities
              .filter((a) => !AMENITY_CATEGORIES.some((c) => c.items.includes(a)))
              .map((a) => (
                <span key={a} className="flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                  {a}
                  <button type="button" onClick={() => toggle(a)} className="font-bold">×</button>
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
