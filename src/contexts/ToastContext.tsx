import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { AlertIcon, BellIcon, CheckIcon, XIcon } from '@/components/icons';

type Tone = 'success' | 'error' | 'info' | 'reminder';

export interface ToastOptions {
  message: string;
  description?: string;
  tone?: Tone;
  action?: { label: string; onClick: () => void };
  /** ms; default 4s (8s with an action, 10s for reminders). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions | string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<Tone, ReactNode> = {
  success: <CheckIcon size={15} className="text-accent" />,
  error: <AlertIcon size={15} className="text-danger" />,
  info: null,
  reminder: <BellIcon size={15} className="text-accent" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (options: ToastOptions | string) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      const id = nextId.current++;
      const tone = opts.tone ?? 'success';
      setItems((list) => [...list.slice(-3), { ...opts, tone, id }]);
      const duration = opts.duration ?? (tone === 'reminder' ? 10_000 : opts.action ? 8_000 : 4_000);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-relevant="additions"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 max-md:bottom-16 sm:p-6"
        >
          {items.map((t) => (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-md border border-line bg-surface px-3.5 py-3 shadow-float animate-toast-in',
              )}
            >
              {ICONS[t.tone ?? 'success'] && <span className="mt-0.5 shrink-0">{ICONS[t.tone ?? 'success']}</span>}
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-ink">{t.message}</p>
                {t.description && <p className="mt-0.5 truncate text-sm text-ink-2">{t.description}</p>}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="-my-0.5 shrink-0 rounded-xs px-2 py-0.5 text-sm font-semibold text-accent hover:bg-accent-soft"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => dismiss(t.id)}
                className="-mr-1 shrink-0 rounded-xs p-0.5 text-ink-3 hover:bg-hover hover:text-ink"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
