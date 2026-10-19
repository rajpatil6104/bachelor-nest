import { Suspense } from 'react';
import ProfileForm from '@/components/owner/ProfileForm';

export default function OwnerProfilePage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-zinc-500">Loading…</p>}>
      <ProfileForm />
    </Suspense>
  );
}
