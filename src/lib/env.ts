export function getOptionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

export function isEnvFlagEnabled(...names: string[]) {
  return names.some((name) => {
    const value = getOptionalEnv(name);

    if (!value) {
      return false;
    }

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });
}

export function isSupabaseConfigured() {
  return Boolean(getOptionalEnv("NEXT_PUBLIC_SUPABASE_URL") && getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY"));
}
