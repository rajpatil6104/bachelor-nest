import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Search stays',
  description: 'Search bachelor-friendly PGs, hostels, rooms and flats by city, budget and amenities — with live vacancy counts and zero brokerage.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
