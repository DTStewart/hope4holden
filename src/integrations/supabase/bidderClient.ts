import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Bidder Supabase client — separate auth storage from the admin client so
 * that a single browser can host an admin session AND a bidder session without
 * GoTrue lock contention.
 *
 * Anonymous bidder traffic uses this client too; Supabase Auth just reports
 * no session for them. Sign-in is OAuth-based (Google, Microsoft, Apple).
 */
export const bidderSupabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: "h4h-bidder-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  }
);
