import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Saved stays',
  description: 'Your shortlisted PGs, hostels, rooms and flats on BachelorsNest.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
