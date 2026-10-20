import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Vacancy alerts',
  description: 'Your vacancy alerts — see new bachelor-friendly stays matching your searches on BachelorsNest.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
