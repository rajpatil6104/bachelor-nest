import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agreements',
  description: 'Create and manage digital rental agreements for your tenants.',
};

export default function OwnerAgreementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
