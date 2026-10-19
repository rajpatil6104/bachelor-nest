'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSupabase, isSupabaseConfigured } from './supabase';

export type Role = 'owner' | 'tenant';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  demo?: boolean;
}

interface AuthResult {
  ok: boolean;
  message?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  demoMode: boolean;
  signUp: (name: string, email: string, password: string, role: Role) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  demoSignIn: (role: Role) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const DEMO_KEY = 'bn-demo-user';
const PENDING_KEY = 'bn-pending-signup';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const demoMode = !isSupabaseConfigured();

  // Ensure a row exists in public.profiles for this auth user
  async function ensureProfile(sb: any, authId: string, email: string): Promise<AuthUser> {
    const { data } = await sb.from('profiles').select('*').eq('id', authId).single();
    if (data) {
      return { id: data.id, email, name: data.full_name ?? email, role: data.role };
    }
    let pending: { name: string; role: Role } | null = null;
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    } catch {}
    const name = pending?.name ?? email.split('@')[0];
    const role = pending?.role ?? 'tenant';
    await sb.from('profiles').insert({ id: authId, role, full_name: name });
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {}
    return { id: authId, email, name, role };
  }

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      // Demo mode: restore demo session from localStorage
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch {}
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const u = data.session.user;
        setUser(await ensureProfile(sb, u.id, u.email ?? ''));
      }
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange(async (_evt, session) => {
      if (session?.user) {
        setUser(await ensureProfile(sb, session.user.id, session.user.email ?? ''));
      } else {
        setUser(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp(name: string, email: string, password: string, role: Role): Promise<AuthResult> {
    const sb = getSupabase();
    if (!sb) return { ok: false, message: 'Connect Supabase to enable real signup, or use a demo login.' };
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ name, role }));
    } catch {}
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
    if (!data.session) {
      return {
        ok: true,
        message: 'Account created! Check your email to confirm, then log in. (Tip: you can turn off email confirmation in Supabase → Authentication → Providers → Email.)',
      };
    }
    const u = data.session.user;
    setUser(await ensureProfile(sb, u.id, u.email ?? ''));
    return { ok: true };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const sb = getSupabase();
    if (!sb) return { ok: false, message: 'Connect Supabase to enable real login, or use a demo login.' };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    const u = data.session.user;
    setUser(await ensureProfile(sb, u.id, u.email ?? ''));
    return { ok: true };
  }

  async function signOut() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {}
    setUser(null);
  }

  function demoSignIn(role: Role) {
    const demo: AuthUser = {
      id: role === 'owner' ? 'owner-1' : 'tenant-1',
      email: role === 'owner' ? 'owner@demo.in' : 'bachelor@demo.in',
      name: role === 'owner' ? 'Demo Owner' : 'Demo Bachelor',
      role,
      demo: true,
    };
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    } catch {}
    setUser(demo);
  }

  return (
    <Ctx.Provider value={{ user, loading, demoMode, signUp, signIn, signOut, demoSignIn }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
