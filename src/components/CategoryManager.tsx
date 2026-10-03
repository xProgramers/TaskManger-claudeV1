import { useState } from 'react';
import type { Category } from '@/types';
import { CATEGORY_COLORS } from '@/utils/task';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories, useCategoryActions } from '@/hooks/useCategories';
import { PencilIcon, PlusIcon, TrashIcon } from './icons';
import { Button, IconButton } from './ui/Button';
import { Dialog } from './ui/Layer';
import { ColorPicker } from './ui/ColorPicker';
import { ConfirmDialog } from './ConfirmDialog';

function CategoryEditor({
  initial,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial: { name: string; color: string };
  onSave: (v: { name: string; color: string }) => Promise<unknown>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return setError('Dê um nome para a categoria.');
        if (trimmed.length > 40) return setError('Use até 40 caracteres.');
        setSaving(true);
        try {
          await onSave({ name: trimmed, color });
          setName('');
          setError(null);
        } catch {
          // toast already shown
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex gap-2">
        <input
          data-autofocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={40}
          aria-label="Nome da categoria"
          aria-invalid={error ? true : undefined}
          placeholder="Nome, ex.: Trabalho"
          className="h-9 min-w-0 flex-1 rounded-sm border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" loading={saving} leading={onCancel ? undefined : <PlusIcon size={15} />}>
          {submitLabel}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <ColorPicker value={color} onChange={setColor} colors={CATEGORY_COLORS} />
    </form>
  );
}

export function CategoryManager() {
  const { categoriesOpen, closeCategories } = useTaskUI();
  const { categories } = useCategories();
  const { create, update, remove } = useCategoryActions();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={categoriesOpen}
      onClose={closeCategories}
      title="Categorias"
      description="Agrupe tarefas por área da vida. Cada uma tem uma cor."
      className="max-w-[480px]"
    >
      <div className="px-5 pt-4">
        <CategoryEditor
          submitLabel="Adicionar"
          initial={{ name: '', color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length].value }}
          onSave={create}
        />
      </div>

      <ul className="mt-4 max-h-[320px] overflow-y-auto border-t border-line px-2 py-2 scrollbar-thin">
        {categories.length === 0 && (
          <li className="px-3 py-4 text-sm text-ink-3">Nenhuma categoria ainda. Crie a primeira acima.</li>
        )}
        {categories.map((c) =>
          editing === c.id ? (
            <li key={c.id} className="rounded-sm bg-sunken px-3 py-3">
              <CategoryEditor
                submitLabel="Salvar"
                initial={{ name: c.name, color: c.color }}
                onCancel={() => setEditing(null)}
                onSave={async (v) => {
                  await update(c.id, v);
                  setEditing(null);
                }}
              />
            </li>
          ) : (
            <li key={c.id} className="group flex h-10 items-center gap-3 rounded-sm px-3 hover:bg-hover">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden="true" />
              <span className="flex-1 truncate text-base text-ink">{c.name}</span>
              <IconButton size="sm" label={`Editar ${c.name}`} onClick={() => setEditing(c.id)}>
                <PencilIcon size={14} />
              </IconButton>
              <IconButton size="sm" label={`Excluir ${c.name}`} onClick={() => setDeleting(c)} className="hover:text-danger">
                <TrashIcon size={14} />
              </IconButton>
            </li>
          ),
        )}
      </ul>

      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button onClick={closeCategories}>Concluído</Button>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Excluir categoria?"
        description={
          <>
            A categoria “{deleting?.name}” será excluída. As tarefas dela <strong className="font-semibold text-ink">não</strong> são
            apagadas; elas ficam sem categoria.
          </>
        }
        confirmLabel="Excluir categoria"
        loading={busy}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await remove(deleting);
            setDeleting(null);
          } catch {
            // toast already explained the failure
          } finally {
            setBusy(false);
          }
        }}
      />
    </Dialog>
  );
}
