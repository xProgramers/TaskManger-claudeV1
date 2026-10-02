/**
 * User preferences (the `profiles` row) + everything derived from them that
 * the whole UI needs: the user's time zone, "today" in that zone (kept fresh
 * across midnight), time format, first weekday and the applied theme.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DateContext, ISODate, ThemePreference, TimeFormat, UserPreferences, UserPreferencesPatch } from '@/types';
import { api } from '@/services';
import { setQueryData, useQuery } from '@/lib/query';
import { browserTimeZone, todayIn } from '@/utils/dates';
import { toAppError } from '@/utils/errors';

interface PreferencesValue {
  prefs: UserPreferences | undefined;
  loading: boolean;
  timezone: string;
  today: ISODate;
  timeFormat: TimeFormat;
  weekStartsOn: 0 | 1;
  dateContext: DateContext;
  update: (patch: UserPreferencesPatch) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);
const THEME_KEY = 'prumo:theme';
export const PROFILE_KEY = ['profile'] as const;

function applyTheme(theme: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore (private mode)
  }
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Re-renders when the calendar day changes in `timezone`. */
function useToday(timezone: string): ISODate {
  const [today, setToday] = useState(() => todayIn(timezone));
  useEffect(() => {
    setToday(todayIn(timezone));
    const id = setInterval(() => setToday(todayIn(timezone)), 30_000);
    const onVisible = () => document.visibilityState === 'visible' && setToday(todayIn(timezone));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [timezone]);
  return today;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { data: prefs, isLoading } = useQuery(PROFILE_KEY, () => api.profile.get(), { staleTime: 5 * 60_000 });

  const timezone = prefs?.timezone ?? browserTimeZone();
  const today = useToday(timezone);
  const theme = prefs?.theme;

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const update = useCallback(
    async (patch: UserPreferencesPatch) => {
      const before = prefs;
      if (before) setQueryData<UserPreferences>(PROFILE_KEY, { ...before, ...patch }); // optimistic
      if (patch.theme) applyTheme(patch.theme);
      try {
        const saved = await api.profile.update(patch);
        setQueryData<UserPreferences>(PROFILE_KEY, saved);
      } catch (e) {
        if (before) {
          setQueryData<UserPreferences>(PROFILE_KEY, before);
          applyTheme(before.theme);
        }
        throw toAppError(e, 'Não foi possível salvar suas preferências.');
      }
    },
    [prefs],
  );

  const value = useMemo<PreferencesValue>(() => {
    const weekStartsOn = (prefs?.week_starts_on ?? 0) as 0 | 1;
    return {
      prefs,
      loading: isLoading,
      timezone,
      today,
      timeFormat: prefs?.time_format ?? '24h',
      weekStartsOn,
      dateContext: { timezone, today, weekStartsOn },
      update,
    };
  }, [prefs, isLoading, timezone, today, update]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
