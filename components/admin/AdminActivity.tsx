'use client';

import { useEffect, useState } from 'react';
import { getAdminActions, type AdminAction } from '@/lib/db';

const ACTION_TEXT: Record<string, string> = {
  'listing.approved': 'approved listing',
  'listing.rejected': 'rejected listing',
  'owner.kyc_verified': 'verified owner KYC for',
  'owner.kyc_rejected': 'rejected owner KYC for',
  'owner.suspended': 'suspended owner',
  'owner.reinstated': 'reinstated owner',
  'owner.deleted': 'deleted owner account',
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// Audit trail of moderation actions (migration_admin_log.sql). Logging is
// best-effort in lib/db — before the migration runs this simply stays empty.
export default function AdminActivity() {
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let on = true;
    getAdminActions()
      .then((rows) => {
        if (on) {
          setActions(rows);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (on) setLoaded(true);
      });
    return () => {
      on = false;
    };
  }, []);

  if (!loaded || actions.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold">Admin activity</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        The latest moderation actions and who took them.
      </p>
      <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {actions.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{a.adminEmail ?? 'An admin'}</span>{' '}
              <span className="text-zinc-600 dark:text-zinc-300">
                {ACTION_TEXT[a.action] ?? a.action}
              </span>{' '}
              {a.targetLabel && (
                <span className="font-medium">“{a.targetLabel}”</span>
              )}
            </span>
            <span className="shrink-0 text-xs text-zinc-400">{when(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
