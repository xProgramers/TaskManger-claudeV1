import type { AuthUser } from '@/types';
import type { AuthApi, AuthEvent } from '@/services/api';
import { toAppError } from '@/utils/errors';
import { getSupabase } from './client';

const toUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null;

export const supabaseAuth: AuthApi = {
  async getUser() {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw toAppError(error, 'Não foi possível verificar sua sessão.');
    return toUser(data.session?.user);
  },

  onChange(callback) {
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      const map: Record<string, AuthEvent> = {
        SIGNED_IN: 'SIGNED_IN',
        SIGNED_OUT: 'SIGNED_OUT',
        PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
        USER_UPDATED: 'USER_UPDATED',
      };
      // Defer: calling Supabase inside this callback can deadlock the auth lock.
      setTimeout(() => callback(toUser(session?.user), map[event] ?? 'OTHER'), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  async signIn(email, password) {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toAppError(error, 'Não foi possível entrar.');
  },

  async signUp({ email, password, fullName, timezone }) {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), timezone },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw toAppError(error, 'Não foi possível criar sua conta.');
    return { needsConfirmation: !data.session };
  },

  async signOut() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw toAppError(error, 'Não foi possível sair.');
  },

  async requestPasswordReset(email) {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) throw toAppError(error, 'Não foi possível enviar o e-mail de recuperação.');
  },

  async updatePassword(newPassword) {
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) throw toAppError(error, 'Não foi possível alterar a senha.');
  },
};
