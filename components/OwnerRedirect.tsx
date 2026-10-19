'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// Owners don't browse listings — send them straight to their dashboard.
export default function OwnerRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === 'owner') router.replace('/owner');
  }, [user, loading, router]);

  return null;
}
