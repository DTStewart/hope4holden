import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Admin Supabase client — separate auth storage from anonClient and bidderClient
 * so the GoTrue lock doesn't contend across them on the same browser tab.
 *
 * Lives in its own file (not client.ts) because client.ts is auto-generated
 * by Lovable's codegen and any customization there gets reverted on the next
 * regeneration. This file is hand-edited and stays put.
 *
 * storageKey isolates admin auth in localStorage. PKCE flow is the modern
 * default. detectSessionInUrl is needed for OAuth and magic-link callbacks.
 *
 * Sign-in is at /admin/login. Sessions persist across the 30-day rolling
 * Supabase refresh window without re-prompting.
 */
export const adminSupabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      storageKey: "h4h-admin-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  }
);
