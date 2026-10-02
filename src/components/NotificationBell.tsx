import { useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { formatRelativeInstant } from '@/utils/dates';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useNotifications } from '@/hooks/useNotifications';
import { BellIcon, XIcon } from './icons';
import { IconButton } from './ui/Button';
import { Popover } from './ui/Layer';
import { Skeleton } from './ui/Spinner';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const { items, unread, isLoading, markRead, remove } = useNotifications();
  const { timezone, timeFormat } = usePreferences();
  const { openTask } = useTaskUI();

  return (
    <>
      <IconButton
        ref={anchor}
        label={unread ? `Notificações, ${unread} não lida${unread > 1 ? 's' : ''}` : 'Notificações'}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        active={open}
        className="relative"
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="tnum absolute top-1 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] leading-none font-bold text-accent-ink ring-2 ring-surface"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </IconButton>

      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} align="end" label="Notificações" className="w-[360px] max-w-[calc(100vw-16px)] p-0" autoFocus={false}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-base font-semibold text-ink">Notificações</h2>
          {unread > 0 && (
            <button type="button" onClick={() => void markRead()} className="text-sm font-medium text-accent hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-base font-medium text-ink">Nenhum lembrete por enquanto.</p>
            <p className="mx-auto mt-1 max-w-[30ch] text-sm text-ink-3">
              Quando uma tarefa com lembrete chegar na hora, ela aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto py-1 scrollbar-thin">
            {items.map((n) => {
              const isUnread = n.status === 'sent';
              return (
                <li key={n.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (isUnread) void markRead([n.id]);
                      if (n.task_id) {
                        setOpen(false);
                        openTask(n.task_id);
                      }
                    }}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', isUnread ? 'bg-accent' : 'bg-transparent')}
                    />
                    <span className="min-w-0 flex-1 pr-6">
                      <span className={cn('block text-sm', isUnread ? 'font-semibold text-ink' : 'text-ink-2')}>
                        {n.title}
                        {isUnread && <span className="sr-only"> (não lida)</span>}
                      </span>
                      <span className="block truncate text-base text-ink">{n.message}</span>
                      <span className="tnum mt-0.5 block text-xs text-ink-3">
                        {n.sent_at ? formatRelativeInstant(n.sent_at, timezone, timeFormat) : ''}
                        {!n.task_id && ' · tarefa excluída'}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(n.id)}
                    aria-label={`Remover notificação: ${n.message}`}
                    className="absolute top-2.5 right-3 rounded-xs p-1 text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-ink focus-visible:opacity-100"
                  >
                    <XIcon size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Popover>
    </>
  );
}
