import { Expense, ExpenseMember, Settlement } from './types';

// Balance math for the expense splitter. Every expense is split equally
// among all current group members. A member's net = what they paid
// (expenses + settlements they sent) − what they consumed (their share
// of expenses + settlements they received). Positive net = the group
// owes them; negative = they owe the group.

export interface MemberBalance {
  member: ExpenseMember;
  paid: number;
  share: number;
  net: number; // rounded to whole rupees for display
}

export function computeBalances(
  members: ExpenseMember[],
  expenses: Expense[],
  settlements: Settlement[]
): MemberBalance[] {
  const n = members.length || 1;
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  for (const m of members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  }
  for (const e of expenses) {
    paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + e.amount);
    const each = e.amount / n;
    for (const m of members) share.set(m.id, (share.get(m.id) ?? 0) + each);
  }
  for (const s of settlements) {
    // Settling a debt counts as paying (sender) and consuming (receiver)
    paid.set(s.from_member, (paid.get(s.from_member) ?? 0) + s.amount);
    share.set(s.to_member, (share.get(s.to_member) ?? 0) + s.amount);
  }
  return members.map((m) => ({
    member: m,
    paid: Math.round(paid.get(m.id) ?? 0),
    share: Math.round(share.get(m.id) ?? 0),
    net: Math.round((paid.get(m.id) ?? 0) - (share.get(m.id) ?? 0)),
  }));
}

export interface Debt {
  from: ExpenseMember;
  to: ExpenseMember;
  amount: number;
}

// Greedy simplification: fewest transfers that zero everyone out.
export function simplifyDebts(balances: MemberBalance[]): Debt[] {
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ member: b.member, amt: -b.net }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ member: b.member, amt: b.net }))
    .sort((a, b) => b.amt - a.amt);

  const debts: Debt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].amt, creditors[j].amt);
    if (amt > 0) {
      debts.push({ from: debtors[i].member, to: creditors[j].member, amount: amt });
    }
    debtors[i].amt -= amt;
    creditors[j].amt -= amt;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return debts;
}
