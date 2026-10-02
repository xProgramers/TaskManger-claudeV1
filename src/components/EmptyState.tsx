import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Small illustrative glyph; keep it quiet. */
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, action, icon, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start rounded-md border border-dashed border-line-strong',
        compact ? 'gap-1.5 px-4 py-5' : 'gap-2 px-6 py-8',
        className,
      )}
    >
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className={cn('font-semibold text-ink', compact ? 'text-base' : 'text-md')}>{title}</p>
      {description && <p className="max-w-[46ch] text-base text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Não foi possível carregar suas tarefas.', onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-3">
      <p className="text-base text-ink-2">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 text-sm font-semibold text-accent hover:underline">
          Tentar de novo
        </button>
      )}
    </div>
  );
}
