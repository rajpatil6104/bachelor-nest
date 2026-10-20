'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { acceptAgreement, getAgreement } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Agreement } from '@/lib/types';

const fmtDate = (iso: string) =>
  new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

function endDate(start: string, months: number): string {
  const d = new Date(start + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const STANDARD_TERMS = [
  'Rent is payable by the 5th of every month.',
  'Either party may end this agreement with one month’s written notice.',
  'The security deposit (less any dues or damage charges) will be refunded within 15 days of vacating.',
  'The tenant will keep the premises clean and will not sub-let any part of it.',
  'Any damage beyond normal wear and tear will be charged at actual repair cost.',
];

// The agreement document itself — deliberately light-styled in both
// themes so it prints as a clean PDF (Print button → browser print).
export default function AgreementDoc({ agreementId }: { agreementId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [missing, setMissing] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAgreement(agreementId).then((a) => {
      if (!a) setMissing(true);
      else setAgreement(a);
    });
  }, [agreementId, user]);

  if (authLoading) return <p className="p-8 text-zinc-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">📄</div>
        <h1 className="mt-4 text-xl font-bold">Log in to view this agreement</h1>
        <Link
          href={`/login?next=/agreements/${agreementId}`}
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-xl font-bold">Agreement not found</h1>
        <p className="mt-2 text-sm text-zinc-500">
          It may have been deleted, or it isn't addressed to your account.
        </p>
      </div>
    );
  }
  if (!agreement) return <p className="p-8 text-zinc-500">Loading agreement…</p>;

  const a = agreement;
  const isTenant =
    user.role === 'tenant' && user.email.toLowerCase() === a.tenant_email.toLowerCase();
  const isOwner = user.id === a.owner_id;
  const rules = (a.terms ?? '')
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean);

  async function handleAccept() {
    setAccepting(true);
    try {
      await acceptAgreement(a.id);
      setAgreement({
        ...a,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      });
    } finally {
      setAccepting(false);
    }
  }

  const row = (k: string, v: string) => (
    <tr className="border-b border-zinc-200 last:border-0">
      <td className="py-2 pr-4 font-medium text-zinc-500">{k}</td>
      <td className="py-2 font-semibold">{v}</td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Actions — never printed */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={isOwner ? '/owner/agreements' : '/agreements'} className="text-sm font-medium text-brand-600 hover:underline">
          ← All agreements
        </Link>
        <div className="flex gap-2">
          {isTenant && a.status === 'sent' && (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {accepting ? 'Accepting…' : '✓ Accept agreement'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-full bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-900"
          >
            ⬇ Print / Download PDF
          </button>
        </div>
      </div>

      {isTenant && a.status === 'sent' && (
        <p className="no-print mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Please read the full agreement below. Accepting records your digital
          acceptance with a timestamp.
        </p>
      )}
      {a.status === 'accepted' && (
        <p className="no-print mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          ✓ Accepted by {a.tenant_name}
          {a.accepted_at ? ` on ${fmtDate(a.accepted_at)}` : ''}.
        </p>
      )}

      {/* Document */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm sm:p-10">
        <div className="text-center">
          <img src="/logo.png" alt="BachelorNest" className="mx-auto h-12 w-auto" />
          <h1 className="mt-3 text-2xl font-bold tracking-wide text-[#04334B]">
            RENTAL AGREEMENT
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Agreement no. BN-{a.id.slice(0, 8).toUpperCase()} · Generated on{' '}
            {fmtDate(a.created_at)} via BachelorNest
          </p>
        </div>

        <p className="mt-8 leading-relaxed">
          This agreement is made between <b>{a.owner_name}</b> (the
          &ldquo;Owner&rdquo;) and <b>{a.tenant_name}</b> (the
          &ldquo;Tenant&rdquo;) for a stay booked through BachelorNest.
        </p>

        <h2 className="mt-8 text-lg font-bold text-[#04334B]">Property & term</h2>
        <table className="mt-2 w-full text-left text-sm">
          <tbody>
            {row('Property', `${a.listing_title}${a.room_label ? ` — ${a.room_label}` : ''}`)}
            {row('Address', a.property_address)}
            {row('Monthly rent', `₹${a.monthly_rent.toLocaleString('en-IN')}`)}
            {row('Security deposit', `₹${a.deposit.toLocaleString('en-IN')}`)}
            {row('Start date', fmtDate(a.start_date))}
            {row(
              'Duration',
              `${a.duration_months} months (ends ${fmtDate(endDate(a.start_date, a.duration_months))})`
            )}
            {row('Tenant phone', a.tenant_phone ?? '—')}
            {row('Tenant email', a.tenant_email)}
          </tbody>
        </table>

        <h2 className="mt-8 text-lg font-bold text-[#04334B]">Terms & conditions</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {STANDARD_TERMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>

        {rules.length > 0 && (
          <>
            <h2 className="mt-8 text-lg font-bold text-[#04334B]">House rules</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-sm text-zinc-500">Owner</p>
            <p className="mt-8 border-t border-zinc-300 pt-2 font-semibold">{a.owner_name}</p>
            <p className="text-xs text-zinc-400">Signed digitally on {fmtDate(a.created_at)}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Tenant</p>
            <p className="mt-8 border-t border-zinc-300 pt-2 font-semibold">{a.tenant_name}</p>
            <p className="text-xs text-zinc-400">
              {a.status === 'accepted' && a.accepted_at
                ? `Accepted digitally on ${fmtDate(a.accepted_at)}`
                : 'Awaiting digital acceptance'}
            </p>
          </div>
        </div>

        <p className="mt-10 border-t border-zinc-200 pt-4 text-center text-xs leading-relaxed text-zinc-400">
          Generated via BachelorNest. This document records the terms agreed
          between the two parties on the platform. For full legal validity,
          parties should execute a stamped / registered agreement as per
          their state laws.
        </p>
      </div>
    </div>
  );
}
