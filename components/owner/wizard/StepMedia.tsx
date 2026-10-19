import { WizardDraft } from './types';

export function validateMedia(d: WizardDraft): string | null {
  if (d.photos.length === 0) return 'Add at least 1 photo of your property.';
  return null;
}

export default function StepMedia({
  draft,
  update,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
}) {
  const MAX = 8;

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(
      (f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024
    );
    const mapped = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    update({ photos: [...draft.photos, ...mapped].slice(0, MAX) });
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-red-500">Step 3 of 6 · Media</p>
        <h2 className="mt-1 text-3xl font-bold italic">Show off your property.</h2>
        <p className="mt-1 text-zinc-500">Add photos — listings with 5+ photos get far more inquiries.</p>
      </div>

      <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
        draft.photos.length >= 5
          ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950'
          : 'border-red-200 bg-red-50 text-red-600 dark:bg-red-950'
      }`}>
        {draft.photos.length}/5 photos {draft.photos.length < 5 ? `— add ${5 - draft.photos.length} more` : '— looking great!'}
        <span className="float-right font-normal">min 1 required</span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-300 bg-red-50 text-red-500 dark:border-red-800 dark:bg-red-950">
          <span className="text-3xl">+</span>
          <span className="text-sm font-semibold">Add</span>
          <input type="file" accept="image/*" multiple onChange={handleSelect} className="hidden" />
        </label>
        {draft.photos.map((p, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-2xl">
            <img src={p.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(p.preview);
                update({ photos: draft.photos.filter((_, j) => j !== i) });
              }}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-400">JPG/PNG up to 5 MB each. The first photo becomes your cover.</p>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-bold">Photo tips</h3>
        <ul className="mt-2 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li><span className="mr-2 text-red-500">●</span><b>Cover shot:</b> a wide, well-lit exterior or common area as your first photo.</li>
          <li><span className="mr-2 text-red-500">●</span><b>Show interiors:</b> rooms, kitchen, bathrooms — more detail, more trust.</li>
          <li><span className="mr-2 text-red-500">●</span><b>Natural light:</b> photos near windows or in daylight look far better.</li>
        </ul>
      </div>
    </div>
  );
}
