import { RULE_CHIPS, SERVICE_OPTIONS } from '@/lib/types';
import { WizardDraft } from './types';

export default function StepServices({
  draft,
  update,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
}) {
  const toggleService = (id: string) =>
    update({
      services: draft.services.includes(id)
        ? draft.services.filter((x) => x !== id)
        : [...draft.services, id],
    });

  const toggleRule = (r: string) =>
    update({
      rules: draft.rules.includes(r)
        ? draft.rules.filter((x) => x !== r)
        : [...draft.rules, r],
    });

  function addCustomRule() {
    const v = draft.customRule.trim();
    if (v && !draft.rules.includes(v)) update({ rules: [...draft.rules, v], customRule: '' });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-red-500">Step 5 of 6 · Services & Rules</p>
        <h2 className="mt-1 text-3xl font-bold italic">Services & house rules.</h2>
        <p className="mt-1 text-zinc-500">What's included, what's extra, and what tenants should expect.</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Services</p>
        <div className="space-y-3">
          {SERVICE_OPTIONS.map((s) => {
            const on = draft.services.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-left dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="font-bold text-navy-900 dark:text-white">{s.id}</p>
                  <p className="text-sm text-zinc-500">{s.desc}</p>
                </div>
                <span
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">House rules</p>
        <div className="space-y-4">
          {RULE_CHIPS.map((cat) => (
            <div key={cat.title} className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-bold">{cat.title}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {cat.items.map((r) => {
                  const on = draft.rules.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRule(r)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition ${
                        on
                          ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-bold">Custom rule</h3>
            <p className="text-sm text-zinc-500">Not listed above?</p>
            <div className="mt-3 flex gap-2">
              <input
                value={draft.customRule}
                onChange={(e) => update({ customRule: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomRule())}
                placeholder="e.g. No pets…"
                className="flex-1 rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700"
              />
              <button type="button" onClick={addCustomRule}
                className="rounded-xl bg-red-100 px-6 font-semibold text-red-600 dark:bg-red-950">
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
