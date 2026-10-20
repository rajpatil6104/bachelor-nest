import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find a flatmate',
  description: 'Flatmate matching for bachelors: post if you have a room or need one, show interest, and connect when both sides agree.',
};

export default function FlatmatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
