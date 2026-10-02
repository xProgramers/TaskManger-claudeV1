/**
 * Date utilities.
 *
 * Two kinds of values flow through the app and are never mixed:
 *
 *  - Calendar values (ISODate "YYYY-MM-DD", ISOTime "HH:MM"): what the user
 *    picked, in *their* time zone. Arithmetic on them is done on UTC-midnight
 *    Date objects, so DST and the browser's own zone can never shift a day.
 *  - Instants (ISO strings with offset, e.g. due_at, completed_at): absolute
 *    moments, converted to the user's configured zone only for display.
 *
 * Only `Intl` is used — no date library needed.
 */
import type { ISODate, ISOTime, TimeFormat } from '../types/index.ts';

export const MS_PER_DAY = 86_400_000;
const LOCALE = 'pt-BR';

const pad = (n: number) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Time zone conversion
// ---------------------------------------------------------------------------

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock parts of an instant as seen in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset (ms) of `timeZone` from UTC at a given instant. São Paulo => -3h. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock date/time in `timeZone` to an absolute instant.
 * Same semantics as Postgres `(date + time) AT TIME ZONE tz`.
 */
export function zonedToInstant(date: ISODate, time: ISOTime, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle offsets that change around the target (DST edges).
  let guess = naiveUtc - zoneOffsetMs(new Date(naiveUtc), timeZone);
  guess = naiveUtc - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function nowTimeIn(timeZone: string, now: Date = new Date()): ISOTime {
  const p = zonedParts(now, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Calendar date of an instant in the given zone. */
export function instantToDate(instant: string | Date, timeZone: string): ISODate {
  return todayIn(timeZone, typeof instant === 'string' ? new Date(instant) : instant);
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

/** Deadline instant, mirroring the database's `due_at` derivation. */
export function computeDueAt(date: ISODate | null, time: ISOTime | null, timeZone: string): string | null {
  if (!date) return null;
  if (time) return zonedToInstant(date, time, timeZone).toISOString();
  const nextDay = zonedToInstant(addDays(date, 1), '00:00', timeZone);
  return new Date(nextDay.getTime() - 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Calendar arithmetic on ISODate (always via UTC midnight)
// ---------------------------------------------------------------------------

export function parseDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): ISODate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return toISODate(new Date(parseDate(iso).getTime() + days * MS_PER_DAY));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / MS_PER_DAY);
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(iso: ISODate): number {
  return parseDate(iso).getUTCDay();
}

export function startOfWeek(iso: ISODate, weekStartsOn: 0 | 1): ISODate {
  const delta = (weekdayOf(iso) - weekStartsOn + 7) % 7;
  return addDays(iso, -delta);
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const d = parseDate(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISODate(d);
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** 6 weeks × 7 days covering the month of `iso`. */
export function monthGrid(iso: ISODate, weekStartsOn: 0 | 1): ISODate[] {
  const first = startOfWeek(startOfMonth(iso), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDays(iso: ISODate, weekStartsOn: 0 | 1): ISODate[] {
  const first = startOfWeek(iso, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseDate(value)) === value;
}

// ---------------------------------------------------------------------------
// Formatting (pt-BR)
// ---------------------------------------------------------------------------

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, options: Intl.DateTimeFormatOptions) {
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, options);
    fmtCache.set(key, f);
  }
  return f;
}

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase(LOCALE) + s.slice(1);
}

/** "sexta-feira, 2 de outubro" */
export function formatDayLong(iso: ISODate): string {
  return fmt('dayLong', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parseDate(iso));
}

/** "2 de outubro" (+ " de 2027" when not in `currentYear`) */
export function formatDayMonth(iso: ISODate, currentYear?: number): string {
  const d = parseDate(iso);
  const withYear = currentYear !== undefined && d.getUTCFullYear() !== currentYear;
  return withYear
    ? fmt('dmy', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
    : fmt('dm', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
}

/** "2 out" */
export function formatDayMonthShort(iso: ISODate): string {
  return fmt('dmShort', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(parseDate(iso))
    .replace(/\./g, '')
    .replace(' de ', ' ');
}

/** "Outubro 2026" */
export function formatMonthYear(iso: ISODate): string {
  const d = parseDate(iso);
  return `${capitalize(fmt('month', { month: 'long', timeZone: 'UTC' }).format(d))} ${d.getUTCFullYear()}`;
}

/** "Sexta-feira" */
export function formatWeekday(iso: ISODate): string {
  return capitalize(fmt('weekday', { weekday: 'long', timeZone: 'UTC' }).format(parseDate(iso)));
}

/** "Sex" */
export function formatWeekdayShort(iso: ISODate): string {
  return capitalize(fmt('weekdayShort', { weekday: 'short', timeZone: 'UTC' }).format(parseDate(iso)).replace('.', ''));
}

/** Short weekday labels in display order for a week starting at `weekStartsOn`. */
export function weekdayLabels(weekStartsOn: 0 | 1): string[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => formatWeekdayShort(addDays('2023-01-01', i + weekStartsOn)));
}

/**
 * Human label for a day relative to today:
 * "Hoje", "Amanhã", "Ontem", "Quinta-feira" (within the next 6 days),
 * otherwise "2 de outubro".
 */
export function relativeDayLabel(iso: ISODate, today: ISODate): string {
  const diff = diffDays(iso, today);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  if (diff > 1 && diff < 7) return formatWeekday(iso);
  return formatDayMonth(iso, parseDate(today).getUTCFullYear());
}

export function normalizeTime(time: ISOTime): ISOTime {
  return time.slice(0, 5);
}

/** "18:00" or "6:00 PM" */
export function formatTime(time: ISOTime, format: TimeFormat): string {
  const [h, m] = normalizeTime(time).split(':').map(Number);
  if (format === '24h') return `${pad(h)}:${pad(m)}`;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** Instant shown in the user's zone: "2 de outubro, 18:00". */
export function formatInstant(instant: string, timeZone: string, format: TimeFormat, today?: ISODate): string {
  const date = instantToDate(instant, timeZone);
  const p = zonedParts(new Date(instant), timeZone);
  const time = formatTime(`${pad(p.hour)}:${pad(p.minute)}`, format);
  const day = today ? relativeDayLabel(date, today) : formatDayMonth(date);
  return `${day}, ${time}`;
}

/** "agora", "há 5 min", "há 2 h", then falls back to formatInstant. */
export function formatRelativeInstant(
  instant: string,
  timeZone: string,
  format: TimeFormat,
  now: Date = new Date(),
): string {
  const diffMin = Math.round((now.getTime() - new Date(instant).getTime()) / 60_000);
  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffMin < 6 * 60) return `Há ${Math.floor(diffMin / 60)} h`;
  return formatInstant(instant, timeZone, format, todayIn(timeZone, now));
}

/** "15 minutos antes", "No horário", "1 dia antes" */
export function formatReminderOffset(minutes: number | null): string {
  if (minutes === null) return 'Sem lembrete';
  if (minutes === 0) return 'No horário';
  if (minutes < 60) return `${minutes} minutos antes`;
  if (minutes === 60) return '1 hora antes';
  if (minutes === 1440) return '1 dia antes';
  return `${minutes} minutos antes`;
}

/** Lists IANA zones when the runtime supports it; otherwise a short common list. */
export function availableTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones;
  } catch {
    // fall through
  }
  return [
    'America/Sao_Paulo',
    'America/Manaus',
    'America/Belem',
    'America/Fortaleza',
    'America/Recife',
    'America/Cuiaba',
    'America/Rio_Branco',
    'America/Noronha',
    'America/New_York',
    'Europe/Lisbon',
    'UTC',
  ];
}
