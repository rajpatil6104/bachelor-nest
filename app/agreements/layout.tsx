import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My agreements',
  description: 'Review and accept rental agreements sent to you by owners.',
};

export default function AgreementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
