/**
 * Checklist de uma tarefa: itens numerados, barra de progresso e
 * campo para adicionar vários itens seguidos (Enter adiciona e mantém o campo).
 */
import { useRef, useState } from 'react';
import type { ChecklistItem } from '@/types';
import { cn } from '@/utils/cn';
import { CheckIcon, ChecklistIcon, PlusIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';

const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function checklistProgress(items: ChecklistItem[]) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

interface ChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  /** Remove a seção inteira (só no formulário). */
  onRemove?: () => void;
  /** Abre o campo de novo item já focado (logo depois de clicar em "Checklist"). */
  autoFocusAdd?: boolean;
  /** Só marcar/desmarcar (tela de detalhes). */
  readOnlyText?: boolean;
}

export function Checklist({ items, onChange, onRemove, autoFocusAdd, readOnlyText }: ChecklistProps) {
  const [adding, setAdding] = useState(Boolean(autoFocusAdd));
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { pct } = checklistProgress(items);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: newId(), text: text.slice(0, 200), done: false }]);
    setDraft('');
    inputRef.current?.focus();
  };
  const patch = (id: string, p: Partial<ChecklistItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));

  return (
    <section aria-label="Checklist">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-base font-semibold text-ink">
          <ChecklistIcon size={18} className="text-ink-2" />
          Checklist
        </h3>
        {onRemove && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Excluir
          </Button>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="tnum w-[30px] text-xs text-ink-3">{pct}%</span>
        <div
          role="progressbar"
          aria-label="Progresso do checklist"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken"
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-300 ease-out', pct === 100 ? 'bg-accent' : 'bg-accent/80')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="mt-1.5 flex flex-col">
        {items.map((item, i) => (
          <li key={item.id} className="group flex items-center gap-2.5 rounded-sm py-1 pr-1 hover:bg-hover">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={`${item.done ? 'Desmarcar' : 'Marcar'}: ${item.text}`}
              onClick={() => patch(item.id, { done: !item.done })}
              className={cn(
                'ml-1 flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors',
                item.done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface text-transparent hover:border-ink-3',
              )}
            >
              <CheckIcon size={11} strokeWidth={3} />
            </button>
            <span className="tnum w-5 shrink-0 text-right text-sm text-ink-3">{i + 1}.</span>
            {readOnlyText ? (
              <span className={cn('min-w-0 flex-1 text-base', item.done ? 'text-ink-3 line-through' : 'text-ink')}>
                {item.text}
              </span>
            ) : (
              <input
                value={item.text}
                aria-label={`Item ${i + 1}`}
                maxLength={200}
                onChange={(e) => patch(item.id, { text: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                onBlur={() => !item.text.trim() && onChange(items.filter((x) => x.id !== item.id))}
                className={cn(
                  'h-7 min-w-0 flex-1 rounded-xs bg-transparent px-1 text-base focus:bg-surface focus:outline-1 focus:outline-line-strong',
                  item.done ? 'text-ink-3 line-through' : 'text-ink',
                )}
              />
            )}
            {!readOnlyText && (
              <button
                type="button"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                aria-label={`Remover item ${i + 1}`}
                className="rounded-xs p-1 text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-ink focus-visible:opacity-100"
              >
                <XIcon size={13} />
              </button>
            )}
          </li>
        ))}
      </ol>

      {!readOnlyText &&
        (adding ? (
          <div className="mt-1.5 flex items-center gap-2 pl-[54px]">
            <input
              ref={inputRef}
              autoFocus={autoFocusAdd}
              value={draft}
              maxLength={200}
              placeholder="Adicionar um item"
              aria-label="Novo item do checklist"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                } else if (e.key === 'Escape' && !draft) {
                  e.stopPropagation();
                  setAdding(false);
                }
              }}
              className="h-8 min-w-0 flex-1 rounded-sm border border-line bg-surface px-2.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
            <Button size="sm" variant="primary" onClick={add}>
              Adicionar
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="mt-1.5 ml-[54px]"
            leading={<PlusIcon size={13} />}
            onClick={() => {
              setAdding(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            Adicionar um item
          </Button>
        ))}
    </section>
  );
}
