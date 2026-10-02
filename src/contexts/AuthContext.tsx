import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/types';
import { api } from '@/services';
import { clearQueries } from '@/lib/query';
import { useRouter } from '@/lib/router';

interface AuthValue {
  user: AuthUser | null;
  /** True until the stored session has been checked. */
  initializing: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const { navigate } = useRouter();

  useEffect(() => {
    let alive = true;
    api.auth
      .getUser()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setInitializing(false));

    const unsubscribe = api.auth.onChange((u, event) => {
      setUser((prev) => {
        // Never keep another user's cached data around.
        if (prev?.id !== u?.id) clearQueries();
        return u;
      });
      if (event === 'PASSWORD_RECOVERY') navigate('/redefinir-senha');
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [navigate]);

  const signOut = useCallback(async () => {
    await api.auth.signOut();
    clearQueries();
    setUser(null);
    navigate('/entrar', { replace: true });
  }, [navigate]);

  const value = useMemo(() => ({ user, initializing, signOut }), [user, initializing, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
