/** Typed access to build-time environment variables. */
const raw = import.meta.env;

export const env = {
  supabaseUrl: (raw.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseKey: (raw.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  vapidPublicKey: (raw.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '',
  /** Demonstration mode: local mock data instead of Supabase. */
  demoMode: raw.VITE_DEMO_MODE === 'true' || !raw.VITE_SUPABASE_URL,
} as const;
