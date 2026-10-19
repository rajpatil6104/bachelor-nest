'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Role, useAuth, PENDING_KEY } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import {
  ensureOwnerProfile,
  getOwnerProfile,
  submitKyc,
  uploadOwnerDocs,
} from '@/lib/db';

type Step = 'details' | 'otp' | 'docs' | 'pending';

const inputCls =
  'w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [step, setStep] = useState<Step>('details');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('tenant');

  const [otp, setOtp] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  function validateDetails(): string | null {
    if (!firstName.trim() || !lastName.trim()) return 'Please enter your first and last name.';
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) return 'Please enter a valid 10-digit mobile number.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  }

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    const err = validateDetails();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setNotice('');

    // Tenants keep the simple email+password signup
    if (role === 'tenant') {
      setBusy(true);
      const res = await signUp(fullName, email.trim(), password, 'tenant', cleanPhone);
      setBusy(false);
      if (!res.ok) {
        setError(res.message ?? 'Signup failed');
        return;
      }
      if (res.message) {
        setNotice(res.message);
        return;
      }
      router.push('/');
      return;
    }

    // Owners: verify email with our own OTP, sent from the app's Gmail —
    // Supabase itself sends nothing in this flow.
    const sb = getSupabase();
    if (!sb) {
      setError('Connect Supabase to enable owner registration, or use a demo login.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: fullName }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? 'Could not send the code. Please try again.');
        setBusy(false);
        return;
      }
    } catch {
      setError('Could not send the code. Check your connection and try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
    setStep('otp');
    setNotice(`We sent a 6-digit code to ${email.trim()}. Enter it below.`);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const vres = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const vjson = await vres.json();
      if (!vres.ok || !vjson.ok) {
        setError(vjson.message ?? 'Invalid or expired code. Please try again.');
        setBusy(false);
        return;
      }

      // Code verified — create the account. Supabase sends no email here;
      // "Confirm email" must be OFF in the dashboard (Auth → Providers → Email)
      // so signUp returns a session immediately.
      //
      // IMPORTANT: signUp fires SIGNED_IN, and the auth listener auto-creates
      // the profile via ensureProfile — which defaults to role='tenant' unless
      // PENDING_KEY tells it otherwise. Set it first so owners land as owners.
      try {
        localStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ name: fullName, role: 'owner', phone: cleanPhone })
        );
      } catch {}
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName, phone: cleanPhone, role: 'owner' } },
      });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      if (!data.session) {
        // Address already registered — work out which case it is
        await handleExistingEmail(sb);
        setBusy(false);
        return;
      }
      const authId = data.session.user.id;
      const existing = await getOwnerProfile(authId);
      if (existing && existing.role !== 'owner') {
        await sb.auth.signOut();
        setBusy(false);
        setStep('details');
        setError('This email is already registered with a different account type.');
        return;
      }
      await ensureOwnerProfile({
        id: authId,
        role: 'owner',
        full_name: fullName,
        phone: cleanPhone,
        email: email.trim(),
      });
      setBusy(false);
      setNotice('');
      setStep('docs');
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  // signUp returned no session => the email is taken. Probe with the given
  // password to give a useful message instead of a dead end.
  async function handleExistingEmail(sb: NonNullable<ReturnType<typeof getSupabase>>) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        setError(
          'This email needs confirmation — please turn OFF "Confirm email" in Supabase ' +
            '(Authentication → Providers → Email) and try again.'
        );
      } else {
        setError('This email is already registered. Please log in instead.');
      }
      return;
    }
    const p = await getOwnerProfile(data.user.id);
    const isFresh =
      !p || (p.role === 'owner' && p.kyc_status === 'none' && (p.kyc_docs ?? []).length === 0);
    if (isFresh) {
      // Signed in fine but never finished registering (e.g. abandoned halfway,
      // or a profile row was cleaned up) — continue as owner instead of
      // dead-ending. The probe sign-in above already established a session,
      // which the ID-upload step needs.
      await ensureOwnerProfile({
        id: data.user.id,
        role: 'owner',
        full_name: fullName,
        phone: cleanPhone,
        email: email.trim(),
      });
      setNotice('');
      setStep('docs');
      return;
    }
    await sb.auth.signOut();
    if (p?.role === 'owner' && p?.kyc_status === 'verified') {
      setError('This email already has a verified owner account. Please log in.');
    } else if (p?.role === 'owner') {
      setError(
        "You've already registered with this email — your verification is still pending. " +
          "We'll email you once approved."
      );
    } else {
      setError('This email is already registered with a different account type.');
    }
  }

  async function resendOtp() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: fullName }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) setError(json.message ?? 'Could not resend the code.');
      else setNotice('Code resent — check your inbox (and spam folder).');
    } catch {
      setError('Could not resend the code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDocs(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    if (!idFile) {
      setError('Please upload your government ID to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await sb.auth.getUser();
      const authId = data.user?.id;
      if (!authId) throw new Error('Session expired. Please start over.');
      const paths = await uploadOwnerDocs(authId, [idFile]);
      await submitKyc(authId, paths);
      await sb.auth.signOut();
      setStep('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {step === 'pending' ? (
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl dark:bg-amber-900">
            ⏳
          </div>
          <h1 className="mt-4 text-2xl font-bold">You're on the list!</h1>
          <p className="mt-2 text-sm text-zinc-500">
            We've received your details and ID proof. Our team will verify them —
            once approved, we'll email you at <b>{email.trim()}</b> and you can log in
            and add your stays.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Back to home
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Create your account 🎉</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {role === 'owner' && step !== 'details'
              ? 'Owner verification — step ' + (step === 'otp' ? '2' : '3') + ' of 3'
              : 'One account — pick how you\'ll use BachelorNest.'}
          </p>

          {step === 'details' && (
            <form onSubmit={handleDetails} className="mt-6 space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name" className={inputCls} />
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name" className={inputCls} />
              </div>
              <input required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number" inputMode="numeric" className={inputCls} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address" className={inputCls} />
              <input type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 characters)" className={inputCls} />
              <input type="password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password" className={inputCls} />

              {role === 'owner' && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  🛡️ Owners verify their email with an OTP and upload a government ID.
                  You can log in after our team approves you.
                </p>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {busy ? 'Please wait…' : role === 'owner' ? 'Send verification code' : 'Create account'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <p className="text-sm text-zinc-500">
                Enter the 6-digit code we emailed to <b>{email.trim()}</b>.
              </p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                inputMode="numeric"
                className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800"
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
              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {busy ? 'Verifying…' : 'Verify code'}
              </button>
              <button type="button" onClick={resendOtp} disabled={busy}
                className="w-full text-sm font-medium text-brand-600 hover:underline disabled:opacity-50">
                Didn't get it? Resend code
              </button>
            </form>
          )}

          {step === 'docs' && (
            <form onSubmit={handleDocs} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="font-bold">🛡️ Owner authentication proof</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Upload a government photo ID (Aadhaar, PAN, driving licence, passport
                  or voter ID) — image or PDF. Our team reviews it within 24–48 hours.
                </p>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-center hover:border-brand-500 dark:border-zinc-700">
                  <span className="text-3xl">📄</span>
                  <span className="mt-2 text-sm font-semibold">
                    {idFile ? idFile.name : 'Tap to upload your ID'}
                  </span>
                  <span className="text-xs text-zinc-400">JPG · PNG · PDF, max 5 MB</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > 5 * 1024 * 1024) {
                        setError('File must be under 5 MB.');
                        return;
                      }
                      if (f) setIdFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {busy ? 'Submitting…' : 'Submit for verification'}
              </button>
              <p className="text-center text-xs text-zinc-400">
                You won't be able to log in until our team verifies your ID.
              </p>
            </form>
          )}

          {step === 'details' && (
            <p className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                Log in
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
