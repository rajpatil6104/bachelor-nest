import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'My visits',
  description: 'Track your visit requests and their status on BachelorNest.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
