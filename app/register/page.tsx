'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Role, useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('tenant');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const res = await signUp(name.trim(), email.trim(), password, role);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? 'Signup failed');
      return;
    }
    if (res.message) {
      // Email confirmation required — stay on page and show the notice
      setNotice(res.message);
      return;
    }
    router.push(role === 'owner' ? '/owner' : '/');
  }

  const inputCls =
    'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Create your account 🎉</h1>
      <p className="mt-1 text-sm text-zinc-500">One account — pick how you&apos;ll use BachelorNest.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: 'tenant', icon: '🏠', label: 'I need a stay' },
              { v: 'owner', icon: '🔑', label: 'I own a property' },
            ] as const
          ).map((o) => (
            <button
              type="button"
              key={o.v}
              onClick={() => setRole(o.v)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                role === o.v
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950'
                  : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span className="text-xl">{o.icon}</span>
              <br />
              {o.label}
            </button>
          ))}
        </div>

        <input
          required value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Full name" className={inputCls}
        />
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address" className={inputCls}
        />
        <input
          type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)" className={inputCls}
        />

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {notice}
          </p>
        )}

        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
