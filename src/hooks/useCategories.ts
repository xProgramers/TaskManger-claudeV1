import { useCallback, useMemo } from 'react';
import type { Category, CategoryInput } from '@/types';
import { api } from '@/services';
import { invalidateQueries, setQueryData, useQuery } from '@/lib/query';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/utils/errors';

const KEY = ['categories'] as const;

export function useCategories() {
  const query = useQuery(KEY, () => api.categories.list(), { staleTime: 5 * 60_000 });
  const byId = useMemo(() => new Map((query.data ?? []).map((c) => [c.id, c])), [query.data]);
  return { ...query, categories: query.data ?? [], byId };
}

export function useCategoryActions() {
  const { toast } = useToast();

  const create = useCallback(
    async (input: CategoryInput) => {
      try {
        const c = await api.categories.create(input);
        setQueryData<Category[]>(KEY, (old) =>
          [...(old ?? []), c].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        );
        toast({ message: 'Categoria criada', description: c.name });
        return c;
      } catch (e) {
        toast({ message: errorMessage(e, 'Não foi possível criar a categoria.'), tone: 'error' });
        throw e;
      }
    },
    [toast],
  );

  const update = useCallback(
    async (id: string, input: Partial<CategoryInput>) => {
      try {
        const c = await api.categories.update(id, input);
        setQueryData<Category[]>(KEY, (old) => (old ?? []).map((x) => (x.id === id ? c : x)));
        toast({ message: 'Categoria atualizada' });
        return c;
      } catch (e) {
        toast({ message: errorMessage(e, 'Não foi possível salvar a categoria.'), tone: 'error' });
        throw e;
      }
    },
    [toast],
  );

  const remove = useCallback(
    async (category: Category) => {
      try {
        await api.categories.remove(category.id);
        setQueryData<Category[]>(KEY, (old) => (old ?? []).filter((x) => x.id !== category.id));
        invalidateQueries(['tasks']); // tasks lose the category
        toast({ message: 'Categoria excluída', description: 'As tarefas dela continuam, agora sem categoria.' });
      } catch (e) {
        toast({ message: errorMessage(e, 'Não foi possível excluir a categoria.'), tone: 'error' });
        throw e;
      }
    },
    [toast],
  );

  return { create, update, remove };
}
