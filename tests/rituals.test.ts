import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRitualCadenceValue,
  ritualAlreadyMarkedOn,
  ritualCadenceLabel,
} from '../src/domain/rituals.ts';

test('normalizes weekly and monthly cadence values', () => {
  assert.equal(normalizeRitualCadenceValue('weekly', 0), 0);
  assert.equal(normalizeRitualCadenceValue('weekly', 6), 6);
  assert.equal(normalizeRitualCadenceValue('weekly', 7), null);
  assert.equal(normalizeRitualCadenceValue('monthly', 1), 1);
  assert.equal(normalizeRitualCadenceValue('monthly', 31), 31);
  assert.equal(normalizeRitualCadenceValue('monthly', 32), null);
  assert.equal(normalizeRitualCadenceValue('flexible', 3), null);
});

test('detects whether ritual was already marked on a day', () => {
  const moments = [
    { ritual_id: 'r1', happened_on: '2026-09-13' },
    { ritual_id: 'r2', happened_on: '2026-09-12' },
  ];
  assert.equal(ritualAlreadyMarkedOn(moments, 'r1', '2026-09-13'), true);
  assert.equal(ritualAlreadyMarkedOn(moments, 'r1', '2026-09-12'), false);
});

test('formats cadence labels safely', () => {
  assert.equal(ritualCadenceLabel('weekly', 1), 'каждую неделю · Пн');
  assert.equal(ritualCadenceLabel('monthly', 8), 'каждый месяц · 8 число');
  assert.equal(ritualCadenceLabel('flexible', null), 'когда хочется');
  assert.equal(ritualCadenceLabel('weekly', 9), 'когда хочется');
});
