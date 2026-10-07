import test from 'node:test';
import assert from 'node:assert/strict';
import { familyPresentation, localDay, moodIsToday } from '../src/domain/presentation.ts';

const parent = { user_id: 'p', role: 'parent' as const, display_name: 'Михаил' };
const child = { user_id: 's', role: 'child' as const, display_name: 'Артур' };

test('father sees his son as the other participant even if rows are reversed', () => {
  const view = familyPresentation([child, parent], parent);
  assert.equal(view.isChild, false);
  assert.equal(view.other?.user_id, child.user_id);
  assert.equal(view.myName, 'Михаил');
});
test('son sees father and keeps his own identity', () => {
  const view = familyPresentation([parent, child], child);
  assert.equal(view.isChild, true);
  assert.equal(view.otherName, 'Михаил');
  assert.equal(view.myName, 'Артур');
});
test('actual account role always wins over the preview fallback', () => {
  assert.equal(familyPresentation([parent, child], child, 'parent').isChild, true);
  assert.equal(familyPresentation([parent, child], parent, 'child').isChild, false);
});
test('a father without a connected son is never used as the child', () => {
  const view = familyPresentation([parent], parent);
  assert.equal(view.child, undefined);
  assert.equal(view.other, undefined);
});
test('empty preview uses role labels without inventing family names', () => {
  assert.equal(familyPresentation([], null).myName, 'папа');
  assert.equal(familyPresentation([], null, 'child').otherName, 'папа');
});
test('activity day follows the phone calendar, including shortly after midnight', () => {
  const dawn = new Date(2026, 9, 7, 0, 5);
  assert.equal(localDay(dawn), '2026-10-07');
  assert.equal(localDay(new Date(2026, 0, 2, 23, 55)), '2026-01-02');
});
test('yesterday and invalid timestamps are not shown as today mood', () => {
  const now = new Date(2026, 9, 7, 0, 5);
  assert.equal(moodIsToday(new Date(2026, 9, 6, 23, 59).toISOString(), now), false);
  assert.equal(moodIsToday(new Date(2026, 9, 7, 0, 1).toISOString(), now), true);
  assert.equal(moodIsToday('not a date', now), false);
});
