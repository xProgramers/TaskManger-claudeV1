import { useEffect, useLayoutEffect, useState, type MouseEvent } from 'react';
import type { Note } from '@/types';
import { useNoteActions, useNotes } from '@/hooks/useNotes';
import { useMediaQuery } from '@/hooks/useUtils';
import { NoteCard, NOTE_HEIGHT, NOTE_WIDTH } from '@/components/NoteCard';
import { PageTitle } from '@/components/PageParts';
import { ErrorState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Spinner';
import { PlusIcon, StickyNoteIcon } from '@/components/icons';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Measures the board (callback ref: works whenever the element mounts). */
function useSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

export function BoardPage() {
  const { data: notes, isLoading, isError, refetch } = useNotes();
  const actions = useNoteActions();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [boardRef, size] = useSize<HTMLDivElement>();

  // Pixel <-> fraction, keeping the whole note inside the board.
  const maxLeft = Math.max(0, size.width - NOTE_WIDTH);
  const maxTop = Math.max(0, size.height - NOTE_HEIGHT);
  const toPx = (n: Note) => ({ left: clamp(n.x * size.width, 0, maxLeft), top: clamp(n.y * size.height, 0, maxTop) });
  const toFraction = (left: number, top: number) => ({
    x: size.width ? clamp(left, 0, maxLeft) / size.width : 0,
    y: size.height ? clamp(top, 0, maxTop) / size.height : 0,
  });

  const createAt = async (left: number, top: number) => {
    const { x, y } = toFraction(left, top);
    const note = await actions.create(x, y);
    if (note) setFocusId(note.id);
  };

  /** "+ Nota": cascade new notes from the top-left so they don't stack exactly. */
  const createNext = async () => {
    if (!isWide) {
      const note = await actions.create(0, 0);
      if (note) setFocusId(note.id);
      return;
    }
    const k = (notes?.length ?? 0) % 8;
    await createAt(24 + k * 28, 24 + k * 28);
  };

  const onBoardDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // only empty space
    const rect = e.currentTarget.getBoundingClientRect();
    void createAt(e.clientX - rect.left - NOTE_WIDTH / 2, e.clientY - rect.top - 16);
  };

  // Notes created empty and left empty disappear quietly.
  const onBlur = (n: Note) => {
    actions.flush(n.id);
    if (focusId === n.id) setFocusId(null);
    if (!n.content.trim()) void actions.remove(n, { silent: true });
  };

  useEffect(() => {
    if (focusId && !notes?.some((n) => n.id === focusId)) setFocusId(null);
  }, [notes, focusId]);

  const list = notes ?? [];
  const cardProps = (n: Note) => ({
    note: n,
    autoFocus: n.id === focusId,
    onContent: (v: string) => actions.setContent(n.id, v),
    onBlur: () => onBlur(n),
    onColor: (color: Note['color']) => actions.update(n.id, { color }),
    onDelete: () => void actions.remove(n),
  });

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col">
      <PageTitle
        title="Quadro"
        subtitle={
          isWide
            ? 'Anotações rápidas que ficam até você apagar. Clique duas vezes no quadro para criar uma nota.'
            : 'Anotações rápidas que ficam até você apagar.'
        }
      >
        <Button variant="primary" leading={<PlusIcon size={15} />} onClick={() => void createNext()}>
          Nota
        </Button>
      </PageTitle>

      <div className="mt-6">
        {isError ? (
          <ErrorState message="Não foi possível carregar o quadro." onRetry={() => void refetch()} />
        ) : isWide ? (
          <div
            ref={boardRef}
            onDoubleClick={onBoardDoubleClick}
            role="region"
            aria-label="Quadro de notas"
            className="relative h-[calc(100dvh-220px)] min-h-[460px] overflow-hidden rounded-md border border-line bg-surface"
            style={{
              backgroundImage: 'radial-gradient(var(--color-line-strong) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              backgroundPosition: '11px 11px',
            }}
          >
            {isLoading ? (
              <div className="flex gap-6 p-6">
                <Skeleton className="h-[184px] w-[224px] rounded-md" />
                <Skeleton className="h-[184px] w-[224px] rounded-md" />
              </div>
            ) : list.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <StickyNoteIcon size={28} className="text-ink-3" />
                <p className="text-md font-semibold text-ink">Seu quadro está vazio.</p>
                <p className="max-w-[36ch] text-base text-ink-2">
                  Clique duas vezes em qualquer lugar para criar uma nota, ou use o botão “Nota”.
                </p>
              </div>
            ) : (
              size.width > 0 &&
              list.map((n) => (
                <NoteCard
                  key={n.id}
                  mode="board"
                  position={toPx(n)}
                  onFront={() => actions.bringToFront(n.id)}
                  onDragEnd={(left, top) => actions.update(n.id, toFraction(left, top))}
                  onNudge={(dx, dy) => {
                    const p = toPx(n);
                    actions.update(n.id, toFraction(p.left + dx * size.width, p.top + dy * size.height));
                  }}
                  {...cardProps(n)}
                />
              ))
            )}
          </div>
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
