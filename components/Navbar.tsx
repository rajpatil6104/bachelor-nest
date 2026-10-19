'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import ChatNavLink from './ChatNavLink';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push('/');
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-navy-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="BachelorsNest logo" className="h-10 w-auto" />
          <span className="text-xl font-bold tracking-tight text-navy-900 dark:text-white">
            Bachelors<span className="text-brand-600 dark:text-brand-400">Nest</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm font-medium">
          {user?.role !== 'owner' && (
            <Link href="/search" className="hover:text-brand-600 dark:hover:text-brand-400">
              Find a stay
            </Link>
          )}
          {user?.role === 'owner' && (
            <Link href="/owner/add" className="hover:text-brand-600 dark:hover:text-brand-400">
              + Add listing
            </Link>
          )}
          {loading ? null : user ? (
            <>
              {user.role === 'owner' && (
                <Link href="/owner" className="hover:text-brand-600 dark:hover:text-brand-400">
                  Dashboard
                </Link>
              )}
              {user.role === 'admin' && (
                <Link href="/admin" className="hover:text-brand-600 dark:hover:text-brand-400">
                  🛡️ Review
                </Link>
              )}
              <ChatNavLink />
              {user.role === 'tenant' && (
                <>
                  <Link href="/visits" className="hover:text-brand-600 dark:hover:text-brand-400">
                    My visits
                  </Link>
                  <Link href="/saved" className="hover:text-brand-600 dark:hover:text-brand-400">
                    ❤️ Saved
                  </Link>
                  <Link href="/alerts" className="hover:text-brand-600 dark:hover:text-brand-400">
                    🔔 Alerts
                  </Link>
                </>
              )}
              <span className="hidden text-zinc-500 sm:inline">
                Hi, {user.name.split(' ')[0]}
                {user.demo && ' (demo)'}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-zinc-300 px-4 py-1.5 hover:border-brand-600 hover:text-brand-600 dark:border-zinc-700 dark:hover:border-brand-400 dark:hover:text-brand-400"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand-600 dark:hover:text-brand-400">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand-600 px-4 py-1.5 text-white hover:bg-brand-700"
              >
                Sign up
              </Link>
            </>
          )}
          <Link
            href="/owner/add"
            className="hidden rounded-full border border-brand-600 px-4 py-1.5 text-brand-700 hover:bg-brand-50 sm:inline dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-950"
          >
            List your place
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
