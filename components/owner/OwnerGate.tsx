'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOwnerProfile, getOwnerSuspended } from '@/lib/db';
import { useAuth } from '@/lib/auth';

// Owners must be ID-verified before using any owner surface. Demo accounts
// bypass the gate so Raj can test freely.
export default function OwnerGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ok' | 'pending' | 'rejected' | 'suspended'>('checking');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'owner') {
      setStatus('ok'); // page-level guards handle non-owners
      return;
    }
    if (user.demo) {
      setStatus('ok');
      return;
    }
    Promise.all([getOwnerProfile(user.id), getOwnerSuspended(user.id)]).then(([p, suspended]) => {
      if (suspended) setStatus('suspended');
      else if (!p || p.kyc_status === 'verified') setStatus('ok');
      else if (p.kyc_status === 'rejected') setStatus('rejected');
      else setStatus('pending');
    });
  }, [user, authLoading]);

  async function handleLogout() {
    await signOut();
    router.push('/');
  }

  if (status === 'checking' || authLoading) {
    return <p className="p-8 text-center text-sm text-zinc-500">Checking verification…</p>;
  }

  if (status !== 'ok') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl dark:bg-amber-900">
          {status === 'rejected' ? '❌' : status === 'suspended' ? '🚫' : '⏳'}
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {status === 'rejected'
            ? 'Verification rejected'
            : status === 'suspended'
              ? 'Account suspended'
              : 'Verification pending'}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {status === 'rejected'
            ? 'Your ID verification was rejected. Please contact support to appeal.'
            : status === 'suspended'
              ? 'Your owner account has been suspended for violating platform policy, and your listings are hidden. Please contact support if you think this is a mistake.'
              : "Our team is reviewing your ID. We'll email you once approved — then you can log in and manage your stays."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={handleLogout}
            className="rounded-xl border border-zinc-300 px-6 py-2.5 font-semibold dark:border-zinc-700"
          >
            Log out
          </button>
          <Link
            href="/"
            className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
