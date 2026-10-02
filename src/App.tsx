import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { matchPath, RouterProvider, useRouter } from '@/lib/router';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { TaskUIProvider } from '@/contexts/TaskUIContext';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from '@/pages/AuthPages';
import { TodayPage } from '@/pages/TodayPage';
import { UpcomingPage } from '@/pages/UpcomingPage';
import { AllTasksPage } from '@/pages/AllTasksPage';
import { CompletedPage } from '@/pages/CompletedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LogoMark } from '@/components/icons';
import { Spinner } from '@/components/ui/Spinner';

// Heavier, less frequent screens are split into their own chunks.
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const BoardPage = lazy(() => import('@/pages/BoardPage').then((m) => ({ default: m.BoardPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const PUBLIC_ROUTES: Partial<Record<string, () => ReactNode>> = {
  '/entrar': () => <LoginPage />,
  '/cadastro': () => <SignupPage />,
  '/recuperar-senha': () => <ForgotPasswordPage />,
};

const TITLES: Record<string, string> = {
  '/': 'Hoje',
  '/proximas': 'Próximas',
  '/todas': 'Todas as tarefas',
  '/calendario': 'Calendário',
  '/quadro': 'Quadro',
  '/concluidas': 'Concluídas',
  '/configuracoes': 'Configurações',
  '/entrar': 'Entrar',
  '/cadastro': 'Criar conta',
  '/recuperar-senha': 'Recuperar senha',
  '/redefinir-senha': 'Nova senha',
};

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Carregando">
      <div className="animate-pulse-soft">
        <LogoMark size={36} />
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex justify-center pt-24 text-ink-3" role="status" aria-label="Carregando">
      <Spinner size={20} />
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  const { navigate } = useRouter();
  useEffect(() => navigate(to, { replace: true }), [navigate, to]);
  return null;
}

function AppRoutes() {
  const { path } = useRouter();
  const categoryMatch = matchPath('/categoria/:id', path);
  switch (path) {
    case '/':
      return <TodayPage />;
    case '/proximas':
      return <UpcomingPage />;
    case '/todas':
      return <AllTasksPage />;
    case '/calendario':
      return <CalendarPage />;
    case '/quadro':
      return <BoardPage />;
    case '/concluidas':
      return <CompletedPage />;
    case '/configuracoes':
      return <SettingsPage />;
  }
  if (categoryMatch) return <AllTasksPage categoryId={categoryMatch.id} />;
  return <NotFoundPage />;
}

function Root() {
  const { user, initializing } = useAuth();
  const { path } = useRouter();

  useEffect(() => {
    document.title = TITLES[path] ? `${TITLES[path]} · Prumo` : 'Prumo';
  }, [path]);

  if (initializing) return <Splash />;

  // Reachable from the recovery e-mail, with or without a full session.
  if (path === '/redefinir-senha') return <ResetPasswordPage />;

  const publicRoute = PUBLIC_ROUTES[path];
  if (!user) return publicRoute ? publicRoute() : <Redirect to="/entrar" />;
  if (publicRoute) return <Redirect to="/" />;

  return (
    <PreferencesProvider key={user.id}>
      <TaskUIProvider>
        <AppLayout>
          <Suspense fallback={<PageFallback />}>
            <AppRoutes />
          </Suspense>
        </AppLayout>
      </TaskUIProvider>
    </PreferencesProvider>
  );
}

export function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
