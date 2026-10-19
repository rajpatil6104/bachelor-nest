'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push('/');
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight">
          🏠 Bachelor<span className="text-indigo-600">Nest</span>
        </Link>
        <div className="flex items-center gap-3 text-sm font-medium">
          <Link href="/search" className="hover:text-indigo-600">
            Find a stay
          </Link>
          {loading ? null : user ? (
            <>
              {user.role === 'owner' && (
                <Link href="/owner" className="hover:text-indigo-600">
                  Dashboard
                </Link>
              )}
              {user.role === 'admin' && (
                <Link href="/admin" className="hover:text-indigo-600">
                  🛡️ Review
                </Link>
              )}
              <span className="hidden text-zinc-500 sm:inline">
                Hi, {user.name.split(' ')[0]}
                {user.demo && ' (demo)'}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-zinc-300 px-4 py-1.5 hover:border-indigo-600 hover:text-indigo-600 dark:border-zinc-700"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-indigo-600">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
          <Link
            href="/owner/add"
            className="hidden rounded-full border border-indigo-600 px-4 py-1.5 text-indigo-600 hover:bg-indigo-50 sm:inline dark:hover:bg-indigo-950"
          >
            List your place
          </Link>
        </div>
      </div>
    </nav>
  );
}
