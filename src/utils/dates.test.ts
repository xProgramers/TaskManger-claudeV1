import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  addMonths,
  computeDueAt,
  formatTime,
  monthGrid,
  relativeDayLabel,
  startOfWeek,
  todayIn,
  zonedToInstant,
  formatDayLong,
  formatMonthYear,
  weekdayLabels,
} from './dates.ts';

test('wall clock in São Paulo maps to the right UTC instant (spec §35)', () => {
  // 18:00 in Brazil must be 21:00Z, never 15:00 or 18:00.
  assert.equal(zonedToInstant('2026-10-05', '18:00', 'America/Sao_Paulo').toISOString(), '2026-10-05T21:00:00.000Z');
  // Spec §34 example: 14:00 − 15 min => 13:45 local = 16:45Z
  const due = zonedToInstant('2026-10-05', '14:00', 'America/Sao_Paulo').getTime();
  assert.equal(new Date(due - 15 * 60_000).toISOString(), '2026-10-05T16:45:00.000Z');
});

test('zones with DST resolve correctly on both sides of the change', () => {
  // New York: EDT (-4) in October, EST (-5) in December.
  assert.equal(zonedToInstant('2026-10-05', '09:00', 'America/New_York').toISOString(), '2026-10-05T13:00:00.000Z');
  assert.equal(zonedToInstant('2026-12-05', '09:00', 'America/New_York').toISOString(), '2026-12-05T14:00:00.000Z');
});

test('todayIn uses the user zone, not the machine zone', () => {
  const instant = new Date('2026-10-03T01:30:00Z'); // 22:30 on Oct 2 in São Paulo
  assert.equal(todayIn('America/Sao_Paulo', instant), '2026-10-02');
  assert.equal(todayIn('UTC', instant), '2026-10-03');
});

test('date-only deadline is the last second of the day in the zone', () => {
  assert.equal(computeDueAt('2026-10-05', null, 'America/Sao_Paulo'), '2026-10-06T02:59:59.000Z');
  assert.equal(computeDueAt('2026-10-05', '18:00', 'America/Sao_Paulo'), '2026-10-05T21:00:00.000Z');
  assert.equal(computeDueAt(null, null, 'America/Sao_Paulo'), null);
});

test('calendar arithmetic', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-01');
  assert.equal(startOfWeek('2026-10-02', 0), '2026-09-27'); // sunday start
  assert.equal(startOfWeek('2026-10-02', 1), '2026-09-28'); // monday start
  const grid = monthGrid('2026-10-15', 1);
  assert.equal(grid.length, 42);
  assert.equal(grid[0], '2026-09-28');
  assert.ok(grid.includes('2026-10-31'));
});

test('pt-BR labels', () => {
  assert.equal(relativeDayLabel('2026-10-02', '2026-10-02'), 'Hoje');
  assert.equal(relativeDayLabel('2026-10-03', '2026-10-02'), 'Amanhã');
  assert.equal(relativeDayLabel('2026-10-01', '2026-10-02'), 'Ontem');
  assert.equal(relativeDayLabel('2026-10-08', '2026-10-02'), 'Quinta-feira');
  assert.equal(relativeDayLabel('2026-10-20', '2026-10-02'), '20 de outubro');
  assert.equal(relativeDayLabel('2027-01-20', '2026-10-02'), '20 de janeiro de 2027');
  assert.equal(formatDayLong('2026-10-02'), 'sexta-feira, 2 de outubro');
  assert.equal(formatMonthYear('2026-10-02'), 'Outubro 2026');
  assert.deepEqual(weekdayLabels(1), ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
});

test('time formats', () => {
  assert.equal(formatTime('18:00:00', '24h'), '18:00');
  assert.equal(formatTime('18:00', '12h'), '6:00 PM');
  assert.equal(formatTime('00:15', '12h'), '12:15 AM');
  assert.equal(formatTime('09:05', '24h'), '09:05');
});
