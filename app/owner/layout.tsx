import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Owner dashboard',
  description: 'Manage your buildings, live vacancies and visit requests on BachelorNest.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
