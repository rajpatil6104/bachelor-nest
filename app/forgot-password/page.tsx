'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// Forgot password, Raj's workflow:
//   enter email → 6-digit OTP by email → verify → new password + confirm →
//   submit → back to the login page.
// The three server steps live in /api/password-reset/* and reuse the same
// hashed, single-use, rate-limited OTP store as owner registration.

type Step = 'email' | 'code' | 'password';

const inputCls =
  'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { demoMode } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function post(path: string, payload: object) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json().catch(() => ({ ok: false, message: 'Something went wrong. Please try again.' }));
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    const data = await post('/api/password-reset/request', { email: email.trim() });
    setBusy(false);
    if (!data.ok) {
      setError(data.message ?? 'Could not send the code. Please try again.');
      return;
    }
    setCode('');
    setStep('code');
  }

  async function handleResend() {
    setBusy(true);
    setError('');
    setNote('');
    const data = await post('/api/password-reset/request', { email: email.trim() });
    setBusy(false);
    if (!data.ok) {
      setError(data.message ?? 'Could not resend the code. Please try again.');
      return;
    }
    setNote('A new code is on its way — the previous one no longer works.');
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    const data = await post('/api/password-reset/verify', { email: email.trim(), code });
    setBusy(false);
    if (!data.ok) {
      setError(data.message ?? 'Invalid or expired code. Please try again.');
      return;
    }
    setResetToken(data.resetToken ?? '');
    setStep('password');
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    const data = await post('/api/password-reset/complete', { token: resetToken, password });
    setBusy(false);
    if (!data.ok) {
      setError(data.message ?? 'Could not update the password. Please try again.');
      return;
    }
    router.push('/login?reset=1');
  }

  if (demoMode) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold">Forgot your password? 🔑</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
          You're in <strong>demo mode</strong> — there's no real account to reset.
          Demo logins don't use a password at all; just use the demo buttons on
          the login page.
        </div>
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            ← Back to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Forgot your password? 🔑</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {step === 'email' && "Enter your account email and we'll send you a 6-digit reset code."}
        {step === 'code' && 'Verify the code from your email to continue.'}
        {step === 'password' && 'Almost done — choose a new password.'}
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {note && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {note}
        </p>
      )}

      {step === 'email' && (
        <form onSubmit={handleEmail} className="mt-6 space-y-4">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address" className={inputCls} autoComplete="email"
          />
          <button
            type="submit" disabled={busy}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Sending code…' : 'Send reset code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleCode} className="mt-6 space-y-4">
          <p className="text-sm text-zinc-500">
            If an account exists for <strong>{email.trim()}</strong>, a 6-digit code
            is on its way to that inbox. It expires in 10 minutes.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="------"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="submit" disabled={busy || code.length !== 6}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify code'}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button" disabled={busy} onClick={() => { setStep('email'); setError(''); setNote(''); }}
              className="font-medium text-zinc-500 hover:underline disabled:opacity-50"
            >
              ← Change email
            </button>
            <button
              type="button" disabled={busy} onClick={handleResend}
              className="font-medium text-brand-600 hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handlePassword} className="mt-6 space-y-4">
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 6 characters)" className={inputCls} autoComplete="new-password"
          />
          <input
            type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password" className={inputCls} autoComplete="new-password"
          />
          <button
            type="submit" disabled={busy}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
