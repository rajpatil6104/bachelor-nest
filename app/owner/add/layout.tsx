import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Add a property',
  description: 'List your PG, hostel, flat or room on BachelorNest with the step-by-step builder.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
