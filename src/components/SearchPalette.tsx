import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Task } from '@/types';
import { api } from '@/services';
import { cn } from '@/utils/cn';
import { foldText } from '@/utils/quickAdd';
import { formatTime, relativeDayLabel } from '@/utils/dates';
import { useQuery } from '@/lib/query';
import { useRouter } from '@/lib/router';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { useDebouncedValue } from '@/hooks/useUtils';
import { Dialog } from './ui/Layer';
import { Kbd } from './ui/Form';
import { Spinner } from './ui/Spinner';
import { CategoryDot } from './Badges';
import {
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UpcomingIcon,
} from './icons';

interface ActionItem {
  kind: 'action';
  id: string;
  label: string;
  icon: ReactNode;
  hint?: string;
  run: () => void;
}
interface TaskResult {
  kind: 'task';
  id: string;
  task: Task;
}
type Item = ActionItem | TaskResult;

/** Global search (Ctrl/⌘ K): tasks by title, description and category. */
export function SearchPalette() {
  const { searchOpen, closeSearch, openTask, openCreate } = useTaskUI();
  const { navigate } = useRouter();
  const { today, timeFormat } = usePreferences();
  const { categories, byId } = useCategories();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const debounced = useDebouncedValue(query.trim(), 180);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setActive(0);
    }
  }, [searchOpen]);

  const matchingCategoryIds = useMemo(() => {
    const q = foldText(debounced);
    return q ? categories.filter((c) => foldText(c.name).includes(q)).map((c) => c.id) : [];
  }, [debounced, categories]);

  const { data: results, isFetching } = useQuery(
    ['tasks', 'search', debounced, matchingCategoryIds],
    () => api.tasks.search(debounced, matchingCategoryIds, 20),
    { enabled: searchOpen && debounced.length > 0, keepPrevious: true, staleTime: 10_000 },
  );

  const go = (path: string) => () => {
    closeSearch();
    navigate(path);
  };

  const actions: ActionItem[] = [
    { kind: 'action', id: 'new', label: 'Nova tarefa', icon: <PlusIcon />, hint: 'N', run: () => {
        closeSearch();
        openCreate();
      },
    },
    { kind: 'action', id: 'today', label: 'Ir para Hoje', icon: <SunIcon />, run: go('/') },
    { kind: 'action', id: 'upcoming', label: 'Ir para Próximas', icon: <UpcomingIcon />, run: go('/proximas') },
    { kind: 'action', id: 'all', label: 'Ir para Todas', icon: <ListIcon />, run: go('/todas') },
    { kind: 'action', id: 'calendar', label: 'Ir para Calendário', icon: <CalendarIcon />, run: go('/calendario') },
    { kind: 'action', id: 'done', label: 'Ir para Concluídas', icon: <CheckCircleIcon />, run: go('/concluidas') },
    { kind: 'action', id: 'settings', label: 'Configurações', icon: <SettingsIcon />, run: go('/configuracoes') },
  ];

  const items: Item[] = debounced
    ? (results ?? []).map((t) => ({ kind: 'task', id: t.id, task: t }))
    : actions;

  useEffect(() => setActive(0), [debounced]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'action') item.run();
    else openTask(item.task.id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const searching = debounced.length > 0;
  const noResults = searching && results !== undefined && results.length === 0 && !isFetching;

  return (
    <Dialog open={searchOpen} onClose={closeSearch} title="Buscar" hideTitle position="top" className="max-w-[600px] overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4">
        {isFetching && searching ? <Spinner size={16} className="text-ink-3" /> : <SearchIcon className="text-ink-3" />}
        <input
          data-autofocus
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={items[active] ? `search-item-${active}` : undefined}
          aria-label="Buscar tarefas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar por título, descrição ou categoria"
          className="h-13 flex-1 bg-transparent text-md text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <Kbd>Esc</Kbd>
      </div>

      <ul id="search-results" ref={listRef} role="listbox" aria-label={searching ? 'Resultados' : 'Ações rápidas'} className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5 scrollbar-thin">
        {!searching && <li className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-ink-3">Ações rápidas</li>}
        {items.map((item, i) => {
          const selected = i === active;
          const common = {
            id: `search-item-${i}`,
            'data-index': i,
            role: 'option' as const,
            'aria-selected': selected,
            onMouseMove: () => setActive(i),
            onClick: () => choose(item),
            className: cn(
              'flex min-h-10 cursor-pointer items-center gap-3 rounded-sm px-2.5 py-1.5',
              selected ? 'bg-hover' : '',
            ),
          };
          if (item.kind === 'action') {
            return (
              <li key={item.id} {...common}>
                <span className="text-ink-3">{item.icon}</span>
                <span className="flex-1 text-base text-ink">{item.label}</span>
                {item.hint && <Kbd>{item.hint}</Kbd>}
              </li>
            );
          }
          const t = item.task;
          const cat = t.category_id ? byId.get(t.category_id) : undefined;
          const done = t.status === 'completed';
          return (
            <li key={item.id} {...common}>
              <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong')}>
                {done && <CheckIcon size={10} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-base', done ? 'text-ink-3 line-through' : 'text-ink')}>
                  <Highlight text={t.title} query={debounced} />
                </span>
                {t.description && (
                  <span className="block truncate text-sm text-ink-3">
                    <Highlight text={t.description} query={debounced} />
                  </span>
                )}
              </span>
              {cat && (
                <span className="hidden items-center gap-1.5 text-sm text-ink-3 sm:inline-flex">
                  <CategoryDot color={cat.color} />
                  {cat.name}
                </span>
              )}
              <span className="tnum shrink-0 text-sm text-ink-3">
                {t.due_date ? relativeDayLabel(t.due_date, today) : ''}
                {t.due_time ? `, ${formatTime(t.due_time, timeFormat)}` : ''}
              </span>
            </li>
          );
        })}
        {noResults && (
          <li className="px-3 py-8 text-center">
            <p className="text-base font-medium text-ink">Nada encontrado para “{debounced}”.</p>
            <p className="mt-1 text-sm text-ink-3">Tente outra palavra ou crie a tarefa agora.</p>
            <button
              type="button"
              onClick={() => {
                closeSearch();
                openCreate({ title: debounced });
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              <PlusIcon size={14} />
              Criar “{debounced}”
            </button>
          </li>
        )}
      </ul>
      <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-3 sm:flex">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navegar
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Enter</Kbd> abrir
        </span>
      </div>
    </Dialog>
  );
}

/** Marks the matched part (accent/case-insensitive) without dangerouslySetInnerHTML. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = foldText(query);
  const i = q ? foldText(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[2px] bg-accent-soft text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
