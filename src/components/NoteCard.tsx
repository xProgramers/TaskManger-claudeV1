import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { Note, NoteColor } from '@/types';
import { NOTE_COLORS } from '@/types';
import { cn } from '@/utils/cn';
import { CheckIcon, GripIcon, TrashIcon } from './icons';
import { Popover } from './ui/Layer';

export const NOTE_WIDTH = 224;
export const NOTE_HEIGHT = 184;

const COLOR_LABEL: Record<NoteColor, string> = {
  yellow: 'Amarelo',
  green: 'Verde',
  blue: 'Azul',
  pink: 'Rosa',
  violet: 'Lilás',
  gray: 'Cinza',
};

export const noteStyle = (color: NoteColor): CSSProperties => ({
  background: `var(--note-${color})`,
  borderColor: `var(--note-${color}-edge)`,
  color: 'var(--note-ink)',
});

interface NoteCardProps {
  note: Note;
  /** 'board': absolutely positioned and draggable. 'grid': flows in a list (phones). */
  mode: 'board' | 'grid';
  autoFocus?: boolean;
  /** Board only: pixel position while rendering. */
  position?: { left: number; top: number };
  onContent: (value: string) => void;
  onBlur: () => void;
  onColor: (color: NoteColor) => void;
  onDelete: () => void;
  onFront?: () => void;
  /** Board only: drag by the handle; returns the final pixel position. */
  onDragEnd?: (left: number, top: number) => void;
  /** Board only: keyboard nudge in fractions of the board. */
  onNudge?: (dx: number, dy: number) => void;
}

export function NoteCard({
  note,
  mode,
  autoFocus,
  position,
  onContent,
  onBlur,
  onColor,
  onDelete,
  onFront,
  onDragEnd,
  onNudge,
}: NoteCardProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const colorRef = useRef<HTMLButtonElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [drag, setDrag] = useState<{ startX: number; startY: number; left: number; top: number; dx: number; dy: number } | null>(
    null,
  );

  useEffect(() => {
    if (autoFocus) textRef.current?.focus();
  }, [autoFocus]);

  const firstLine = note.content.split('\n')[0]?.trim() || 'Nota vazia';

  // --- drag by the handle (mouse, pen or touch) ---
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (mode !== 'board' || !position || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onFront?.();
    setDrag({ startX: e.clientX, startY: e.clientY, left: position.left, top: position.top, dx: 0, dy: 0 });
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    setDrag({ ...drag, dx: e.clientX - drag.startX, dy: e.clientY - drag.startY });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const moved = Math.abs(drag.dx) + Math.abs(drag.dy) > 2;
    if (moved) onDragEnd?.(drag.left + drag.dx, drag.top + drag.dy);
    setDrag(null);
  };
  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onNudge?.(m[0], m[1]);
  };

  const left = drag ? drag.left + drag.dx : position?.left;
  const top = drag ? drag.top + drag.dy : position?.top;

  return (
    <article
      aria-label={`Nota: ${firstLine}`}
      onPointerDownCapture={() => onFront?.()}
      className={cn(
        'group/note flex flex-col rounded-md border shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)]',
        mode === 'board' ? 'absolute' : 'relative min-h-[150px]',
        drag ? 'z-[9999] rotate-[0.6deg] shadow-float transition-none' : 'transition-shadow duration-150',
      )}
      style={{
        ...noteStyle(note.color),
        ...(mode === 'board' ? { left, top, width: NOTE_WIDTH, height: NOTE_HEIGHT, zIndex: drag ? 9999 : note.z } : {}),
      }}
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 pr-1 pl-1">
        {mode === 'board' ? (
          <button
            type="button"
            aria-label={`Mover nota “${firstLine}”. Use as setas do teclado; Shift para mover mais.`}
            title="Arraste para mover"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onHandleKey}
            className="flex h-7 flex-1 cursor-grab touch-none items-center rounded-xs pl-1 opacity-45 hover:opacity-80 focus-visible:opacity-100 active:cursor-grabbing"
          >
            <GripIcon size={14} />
          </button>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover/note:opacity-100 sm:group-focus-within/note:opacity-100">
          <button
            ref={colorRef}
            type="button"
            onClick={() => setColorOpen((o) => !o)}
            aria-label="Mudar cor da nota"
            aria-haspopup="dialog"
            aria-expanded={colorOpen}
            title="Cor"
            className="flex size-7 items-center justify-center rounded-xs hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="size-3.5 rounded-full border border-black/15 dark:border-white/20" style={{ background: `var(--note-${note.color}-edge)` }} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Excluir nota “${firstLine}”`}
            title="Excluir"
            className="flex size-7 items-center justify-center rounded-xs opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>

      <label className="sr-only" htmlFor={`note-${note.id}`}>
        Texto da nota
      </label>
      <textarea
        id={`note-${note.id}`}
        ref={textRef}
        value={note.content}
        maxLength={2000}
        onChange={(e) => onContent(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
        placeholder="Escreva algo…"
        className={cn(
          'w-full flex-1 resize-none bg-transparent px-3 pb-3 text-base leading-[22px] placeholder:text-current placeholder:opacity-40 focus:outline-none',
          mode === 'board' ? 'overflow-y-auto scrollbar-thin' : 'field-sizing-content min-h-[96px]',
        )}
      />

      <Popover open={colorOpen} onClose={() => setColorOpen(false)} anchor={colorRef} label="Cor da nota" align="end">
        <div role="radiogroup" aria-label="Cor da nota" className="flex gap-1.5 p-1.5">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={note.color === c}
              aria-label={COLOR_LABEL[c]}
              title={COLOR_LABEL[c]}
              onClick={() => {
                onColor(c);
                setColorOpen(false);
              }}
              className="flex size-7 items-center justify-center rounded-full border"
              style={noteStyle(c)}
            >
              {note.color === c && <CheckIcon size={13} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </Popover>
    </article>
  );
}
