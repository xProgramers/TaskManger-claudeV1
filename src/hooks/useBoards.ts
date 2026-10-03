import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Board, BoardInput } from '@/types';
import { api } from '@/services';
import { invalidateQueries, setQueryData, useQuery } from '@/lib/query';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/utils/errors';
import { CATEGORY_COLORS } from '@/utils/task';
import { notesKey } from './useNotes';

const KEY = ['boards'] as const;
const CURRENT_KEY = 'prumo:board-current';
/** Name of the environment created for someone who has none yet. */
export const DEFAULT_BOARD_NAME = 'Geral';
/** Icon colors: the category palette plus a few warmer tones. White text reads on all of them. */
export const BOARD_COLORS = [
  ...CATEGORY_COLORS,
  { value: '#C0653F', name: 'Terracota' },
  { value: '#B07F24', name: 'Mostarda' },
  { value: '#5C6AC4', name: 'Índigo' },
  { value: '#A0569A', name: 'Magenta' },
] as const;

function loadCurrent(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

function saveCurrent(id: string) {
  try {
    localStorage.setItem(CURRENT_KEY, id);
  } catch {
    // ignore (private mode)
  }
}

export function useBoards() {
  const query = useQuery(KEY, () => api.boards.list(), { staleTime: 5 * 60_000 });
  return { ...query, boards: query.data ?? [] };
}

export function useBoardActions() {
  const { toast } = useToast();

  const create = useCallback(
    async (input: BoardInput, { quiet = false } = {}) => {
      try {
        const b = await api.boards.create(input);
        setQueryData<Board[]>(KEY, (old) => [...(old ?? []), b]);
        setQueryData(notesKey(b.id), []); // a new environment starts empty: no loading flash
        if (!quiet) toast({ message: 'Ambiente criado', description: b.name });
        return b;
      } catch (e) {
        if (!quiet) toast({ message: errorMessage(e, 'Não foi possível criar o ambiente.'), tone: 'error' });
        throw e;
      }
    },
    [toast],
  );

  const update = useCallback(
    async (id: string, input: Partial<BoardInput>) => {
      try {
        const b = await api.boards.update(id, input);
        setQueryData<Board[]>(KEY, (old) => (old ?? []).map((x) => (x.id === id ? b : x)));
        return b;
      } catch (e) {
        toast({ message: errorMessage(e, 'Não foi possível salvar o ambiente.'), tone: 'error' });
        throw e;
      }
    },
    [toast],
  );

  const remove = useCallback(
    async (board: Board) => {
      try {
        await api.boards.remove(board.id);
        setQueryData<Board[]>(KEY, (old) => (old ?? []).filter((x) => x.id !== board.id));
        invalidateQueries(notesKey(board.id));
        toast({ message: 'Ambiente excluído', description: board.name });
      } catch (e) {
        toast({ message: errorMessage(e, 'Não foi possível excluir o ambiente.'), tone: 'error' });
        throw e;
      }
    },
    [toast],
  );

  return { create, update, remove };
}

/**
 * The environment on screen. Remembered per device; falls back to the first
 * one. Someone without any environment gets "Geral" created for them.
 */
export function useCurrentBoard() {
  const { boards, isLoading, isError, refetch } = useBoards();
  const { create } = useBoardActions();
  const [selected, setSelected] = useState<string | null>(loadCurrent);
  // Create the initial environment at most once per visit (no retry loops).
  const attempted = useRef(false);
  const [failed, setFailed] = useState(false);

  const current = useMemo(
    () => boards.find((b) => b.id === selected) ?? boards[0] ?? null,
    [boards, selected],
  );

  useEffect(() => {
    if (isLoading || isError || boards.length > 0 || attempted.current) return;
    attempted.current = true;
    create({ name: DEFAULT_BOARD_NAME, color: BOARD_COLORS[0].value }, { quiet: true }).catch(async () => {
      // Another tab may have created it first (unique name): load what exists.
      const fresh = await refetch().catch(() => null);
      if (!Array.isArray(fresh) || fresh.length === 0) setFailed(true);
    });
  }, [isLoading, isError, boards.length, create, refetch]);

  const select = useCallback((id: string) => {
    setSelected(id);
    saveCurrent(id);
  }, []);

  return {
    boards,
    current,
    select,
    isLoading: isLoading || (!isError && !failed && !current),
    isError: isError || (failed && !current),
    refetch,
  };
}
