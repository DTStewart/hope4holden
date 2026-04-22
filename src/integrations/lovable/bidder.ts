// Bidder-side Lovable OAuth wrapper. Mirrors the auto-generated admin
// wrapper in ./index.ts but writes the resulting session to bidderSupabase
// (distinct storageKey from the admin client).
//
// Uses Lovable's Cloud Auth which ships with pre-registered Google / Microsoft
// / Apple OAuth apps — no need for the admin to set up OAuth clients anywhere.

import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { bidderSupabase } from "../supabase/bidderClient";

const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const bidderLovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft",
      opts?: SignInOptions
    ) => {
      const result = await lovableAuth.signInWithOAuth(provider, {
        redirect_uri: opts?.redirect_uri,
        extraParams: { ...opts?.extraParams },
      });

      if (result.redirected) return result;
      if (result.error) return result;

      try {
        await bidderSupabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
