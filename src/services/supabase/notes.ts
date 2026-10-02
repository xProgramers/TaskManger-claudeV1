import type { Note, NotePatch } from '@/types';
import type { NotesApi } from '@/services/api';
import { toAppError } from '@/utils/errors';
import { getSupabase } from './client';

// The board is infinite: positions live in pos_x/pos_y (world pixels at 100% zoom).
// They are exposed to the app as x/y. (The DB's own x/y columns are legacy.)
const COLUMNS = 'id,user_id,content,color,x:pos_x,y:pos_y,z,w,h,created_at,updated_at';
const LIMIT = 100_000;
const clampWorld = (v: number) => Math.round(Math.min(LIMIT, Math.max(-LIMIT, v)));

function toRow(patch: NotePatch) {
  const { x, y, ...rest } = patch;
  return {
    ...rest,
    ...(x !== undefined ? { pos_x: clampWorld(x) } : {}),
    ...(y !== undefined ? { pos_y: clampWorld(y) } : {}),
  };
}

export const supabaseNotes: NotesApi = {
  async list() {
    const { data, error } = await getSupabase().from('notes').select(COLUMNS).order('z').limit(1000);
    if (error) throw toAppError(error, 'Não foi possível carregar o quadro.');
    return (data ?? []) as unknown as Note[];
  },
  async create(input) {
    const { data, error } = await getSupabase()
      .from('notes')
      .insert(toRow(input))
      .select(COLUMNS)
      .single();
    if (error) throw toAppError(error, 'Não foi possível criar a nota.');
    return data as unknown as Note;
  },
  async update(id, patch) {
    const { data, error } = await getSupabase().from('notes').update(toRow(patch)).eq('id', id).select(COLUMNS).single();
    if (error) throw toAppError(error, 'Não foi possível salvar a nota.');
    return data as unknown as Note;
  },
  async remove(id) {
    const { error } = await getSupabase().from('notes').delete().eq('id', id);
    if (error) throw toAppError(error, 'Não foi possível excluir a nota.');
  },
};
