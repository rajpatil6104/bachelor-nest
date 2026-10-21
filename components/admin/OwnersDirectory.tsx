'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AdminOwner,
  deleteOwnerAccount,
  getAdminOwners,
  getSignedDocUrl,
  setKycStatus,
  setOwnerSuspended,
} from '@/lib/db';
import { sendVerifiedEmail } from '@/lib/notify';
import { TYPE_LABELS, listingAvailableBeds, minRent } from '@/lib/types';

// Owners directory for /admin: every owner account with their listings,
// KYC documents and report counts — plus the policy actions: verify /
// reject KYC, suspend (login blocked + listings hidden everywhere),
// reinstate, and permanent account deletion (type-the-email confirm).

type Filter = 'all' | 'pending' | 'verified' | 'suspended' | 'rejected';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending KYC' },
  { key: 'verified', label: 'Verified' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'rejected', label: 'Rejected' },
];

function joinedLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function kycBadge(o: AdminOwner) {
  if (o.suspended)
    return (
      <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
        🚫 Suspended
      </span>
    );
  if (o.kyc_status === 'verified')
    return (
      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
        ✓ Verified
      </span>
    );
  if (o.kyc_status === 'rejected')
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
        Rejected
      </span>
    );
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
      Pending KYC
    </span>
  );
}

export default function OwnersDirectory() {
  const [owners, setOwners] = useState<AdminOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [confirmSuspendId, setConfirmSuspendId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    getAdminOwners()
      .then(setOwners)
      .catch(() => setLoadError('Could not load the owners list. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  // Load an owner's KYC documents the first time their card is expanded.
  useEffect(() => {
    if (!expandedId) return;
    const owner = owners.find((o) => o.id === expandedId);
    if (!owner) return;
    for (const doc of owner.kyc_docs) {
      if (docUrls[doc]) continue;
      getSignedDocUrl(doc)
        .then((url) => setDocUrls((prev) => ({ ...prev, [doc]: url })))
        .catch(() => { /* leave the placeholder */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return owners.filter((o) => {
      if (filter === 'pending' && o.kyc_status !== 'pending') return false;
      if (filter === 'verified' && o.kyc_status !== 'verified') return false;
      if (filter === 'rejected' && o.kyc_status !== 'rejected') return false;
      if (filter === 'suspended' && !o.suspended) return false;
      if (!q) return true;
      return (
        (o.full_name ?? '').toLowerCase().includes(q) ||
        (o.email ?? '').toLowerCase().includes(q) ||
        (o.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [owners, query, filter]);

  function patchOwner(id: string, patch: Partial<AdminOwner>) {
    setOwners((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  async function decideKyc(o: AdminOwner, status: 'verified' | 'rejected') {
    setActing(o.id);
    setNote('');
    setNoteError('');
    try {
      await setKycStatus(o.id, status);
      patchOwner(o.id, { kyc_status: status });
      if (status === 'verified') {
        const r = await sendVerifiedEmail(o.email, o.full_name);
        setNote(
          r.sent
            ? `✓ ${o.full_name ?? 'Owner'} verified — email sent to ${o.email}.`
            : `✓ ${o.full_name ?? 'Owner'} verified. (Verification email skipped: ${r.reason ?? 'not configured'}.)`
        );
      } else {
        setNote(`✗ ${o.full_name ?? 'Owner'}'s verification was rejected.`);
      }
    } catch (err) {
      const msg = (err as { message?: string } | null)?.message;
      setNoteError(
        msg ? `Could not save that decision: ${msg}` : 'Could not save that decision. Please try again.'
      );
    } finally {
      setActing(null);
    }
  }

  async function toggleSuspend(o: AdminOwner) {
    const next = !o.suspended;
    if (next && confirmSuspendId !== o.id) {
      setConfirmSuspendId(o.id);
      return;
    }
    setConfirmSuspendId(null);
    setActing(o.id);
    setNote('');
    setNoteError('');
    try {
      await setOwnerSuspended(o.id, next);
      patchOwner(o.id, { suspended: next });
      setNote(
        next
          ? `🚫 ${o.full_name ?? 'Owner'} suspended — they can't log in and all their listings are now hidden.`
          : `✓ ${o.full_name ?? 'Owner'} reinstated — their listings are visible again.`
      );
    } catch (err) {
      // Supabase errors are plain objects carrying a message, not Errors.
      const msg = (err as { message?: string } | null)?.message ?? '';
      setNoteError(
        /suspended/.test(msg)
          ? 'The database is missing the suspension column — run supabase/migration_owner_suspend.sql in the Supabase SQL editor, then try again.'
          : msg
            ? `Could not change suspension: ${msg}`
            : 'Could not change suspension. Please try again.'
      );
    } finally {
      setActing(null);
    }
  }

  async function confirmDelete(o: AdminOwner) {
    setActing(o.id);
    setNote('');
    setNoteError('');
    const r = await deleteOwnerAccount(o.id);
    setActing(null);
    if (!r.ok) {
      setNoteError(r.message ?? 'Could not delete the account.');
      return;
    }
    setOwners((prev) => prev.filter((x) => x.id !== o.id));
    setDeleteId(null);
    setDeleteText('');
    setNote(`🗑️ ${o.full_name ?? 'Owner'}'s account and all their listings were permanently deleted.`);
  }

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold">👥 Owners</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Every owner on the platform. Open one to see their listings and documents,
        or suspend an owner who breaks policy — their listings disappear instantly.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or phone…"
          className="min-w-56 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              filter === f.key
                ? 'bg-navy-800 text-white dark:bg-navy-700'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {note && (
        <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {note}
        </p>
      )}
      {noteError && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {noteError}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">Loading owners…</p>
      ) : loadError ? (
        <p className="mt-6 text-sm text-red-600">{loadError}</p>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <div className="text-4xl">🔍</div>
          <p className="mt-2 font-medium">No owners match</p>
          <p className="text-sm text-zinc-500">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {visible.map((o) => {
            const expanded = expandedId === o.id;
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                      {(o.full_name ?? '?').trim().charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{o.full_name ?? 'Unnamed owner'}</p>
                        {kycBadge(o)}
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {o.email ?? 'No email'} · {o.phone ?? 'No phone'}
                        {o.created_at ? ` · joined ${joinedLabel(o.created_at)}` : ''}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        🏠 {o.listings.length} listing{o.listings.length === 1 ? '' : 's'} ·{' '}
                        {o.liveCount} live · {o.pendingCount} pending
                        {o.reportCount > 0 && (
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {' '}· 🚩 {o.reportCount} report{o.reportCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setExpandedId(expanded ? null : o.id)}
                      className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      {expanded ? 'Hide details' : 'View details'}
                    </button>
                    {o.kyc_status === 'pending' && (
                      <>
                        <button
                          onClick={() => decideKyc(o, 'rejected')}
                          disabled={acting === o.id}
                          className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => decideKyc(o, 'verified')}
                          disabled={acting === o.id}
                          className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {acting === o.id ? 'Saving…' : 'Verify'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleSuspend(o)}
                      disabled={acting === o.id}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                        o.suspended
                          ? 'bg-brand-600 text-white hover:bg-brand-700'
                          : confirmSuspendId === o.id
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950'
                      }`}
                    >
                      {acting === o.id
                        ? 'Saving…'
                        : o.suspended
                          ? 'Reinstate'
                          : confirmSuspendId === o.id
                            ? 'Click again to suspend'
                            : 'Suspend'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    {o.kyc_docs.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold">Identity documents</h3>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {o.kyc_docs.map((doc) => (
                            <div
                              key={doc}
                              className="h-40 w-32 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
                            >
                              {docUrls[doc] ? (
                                <a href={docUrls[doc]} target="_blank" rel="noreferrer">
                                  <img
                                    src={docUrls[doc]}
                                    alt="Verification document"
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ) : (
                                <div className="flex h-full items-center justify-center p-2 text-center text-xs text-zinc-400">
                                  Loading document…
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h3 className="mt-4 text-sm font-semibold">
                      Their listings ({o.listings.length})
                    </h3>
                    {o.listings.length === 0 ? (
                      <p className="mt-1 text-sm text-zinc-500">No listings yet.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {o.listings.map((l) => {
                          const rent = l.rooms.length ? minRent(l) : null;
                          return (
                            <div
                              key={l.id}
                              className="flex items-center gap-3 rounded-xl border border-zinc-100 p-2.5 dark:border-zinc-800"
                            >
                              {l.photos[0] ? (
                                <img
                                  src={l.photos[0]}
                                  alt={l.title}
                                  className="h-12 w-16 shrink-0 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl dark:bg-zinc-800">
                                  🏠
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{l.title}</p>
                                <p className="text-xs text-zinc-500">
                                  {TYPE_LABELS[l.type]} · {l.locality ? `${l.locality}, ` : ''}
                                  {l.city} · {listingAvailableBeds(l)} beds free
                                  {rent !== null && ` · from ₹${rent.toLocaleString('en-IN')}/mo`}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  l.status === 'approved'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : l.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}
                              >
                                {l.status}
                              </span>
                              <Link
                                href={`/admin/edit-listing/${l.id}`}
                                className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
                              >
                                Edit
                              </Link>
                              <Link
                                href={`/listing/${l.id}`}
                                className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
                              >
                                Open ↗
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                        Danger zone
                      </p>
                      {deleteId !== o.id ? (
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm text-red-600/80 dark:text-red-300/80">
                            Permanently delete this owner and everything they own. This cannot be undone.
                          </p>
                          <button
                            onClick={() => { setDeleteId(o.id); setDeleteText(''); }}
                            className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
                          >
                            Delete account…
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-red-600 dark:text-red-300">
                            Type the owner's email (<strong>{o.email ?? '—'}</strong>) to confirm
                            permanent deletion of the account and all {o.listings.length} listing
                            {o.listings.length === 1 ? '' : 's'}.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <input
                              value={deleteText}
                              onChange={(e) => setDeleteText(e.target.value)}
                              placeholder={o.email ?? 'owner email'}
                              className="min-w-56 flex-1 rounded-xl border border-red-300 px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-red-800 dark:bg-zinc-900"
                            />
                            <button
                              onClick={() => confirmDelete(o)}
                              disabled={acting === o.id || !o.email || deleteText.trim().toLowerCase() !== o.email.toLowerCase()}
                              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {acting === o.id ? 'Deleting…' : 'Delete permanently'}
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              disabled={acting === o.id}
                              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
