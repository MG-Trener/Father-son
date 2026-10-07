import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAccountAccess, parseOwnerCallback } from '../src/domain/ownerAccess.ts';

test('access response fails closed for absent or malformed flags', () => {
  for (const value of [null, {}, { is_owner: true }, { is_owner: true, requires_confirmation: 'false' }]) {
    assert.throws(() => parseAccountAccess(value));
  }
  assert.deepEqual(parseAccountAccess({ is_owner: true, requires_confirmation: true }), { isOwner: true, requiresConfirmation: true });
  assert.deepEqual(parseAccountAccess({ is_owner: false, requires_confirmation: false }), { isOwner: false, requiresConfirmation: false });
});

test('only the exact native callback accepts a complete token pair', () => {
  assert.deepEqual(parseOwnerCallback('papaiya://auth-callback#access_token=a&refresh_token=b'), { access_token: 'a', refresh_token: 'b' });
  for (const url of ['https://auth-callback#access_token=a&refresh_token=b', 'papaiya://other#access_token=a&refresh_token=b', 'papaiya://auth-callback/other#access_token=a&refresh_token=b', 'papaiya://auth-callback#access_token=a', 'invalid']) {
    assert.equal(parseOwnerCallback(url), null);
  }
});

test('expired links show a safe explanation without leaking callback content', () => {
  assert.throws(() => parseOwnerCallback('papaiya://auth-callback#error_code=otp_expired&error_description=secret'), /Ссылка устарела/);
});
