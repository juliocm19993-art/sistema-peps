import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { client: null, configured: false };
  }

  return {
    client: createClient(url, anonKey),
    configured: true,
  };
}