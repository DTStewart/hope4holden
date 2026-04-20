import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Anonymous Supabase client with NO auth session management.
 * Use for public (non-authenticated) queries across the site to prevent
 * auth lock conflicts ("Lock was released because another request stole it")
 * with the authenticated session used by the admin dashboard.
 */
export const anonSupabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
