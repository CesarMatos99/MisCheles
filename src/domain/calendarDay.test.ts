import assert from 'node:assert/strict';
import test from 'node:test';
import { isCalendarDayInMonth, parseCalendarDay } from './calendarDay.ts';
test('calendar filters reject rollover dates and preserve valid leap days', () => {
  assert.equal(parseCalendarDay('2024-02-29').getDate(), 29);
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '', '2026-1-01', '2026-01-00']) assert.ok(Number.isNaN(parseCalendarDay(value).getTime()), value);
});

test('income dates belong to the selected accounting month', () => {
  assert.equal(isCalendarDayInMonth('2026-11-02', '2026-11'), true);
  assert.equal(isCalendarDayInMonth('2026-10-31', '2026-11'), false);
  assert.equal(isCalendarDayInMonth('2026-11-31', '2026-11'), false);
  assert.equal(isCalendarDayInMonth('2026-11-02', '2026-13'), false);
});
