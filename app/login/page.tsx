'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Role, useAuth } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, demoSignIn, demoMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = searchParams.get('next') ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? 'Login failed');
      return;
    }
    router.push(next);
  }

  function handleDemo(role: Role) {
    demoSignIn(role);
    router.push(role === 'owner' ? '/owner' : role === 'admin' ? '/admin' : '/');
  }

  const inputCls =
    'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Welcome back 👋</h1>
      <p className="mt-1 text-sm text-zinc-500">Log in to your BachelorNest account.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address" className={inputCls}
        />
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" className={inputCls}
        />
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {demoMode && (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm font-medium">No Supabase connected yet — try a demo login:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleDemo('tenant')}
              className="flex-1 rounded-xl border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              🏠 Demo bachelor
            </button>
            <button
              onClick={() => handleDemo('owner')}
              className="flex-1 rounded-xl border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              🔑 Demo owner
            </button>
            <button
              onClick={() => handleDemo('admin')}
              className="flex-1 rounded-xl border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              🛡️ Demo admin
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        New here?{' '}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-zinc-500">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
