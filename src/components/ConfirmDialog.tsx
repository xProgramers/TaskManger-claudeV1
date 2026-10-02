import { useRef, type ReactNode } from 'react';
import { Dialog } from './ui/Layer';
import { Button } from './ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

/** Only for destructive actions. Focus starts on "Cancelar" (the safe choice). */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose, loading }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onClose={onClose} title={title} role="alertdialog" className="max-w-[420px]" initialFocus={cancelRef}>
      <div className="px-5 pt-1.5 text-base text-ink-2">{description}</div>
      <div className="flex justify-end gap-2 px-5 pt-5 pb-5">
        <Button ref={cancelRef} variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
