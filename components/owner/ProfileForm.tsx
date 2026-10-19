'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getOwnerProfile, updateOwnerProfile } from '@/lib/db';
import { useAuth } from '@/lib/auth';

const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700';

export default function ProfileForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const next = params.get('next') ?? '/owner';

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'owner')) {
      router.replace('/login?next=/owner/profile');
      return;
    }
    if (user) {
      getOwnerProfile(user.id).then((p) => {
        const parts = (p?.full_name ?? user.name ?? '').split(' ');
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' ') ?? '');
        setPhone(p?.phone ?? '');
        setLoading(false);
      });
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10))) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateOwnerProfile(user.id, {
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.replace(/\D/g, '').slice(-10),
      });
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <p className="p-6 text-center text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl font-bold">Complete Your Profile</h1>
      <p className="mt-1 text-zinc-500">Set up your account details to get started</p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="mb-1 block text-sm font-medium">Email Address</label>
        <input value={user?.email ?? ''} disabled className={`${inputCls} opacity-60`} />
        <p className="mb-4 mt-1 text-xs text-zinc-400">Email cannot be changed</p>

        <label className="mb-1 block text-sm font-medium">
          First Name <span className="text-red-500">*</span>
        </label>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          className={`${inputCls} mb-4`}
        />

        <label className="mb-1 block text-sm font-medium">
          Last Name <span className="text-red-500">*</span>
        </label>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          className={`${inputCls} mb-4`}
        />

        <label className="mb-1 block text-sm font-medium">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="98765 43210"
          inputMode="numeric"
          className={inputCls}
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-2xl bg-navy-800 py-4 font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Complete Onboarding'}
        </button>
      </form>
    </div>
  );
}
