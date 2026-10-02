import { useEffect, type ReactNode } from 'react';
import { refetchActiveQueries } from '@/lib/query';
import { useRouter } from '@/lib/router';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useHotkeys, useMediaQuery } from '@/hooks/useUtils';
import { useReminderDelivery } from '@/hooks/useNotifications';
import { Sidebar, MobileNav } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { TaskModal } from '@/components/TaskModal';
import { TaskDetails } from '@/components/TaskDetails';
import { SearchPalette } from '@/components/SearchPalette';
import { CategoryManager } from '@/components/CategoryManager';
import { hasOpenLayer } from '@/components/ui/Layer';
import { PlusIcon } from '@/components/icons';

export function AppLayout({ children }: { children: ReactNode }) {
  const { openCreate, openSearch, openTask, searchOpen, closeSearch } = useTaskUI();
  const { search, path, navigate } = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px)');

  useReminderDelivery(openTask);

  useHotkeys([
    { combo: 'mod+k', allowInInputs: true, handler: () => (searchOpen ? closeSearch() : openSearch()) },
    { combo: 'n', handler: () => !hasOpenLayer() && openCreate() },
    { combo: '/', handler: () => !hasOpenLayer() && openSearch() },
  ]);

  // Deep link from a notification: /?task=<id>
  const linkedTask = search.get('task');
  useEffect(() => {
    if (!linkedTask) return;
    openTask(linkedTask);
    navigate(path, { replace: true });
  }, [linkedTask, openTask, navigate, path]);

  // Fresh data when coming back to the tab or the network returns.
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && refetchActiveQueries();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', refetchActiveQueries);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', refetchActiveQueries);
    };
  }, []);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-sm bg-surface px-3 py-2 text-base font-medium text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      {isTablet && <Sidebar compact={!isDesktop} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="conteudo" tabIndex={-1} className="flex-1 px-4 pt-6 pb-28 focus:outline-none md:px-8 md:pt-8 md:pb-16">
          {children}
        </main>
      </div>

      {!isTablet && (
        <>
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="Nova tarefa"
            className="fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 flex size-13 items-center justify-center rounded-full bg-accent text-accent-ink shadow-float active:scale-95"
          >
            <PlusIcon size={22} strokeWidth={2.25} />
          </button>
          <MobileNav />
        </>
      )}

      <TaskModal />
      <TaskDetails />
      <SearchPalette />
      <CategoryManager />
    </div>
  );
}
