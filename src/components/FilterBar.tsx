import type { ReactNode } from 'react';
import type { Category, PeriodFilter, StatusFilter, TaskFilters, TaskPriority, TaskSort } from '@/types';
import { cn } from '@/utils/cn';
import { PRIORITY_LABEL } from '@/utils/task';
import { CheckIcon, ChevronDownIcon, SearchIcon, SortIcon, XIcon } from './icons';
import { CategoryDot, PriorityGlyph } from './Badges';
import { Segmented } from './ui/Form';
import { Menu, MenuItem } from './ui/Layer';

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  status: 'pending',
  priority: 'any',
  categoryId: 'any',
  period: 'any',
  sort: 'date',
};

const PERIOD_LABEL: Record<PeriodFilter, string> = {
  any: 'Qualquer data',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  week: 'Esta semana',
  next30: 'Próximos 30 dias',
};

const SORT_LABEL: Record<TaskSort, string> = {
  date: 'Data',
  priority: 'Prioridade',
  created: 'Criação',
  status: 'Status',
};

function FilterMenu({ label, value, active, children }: { label: string; value: ReactNode; active: boolean; children: ReactNode }) {
  return (
    <Menu
      label={label}
      align="start"
      trigger={(t) => (
        <button
          ref={t.ref}
          type="button"
          onClick={t.onClick}
          aria-haspopup={t['aria-haspopup']}
          aria-expanded={t['aria-expanded']}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-sm transition-colors',
            active ? 'border-line-strong bg-surface font-medium text-ink' : 'border-line bg-surface text-ink-2 hover:text-ink',
          )}
        >
          <span className="text-ink-3">{label}:</span>
          {value}
          <ChevronDownIcon size={13} className="text-ink-3" />
        </button>
      )}
    >
      {children}
    </Menu>
  );
}

const check = (on: boolean) => (on ? <CheckIcon size={14} className="text-accent" /> : null);

interface FilterBarProps {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  categories: Category[];
  /** Hide the category filter (category pages). */
  lockCategory?: boolean;
}

export function FilterBar({ filters, onChange, categories, lockCategory }: FilterBarProps) {
  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => onChange({ ...filters, [key]: value });
  const category = categories.find((c) => c.id === filters.categoryId);
  const dirty =
    filters.priority !== 'any' ||
    (!lockCategory && filters.categoryId !== 'any') ||
    filters.period !== 'any' ||
    filters.search !== '' ||
    filters.status !== DEFAULT_FILTERS.status;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Filtrar por título ou descrição"
            aria-label="Filtrar por título ou descrição"
            className="h-8 w-full rounded-sm border border-line bg-surface pr-8 pl-8 text-base text-ink placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set('search', '')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-xs p-1 text-ink-3 hover:text-ink"
            >
              <XIcon size={13} />
            </button>
          )}
        </div>
        <Segmented<StatusFilter>
          label="Status"
          value={filters.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'pending', label: 'Pendentes' },
            { value: 'completed', label: 'Concluídas' },
            { value: 'overdue', label: 'Atrasadas' },
          ]}
          className="max-w-full overflow-x-auto"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu
          label="Prioridade"
          active={filters.priority !== 'any'}
          value={filters.priority === 'any' ? 'Todas' : PRIORITY_LABEL[filters.priority]}
        >
          <MenuItem onSelect={() => set('priority', 'any')} hint={check(filters.priority === 'any')}>
            Todas
          </MenuItem>
          {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
            <MenuItem key={p} onSelect={() => set('priority', p)} icon={<PriorityGlyph priority={p} />} hint={check(filters.priority === p)}>
              {PRIORITY_LABEL[p]}
            </MenuItem>
          ))}
        </FilterMenu>

        {!lockCategory && (
          <FilterMenu
            label="Categoria"
            active={filters.categoryId !== 'any'}
            value={
              category ? (
                <span className="inline-flex items-center gap-1.5">
                  <CategoryDot color={category.color} />
                  {category.name}
                </span>
              ) : (
                'Todas'
              )
            }
          >
            <MenuItem onSelect={() => set('categoryId', 'any')} hint={check(filters.categoryId === 'any')}>
              Todas
            </MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} onSelect={() => set('categoryId', c.id)} icon={<CategoryDot color={c.color} />} hint={check(filters.categoryId === c.id)}>
                {c.name}
              </MenuItem>
            ))}
          </FilterMenu>
        )}

        <FilterMenu label="Período" active={filters.period !== 'any'} value={PERIOD_LABEL[filters.period]}>
          {(Object.keys(PERIOD_LABEL) as PeriodFilter[]).map((p) => (
            <MenuItem key={p} onSelect={() => set('period', p)} hint={check(filters.period === p)}>
              {PERIOD_LABEL[p]}
            </MenuItem>
          ))}
        </FilterMenu>

        {dirty && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, categoryId: lockCategory ? filters.categoryId : 'any', sort: filters.sort })}
            className="h-8 rounded-sm px-2 text-sm font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            Limpar filtros
          </button>
        )}

        <div className="ml-auto">
          <Menu
            label="Ordenar por"
            trigger={(t) => (
              <button
                ref={t.ref}
                type="button"
                onClick={t.onClick}
                aria-haspopup={t['aria-haspopup']}
                aria-expanded={t['aria-expanded']}
                className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-sm text-ink-2 hover:bg-hover hover:text-ink"
              >
                <SortIcon size={14} className="text-ink-3" />
                Ordenar: <span className="font-medium text-ink">{SORT_LABEL[filters.sort]}</span>
              </button>
            )}
          >
            {(Object.keys(SORT_LABEL) as TaskSort[]).map((s) => (
              <MenuItem key={s} onSelect={() => set('sort', s)} hint={check(filters.sort === s)}>
                {SORT_LABEL[s]}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>
    </div>
  );
}
