import type { Api } from './api';
import { env } from '@/lib/env';
import { supabaseApi } from './supabase';
import { mockApi } from './mock';

/**
 * The one place that decides where data comes from.
 * Demo mode (mock data) is explicit: VITE_DEMO_MODE=true or no Supabase URL.
 */
export const api: Api = env.demoMode ? mockApi : supabaseApi;

export type { Api } from './api';
