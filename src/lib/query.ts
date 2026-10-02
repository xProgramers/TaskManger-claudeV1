/**
 * A small query cache (the subset of TanStack Query this app needs):
 * keyed caching, request de-duplication, stale-while-revalidate,
 * prefix invalidation and in-place updates for optimistic UI.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

export type QueryKey = readonly unknown[];
type Status = 'idle' | 'loading' | 'success' | 'error';

interface Entry {
  key: QueryKey;
  data: unknown;
  error: unknown;
  status: Status;
  updatedAt: number;
  stale: boolean;
  promise: Promise<unknown> | null;
  fetcher: (() => Promise<unknown>) | null;
  listeners: Set<() => void>;
  snapshot: Snapshot<unknown>;
}

export interface Snapshot<T> {
  data: T | undefined;
  error: unknown;
  status: Status;
  isFetching: boolean;
}

const cache = new Map<string, Entry>();
const hashKey = (key: QueryKey) => JSON.stringify(key);

function getEntry(key: QueryKey): Entry {
  const h = hashKey(key);
  let e = cache.get(h);
  if (!e) {
    e = {
      key,
      data: undefined,
      error: null,
      status: 'idle',
      updatedAt: 0,
      stale: true,
      promise: null,
      fetcher: null,
      listeners: new Set(),
      snapshot: { data: undefined, error: null, status: 'idle', isFetching: false },
    };
    cache.set(h, e);
  }
  return e;
}

function emit(e: Entry) {
  e.snapshot = { data: e.data, error: e.error, status: e.status, isFetching: e.promise !== null };
  e.listeners.forEach((l) => l());
}

function fetchEntry(e: Entry): Promise<unknown> {
  if (e.promise) return e.promise;
  if (!e.fetcher) return Promise.resolve(e.data);
  if (e.data === undefined) e.status = 'loading';
  const p = e.fetcher().then(
    (data) => {
      if (e.promise !== p) return data; // superseded
      e.data = data;
      e.error = null;
      e.status = 'success';
      e.updatedAt = Date.now();
      e.stale = false;
      e.promise = null;
      emit(e);
      return data;
    },
    (error: unknown) => {
      if (e.promise !== p) return e.data;
      e.error = error;
      e.status = e.data === undefined ? 'error' : 'success';
      e.promise = null;
      emit(e);
      return e.data;
    },
  );
  e.promise = p;
  emit(e);
  return p;
}

const startsWith = (key: QueryKey, prefix: QueryKey) =>
  prefix.every((part, i) => JSON.stringify(part) === JSON.stringify(key[i]));

/** Marks matching queries stale; ones currently on screen refetch immediately. */
export function invalidateQueries(prefix: QueryKey) {
  for (const e of cache.values()) {
    if (!startsWith(e.key, prefix)) continue;
    e.stale = true;
    if (e.listeners.size > 0) {
      e.promise = null; // force a fresh request even if one is in flight
      void fetchEntry(e);
    }
  }
}

export function getQueryData<T>(key: QueryKey): T | undefined {
  return cache.get(hashKey(key))?.data as T | undefined;
}

export function setQueryData<T>(key: QueryKey, updater: T | ((old: T | undefined) => T)) {
  const e = getEntry(key);
  e.data = typeof updater === 'function' ? (updater as (old: T | undefined) => T)(e.data as T | undefined) : updater;
  e.status = 'success';
  emit(e);
}

/** Applies `updater` to every cached query under `prefix` that has data. */
export function updateQueries(prefix: QueryKey, updater: (data: unknown, key: QueryKey) => unknown) {
  for (const e of cache.values()) {
    if (e.data === undefined || !startsWith(e.key, prefix)) continue;
    const next = updater(e.data, e.key);
    if (next !== e.data) {
      e.data = next;
      emit(e);
    }
  }
}

export function clearQueries() {
  cache.clear();
}

export interface UseQueryOptions {
  enabled?: boolean;
  /** ms before cached data is refetched on mount (default 30s). */
  staleTime?: number;
  /** Keep showing the previous key's data while the new key loads. */
  keepPrevious?: boolean;
}

export interface UseQueryResult<T> {
  data: T | undefined;
  error: unknown;
  /** No data yet and a request is running. */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

export function useQuery<T>(
  key: QueryKey,
  fetcher: () => Promise<T>,
  { enabled = true, staleTime = 30_000, keepPrevious = false }: UseQueryOptions = {},
): UseQueryResult<T> {
  const h = hashKey(key);
  const entry = getEntry(key);
  entry.fetcher = fetcher as () => Promise<unknown>;

  const subscribe = useCallback(
    (cb: () => void) => {
      const e = getEntry(JSON.parse(h) as QueryKey);
      e.listeners.add(cb);
      return () => e.listeners.delete(cb);
    },
    [h],
  );
  const snap = useSyncExternalStore(
    subscribe,
    () => getEntry(JSON.parse(h) as QueryKey).snapshot,
  ) as Snapshot<T>;

  useEffect(() => {
    if (!enabled) return;
    const e = getEntry(JSON.parse(h) as QueryKey);
    if (e.stale || Date.now() - e.updatedAt > staleTime || e.data === undefined) void fetchEntry(e);
  }, [h, enabled, staleTime]);

  const previous = useRef<T | undefined>(undefined);
  if (snap.data !== undefined) previous.current = snap.data;
  const data = snap.data ?? (keepPrevious ? previous.current : undefined);

  return {
    data,
    error: snap.error,
    isLoading: enabled && data === undefined && snap.status !== 'error',
    isFetching: snap.isFetching,
    isError: snap.status === 'error',
    refetch: () => fetchEntry(getEntry(JSON.parse(h) as QueryKey)),
  };
}

/** Refetch everything on screen when the tab regains focus or the network returns. */
export function refetchActiveQueries() {
  for (const e of cache.values()) {
    if (e.listeners.size > 0) {
      e.stale = true;
      void fetchEntry(e);
    }
  }
}
