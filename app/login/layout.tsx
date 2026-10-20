import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to BachelorsNest to manage your stays, visit requests and chats.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
