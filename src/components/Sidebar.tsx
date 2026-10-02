import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Link, useRouter } from '@/lib/router';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { useOverdueTasks, useRangeTasks } from '@/hooks/useTasks';
import { CategoryDot } from './Badges';
import { Avatar } from './Avatar';
import {
  CalendarIcon,
  CheckCircleIcon,
  ListIcon,
  LogOutIcon,
  LogoMark,
  PlusIcon,
  SettingsIcon,
  StickyNoteIcon,
  SunIcon,
  UpcomingIcon,
} from './icons';

export const NAV_ITEMS = [
  { to: '/', label: 'Hoje', icon: SunIcon },
  { to: '/proximas', label: 'Próximas', icon: UpcomingIcon },
  { to: '/todas', label: 'Todas', icon: ListIcon },
  { to: '/calendario', label: 'Calendário', icon: CalendarIcon },
  { to: '/quadro', label: 'Quadro', icon: StickyNoteIcon },
  { to: '/concluidas', label: 'Concluídas', icon: CheckCircleIcon },
] as const;

function NavLink({ to, icon, label, count, countTone, compact }: {
  to: string;
  icon: ReactNode;
  label: string;
  count?: number;
  countTone?: 'late';
  compact: boolean;
}) {
  const { path } = useRouter();
  const active = path === to;
  return (
    <Link
      to={to}
      markCurrent
      title={compact ? label : undefined}
      aria-label={compact ? (count ? `${label}, ${count}` : label) : undefined}
      className={cn(
        'group flex h-8 items-center gap-2.5 rounded-sm text-base transition-colors duration-150',
        compact ? 'justify-center' : 'px-2.5',
        active ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink-2 hover:bg-hover hover:text-ink',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')}>{icon}</span>
      {!compact && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {count ? (
            <span className={cn('tnum text-sm', countTone === 'late' ? 'font-medium text-late' : 'text-ink-3')}>{count}</span>
          ) : null}
        </>
      )}
    </Link>
  );
}

export function Sidebar({ compact = false }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  const { prefs, today } = usePreferences();
  const { categories } = useCategories();
  const { openCategories } = useTaskUI();
  const { data: todayTasks } = useRangeTasks(today, today);
  const { data: overdue } = useOverdueTasks();

  const pendingToday = (todayTasks ?? []).filter((t) => t.status === 'pending').length;
  // Late tasks from earlier days (today's late ones are already in pendingToday).
  const lateCount = (overdue ?? []).filter((t) => t.due_date !== today).length;

  return (
    <aside
      aria-label="Navegação principal"
      className={cn(
        'sticky top-0 flex h-dvh shrink-0 flex-col border-r border-line bg-bg',
        compact ? 'w-16 px-2' : 'w-[248px] px-3',
      )}
    >
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5', compact ? 'justify-center' : 'px-1.5')}>
        <LogoMark size={26} />
        {!compact && <span className="text-lg font-semibold tracking-[-0.01em] text-ink">Prumo</span>}
      </div>

      <nav className="mt-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            label={label}
            icon={<Icon size={17} />}
            compact={compact}
            count={to === '/' ? pendingToday + lateCount || undefined : undefined}
            countTone={to === '/' && lateCount > 0 ? 'late' : undefined}
          />
        ))}
      </nav>

      <div className="my-4 h-px bg-line" role="separator" />

      {!compact && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-7 items-center justify-between pr-1 pl-2.5">
            <h2 className="text-sm font-medium text-ink-3">Categorias</h2>
            <button
              type="button"
              onClick={openCategories}
              aria-label="Gerenciar categorias"
              title="Gerenciar categorias"
              className="rounded-xs p-1 text-ink-3 hover:bg-hover hover:text-ink"
            >
              <PlusIcon size={14} />
            </button>
          </div>
          <nav aria-label="Categorias" className="mt-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto scrollbar-thin">
            {categories.length === 0 && (
              <button
                type="button"
                onClick={openCategories}
                className="px-2.5 py-1.5 text-left text-sm text-ink-3 hover:text-ink"
              >
                Crie categorias para organizar suas tarefas.
              </button>
            )}
            {categories.map((c) => (
              <NavLink key={c.id} to={`/categoria/${c.id}`} label={c.name} icon={<span className="flex size-[17px] items-center justify-center"><CategoryDot color={c.color} /></span>} compact={false} />
            ))}
          </nav>
        </div>
      )}
      {compact && <div className="flex-1" />}

      <div className="flex shrink-0 flex-col gap-0.5 border-t border-line py-3">
        <NavLink to="/configuracoes" label="Configurações" icon={<SettingsIcon size={17} />} compact={compact} />
        {!compact && (
          <Link
            to="/configuracoes#conta"
            className="flex h-10 items-center gap-2.5 rounded-sm px-2 text-left hover:bg-hover"
            aria-label="Perfil"
          >
            <Avatar name={prefs?.full_name} email={user?.email} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{prefs?.full_name || 'Seu perfil'}</span>
              <span className="block truncate text-xs text-ink-3">{user?.email}</span>
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          title={compact ? 'Sair' : undefined}
          aria-label={compact ? 'Sair' : undefined}
          className={cn(
            'flex h-8 items-center gap-2.5 rounded-sm text-base text-ink-2 hover:bg-hover hover:text-ink',
            compact ? 'justify-center' : 'px-2.5',
          )}
        >
          <LogOutIcon size={17} className="text-ink-3" />
          {!compact && 'Sair'}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { path } = useRouter();
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-md items-stretch justify-around">
        {/* Five slots on phones: Concluídas moves to the account menu. */}
        {NAV_ITEMS.filter((i) => i.to !== '/concluidas').map(({ to, label, icon: Icon }) => {
          const active = path === to;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                markCurrent
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-0.5 text-2xs font-medium',
                  active ? 'text-accent' : 'text-ink-3',
                )}
              >
                <Icon size={19} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
