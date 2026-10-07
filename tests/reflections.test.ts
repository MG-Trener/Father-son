import test from 'node:test';
import assert from 'node:assert/strict';
import { reflectionPageCursor } from '../src/domain/reflections.ts';

const id = '11111111-2222-3333-4444-555555555555';
test('memory pagination retains microseconds and resolves timestamp ties by id', () => {
  const result = reflectionPageCursor({ id, created_at: '2026-10-07T10:15:22.123456+00:00' });
  assert.ok(result.includes('created_at.lt.2026-10-07T10:15:22.123456+00:00'));
  assert.ok(result.includes(`and(created_at.eq.2026-10-07T10:15:22.123456+00:00,id.lt.${id})`));
});
test('cursor accepts UTC and offset timestamps without rewriting them', () => {
  assert.ok(reflectionPageCursor({ id, created_at: '2026-10-07T00:00:00Z' }).includes('00:00:00Z'));
  assert.ok(reflectionPageCursor({ id, created_at: '2026-10-07T05:00:00.001+05:00' }).includes('.001+05:00'));
});
test('cursor rejects malformed timestamps and PostgREST control characters', () => {
  assert.throws(() => reflectionPageCursor({ id, created_at: '2026-10-07T25:99:00Z' }));
  assert.throws(() => reflectionPageCursor({ id: id + ',id.not.is.null', created_at: '2026-10-07T00:00:00Z' }));
  assert.throws(() => reflectionPageCursor({ id, created_at: '2026-10-07T00:00:00Z),id.not.is.null' }));
});
