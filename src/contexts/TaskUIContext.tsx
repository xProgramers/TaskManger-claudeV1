import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ISODate, ISOTime } from '@/types';

export interface CreateDefaults {
  title?: string;
  due_date?: ISODate | null;
  due_time?: ISOTime | null;
  category_id?: string | null;
}

interface TaskUIValue {
  createOpen: boolean;
  createDefaults: CreateDefaults;
  openCreate: (defaults?: CreateDefaults) => void;
  closeCreate: () => void;
  taskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  categoriesOpen: boolean;
  openCategories: () => void;
  closeCategories: () => void;
}

const TaskUIContext = createContext<TaskUIValue | null>(null);

export function TaskUIProvider({ children }: { children: ReactNode }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<CreateDefaults>({});
  const [taskId, setTaskId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const openCreate = useCallback((defaults: CreateDefaults = {}) => {
    setCreateDefaults(defaults);
    setCreateOpen(true);
  }, []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);
  const openTask = useCallback((id: string) => {
    setSearchOpen(false);
    setTaskId(id);
  }, []);
  const closeTask = useCallback(() => setTaskId(null), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openCategories = useCallback(() => setCategoriesOpen(true), []);
  const closeCategories = useCallback(() => setCategoriesOpen(false), []);

  const value = useMemo(
    () => ({
      createOpen,
      createDefaults,
      openCreate,
      closeCreate,
      taskId,
      openTask,
      closeTask,
      searchOpen,
      openSearch,
      closeSearch,
      categoriesOpen,
      openCategories,
      closeCategories,
    }),
    [createOpen, createDefaults, openCreate, closeCreate, taskId, openTask, closeTask, searchOpen, openSearch, closeSearch, categoriesOpen, openCategories, closeCategories],
  );
  return <TaskUIContext.Provider value={value}>{children}</TaskUIContext.Provider>;
}

export function useTaskUI(): TaskUIValue {
  const ctx = useContext(TaskUIContext);
  if (!ctx) throw new Error('useTaskUI must be used inside TaskUIProvider');
  return ctx;
}
