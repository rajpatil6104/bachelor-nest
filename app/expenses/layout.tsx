import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Expense splitter',
  description: 'Split rent, groceries and bills with your flatmates — see who owes whom at a glance.',
};

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
