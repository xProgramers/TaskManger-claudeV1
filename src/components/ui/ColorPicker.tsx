import { cn } from '@/utils/cn';
import { CheckIcon } from '@/components/icons';

export interface ColorOption {
  value: string;
  name: string;
}

/** Row of round swatches (radio group). `value` is a hex color. */
export function ColorPicker({
  value,
  onChange,
  colors,
  label = 'Cor',
}: {
  value: string;
  onChange: (c: string) => void;
  colors: readonly ColorOption[];
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={value === c.value}
          aria-label={c.name}
          title={c.name}
          onClick={() => onChange(c.value)}
          className={cn(
            'flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition',
            value === c.value && 'ring-2 ring-ink-2',
          )}
          style={{ background: c.value }}
        >
          {value === c.value && <CheckIcon size={12} strokeWidth={3} className="text-white" />}
        </button>
      ))}
    </div>
  );
}
