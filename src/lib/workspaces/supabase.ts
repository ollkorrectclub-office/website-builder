import { createClient } from "@supabase/supabase-js";

import { getOptionalEnv } from "@/lib/env";

export function createSupabaseServerClient() {
  const url = getOptionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
