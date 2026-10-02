/**
 * Layer primitives: Dialog (centered), Sheet (side panel / bottom sheet on
 * mobile), Popover and Menu. Accessible by construction: focus is trapped and
 * restored, Escape closes only the top-most layer, page scroll is locked
 * while a modal is open, and roles/labels are set.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { XIcon } from '@/components/icons';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// --- layer stack -------------------------------------------------------------
const stack: string[] = [];
const isTop = (id: string) => stack[stack.length - 1] === id;
let scrollLocks = 0;

function useLayer(open: boolean, onClose: () => void, modal: boolean) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    stack.push(id);
    if (modal && scrollLocks++ === 0) {
      document.documentElement.style.overflow = 'hidden';
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTop(id)) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (modal && --scrollLocks === 0) document.documentElement.style.overflow = '';
    };
  }, [open, id, modal]);
  return id;
}

/** True while any dialog/popover is open (global shortcuts stay quiet). */
export const hasOpenLayer = () => stack.length > 0;

function useFocusTrap(ref: RefObject<HTMLElement | null>, open: boolean, initialFocus?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = initialFocus?.current ?? node?.querySelector<HTMLElement>('[data-autofocus]') ?? node;
    // Wait a frame so the element is in the DOM and animations have started.
    const raf = requestAnimationFrame(() => first?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open, ref, initialFocus]);
}

function trapTab(e: ReactKeyboardEvent<HTMLElement>, container: HTMLElement | null) {
  if (e.key !== 'Tab' || !container) return;
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (items.length === 0) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === container)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// --- Dialog ------------------------------------------------------------------

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (still announced). */
  hideTitle?: boolean;
  description?: string;
  children: ReactNode;
  className?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  /** 'top' pins it near the top like a command palette. */
  position?: 'center' | 'top';
  role?: 'dialog' | 'alertdialog';
}

export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  className,
  initialFocus,
  position = 'center',
  role = 'dialog',
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useLayer(open, onClose, true);
  useFocusTrap(ref, open, initialFocus);
  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center px-4',
        position === 'top' ? 'items-start pt-[12vh] max-sm:pt-4' : 'items-center',
      )}
    >
      <div className="absolute inset-0 bg-overlay animate-fade-in" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={(e) => trapTab(e, ref.current)}
        className={cn(
          'relative w-full max-w-[520px] rounded-lg border border-line bg-surface shadow-float animate-dialog-in focus:outline-none',
          className,
        )}
      >
        <h2 id={titleId} className={cn(hideTitle ? 'sr-only' : 'px-5 pt-5 text-lg font-semibold text-ink')}>
          {title}
        </h2>
        {description && (
          <p id={descId} className="px-5 pt-1.5 text-base text-ink-2">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

// --- Sheet (side panel; bottom sheet under 640px) ------------------------------

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useLayer(open, onClose, true);
  useFocusTrap(ref, open);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-overlay animate-fade-in" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => trapTab(e, ref.current)}
        className={cn(
          'absolute flex flex-col bg-surface focus:outline-none',
          'inset-y-0 right-0 w-full max-w-[460px] border-l border-line shadow-sheet animate-sheet-in',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:rounded-t-lg max-sm:border-t max-sm:border-l-0 max-sm:animate-sheet-up',
          className,
        )}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <div className="flex h-12 shrink-0 items-center justify-end gap-1 border-b border-line px-3">
          <div className="mx-auto h-1 w-9 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
          <IconButton label="Fechar painel" onClick={onClose} size="sm" className="max-sm:absolute max-sm:right-3">
            <XIcon />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// --- Popover -------------------------------------------------------------------

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  label: string;
  /** Focus the first focusable element when opened (default true). */
  autoFocus?: boolean;
}

export function Popover({ open, onClose, anchor, children, align = 'start', className, label, autoFocus = true }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  useLayer(open, onClose, false);

  const place = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect();
    const el = ref.current;
    if (!a || !el) return;
    const margin = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === 'end' ? a.right - w : a.left;
    left = Math.max(margin, Math.min(left, vw - w - margin));
    const below = vh - a.bottom - margin;
    const above = a.top - margin;
    const openUp = h > below && above > below;
    const top = openUp ? Math.max(margin, a.top - 6 - h) : a.bottom + 6;
    setPos({ top, left, maxH: (openUp ? above : below) - 6 });
  }, [anchor, align]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    const onScroll = () => place();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose, anchor]);

  useEffect(() => {
    if (!open || !autoFocus) return;
    const raf = requestAnimationFrame(() => {
      const target =
        ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
    const trigger = anchor.current;
    return () => {
      cancelAnimationFrame(raf);
      // Focus was inside the popover, which is now gone: hand it back to the trigger.
      const active = document.activeElement;
      if (trigger && (!active || active === document.body)) trigger.focus({ preventScroll: true });
    };
  }, [open, autoFocus, anchor]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        maxHeight: pos ? Math.max(160, pos.maxH) : undefined,
      }}
      className={cn(
        'fixed z-[60] overflow-auto rounded-md border border-line bg-surface p-1 shadow-float animate-pop-in scrollbar-thin',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

// --- Menu ------------------------------------------------------------------------

const MenuContext = createContext<{ close: () => void } | null>(null);

interface MenuProps {
  trigger: (props: {
    ref: RefObject<HTMLButtonElement | null>;
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
  }) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  label: string;
  className?: string;
}

export function Menu({ trigger, children, align = 'end', label, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <>
      {trigger({ ref: anchor, onClick: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open })}
      <Popover open={open} onClose={close} anchor={anchor} align={align} label={label} className={cn('min-w-48', className)}>
        <MenuContext.Provider value={{ close }}>
          <div ref={listRef} role="menu" aria-label={label} onKeyDown={onKeyDown}>
            {children}
          </div>
        </MenuContext.Provider>
      </Popover>
    </>
  );
}

interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  hint?: ReactNode;
}

export function MenuItem({ onSelect, children, icon, tone = 'default', disabled, hint }: MenuItemProps) {
  const ctx = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        ctx?.close();
        onSelect();
      }}
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-xs px-2.5 text-left text-base outline-none',
        'hover:bg-hover focus-visible:bg-hover focus-visible:outline-none disabled:opacity-50',
        tone === 'danger' ? 'text-danger' : 'text-ink',
      )}
    >
      {icon && <span className={cn('shrink-0', tone === 'danger' ? 'text-danger' : 'text-ink-3')}>{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {hint}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
