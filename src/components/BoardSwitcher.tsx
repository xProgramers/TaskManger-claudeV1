import { useRef, useState } from 'react';
import type { Board, BoardInput } from '@/types';
import { cn } from '@/utils/cn';
import { BOARD_COLORS, useBoardActions } from '@/hooks/useBoards';
import { CheckIcon, ChevronDownIcon, PencilIcon, PlusIcon, TrashIcon } from './icons';
import { Button } from './ui/Button';
import { Dialog, Menu, MenuItem, MenuSeparator } from './ui/Layer';
import { ColorPicker } from './ui/ColorPicker';
import { ConfirmDialog } from './ConfirmDialog';

/** The environment's icon: its initial on its color. */
export function BoardIcon({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  const initial = [...name.trim()][0]?.toLocaleUpperCase('pt-BR') ?? '';
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-[6px] font-semibold text-white select-none"
      style={{ background: color, width: size, height: size, fontSize: Math.round(size * 0.55) }}
    >
      {initial}
    </span>
  );
}

interface BoardSwitcherProps {
  boards: Board[];
  current: Board;
  onSelect: (id: string) => void;
  className?: string;
}

/** Shows the current environment and lets the user switch, create, edit or delete one. */
export function BoardSwitcher({ boards, current, onSelect, className }: BoardSwitcherProps) {
  const actions = useBoardActions();
  const [editor, setEditor] = useState<{ mode: 'create' } | { mode: 'edit'; board: Board } | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);
  const [busy, setBusy] = useState(false);

  const nextColor = () => {
    const used = new Set(boards.map((b) => b.color));
    return (BOARD_COLORS.find((c) => !used.has(c.value)) ?? BOARD_COLORS[boards.length % BOARD_COLORS.length]).value;
  };

  return (
    <>
      <Menu
        label="Ambientes"
        align="start"
        className="w-64"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            title="Trocar de ambiente"
            aria-label={`Ambiente: ${current.name}. Trocar de ambiente`}
            className={cn(
              'flex h-8 max-w-[260px] min-w-0 items-center gap-2 rounded-sm pr-1.5 pl-1.5 text-base font-semibold text-ink hover:bg-hover',
              className,
            )}
          >
            <BoardIcon name={current.name} color={current.color} />
            <span className="truncate">{current.name}</span>
            <ChevronDownIcon size={14} className="shrink-0 text-ink-3" />
          </button>
        )}
      >
        <p className="px-2.5 pt-1 pb-1.5 text-xs font-medium text-ink-3">Ambientes</p>
        <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
          {boards.map((b) => (
            <MenuItem
              key={b.id}
              onSelect={() => onSelect(b.id)}
              icon={<BoardIcon name={b.name} color={b.color} size={18} />}
              hint={b.id === current.id ? <CheckIcon size={14} className="text-accent" aria-label="Atual" /> : undefined}
            >
              {b.name}
            </MenuItem>
          ))}
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => setEditor({ mode: 'create' })} icon={<PlusIcon size={15} />}>
          Novo ambiente
        </MenuItem>
        <MenuItem onSelect={() => setEditor({ mode: 'edit', board: current })} icon={<PencilIcon size={15} />}>
          Editar “{current.name}”
        </MenuItem>
        <MenuItem
          onSelect={() => setDeleting(current)}
          icon={<TrashIcon size={15} />}
          tone="danger"
          disabled={boards.length <= 1}
          hint={boards.length <= 1 ? <span className="text-xs text-ink-3">único</span> : undefined}
        >
          Excluir ambiente
        </MenuItem>
      </Menu>

      <BoardDialog
        key={editor ? (editor.mode === 'edit' ? editor.board.id : 'new') : 'closed'}
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'edit' ? 'Editar ambiente' : 'Novo ambiente'}
        submitLabel={editor?.mode === 'edit' ? 'Salvar' : 'Criar ambiente'}
        initial={
          editor?.mode === 'edit'
            ? { name: editor.board.name, color: editor.board.color }
            : { name: '', color: nextColor() }
        }
        onSave={async (input) => {
          if (editor?.mode === 'edit') {
            await actions.update(editor.board.id, input);
          } else {
            const b = await actions.create(input);
            onSelect(b.id);
          }
          setEditor(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Excluir ambiente?"
        description={
          <>
            O ambiente “{deleting?.name}” e <strong className="font-semibold text-ink">todas as notas dele</strong> serão
            excluídos. Isso não pode ser desfeito.
          </>
        }
        confirmLabel="Excluir ambiente"
        loading={busy}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            const other = boards.find((b) => b.id !== deleting.id);
            await actions.remove(deleting);
            if (other && deleting.id === current.id) onSelect(other.id);
            setDeleting(null);
          } catch {
            // toast already explained the failure
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

interface BoardDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  initial: BoardInput;
  onSave: (input: BoardInput) => Promise<unknown>;
}

function BoardDialog({ open, onClose, title, submitLabel, initial, onSave }: BoardDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="Separe suas notas por assunto, como Trabalho ou Pessoal."
      className="max-w-[440px]"
      initialFocus={inputRef}
    >
      <form
        className="flex flex-col gap-4 px-5 pt-4 pb-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return setError('Dê um nome para o ambiente.');
          if (trimmed.length > 40) return setError('Use até 40 caracteres.');
          setSaving(true);
          try {
            await onSave({ name: trimmed, color });
          } catch {
            // toast already explained the failure
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="board-name" className="text-sm font-medium text-ink-2">
            Nome
          </label>
          <div className="flex items-center gap-2.5">
            <BoardIcon name={name || '?'} color={color} size={36} />
            <input
              id="board-name"
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={40}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'board-name-error' : undefined}
              placeholder="Ex.: Trabalho"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 rounded-sm border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none aria-[invalid=true]:border-danger"
            />
          </div>
          {error && (
            <p id="board-name-error" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-2">Cor do ícone</span>
          <ColorPicker value={color} onChange={setColor} colors={BOARD_COLORS} label="Cor do ícone" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
