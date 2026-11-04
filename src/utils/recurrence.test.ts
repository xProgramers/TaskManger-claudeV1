import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstOccurrence, nextOccurrence, recurrenceLabel } from './recurrence.ts';

// Friday, 2 Oct 2026.
const today = '2026-10-02';

test('next date after completing on time', () => {
  assert.equal(nextOccurrence('daily', today, today), '2026-10-03');
  assert.equal(nextOccurrence('weekdays', today, today), '2026-10-05'); // skips the weekend
  assert.equal(nextOccurrence('weekly', today, today), '2026-10-09');
  assert.equal(nextOccurrence('monthly', today, today), '2026-11-02');
  assert.equal(nextOccurrence('yearly', today, today), '2027-10-02');
});

test('overdue tasks skip the missed dates', () => {
  assert.equal(nextOccurrence('daily', '2026-09-20', today), '2026-10-03');
  assert.equal(nextOccurrence('weekly', '2026-09-21', today), '2026-10-05'); // still on Mondays
  assert.equal(nextOccurrence('weekly', '2026-09-25', today), '2026-10-09'); // a Friday, 1 week late
  assert.equal(nextOccurrence('monthly', '2026-08-15', today), '2026-10-15');
  assert.equal(nextOccurrence('yearly', '2025-12-25', today), '2026-12-25');
});

test('completing early moves from the due date', () => {
  assert.equal(nextOccurrence('daily', '2026-10-06', today), '2026-10-07');
  assert.equal(nextOccurrence('weekly', '2026-10-06', today), '2026-10-13');
});

test('months without the day use their last day', () => {
  assert.equal(nextOccurrence('monthly', '2027-01-31', '2027-01-31'), '2027-02-28');
  assert.equal(nextOccurrence('yearly', '2028-02-29', '2028-02-29'), '2029-02-28');
});

test('first date and labels', () => {
  assert.equal(firstOccurrence('weekdays', '2026-10-03'), '2026-10-05');
  assert.equal(firstOccurrence('daily', '2026-10-03'), '2026-10-03');
  assert.equal(recurrenceLabel('weekly', '2026-10-05'), 'Toda segunda');
  assert.equal(recurrenceLabel('weekly', '2026-10-03'), 'Todo sábado');
  assert.equal(recurrenceLabel('monthly', '2026-10-05'), 'Todo dia 5');
  assert.equal(recurrenceLabel('daily'), 'Todo dia');
});
