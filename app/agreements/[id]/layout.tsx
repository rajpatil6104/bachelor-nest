import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rental agreement',
  description: 'View, accept and download your BachelorNest rental agreement.',
};

export default function AgreementDocLayout({ children }: { children: React.ReactNode }) {
  return children;
}
