import type { Note } from '@/types';
import type { NotesApi } from '@/services/api';
import { toAppError } from '@/utils/errors';
import { getSupabase } from './client';

const COLUMNS = 'id,user_id,content,color,x,y,z,w,h,created_at,updated_at';
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const supabaseNotes: NotesApi = {
  async list() {
    const { data, error } = await getSupabase().from('notes').select(COLUMNS).order('z').limit(500);
    if (error) throw toAppError(error, 'Não foi possível carregar o quadro.');
    return (data ?? []) as Note[];
  },
  async create(input) {
    const { data, error } = await getSupabase()
      .from('notes')
      .insert({ ...input, x: clamp01(input.x), y: clamp01(input.y) })
      .select(COLUMNS)
      .single();
    if (error) throw toAppError(error, 'Não foi possível criar a nota.');
    return data as Note;
  },
  async update(id, patch) {
    const safe = {
      ...patch,
      ...(patch.x !== undefined ? { x: clamp01(patch.x) } : {}),
      ...(patch.y !== undefined ? { y: clamp01(patch.y) } : {}),
    };
    const { data, error } = await getSupabase().from('notes').update(safe).eq('id', id).select(COLUMNS).single();
    if (error) throw toAppError(error, 'Não foi possível salvar a nota.');
    return data as Note;
  },
  async remove(id) {
    const { error } = await getSupabase().from('notes').delete().eq('id', id);
    if (error) throw toAppError(error, 'Não foi possível excluir a nota.');
  },
};
