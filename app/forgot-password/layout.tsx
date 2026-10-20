import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Reset your BachelorsNest password with a 6-digit code sent to your email.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
