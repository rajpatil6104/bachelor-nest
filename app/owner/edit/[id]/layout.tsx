import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit listing',
  description: 'Update your property details, pricing and photos. Edits go through admin verification before going live again.',
};

export default function EditListingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
