import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Admin review',
  description: 'Review and moderate listings and owner identity verifications on BachelorsNest.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
