import assert from 'node:assert/strict';
import test from 'node:test';
import {
  asRpcRecord,
  requireRpcString,
  rpcBoolean,
  rpcNumber,
  rpcString,
  rpcStringArray,
} from '../src/lib/rpcResult.ts';

test('asRpcRecord only accepts plain object-like RPC payloads', () => {
  assert.deepEqual(asRpcRecord({ id: 'abc' }), { id: 'abc' });
  assert.equal(asRpcRecord(null), null);
  assert.equal(asRpcRecord(['abc']), null);
  assert.equal(asRpcRecord('abc'), null);
});

test('rpcString returns non-empty string fields', () => {
  assert.equal(rpcString({ event_id: 'event-1' }, 'event_id'), 'event-1');
  assert.equal(rpcString({ event_id: '' }, 'event_id'), null);
  assert.equal(rpcString({ event_id: 1 }, 'event_id'), null);
});

test('requireRpcString fails deterministically for malformed RPC responses', () => {
  assert.equal(requireRpcString({ meeting_id: 'meeting-1' }, 'meeting_id'), 'meeting-1');
  assert.throws(
    () => requireRpcString({}, 'meeting_id', 'MEETING_CREATE_RESULT_INVALID'),
    /MEETING_CREATE_RESULT_INVALID:meeting_id/,
  );
});

test('number and boolean helpers preserve valid scalar types', () => {
  assert.equal(rpcNumber({ xp_reward: 10 }, 'xp_reward'), 10);
  assert.equal(rpcNumber({ xp_reward: Number.NaN }, 'xp_reward'), null);
  assert.equal(rpcBoolean({ already_completed: false }, 'already_completed'), false);
  assert.equal(rpcBoolean({ already_completed: 'false' }, 'already_completed'), null);
});

test('rpcStringArray filters invalid array elements', () => {
  assert.deepEqual(
    rpcStringArray({ achievement_titles: ['Первый шаг', 10, null, 'Команда'] }, 'achievement_titles'),
    ['Первый шаг', 'Команда'],
  );
  assert.deepEqual(rpcStringArray({}, 'achievement_titles'), []);
});
