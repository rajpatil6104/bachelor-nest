import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home expenses',
  description: 'Balances, settle-ups and expense history for your home group.',
};

export default function ExpenseGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
