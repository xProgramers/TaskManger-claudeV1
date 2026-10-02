import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { Note } from '@/types';
import { useNoteActions, useNotes } from '@/hooks/useNotes';
import { isTypingTarget, useMediaQuery } from '@/hooks/useUtils';
import { NoteCard, NOTE_HEIGHT, NOTE_MAX, NOTE_MIN_H, NOTE_MIN_W, NOTE_WIDTH } from '@/components/NoteCard';
import { PageTitle } from '@/components/PageParts';
import { ErrorState } from '@/components/EmptyState';
import { Button, IconButton } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Spinner';
import { PlusIcon, StickyNoteIcon } from '@/components/icons';

// ---------------------------------------------------------------------------
// Viewport math. World = note coordinates (pixels at 100%).
// screen = world * zoom + offset
// ---------------------------------------------------------------------------

interface View {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const VIEW_KEY = 'prumo:board-view';
const ORIGIN: View = { x: 40, y: 40, zoom: 1 };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function loadView(): View | null {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as View | null;
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.zoom) ? v : null;
  } catch {
    return null;
  }
}

/** Zoom to `zoom` keeping the world point under (sx, sy) fixed on screen. */
function zoomAt(view: View, zoom: number, sx: number, sy: number): View {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const k = z / view.zoom;
  return { zoom: z, x: sx - (sx - view.x) * k, y: sy - (sy - view.y) * k };
}

const sizeOf = (n: Pick<Note, 'w' | 'h'>) => ({ width: n.w ?? NOTE_WIDTH, height: n.h ?? NOTE_HEIGHT });

/** View that frames all notes (at most 100%) inside a viewport of the given size. */
function fitView(notes: Note[], width: number, height: number): View {
  if (notes.length === 0 || width === 0) return ORIGIN;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of notes) {
    const s = sizeOf(n);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + s.width);
    maxY = Math.max(maxY, n.y + s.height);
  }
  const pad = 48;
  const controls = 56; // keep the floating toolbar from covering the bottom notes
  const usableH = height - pad * 2 - controls;
  const zoom = clamp(Math.min((width - pad * 2) / (maxX - minX), usableH / (maxY - minY), 1), MIN_ZOOM, MAX_ZOOM);
  return {
    zoom,
    x: (width - (maxX - minX) * zoom) / 2 - minX * zoom,
    y: pad + (usableH - (maxY - minY) * zoom) / 2 - minY * zoom,
  };
}

function useElementSize() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { el, ref: setEl, size };
}

// ---------------------------------------------------------------------------

export function BoardPage() {
  const { data: notes, isLoading, isError, refetch } = useNotes();
  const actions = useNoteActions();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [focusId, setFocusId] = useState<string | null>(null);
  const list = notes ?? [];

  // Notes created empty and left empty disappear quietly.
  const onBlur = (n: Note) => {
    actions.flush(n.id);
    if (focusId === n.id) setFocusId(null);
    if (!n.content.trim()) void actions.remove(n, { silent: true });
  };

  useEffect(() => {
    if (focusId && !notes?.some((n) => n.id === focusId)) setFocusId(null);
  }, [notes, focusId]);

  const cardProps = (n: Note) => ({
    note: n,
    autoFocus: n.id === focusId,
    onContent: (v: string) => actions.setContent(n.id, v),
    onBlur: () => onBlur(n),
    onColor: (color: Note['color']) => actions.update(n.id, { color }),
    onDelete: () => void actions.remove(n),
  });

  const createMobile = async () => {
    const note = await actions.create(0, 0);
    if (note) setFocusId(note.id);
  };

  return (
    <div className="flex w-full flex-col">
      <PageTitle
        title="Quadro"
        subtitle={
          isWide
            ? 'Anotações rápidas que ficam até você apagar. Clique duas vezes num espaço vazio para criar uma nota.'
            : 'Anotações rápidas que ficam até você apagar.'
        }
      >
        {!isWide && (
          <Button variant="primary" leading={<PlusIcon size={15} />} onClick={() => void createMobile()}>
            Nota
          </Button>
        )}
      </PageTitle>

      <div className="mt-6">
        {isError ? (
          <ErrorState message="Não foi possível carregar o quadro." onRetry={() => void refetch()} />
        ) : isWide ? (
          <InfiniteBoard notes={list} loading={isLoading} setFocusId={setFocusId} cardProps={cardProps} />
        ) : isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-[150px] rounded-md" />
            <Skeleton className="h-[150px] rounded-md" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-line-strong px-5 py-7">
            <p className="text-md font-semibold text-ink">Nenhuma nota ainda.</p>
            <p className="text-base text-ink-2">Use o botão “Nota” para anotar algo rápido.</p>
          </div>
        ) : (
          // Phones: newest-on-top grid instead of a free board.
          <div className="grid gap-3 sm:grid-cols-2">
            {[...list].reverse().map((n) => (
              <NoteCard key={n.id} mode="grid" {...cardProps(n)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Infinite board (tablet & desktop)
// ---------------------------------------------------------------------------

type CardProps = Omit<Parameters<typeof NoteCard>[0], 'mode'>;

interface InfiniteBoardProps {
  notes: Note[];
  loading: boolean;
  setFocusId: (id: string | null) => void;
  cardProps: (n: Note) => CardProps;
}

function InfiniteBoard({ notes, loading, setFocusId, cardProps }: InfiniteBoardProps) {
  const actions = useNoteActions();
  const { el, ref, size } = useElementSize();
  const [view, setView] = useState<View | null>(loadView);
  const viewRef = useRef(view);
  viewRef.current = view;

  // First visit on this device: frame the existing notes.
  useEffect(() => {
    if (view || loading || size.width === 0) return;
    setView(fitView(notes, size.width, size.height));
  }, [view, loading, notes, size]);

  // Remember where the user left the board (per device).
  useEffect(() => {
    if (!view) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view));
      } catch {
        // ignore (private mode)
      }
    }, 300);
    return () => clearTimeout(id);
  }, [view]);

  const v = view ?? ORIGIN;

  const toWorld = useCallback((sx: number, sy: number) => {
    const cur = viewRef.current ?? ORIGIN;
    return { x: (sx - cur.x) / cur.zoom, y: (sy - cur.y) / cur.zoom };
  }, []);

  const zoomBy = useCallback(
    (factor: number, sx = size.width / 2, sy = size.height / 2) =>
      setView((cur) => zoomAt(cur ?? ORIGIN, (cur ?? ORIGIN).zoom * factor, sx, sy)),
    [size],
  );

  // --- wheel: scroll pans, Ctrl/⌘ + wheel (and trackpad pinch) zooms ---
  useEffect(() => {
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const ta = (e.target as HTMLElement).closest('textarea');
      if (ta && ta.scrollHeight > ta.clientHeight && !e.ctrlKey && !e.metaKey) return; // scroll the note's own text
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0025);
        setView((cur) =>
          zoomAt(cur ?? ORIGIN, (cur ?? ORIGIN).zoom * factor, e.clientX - rect.left, e.clientY - rect.top),
        );
      } else {
        const horizontal = e.shiftKey && !e.deltaX;
        const dx = horizontal ? e.deltaY : e.deltaX;
        const dy = horizontal ? 0 : e.deltaY;
        setView((cur) => {
          const base = cur ?? ORIGIN;
          return { ...base, x: base.x - dx, y: base.y - dy };
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [el]);

  // --- pointer: drag the background to pan; two fingers pinch to zoom ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setPanning(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !el) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const rect = el.getBoundingClientRect();
      const p = pinch.current;
      setView((cur) => {
        const base = cur ?? ORIGIN;
        const zoomed = zoomAt(base, base.zoom * (dist / p.dist), mx - rect.left, my - rect.top);
        return { ...zoomed, x: zoomed.x + (mx - p.mx), y: zoomed.y + (my - p.my) };
      });
      pinch.current = { dist, mx, my };
    } else {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setView((cur) => {
        const base = cur ?? ORIGIN;
        return { ...base, x: base.x + dx, y: base.y + dy };
      });
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setPanning(false);
  };

  // --- create ---
  const createAtWorld = async (wx: number, wy: number) => {
    const note = await actions.create(Math.round(wx), Math.round(wy));
    if (note) setFocusId(note.id);
  };
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    void createAtWorld(w.x - NOTE_WIDTH / 2, w.y - 16);
  };
  /** "+ Nota": in the middle of what's on screen, nudged so repeated clicks don't stack. */
  const createInView = () => {
    const c = toWorld(size.width / 2, size.height / 2);
    const k = (notes.length % 6) * 24;
    void createAtWorld(c.x - NOTE_WIDTH / 2 + k, c.y - NOTE_HEIGHT / 2 + k);
  };

  // --- keyboard: + / - / 0 zoom, F frames everything (not while typing) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') zoomBy(1.2);
      else if (e.key === '-') zoomBy(1 / 1.2);
      else if (e.key === '0') setView((cur) => zoomAt(cur ?? ORIGIN, 1, size.width / 2, size.height / 2));
      else if (e.key.toLowerCase() === 'f') setView(fitView(notes, size.width, size.height));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomBy, notes, size]);

  const resize = (n: Note, width: number, height: number) => {
    const s = sizeOf(n);
    const w = Math.round(clamp(width, NOTE_MIN_W, NOTE_MAX));
    const h = Math.round(clamp(height, NOTE_MIN_H, NOTE_MAX));
    if (w !== s.width || h !== s.height) actions.update(n.id, { w, h });
  };

  const dot = 22 * v.zoom;

  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-label="Quadro de notas. Arraste o fundo para mover; Ctrl e a roda do mouse para zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        className={`relative h-[calc(100dvh-220px)] min-h-[460px] touch-none overflow-hidden rounded-md border border-line bg-surface select-none ${
          panning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage: 'radial-gradient(var(--color-line-strong) 1px, transparent 1px)',
          backgroundSize: `${dot}px ${dot}px`,
          backgroundPosition: `${v.x}px ${v.y}px`,
        }}
      >
        {/* The world: everything inside is positioned in world pixels. */}
        <div
          className="absolute top-0 left-0 origin-top-left cursor-auto"
          style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.zoom})` }}
        >
          {notes.map((n) => {
            const s = sizeOf(n);
            return (
              <NoteCard
                key={n.id}
                mode="board"
                scale={v.zoom}
                rect={{ left: n.x, top: n.y, width: s.width, height: s.height }}
                onFront={() => actions.bringToFront(n.id)}
                onMoveEnd={(left, top) => actions.update(n.id, { x: Math.round(left), y: Math.round(top) })}
                onResizeEnd={(width, height) => resize(n, width, height)}
                {...cardProps(n)}
              />
            );
          })}
        </div>

        {loading ? (
          <div className="flex gap-6 p-6">
            <Skeleton className="h-[184px] w-[224px] rounded-md" />
            <Skeleton className="h-[184px] w-[224px] rounded-md" />
          </div>
        ) : (
          notes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <StickyNoteIcon size={28} className="text-ink-3" />
              <p className="text-md font-semibold text-ink">Seu quadro está vazio.</p>
              <p className="max-w-[36ch] text-base text-ink-2">
                Clique duas vezes em qualquer lugar para criar uma nota, ou use o botão “Nota”.
              </p>
            </div>
          )
        )}
      </div>

      {/* Controls float over the board. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
        <p className="pointer-events-auto hidden rounded-sm bg-surface/90 px-2.5 py-1.5 text-xs text-ink-3 shadow-[0_0_0_1px_var(--color-line)] backdrop-blur lg:block">
          Arraste o fundo para mover. Ctrl + roda do mouse para zoom.
        </p>
        <div className="pointer-events-auto ml-auto flex items-center gap-1 rounded-md bg-surface/95 p-1 shadow-float backdrop-blur">
          <Button variant="primary" size="sm" leading={<PlusIcon size={14} />} onClick={createInView}>
            Nota
          </Button>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
          <IconButton size="sm" label="Diminuir zoom" onClick={() => zoomBy(1 / 1.2)} disabled={v.zoom <= MIN_ZOOM}>
            <span className="text-lg leading-none">−</span>
          </IconButton>
          <button
            type="button"
            onClick={() => setView(zoomAt(v, 1, size.width / 2, size.height / 2))}
            title="Voltar para 100% (tecla 0)"
            aria-label={`Zoom ${Math.round(v.zoom * 100)}%. Voltar para 100%`}
            className="tnum h-7 min-w-12 rounded-xs px-1.5 text-sm font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            {Math.round(v.zoom * 100)}%
          </button>
          <IconButton size="sm" label="Aumentar zoom" onClick={() => zoomBy(1.2)} disabled={v.zoom >= MAX_ZOOM}>
            <span className="text-lg leading-none">+</span>
          </IconButton>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView(fitView(notes, size.width, size.height))}
            title="Enquadrar todas as notas (tecla F)"
          >
            Ajustar
          </Button>
        </div>
      </div>
    </div>
  );
}
