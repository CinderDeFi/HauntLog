import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIGURED } from './supabase';
import type { ProfileRow } from './database.types';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
};

// Module-level state + subscribers so all useAuth() callers share one
// session. Without this we'd hit Supabase on every component mount.
let cached: AuthState = {
  status: SUPABASE_CONFIGURED ? 'loading' : 'signed_out',
  user: null,
  session: null,
  profile: null,
};
const subscribers = new Set<(s: AuthState) => void>();
let initialized = false;

function setCached(next: Partial<AuthState>) {
  cached = { ...cached, ...next };
  subscribers.forEach((fn) => fn(cached));
}

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[auth] failed to load profile:', error.message);
    return null;
  }
  return data;
}

async function applySession(session: Session | null) {
  if (!session) {
    setCached({ status: 'signed_out', user: null, session: null, profile: null });
    return;
  }
  const profile = await loadProfile(session.user.id);
  setCached({
    status: 'signed_in',
    user: session.user,
    session,
    profile,
  });
}

function ensureInitialized() {
  if (initialized || !SUPABASE_CONFIGURED) return;
  initialized = true;

  // Read the persisted session on boot.
  supabase.auth.getSession().then(({ data }) => {
    applySession(data.session ?? null);
  });

  // React to sign in / sign out / token refresh.
  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session ?? null);
  });
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(cached);

  useEffect(() => {
    ensureInitialized();
    const fn = (s: AuthState) => setState(s);
    subscribers.add(fn);
    // Sync immediately in case state moved between render and effect.
    setState(cached);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // applySession will fire via onAuthStateChange.
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!cached.user) return;
    const profile = await loadProfile(cached.user.id);
    setCached({ profile });
  }, []);

  return {
    status: state.status,
    user: state.user,
    session: state.session,
    profile: state.profile,
    signOut,
    refreshProfile,
  };
}
