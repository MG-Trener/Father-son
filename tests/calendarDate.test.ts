import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarMonths, formatCalendarDate, parseIsoDay, toIsoDay } from '../src/domain/calendarDate.ts';

test('calendar dates preserve the selected local day at noon', () => {
  const date = parseIsoDay('2027-10-07')!;
  assert.equal(date.getHours(), 12);
  assert.equal(toIsoDay(date), '2027-10-07');
  assert.match(formatCalendarDate('2027-10-07'), /7 октября 2027/);
});
test('invalid and impossible calendar dates are rejected', () => {
  for (const input of ['', '2027-02-29', '2026-13-01', '07.10.2026']) assert.equal(parseIsoDay(input), null);
  assert.equal(toIsoDay(parseIsoDay('2028-02-29')!), '2028-02-29');
});
test('quick month and year choices clamp month-end and leap day', () => {
  assert.equal(toIsoDay(addCalendarMonths(new Date(2027, 0, 31), 1)), '2027-02-28');
  assert.equal(toIsoDay(addCalendarMonths(new Date(2028, 1, 29), 12)), '2029-02-28');
});
