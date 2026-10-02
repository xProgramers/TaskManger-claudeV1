import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { DaySummary } from '@/utils/task';

/**
 * The day's progress drawn as a plumb line: a hairline rule with the bob
 * resting where the day currently stands.
 */
export function DayProgress({ summary }: { summary: DaySummary }) {
  const pct = Math.round(summary.progress * 100);
  const label =
    summary.total === 0
      ? 'Nenhuma tarefa marcada para hoje'
      : summary.completed === summary.total
        ? `Dia concluído: ${summary.total} de ${summary.total} tarefas`
        : `${summary.completed} de ${summary.total} tarefas concluídas`;

  return (
    <div className="mt-5">
      <div
        role="progressbar"
        aria-label="Progresso do dia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={label}
        className="relative h-3"
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
        <div
          className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="absolute top-0 -ml-1.5 text-accent transition-[left] duration-500 ease-out"
          style={{ left: `${pct}%` }}
        >
          <path d="M6 0.5 10.5 5 6 11.5 1.5 5Z" fill="currentColor" />
        </svg>
      </div>
      <p className="tnum mt-2 text-sm text-ink-2">
        {label}
        {summary.total > 0 && <span className="text-ink-3"> ({pct}%)</span>}
      </p>
    </div>
  );
}

interface StatProps {
  value: number | undefined;
  label: string;
  tone?: 'late' | 'accent';
}

export function Stat({ value, label, tone }: StatProps) {
  return (
    // dt comes first in the DOM (valid <dl>); flex-col-reverse puts the number on top.
    <div className="min-w-0">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd
        className={cn(
          'tnum text-2xl font-semibold tracking-[-0.02em]',
          value === undefined ? 'text-ink-3' : tone === 'late' && value > 0 ? 'text-late' : 'text-ink',
        )}
      >
        {value ?? '–'}
      </dd>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-4 sm:grid-cols-4 [&>div]:flex [&>div]:flex-col-reverse">
      {children}
    </dl>
  );
}

interface SectionProps {
  title: string;
  count?: number;
  tone?: 'late';
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}

export function Section({ title, count, tone, action, children, id }: SectionProps) {
  const headingId = id ?? `section-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-3">
        <h2 id={headingId} className={cn('text-base font-semibold', tone === 'late' ? 'text-late' : 'text-ink')}>
          {title}
          {count !== undefined && <span className="tnum ml-2 font-normal text-ink-3">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-ink-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
