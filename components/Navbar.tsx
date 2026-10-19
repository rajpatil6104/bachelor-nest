'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getUnreadCount } from '@/lib/db';
import ThemeToggle from './ThemeToggle';

interface MenuLink {
  href: string;
  label: string;
  show: boolean;
  badge?: number;
}

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || user.role === 'admin') {
      setUnread(0);
      return;
    }
    const load = () => getUnreadCount(user.id).then(setUnread).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  async function handleLogout() {
    setOpen(false);
    await signOut();
    router.push('/');
  }

  const links: MenuLink[] = [
    { href: '/', label: '🏠 Home', show: user?.role !== 'owner' },
    { href: '/search', label: '🔍 Find a stay', show: user?.role !== 'owner' },
    { href: '/owner', label: '📊 Dashboard', show: user?.role === 'owner' },
    { href: '/owner/add', label: '➕ Add listing', show: user?.role === 'owner' },
    { href: '/admin', label: '🛡️ Review listings', show: user?.role === 'admin' },
    { href: '/visits', label: '📅 My visits', show: user?.role === 'tenant' },
    { href: '/saved', label: '❤️ Saved', show: user?.role === 'tenant' },
    { href: '/alerts', label: '🔔 Alerts', show: user?.role === 'tenant' },
    { href: '/chat', label: '💬 Chats', show: !!user && user.role !== 'admin', badge: unread },
  ];

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-navy-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="BachelorsNest logo" className="h-10 w-auto" />
            <span className="text-xl font-bold tracking-tight text-navy-900 dark:text-white">
              Bachelors<span className="text-brand-600 dark:text-brand-400">Nest</span>
            </span>
          </Link>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-xl hover:border-brand-500 dark:border-zinc-700"
          >
            ☰
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Slide-in menu */}
      <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute right-0 top-0 flex h-full w-72 flex-col bg-white shadow-2xl transition-transform duration-200 dark:bg-navy-950 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <span className="font-bold">Menu</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-lg dark:border-zinc-700"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? null : (
              <ul className="space-y-1">
                {links
                  .filter((l) => l.show)
                  .map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                          pathname === l.href ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : ''
                        }`}
                      >
                        <span>{l.label}</span>
                        {!!l.badge && l.badge > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                            {l.badge > 9 ? '9+' : l.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}

            <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="font-medium">🌙 Appearance</span>
              <ThemeToggle />
            </div>
          </div>

          <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
                  {(user.name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {user.name}
                    {user.demo && <span className="text-zinc-400"> (demo)</span>}
                  </p>
                  <p className="truncate text-xs capitalize text-zinc-500">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:border-red-400 hover:text-red-600 dark:border-zinc-700"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-center font-semibold dark:border-zinc-700"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-center font-semibold text-white hover:bg-brand-700"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
