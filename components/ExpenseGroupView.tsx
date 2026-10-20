'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  addExpense,
  addExpenseMember,
  addSettlement,
  deleteExpense,
  deleteExpenseGroup,
  getExpenseGroupDetail,
  ExpenseGroupDetail as Detail,
} from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { EXPENSE_CATEGORIES } from '@/lib/types';
import { computeBalances, simplifyDebts } from '@/lib/expenses';

const inputCls =
  'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function ExpenseGroupView({ groupId }: { groupId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);

  const [memberName, setMemberName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [category, setCategory] = useState<string>('Groceries');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    getExpenseGroupDetail(groupId).then((d) => {
      if (!d) setMissing(true);
      else {
        setDetail(d);
        setPaidBy(d.members[0]?.id ?? '');
      }
    });
  }, [groupId, user]);

  const balances = useMemo(
    () =>
      detail
        ? computeBalances(detail.members, detail.expenses, detail.settlements)
        : [],
    [detail]
  );
  const debts = useMemo(() => simplifyDebts(balances), [balances]);
  const totalSpent = useMemo(
    () => detail?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0,
    [detail]
  );
  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    detail?.members.forEach((x) => m.set(x.id, x.name));
    return m;
  }, [detail]);

  if (authLoading) return <p className="p-8 text-zinc-500">Loading…</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🧾</div>
        <h1 className="mt-4 text-xl font-bold">Log in to see this home</h1>
        <Link href={`/login?next=/expenses/${groupId}`} className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700">
          Log in
        </Link>
      </div>
    );
  }
  if (missing) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-xl font-bold">Home not found</h1>
        <Link href="/expenses" className="mt-6 inline-block font-medium text-brand-600 hover:underline">
          ← Your homes
        </Link>
      </div>
    );
  }
  if (!detail) return <p className="p-8 text-zinc-500">Loading home…</p>;

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim()) return;
    const m = await addExpenseMember(groupId, memberName.trim());
    setDetail((d) => (d ? { ...d, members: [...d.members, m] } : d));
    setMemberName('');
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!title.trim() || !amt || amt <= 0 || !paidBy) {
      setError('Add a title, a valid amount, and who paid.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const exp = await addExpense({
        group_id: groupId,
        title: title.trim(),
        amount: amt,
        paid_by: paidBy,
        category,
      });
      setDetail((d) => (d ? { ...d, expenses: [exp, ...d.expenses] } : d));
      setTitle('');
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the expense.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSettle(fromId: string, toId: string, amt: number) {
    const s = await addSettlement({
      group_id: groupId,
      from_member: fromId,
      to_member: toId,
      amount: amt,
    });
    setDetail((d) => (d ? { ...d, settlements: [s, ...d.settlements] } : d));
  }

  async function handleDeleteExpense(id: string) {
    await deleteExpense(id);
    setDetail((d) => (d ? { ...d, expenses: d.expenses.filter((e) => e.id !== id) } : d));
  }

  async function handleDeleteGroup() {
    await deleteExpenseGroup(groupId);
    router.push('/expenses');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/expenses" className="text-sm font-medium text-brand-600 hover:underline">
        ← Your homes
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">🏠 {detail.group.name}</h1>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium dark:bg-zinc-800">
          Total spent: {inr(totalSpent)}
        </span>
      </div>

      {/* Members */}
      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-bold">Flatmates ({detail.members.length})</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.members.map((m) => (
            <span key={m.id} className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200">
              👤 {m.name}
            </span>
          ))}
        </div>
        <form onSubmit={handleAddMember} className="mt-3 flex gap-2">
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Add a flatmate's name" className={inputCls} />
          <button type="submit" className="shrink-0 rounded-xl border border-zinc-300 px-4 font-semibold dark:border-zinc-700">
            Add
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-400">
          Expenses split equally among everyone in the home. Adding a member later re-splits past expenses too.
        </p>
      </section>

      {/* Balances */}
      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-bold">Who owes whom</h2>
        {debts.length === 0 ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-300">
            ✓ All settled up — nobody owes anybody.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {debts.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
                <span className="text-sm">
                  <b>{d.from.name}</b> pays <b>{d.to.name}</b>{' '}
                  <span className="font-bold text-navy-900 dark:text-white">{inr(d.amount)}</span>
                </span>
                <button
                  onClick={() => handleSettle(d.from.id, d.to.id, d.amount)}
                  className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  ✓ Mark settled
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {balances.map((b) => (
            <div key={b.member.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800">
              <span className="font-medium">{b.member.name}</span>
              {b.net > 0 ? (
                <span className="font-semibold text-green-600">gets back {inr(b.net)}</span>
              ) : b.net < 0 ? (
                <span className="font-semibold text-red-600">owes {inr(-b.net)}</span>
              ) : (
                <span className="text-zinc-400">settled</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Add expense */}
      <form onSubmit={handleAddExpense} className="mt-4 space-y-3 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-bold">Add an expense</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What was it? e.g. Milk & eggs" className={inputCls} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={1} placeholder="Amount ₹" className={inputCls} />
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={inputCls}>
            {detail.members.map((m) => (
              <option key={m.id} value={m.id}>Paid by {m.name}</option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-2xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? 'Adding…' : 'Add expense'}
        </button>
      </form>

      {/* Expense history */}
      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-bold">Expenses</h2>
        {detail.expenses.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No expenses yet — add the first one above.</p>
        ) : (
          <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {detail.expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-zinc-500">
                    {memberNameById.get(e.paid_by) ?? 'Someone'} paid · {e.category ?? 'Other'} ·{' '}
                    {new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' · '}{inr(Math.round(e.amount / Math.max(1, detail.members.length)))} each
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{inr(e.amount)}</span>
                  <button onClick={() => handleDeleteExpense(e.id)} className="text-sm text-red-500 hover:underline" aria-label={`Delete ${e.title}`}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {detail.settlements.length > 0 && (
          <>
            <h3 className="mt-5 font-bold">Settlements</h3>
            <div className="mt-2 space-y-1 text-sm text-zinc-500">
              {detail.settlements.map((s) => (
                <p key={s.id}>
                  🤝 {memberNameById.get(s.from_member)} paid {memberNameById.get(s.to_member)} {inr(s.amount)} ·{' '}
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Danger zone */}
      <div className="mt-6 pb-8 text-right">
        {confirmDelete ? (
          <span className="flex items-center justify-end gap-2 text-sm">
            <span className="font-medium text-red-600">Delete this home and all its expenses?</span>
            <button onClick={handleDeleteGroup} className="rounded-full bg-red-600 px-4 py-1.5 font-semibold text-white">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-full border border-zinc-300 px-4 py-1.5 font-semibold dark:border-zinc-600">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm font-medium text-red-600 hover:underline">
            Delete this home
          </button>
        )}
      </div>
    </div>
  );
}
