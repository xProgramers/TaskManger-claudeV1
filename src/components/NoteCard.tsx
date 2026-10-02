import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { Note, NoteColor } from '@/types';
import { NOTE_COLORS } from '@/types';
import { cn } from '@/utils/cn';
import { CheckIcon, GripIcon, TrashIcon } from './icons';
import { Popover } from './ui/Layer';

/** Default size; a note can be resized within the limits below (also enforced by the database). */
export const NOTE_WIDTH = 224;
export const NOTE_HEIGHT = 184;
export const NOTE_MIN_W = 160;
export const NOTE_MIN_H = 120;
export const NOTE_MAX = 900;
const HEADER_H = 32;

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

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface NoteCardProps {
  note: Note;
  /** 'board': absolutely positioned, draggable and resizable. 'grid': flows in a list (phones). */
  mode: 'board' | 'grid';
  autoFocus?: boolean;
  /** Board only: pixel rect while rendering. */
  rect?: Rect;
  onContent: (value: string) => void;
  onBlur: () => void;
  onColor: (color: NoteColor) => void;
  onDelete: () => void;
  onFront?: () => void;
  /** Board only: final pixel position after a drag. */
  onMoveEnd?: (left: number, top: number) => void;
  /** Board only: final pixel size after a resize. */
  onResizeEnd?: (width: number, height: number) => void;
}

type Gesture = { kind: 'move' | 'resize'; startX: number; startY: number; base: Rect; dx: number; dy: number };

export function NoteCard({
  note,
  mode,
  autoFocus,
  rect,
  onContent,
  onBlur,
  onColor,
  onDelete,
  onFront,
  onMoveEnd,
  onResizeEnd,
}: NoteCardProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const colorRef = useRef<HTMLButtonElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);

  useEffect(() => {
    if (autoFocus) textRef.current?.focus();
  }, [autoFocus]);

  const firstLine = note.content.split('\n')[0]?.trim() || 'Nota vazia';

  // --- pointer gestures (mouse, pen or touch) shared by move and resize ---
  const start = (kind: Gesture['kind']) => (e: PointerEvent<HTMLElement>) => {
    if (mode !== 'board' || !rect || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onFront?.();
    setGesture({ kind, startX: e.clientX, startY: e.clientY, base: rect, dx: 0, dy: 0 });
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    if (gesture) setGesture({ ...gesture, dx: e.clientX - gesture.startX, dy: e.clientY - gesture.startY });
  };
  const end = () => {
    if (!gesture) return;
    const { kind, base, dx, dy } = gesture;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      if (kind === 'move') onMoveEnd?.(base.left + dx, base.top + dy);
      else onResizeEnd?.(base.width + dx, base.height + dy);
    }
    setGesture(null);
  };

  /** Grows or shrinks the height so the whole text fits (no inner scroll). */
  const fitToContent = () => {
    const ta = textRef.current;
    if (!ta || !rect) return;
    // Measure the text's natural height: take the textarea out of the flex
    // sizing for a moment, otherwise it reports the note's current height.
    const { flex, height } = ta.style;
    ta.style.flex = 'none';
    ta.style.height = '0px';
    const needed = ta.scrollHeight + HEADER_H + 2;
    ta.style.flex = flex;
    ta.style.height = height;
    onResizeEnd?.(rect.width, needed);
  };

  const keyStep = (e: KeyboardEvent<HTMLElement>, apply: (dx: number, dy: number) => void, step: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    apply(m[0], m[1]);
  };

  // Live geometry while dragging or resizing.
  let live: Rect | undefined = rect;
  if (rect && gesture) {
    live =
      gesture.kind === 'move'
        ? { ...gesture.base, left: gesture.base.left + gesture.dx, top: gesture.base.top + gesture.dy }
        : {
            ...gesture.base,
            width: Math.min(NOTE_MAX, Math.max(NOTE_MIN_W, gesture.base.width + gesture.dx)),
            height: Math.min(NOTE_MAX, Math.max(NOTE_MIN_H, gesture.base.height + gesture.dy)),
          };
  }

  return (
    <article
      aria-label={`Nota: ${firstLine}`}
      onPointerDownCapture={() => onFront?.()}
      className={cn(
        'group/note flex flex-col rounded-md border shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)]',
        mode === 'board' ? 'absolute' : 'relative min-h-[150px]',
        gesture?.kind === 'move' ? 'rotate-[0.6deg] shadow-float transition-none' : 'transition-shadow duration-150',
      )}
      style={{
        ...noteStyle(note.color),
        ...(mode === 'board' && live
          ? { left: live.left, top: live.top, width: live.width, height: live.height, zIndex: gesture ? 9999 : note.z }
          : {}),
      }}
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 pr-1 pl-1">
        {mode === 'board' ? (
          <button
            type="button"
            aria-label={`Mover nota “${firstLine}”. Use as setas do teclado; Shift para mover mais.`}
            title="Arraste para mover"
            onPointerDown={start('move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) =>
              rect && keyStep(e, (dx, dy) => onMoveEnd?.(rect.left + dx, rect.top + dy), e.shiftKey ? 80 : 16)
            }
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
            <span
              className="size-3.5 rounded-full border border-black/15 dark:border-white/20"
              style={{ background: `var(--note-${note.color}-edge)` }}
            />
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
          'min-h-0 w-full flex-1 resize-none bg-transparent px-3 pb-3 text-base leading-[22px] placeholder:text-current placeholder:opacity-40 focus:outline-none',
          mode === 'board' ? 'overflow-y-auto scrollbar-thin' : 'field-sizing-content min-h-[96px]',
        )}
      />

      {mode === 'board' && (
        <button
          type="button"
          aria-label="Redimensionar nota. Setas mudam o tamanho; clique duplo ajusta a altura ao texto."
          title="Arraste para redimensionar; clique duplo ajusta ao texto"
          onPointerDown={start('resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onDoubleClick={fitToContent}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              fitToContent();
              return;
            }
            if (rect) keyStep(e, (dw, dh) => onResizeEnd?.(rect.width + dw, rect.height + dh), e.shiftKey ? 80 : 16);
          }}
          className="absolute right-0 bottom-0 flex size-5 cursor-nwse-resize touch-none items-end justify-end rounded-br-md p-[3px] opacity-40 hover:opacity-90 focus-visible:opacity-100"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}

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
