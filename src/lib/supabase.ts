import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev so misconfiguration is obvious. The console error
  // makes it clear what's missing before the app silently breaks on every
  // network call.
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Create .env.local with both values and restart the dev server.'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey);
