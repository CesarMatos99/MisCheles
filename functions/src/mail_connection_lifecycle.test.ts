import assert from 'node:assert/strict';
import test from 'node:test';
import { activateMailConnection, disconnectMailConnection } from './mail_connection_lifecycle.ts';

const data = {
  uid: 'uid-1', connectionId: 'conn-1', provider: 'gmail' as const,
  emailAddress: 'owner@gmail.com', grantedScopes: ['mail.readonly'],
  connectedAt: '2026-11-01T12:00:00.000Z',
  tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAtMs: 1_900_000_000_000 },
};

function adapters(events: string[], options: { failMetadata?: boolean; failInitialMetadata?: boolean; failSave?: boolean; failRevoke?: boolean } = {}) {
  let status = 'missing';
  let hasCredentials = false;
  const metadata = {
    async upsert(_uid: string, _id: string, record: { status: string }) {
      events.push('metadata:' + record.status);
      if ((options.failMetadata && record.status === 'active') || (options.failInitialMetadata && record.status === 'reauthorization_required')) throw new Error('write failure');
      status = record.status;
    },
    async delete() { events.push('metadata:delete'); status = 'missing'; },
  };
  const credentials = {
    async saveTokens() { events.push('tokens:save'); if (options.failSave) throw new Error('provider token failure'); hasCredentials = true; },
    async revoke() { events.push('tokens:revoke'); if (options.failRevoke) throw new Error('provider revoke failure'); hasCredentials = false; },
  };
  return { metadata, credentials, getStatus: () => status, hasCredentials: () => hasCredentials, setExisting: () => { status = 'active'; hasCredentials = true; } };
}

test('connection is marked active only after private credentials are stored', async () => {
  const events: string[] = [];
  const state = adapters(events);
  await activateMailConnection({ ...data, ...state });
  assert.deepEqual(events, ['metadata:reauthorization_required', 'tokens:save', 'metadata:active']);
  assert.equal(state.getStatus(), 'active');
  assert.equal(state.hasCredentials(), true);
});

test('credential failure never leaves an active connection', async () => {
  const events: string[] = [];
  const state = adapters(events, { failSave: true });
  await assert.rejects(activateMailConnection({ ...data, ...state }), /provider token failure/);
  assert.deepEqual(events, ['metadata:reauthorization_required', 'tokens:save']);
  assert.equal(state.getStatus(), 'reauthorization_required');
  assert.equal(state.hasCredentials(), false);
});

test('metadata activation failure leaves stored credentials inaccessible', async () => {
  const events: string[] = [];
  const state = adapters(events, { failMetadata: true });
  await assert.rejects(activateMailConnection({ ...data, ...state }), /write failure/);
  assert.deepEqual(events, ['metadata:reauthorization_required', 'tokens:save', 'metadata:active']);
  assert.equal(state.getStatus(), 'reauthorization_required');
  assert.equal(state.hasCredentials(), true);
});

test('initial metadata failure prevents any token storage', async () => {
  const events: string[] = [];
  const state = adapters(events, { failInitialMetadata: true });
  await assert.rejects(activateMailConnection({ ...data, ...state }), /write failure/);
  assert.deepEqual(events, ['metadata:reauthorization_required']);
  assert.equal(state.hasCredentials(), false);
});

test('disconnect revokes provider tokens before deleting metadata', async () => {
  const events: string[] = [];
  const state = adapters(events);
  await disconnectMailConnection({ uid: data.uid, connectionId: data.connectionId, provider: data.provider, ...state });
  assert.deepEqual(events, ['tokens:revoke', 'metadata:delete']);
  assert.equal(state.getStatus(), 'missing');
  assert.equal(state.hasCredentials(), false);
});

test('failed provider revocation preserves connection metadata for retry', async () => {
  const events: string[] = [];
  const state = adapters(events, { failRevoke: true });
  state.setExisting();
  await assert.rejects(disconnectMailConnection({ uid: data.uid, connectionId: data.connectionId, provider: data.provider, ...state }), /provider revoke failure/);
  assert.deepEqual(events, ['tokens:revoke']);
  assert.equal(state.getStatus(), 'active');
  assert.equal(state.hasCredentials(), true);
});
