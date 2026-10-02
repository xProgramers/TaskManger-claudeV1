import { useEffect, useRef, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** True when focus is in something the user types into. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

interface Hotkey {
  /** e.g. "n", "mod+k" (mod = Ctrl on Windows/Linux, ⌘ on macOS) */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** Fire even while typing in a field (used for mod+k). */
  allowInInputs?: boolean;
}

export function useHotkeys(hotkeys: Hotkey[]) {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      for (const h of ref.current) {
        const parts = h.combo.toLowerCase().split('+');
        const key = parts[parts.length - 1];
        const wantsMod = parts.includes('mod');
        const mod = e.metaKey || e.ctrlKey;
        if (wantsMod !== mod || e.altKey || e.key.toLowerCase() !== key) continue;
        if (!wantsMod && e.shiftKey) continue;
        if (!h.allowInInputs && isTypingTarget(e.target)) continue;
        e.preventDefault();
        h.handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Calls `onIntersect` when the sentinel scrolls into view (infinite lists). */
export function useInfiniteScroll(onIntersect: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onIntersect);
  cb.current = onIntersect;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && cb.current(), {
      rootMargin: '400px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
