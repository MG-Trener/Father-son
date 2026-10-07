import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysUntilFutureLetterUnlock,
  futureLetterAccess,
  isFutureLetterUnlocked,
  futureLetterRecipients,
} from '../src/domain/futureLetters.ts';

const now = Date.parse('2026-09-13T12:00:00Z');
const dad = { user_id: 'dad', role: 'parent', display_name: 'Папа', birth_date: '1985-04-01' };
const son = { user_id: 'son', role: 'child', display_name: 'Сын', birth_date: '2014-06-02' };

test('both roles can explicitly choose self or the other family member', () => {
  assert.deepEqual(futureLetterRecipients([dad, son], dad).map(x => [x.label, x.id]), [['Себе', 'dad'], ['Сыну', 'son']]);
  assert.deepEqual(futureLetterRecipients([dad, son], son).map(x => [x.label, x.id]), [['Себе', 'son'], ['Папе', 'dad']]);
  assert.equal(futureLetterRecipients([dad, son], son)[1].birthDate, dad.birth_date);
});

test('missing relative remains visible but cannot receive a letter as the author', () => {
  const options = futureLetterRecipients([dad], dad);
  assert.equal(options[0].id, 'dad');
  assert.equal(options[1].id, null);
  assert.equal(options[1].label, 'Сыну');
});

test('self-addressed letter stays private from the other family member', () => {
  const letter = { status: 'sealed', unlockAt: '2026-01-01T00:00:00Z', authorUserId: 'son', recipientUserId: 'son' };
  assert.equal(futureLetterAccess(letter, 'son', now), 'sealed-open');
  assert.equal(futureLetterAccess(letter, 'dad', now), 'forbidden');
});
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
