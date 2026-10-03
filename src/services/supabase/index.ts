import type { Api } from '@/services/api';
import { supabaseAuth } from './auth';
import { supabaseTasks } from './tasks';
import { supabaseBoards, supabaseNotes } from './notes';
import { supabaseCategories, supabaseNotifications, supabaseProfile, supabasePush } from './resources';

export const supabaseApi: Api = {
  mode: 'supabase',
  auth: supabaseAuth,
  tasks: supabaseTasks,
  categories: supabaseCategories,
  notifications: supabaseNotifications,
  profile: supabaseProfile,
  push: supabasePush,
  boards: supabaseBoards,
  notes: supabaseNotes,
};
