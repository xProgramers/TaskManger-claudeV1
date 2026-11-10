/** Typed access to build-time environment variables. */
const raw = import.meta.env;

export const env = {
  supabaseUrl: (raw.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseKey: (raw.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  vapidPublicKey: (raw.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '',
  /** Demonstration mode: local mock data instead of Supabase. */
  // Read straight from import.meta.env so the build can drop the demo data from production.
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_SUPABASE_URL,
} as const;
