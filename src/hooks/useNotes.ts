import { useCallback, useEffect, useRef } from 'react';
import type { Note, NoteColor, NotePatch } from '@/types';
import { api } from '@/services';
import { getQueryData, invalidateQueries, setQueryData, useQuery } from '@/lib/query';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/utils/errors';

export const NOTES = ['notes'] as const;
const CONTENT_SAVE_DELAY = 500;

const byZ = (a: Note, b: Note) => a.z - b.z;

export function useNotes() {
  return useQuery(NOTES, () => api.notes.list(), { staleTime: 60_000 });
}

function patchCache(id: string, patch: Partial<Note>) {
  setQueryData<Note[]>(NOTES, (old) => (old ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n)));
}

export function useNoteActions() {
  const { toast } = useToast();
  // Pending content saves, debounced per note while the user types.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const topZ = () => Math.max(0, ...(getQueryData<Note[]>(NOTES) ?? []).map((n) => n.z));

  const create = useCallback(
    async (
      x: number,
      y: number,
      color: NoteColor = 'yellow',
      content = '',
      size: Pick<Note, 'w' | 'h'> = { w: null, h: null },
    ) => {
      try {
        const note = await api.notes.create({ x, y, z: topZ() + 1, color, content, ...size });
        setQueryData<Note[]>(NOTES, (old) => [...(old ?? []), note].sort(byZ));
        return note;
      } catch (e) {
        toast({ tone: 'error', message: errorMessage(e, 'Não foi possível criar a nota.') });
        return null;
      }
    },
    [toast],
  );

  const persist = useCallback(
    async (id: string, patch: NotePatch) => {
      try {
        await api.notes.update(id, patch);
      } catch (e) {
        toast({ tone: 'error', message: errorMessage(e, 'Não foi possível salvar a nota.') });
        invalidateQueries(NOTES); // restore the server's version
      }
    },
    [toast],
  );

  /** Immediate change (position, color, order). */
  const update = useCallback(
    (id: string, patch: NotePatch) => {
      patchCache(id, patch);
      void persist(id, patch);
    },
    [persist],
  );

  /** Typing: update the screen now, save after a short pause. */
  const setContent = useCallback(
    (id: string, content: string) => {
      patchCache(id, { content });
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          void persist(id, { content });
        }, CONTENT_SAVE_DELAY),
      );
    },
    [persist],
  );

  /** Saves pending typing right away (on blur). */
  const flush = useCallback(
    (id: string) => {
      const pending = timers.current.get(id);
      if (!pending) return;
      clearTimeout(pending);
      timers.current.delete(id);
      const note = getQueryData<Note[]>(NOTES)?.find((n) => n.id === id);
      if (note) void persist(id, { content: note.content });
    },
    [persist],
  );

  const bringToFront = useCallback(
    (id: string) => {
      const notes = getQueryData<Note[]>(NOTES) ?? [];
      const note = notes.find((n) => n.id === id);
      if (!note || note.z === topZ()) return;
      const z = topZ() + 1;
      setQueryData<Note[]>(NOTES, (old) => (old ?? []).map((n) => (n.id === id ? { ...n, z } : n)).sort(byZ));
      void persist(id, { z });
    },
    [persist],
  );

  /** Deletes now; "Desfazer" recreates it with the same text, color and place. */
  const remove = useCallback(
    async (note: Note, { silent = false } = {}) => {
      clearTimeout(timers.current.get(note.id));
      timers.current.delete(note.id);
      setQueryData<Note[]>(NOTES, (old) => (old ?? []).filter((n) => n.id !== note.id));
      try {
        await api.notes.remove(note.id);
      } catch (e) {
        toast({ tone: 'error', message: errorMessage(e, 'Não foi possível excluir a nota.') });
        invalidateQueries(NOTES);
        return;
      }
      if (silent) return;
      toast({
        message: 'Nota excluída',
        description: note.content.split('\n')[0]?.slice(0, 60) || undefined,
        action: {
          label: 'Desfazer',
          onClick: () => void create(note.x, note.y, note.color, note.content, { w: note.w, h: note.h }),
        },
      });
    },
    [toast, create],
  );

  return { create, update, setContent, flush, bringToFront, remove };
}
