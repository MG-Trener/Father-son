import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysUntilFutureLetterUnlock,
  futureLetterAccess,
  isFutureLetterUnlocked,
} from '../src/domain/futureLetters.ts';

const now = Date.parse('2026-09-13T12:00:00Z');
const base = {
  status: 'sealed',
  unlockAt: '2026-09-15T12:00:00Z',
  authorUserId: 'dad',
  recipientUserId: 'son',
};

test('sealed future letter stays closed before unlock date', () => {
  assert.equal(isFutureLetterUnlocked(base.status, base.unlockAt, now), false);
  assert.equal(futureLetterAccess(base, 'dad', now), 'sealed-wait');
  assert.equal(futureLetterAccess(base, 'son', now), 'sealed-wait');
});

test('sealed letter opens for author and recipient at unlock date', () => {
  const unlockedAt = Date.parse(base.unlockAt);
  assert.equal(isFutureLetterUnlocked(base.status, base.unlockAt, unlockedAt), true);
  assert.equal(futureLetterAccess(base, 'dad', unlockedAt), 'sealed-open');
  assert.equal(futureLetterAccess(base, 'son', unlockedAt), 'sealed-open');
});

test('unrelated user cannot access a future letter', () => {
  assert.equal(futureLetterAccess(base, 'other', Date.parse(base.unlockAt)), 'forbidden');
});

test('only author can access a draft', () => {
  const draft = { ...base, status: 'draft' };
  assert.equal(futureLetterAccess(draft, 'dad', now), 'draft-owner');
  assert.equal(futureLetterAccess(draft, 'son', now), 'forbidden');
});

test('days until unlock is clamped at zero', () => {
  assert.equal(daysUntilFutureLetterUnlock(base.unlockAt, now), 2);
  assert.equal(daysUntilFutureLetterUnlock('2026-09-12T12:00:00Z', now), 0);
});
