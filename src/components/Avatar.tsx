import { cn } from '@/utils/cn';

/** Initials avatar (photo upload is intentionally out of scope). */
export function Avatar({ name, email, size = 28, className }: { name?: string | null; email?: string | null; size?: number; className?: string }) {
  const source = (name || email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? '?') + (name ? (parts[1]?.[0] ?? '') : '')).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent select-none',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}
