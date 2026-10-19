import { RoomType } from '@/lib/types';
import { inputCls, RentCycle, WizardDraft, WizardRoomInput } from './types';

const CYCLES: { value: RentCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
];

export function validateRooms(d: WizardDraft): string | null {
  const units = d.type === 'flat' ? d.flatSpaces : d.type === 'room' ? [d.roomInfo] : d.rooms;
  if (units.length === 0) return 'Add at least one room or space.';
  if (units.some((u) => u.rent_per_bed <= 0)) return 'Enter a rent for every room/space.';
  if (d.type !== 'room' && d.type !== 'flat' && units.some((u) => u.total_beds <= 0))
    return 'Every room type needs at least 1 bed.';
  return null;
}

function SpaceFields({
  s,
  onChange,
  onRemove,
  showBeds,
}: {
  s: WizardRoomInput;
  onChange: (patch: Partial<WizardRoomInput>) => void;
  onRemove: () => void;
  showBeds: boolean;
}) {
  return (
    <div className={`mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700 ${showBeds ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
      <input value={s.label} onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Name — e.g. Master bedroom" className={inputCls} />
      {showBeds && (
        <select value={s.room_type} onChange={(e) => onChange({ room_type: e.target.value as RoomType })}
          className={inputCls}>
          <option value="single">Single</option>
          <option value="double">Double</option>
          <option value="triple">Triple</option>
          <option value="dorm">Dorm</option>
        </select>
      )}
      {showBeds && (
        <input type="number" min={1} value={s.total_beds}
          onChange={(e) => onChange({ total_beds: Number(e.target.value) })}
          placeholder="Beds" title="Total beds" className={inputCls} />
      )}
      <input type="number" min={0} value={s.rent_per_bed}
        onChange={(e) => onChange({ rent_per_bed: Number(e.target.value) })}
        placeholder={showBeds ? 'Rent ₹/bed/mo' : 'Rent ₹/month'} title="Rent" className={inputCls} />
      <input type="number" min={0} value={s.deposit}
        onChange={(e) => onChange({ deposit: Number(e.target.value) })}
        placeholder="Deposit ₹" title="Deposit" className={inputCls} />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.available}
            onChange={(e) => onChange({ available: e.target.checked })}
            className="h-4 w-4 accent-teal-600" />
          Available
        </label>
        <button type="button" onClick={onRemove} className="text-sm text-red-600 hover:underline">
          Remove
        </button>
      </div>
    </div>
  );
}

export default function StepRooms({
  draft,
  update,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
}) {
  const setRooms = (rooms: WizardRoomInput[]) => update({ rooms });
  const setFlatSpaces = (flatSpaces: WizardRoomInput[]) => update({ flatSpaces });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-red-500">Step 2 of 6 · Flats & Rooms</p>
        <h2 className="mt-1 text-3xl font-bold italic">Add your flats & rooms.</h2>
        <p className="mt-1 text-zinc-500">Choose how often you collect rent, then add your spaces.</p>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-bold">Rent collection</h3>
        <p className="text-sm text-zinc-500">How often do you collect rent?</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CYCLES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => update({ rentCycle: c.value })}
              className={`rounded-2xl border-2 py-3 font-semibold transition ${
                draft.rentCycle === c.value
                  ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-950'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {draft.type === 'flat' ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold">Spaces & monthly pricing</h3>
            <button type="button"
              onClick={() => setFlatSpaces([...draft.flatSpaces, { room_type: 'single', label: '', total_beds: 1, rent_per_bed: 8000, deposit: 16000, available: true }])}
              className="text-sm font-semibold text-brand-600 hover:underline">
              + Add space
            </button>
          </div>
          <p className="mb-3 text-xs text-zinc-500">Name each rentable space with its own monthly rent. Untick spaces already occupied.</p>
          {draft.flatSpaces.map((s, i) => (
            <SpaceFields key={i} s={s} showBeds={false}
              onChange={(p) => setFlatSpaces(draft.flatSpaces.map((x, j) => (j === i ? { ...x, ...p } : x)))}
              onRemove={() => setFlatSpaces(draft.flatSpaces.filter((_, j) => j !== i))} />
          ))}
        </div>
      ) : draft.type === 'room' ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-lg font-bold">Room & monthly pricing</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select value={draft.roomInfo.label}
              onChange={(e) => update({ roomInfo: { ...draft.roomInfo, label: e.target.value } })}
              className={inputCls}>
              <option value="Private room">Private room</option>
              <option value="Sharing room">Sharing room</option>
            </select>
            <input type="number" min={0} value={draft.roomInfo.rent_per_bed}
              onChange={(e) => update({ roomInfo: { ...draft.roomInfo, rent_per_bed: Number(e.target.value) } })}
              placeholder="Rent ₹/month" className={inputCls} />
            <input type="number" min={0} value={draft.roomInfo.deposit}
              onChange={(e) => update({ roomInfo: { ...draft.roomInfo, deposit: Number(e.target.value) } })}
              placeholder="Deposit ₹" className={inputCls} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.roomInfo.available}
                onChange={(e) => update({ roomInfo: { ...draft.roomInfo, available: e.target.checked } })}
                className="h-4 w-4 accent-teal-600" />
              Available
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold">Rooms & pricing</h3>
            <button type="button"
              onClick={() => setRooms([...draft.rooms, { room_type: 'double', label: '', total_beds: 4, rent_per_bed: 7000, deposit: 7000, available: true }])}
              className="text-sm font-semibold text-brand-600 hover:underline">
              + Add room type
            </button>
          </div>
          {draft.rooms.map((r, i) => (
            <SpaceFields key={i} s={r} showBeds
              onChange={(p) => setRooms(draft.rooms.map((x, j) => (j === i ? { ...x, ...p } : x)))}
              onRemove={() => setRooms(draft.rooms.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
    </div>
  );
}
