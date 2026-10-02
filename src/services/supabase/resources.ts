import type { AppNotification, Category, UserPreferences } from '@/types';
import type { CategoriesApi, NotificationsApi, ProfileApi, PushApi } from '@/services/api';
import { toAppError } from '@/utils/errors';
import { getSupabase } from './client';

const NOTIFICATION_COLUMNS = 'id,user_id,task_id,title,message,scheduled_for,status,sent_at,read_at,created_at';

export const supabaseCategories: CategoriesApi = {
  async list() {
    const { data, error } = await getSupabase().from('categories').select('*').order('name');
    if (error) throw toAppError(error, 'Não foi possível carregar as categorias.');
    return (data ?? []) as Category[];
  },
  async create(input) {
    const { data, error } = await getSupabase()
      .from('categories')
      .insert({ name: input.name.trim(), color: input.color })
      .select('*')
      .single();
    if (error) throw toAppError(error, 'Não foi possível criar a categoria.');
    return data as Category;
  },
  async update(id, input) {
    const { data, error } = await getSupabase()
      .from('categories')
      .update({ ...input, ...(input.name ? { name: input.name.trim() } : {}) })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw toAppError(error, 'Não foi possível salvar a categoria.');
    return data as Category;
  },
  async remove(id) {
    const { error } = await getSupabase().from('categories').delete().eq('id', id);
    if (error) throw toAppError(error, 'Não foi possível excluir a categoria.');
  },
};

export const supabaseNotifications: NotificationsApi = {
  async list(limit = 30) {
    const { data, error } = await getSupabase()
      .from('notifications')
      .select(NOTIFICATION_COLUMNS)
      .in('status', ['sent', 'read'])
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) throw toAppError(error, 'Não foi possível carregar as notificações.');
    return (data ?? []) as AppNotification[];
  },
  async markRead(ids) {
    const { error } = await getSupabase().rpc('mark_notifications_read', ids ? { p_ids: ids } : {});
    if (error) throw toAppError(error, 'Não foi possível marcar como lida.');
  },
  async remove(id) {
    const { error } = await getSupabase().from('notifications').delete().eq('id', id);
    if (error) throw toAppError(error, 'Não foi possível remover a notificação.');
  },
  subscribe(userId, onDelivered) {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          if (row.status === 'sent') onDelivered(row);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};

export const supabaseProfile: ProfileApi = {
  async get() {
    const { data, error } = await getSupabase().from('profiles').select('*').single();
    if (error) throw toAppError(error, 'Não foi possível carregar suas preferências.');
    return data as UserPreferences;
  },
  async update(patch) {
    const { data: auth } = await getSupabase().auth.getUser();
    if (!auth.user) throw toAppError({ code: '42501' }, 'Sessão expirada.');
    const { data, error } = await getSupabase()
      .from('profiles')
      .update(patch)
      .eq('id', auth.user.id)
      .select('*')
      .single();
    if (error) throw toAppError(error, 'Não foi possível salvar suas preferências.');
    return data as UserPreferences;
  },
};

export const supabasePush: PushApi = {
  async register(sub) {
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) return;
    const { error } = await getSupabase().rpc('register_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: sub.keys.p256dh,
      p_auth: sub.keys.auth,
      p_user_agent: navigator.userAgent,
    });
    if (error) throw toAppError(error, 'Não foi possível ativar as notificações neste navegador.');
  },
  async unregister(endpoint) {
    const { error } = await getSupabase().rpc('unregister_push_subscription', { p_endpoint: endpoint });
    if (error) throw toAppError(error, 'Não foi possível desativar as notificações neste navegador.');
  },
};
