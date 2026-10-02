import { useEffect, useState } from 'react';
import type { TaskFilters } from '@/types';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { useFilteredTasks } from '@/hooks/useTasks';
import { useDebouncedValue, useInfiniteScroll } from '@/hooks/useUtils';
import { TaskList } from '@/components/TaskList';
import { FilterBar, DEFAULT_FILTERS } from '@/components/FilterBar';
import { PageTitle } from '@/components/PageParts';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { CategoryDot } from '@/components/Badges';
import { Spinner, TaskListSkeleton } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/icons';

/** "Todas" and the per-category pages (same screen, category locked). */
export function AllTasksPage({ categoryId }: { categoryId?: string }) {
  const { openCreate } = useTaskUI();
  const { byId, categories } = useCategories();
  const [filters, setFilters] = useState<TaskFilters>({ ...DEFAULT_FILTERS, categoryId: categoryId ?? 'any' });

  useEffect(() => {
    setFilters((f) => ({ ...f, categoryId: categoryId ?? 'any' }));
  }, [categoryId]);

  // Typing shouldn't fire a request per keystroke.
  const search = useDebouncedValue(filters.search, 250);
  const effective = { ...filters, search };
  const { data, isLoading, isError, isFetching, refetch, loadMore, loadingMore } = useFilteredTasks(effective);
  const sentinel = useInfiniteScroll(() => void loadMore(), Boolean(data?.hasMore));

  const category = categoryId ? byId.get(categoryId) : undefined;
  const filtered =
    filters.search !== '' || filters.priority !== 'any' || filters.period !== 'any' || filters.status !== DEFAULT_FILTERS.status ||
    (!categoryId && filters.categoryId !== 'any');

  const rows = data?.rows ?? [];

  return (
    <div className="max-w-[1040px]">
      <PageTitle
        title={category ? category.name : categoryId ? 'Categoria' : 'Todas as tarefas'}
        subtitle={
          category ? (
            <span className="inline-flex items-center gap-2">
              <CategoryDot color={category.color} /> Tarefas desta categoria
            </span>
          ) : (
            'Busque, filtre e organize tudo o que você já criou.'
          )
        }
      >
        <Button
          leading={<PlusIcon size={15} />}
          onClick={() => openCreate({ category_id: categoryId ?? null })}
        >
          Nova tarefa
        </Button>
      </PageTitle>

      <div className="mt-6">
        <FilterBar filters={filters} onChange={setFilters} categories={categories} lockCategory={Boolean(categoryId)} />
      </div>

      <div className="mt-5" aria-busy={isFetching}>
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TaskListSkeleton rows={8} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title="Nenhuma tarefa com esses filtros."
              description={filters.search ? `Nada corresponde a “${filters.search}”. Tente outra palavra ou limpe os filtros.` : 'Ajuste os filtros para ver mais tarefas.'}
              action={
                <Button onClick={() => setFilters({ ...DEFAULT_FILTERS, categoryId: categoryId ?? 'any', sort: filters.sort })}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={category ? `Nenhuma tarefa em ${category.name}.` : 'Nenhuma tarefa pendente.'}
              description="Crie uma tarefa e ela aparece aqui."
              action={
                <Button variant="primary" leading={<PlusIcon size={15} />} onClick={() => openCreate({ category_id: categoryId ?? null })}>
                  Criar tarefa
                </Button>
              }
            />
          )
        ) : (
          <>
            <TaskList tasks={rows} when="date" hideCompleted={filters.status === 'pending' || filters.status === 'overdue'} label="Tarefas" />
            <div ref={sentinel} className="flex h-12 items-center justify-center text-ink-3">
              {loadingMore ? <Spinner /> : !data?.hasMore && rows.length > 20 ? <span className="text-sm">Fim da lista</span> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
