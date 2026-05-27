import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { adminSupabase } from "../supabase/adminClient";

const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const adminLovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft", opts?: SignInOptions) => {
      const result = await lovableAuth.signInWithOAuth(provider, {
        redirect_uri: opts?.redirect_uri,
        extraParams: { ...opts?.extraParams },
      });

      if (result.redirected) return result;
      if (result.error) return result;

      try {
        await adminSupabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }

      return result;
    },
  },
};