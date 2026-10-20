import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Join BachelorsNest — find a bachelor-friendly stay, or list your PG, hostel, room or flat. Owners verify once with an email OTP and ID proof.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
