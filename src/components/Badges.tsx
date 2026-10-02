import type { Category, TaskPriority } from '@/types';
import { PRIORITY_LABEL } from '@/utils/task';
import { cn } from '@/utils/cn';

const BARS: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };

/** Three ascending bars, filled to the priority level. Never colour-only. */
export function PriorityGlyph({ priority, className }: { priority: TaskPriority; className?: string }) {
  const filled = BARS[priority];
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true" className={cn('shrink-0', className)}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={i * 5}
          y={8 - i * 4}
          width="3.2"
          height={4 + i * 4}
          rx="1"
          fill="currentColor"
          opacity={i < filled ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

interface PriorityBadgeProps {
  priority: TaskPriority;
  /** Show the text label next to the glyph (otherwise it's screen-reader only). */
  showLabel?: boolean;
  className?: string;
}

export function PriorityBadge({ priority, showLabel, className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm',
        priority === 'high' ? 'text-ink' : priority === 'medium' ? 'text-ink-2' : 'text-ink-3',
        className,
      )}
      title={`Prioridade ${PRIORITY_LABEL[priority].toLowerCase()}`}
    >
      <PriorityGlyph priority={priority} />
      <span className={showLabel ? '' : 'sr-only'}>
        {showLabel ? PRIORITY_LABEL[priority] : `Prioridade ${PRIORITY_LABEL[priority].toLowerCase()}`}
      </span>
    </span>
  );
}

export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: color }} />
  );
}

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-sm text-ink-2', className)}>
      <CategoryDot color={category.color} />
      <span className="truncate">{category.name}</span>
    </span>
  );
}
