/**
 * Quick add: deterministic pt-BR parser for one-line task entry.
 *
 *   "Comprar ração amanhã às 18h"  ->  title "Comprar ração", date +1, 18:00
 *
 * It is intentionally rule-based (no AI): every match becomes a visible chip
 * in the UI, so the user always sees what was understood and can undo it.
 * Recognised:
 *   dates     hoje, amanhã, depois de amanhã, segunda…domingo (próxima …),
 *             dia 15, 15/10, 15/10/2026
 *   times     18h, 18h30, 18:30, às 9, meio-dia, "9h da noite"
 *   priority  !alta  !média  !baixa
 *   category  #nome  (only when a category with that name exists)
 */
import type { ISODate, ISOTime, TaskPriority } from '../types/index.ts';
import { addDays, isValidISODate, parseDate, toISODate, weekdayOf } from './dates.ts';

export type QuickTokenKind = 'date' | 'time' | 'priority' | 'category';

export interface QuickToken {
  kind: QuickTokenKind;
  start: number;
  end: number;
  text: string;
}

export interface QuickParseResult {
  title: string;
  date: ISODate | null;
  time: ISOTime | null;
  priority: TaskPriority | null;
  categoryId: string | null;
  tokens: QuickToken[];
}

export interface QuickParseContext {
  today: ISODate;
  /** "HH:MM" now in the user's zone, used to place a bare time today or tomorrow. */
  nowTime: ISOTime;
  categories?: { id: string; name: string }[];
  /** Token kinds the user dismissed; they stay part of the title. */
  ignore?: QuickTokenKind[];
}

/** Lowercase + strip accents while keeping string length (1:1 index mapping). */
export function foldText(s: string): string {
  let out = '';
  for (const ch of s) {
    const base = ch.normalize('NFD')[0] ?? ch;
    out += ch.length === base.length ? base.toLowerCase() : ch.toLowerCase();
  }
  return out;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const pad = (n: number) => String(n).padStart(2, '0');

// Optional connector before a token ("no", "na", "às", "para", "em", "dia").
const LEAD = String.raw`(?:^|\s)(?:(?:para|pra|no|na|em|as|ate)\s+)?`;
const END = String.raw`(?=$|[\s,.;!?])`;

interface Rule {
  kind: QuickTokenKind;
  re: RegExp;
  resolve: (m: RegExpExecArray, ctx: QuickParseContext) => Partial<QuickParseResult> | null;
}

/** Next occurrence of a weekday ("sexta" said on a Friday means next Friday). */
function nextWeekday(today: ISODate, target: number): ISODate {
  const delta = (target - weekdayOf(today) + 7) % 7 || 7;
  return addDays(today, delta);
}

function dayOfMonth(today: ISODate, day: number, month?: number, year?: number): ISODate | null {
  const t = parseDate(today);
  const y = year ?? t.getUTCFullYear();
  const m = month ?? t.getUTCMonth() + 1;
  let candidate = `${y}-${pad(m)}-${pad(day)}`;
  if (!isValidISODate(candidate)) return null;
  if (candidate < today && year === undefined) {
    // Past date without explicit year: roll forward (next month or next year).
    const d = parseDate(candidate);
    if (month === undefined) d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    candidate = toISODate(d);
    if (!isValidISODate(candidate) || Number(candidate.slice(8)) !== day) return null;
  }
  return candidate;
}

function toTime(h: number, m: number, period?: string): ISOTime | null {
  let hour = h;
  if (period && /tarde|noite/.test(period) && hour < 12) hour += 12;
  if (period && /manha/.test(period) && hour === 12) hour = 0;
  if (hour > 23 || m > 59) return null;
  return `${pad(hour)}:${pad(m)}`;
}

const RULES: Rule[] = [
  {
    kind: 'date',
    re: new RegExp(`${LEAD}(depois de amanha)${END}`, 'g'),
    resolve: (_m, ctx) => ({ date: addDays(ctx.today, 2) }),
  },
  {
    kind: 'date',
    re: new RegExp(`${LEAD}(hoje|amanha)${END}`, 'g'),
    resolve: (m, ctx) => ({ date: m[1] === 'hoje' ? ctx.today : addDays(ctx.today, 1) }),
  },
  {
    kind: 'date',
    re: new RegExp(
      `${LEAD}(?:(proxim[oa]|prox\\.?|nest[ea]|ness[ea])\\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?${END}`,
      'g',
    ),
    resolve: (m, ctx) => ({ date: nextWeekday(ctx.today, WEEKDAYS[m[2]]) }),
  },
  {
    kind: 'date',
    re: new RegExp(`${LEAD}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?${END}`, 'g'),
    resolve: (m, ctx) => {
      const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
      const date = dayOfMonth(ctx.today, Number(m[1]), Number(m[2]), year);
      return date ? { date } : null;
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${LEAD}dia\\s+(\\d{1,2})${END}`, 'g'),
    resolve: (m, ctx) => {
      const date = dayOfMonth(ctx.today, Number(m[1]));
      return date ? { date } : null;
    },
  },
  {
    kind: 'time',
    re: new RegExp(`${LEAD}(meio-dia|meio dia|meia-noite|meia noite)${END}`, 'g'),
    resolve: (m) => ({ time: m[1].startsWith('meio') ? '12:00' : '00:00' }),
  },
  {
    kind: 'time',
    // 18h, 18h30, 18hs, 18:30 — optional "da manhã/tarde/noite"
    re: new RegExp(`${LEAD}(\\d{1,2})(?:hs?(\\d{2})?|:(\\d{2}))(?:\\s+da\\s+(manha|tarde|noite))?${END}`, 'g'),
    resolve: (m) => {
      const time = toTime(Number(m[1]), Number(m[2] ?? m[3] ?? 0), m[4]);
      return time ? { time } : null;
    },
  },
  {
    kind: 'time',
    // "às 9", "às 7 da noite" (a bare number needs the "às")
    re: new RegExp(`(?:^|\\s)(?:(?:para|pra|ate)\\s+)?as\\s+(\\d{1,2})(?:\\s+da\\s+(manha|tarde|noite))?${END}`, 'g'),
    resolve: (m) => {
      const time = toTime(Number(m[1]), 0, m[2]);
      return time ? { time } : null;
    },
  },
  {
    kind: 'priority',
    re: new RegExp(`(?:^|\\s)!(alta|media|baixa)${END}`, 'g'),
    resolve: (m) => ({ priority: ({ alta: 'high', media: 'medium', baixa: 'low' } as const)[m[1] as 'alta'] }),
  },
  {
    kind: 'category',
    re: new RegExp(`(?:^|\\s)#([\\p{L}\\p{N}_-]+)${END}`, 'gu'),
    resolve: (m, ctx) => {
      const wanted = m[1];
      const match = ctx.categories?.find((c) => foldText(c.name).replace(/\s+/g, '-') === wanted);
      return match ? { categoryId: match.id } : null;
    },
  },
];

export function parseQuickAdd(input: string, ctx: QuickParseContext): QuickParseResult {
  const folded = foldText(input);
  const result: QuickParseResult = {
    title: input.trim(),
    date: null,
    time: null,
    priority: null,
    categoryId: null,
    tokens: [],
  };
  const taken: [number, number][] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  for (const rule of RULES) {
    if (ctx.ignore?.includes(rule.kind)) continue;
    if (result.tokens.some((t) => t.kind === rule.kind)) continue; // first match per kind wins
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(folded))) {
      // Skip the leading whitespace captured by (?:^|\s).
      const start = m.index + (m[0].length - m[0].trimStart().length);
      const end = m.index + m[0].length;
      if (overlaps(start, end)) continue;
      const resolved = rule.resolve(m, ctx);
      if (!resolved) continue;
      Object.assign(result, resolved);
      taken.push([start, end]);
      result.tokens.push({ kind: rule.kind, start, end, text: input.slice(start, end) });
      break;
    }
  }

  // A time without a date means the next occurrence of that time.
  if (result.time && !result.date) {
    result.date = result.time > ctx.nowTime ? ctx.today : addDays(ctx.today, 1);
  }

  if (result.tokens.length > 0) {
    let title = '';
    let cursor = 0;
    for (const t of [...result.tokens].sort((a, b) => a.start - b.start)) {
      title += input.slice(cursor, t.start) + ' ';
      cursor = t.end;
    }
    title += input.slice(cursor);
    result.title = title
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;])/g, '$1')
      .replace(/[\s,;-]+$/g, '')
      .trim();
  }

  result.tokens.sort((a, b) => a.start - b.start);
  return result;
}
