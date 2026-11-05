import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { beginMailOAuthAuthorization, completeMailOAuthAuthorization, completeMailOAuthCallback, consumeMailOAuthCallback, MAIL_OAUTH_STATE_TTL_MS, type MailOAuthStateStore, type PendingMailAuthorization } from './mail_oauth_flow.ts';

class MemoryOAuthStateStore implements MailOAuthStateStore {
  readonly records = new Map<string, PendingMailAuthorization>();
  async create(record: PendingMailAuthorization) {
    if (this.records.has(record.stateHash)) throw new Error('State already exists.');
    this.records.set(record.stateHash, structuredClone(record));
  }
  async consume(hash: string, nowMs: number) {
    const record = this.records.get(hash);
    if (!record) return null;
    this.records.delete(hash);
    return record.expiresAtMs > nowMs ? structuredClone(record) : null;
  }
}

const googleConfig = {
  provider: 'gmail' as const,
  clientId: 'web-client-id',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  redirectUri: 'https://app.example.com/oauth/google/callback',
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
};
const outlookConfig = {
  provider: 'outlook' as const,
  clientId: 'ms-client-id',
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  redirectUri: 'https://app.example.com/oauth/outlook/callback',
  scopes: ['offline_access', 'openid', 'email', 'https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/User.Read'],
};

for (const config of [googleConfig, outlookConfig]) {
  test(config.provider + ' authorization uses PKCE and binds a one-time state to the UID', async () => {
    const store = new MemoryOAuthStateStore();
    const nowMs = 1_800_000_000_000;
    const result = await beginMailOAuthAuthorization({ uid: 'owner-1', config, stateStore: store, nowMs });
    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get('state')!;
    const verifier = [...store.records.values()][0].codeVerifier;
    const expectedChallenge = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('code_challenge'), expectedChallenge);
    assert.equal(url.searchParams.get('redirect_uri'), config.redirectUri);
    assert.equal(result.expiresAtMs, nowMs + MAIL_OAUTH_STATE_TTL_MS);
    assert.equal(store.records.size, 1);
    const [storedHash, pending] = [...store.records.entries()][0];
    assert.equal(storedHash, createHash('sha256').update(state).digest('hex'));
    assert.equal(pending.uid, 'owner-1');
    assert.equal(pending.provider, config.provider);
    assert.equal(pending.codeVerifier, verifier);
    assert.equal(JSON.stringify(pending).includes(state), false);
    const callback = await consumeMailOAuthCallback({ state, stateStore: store, nowMs: nowMs + 1 });
    assert.equal(callback?.uid, 'owner-1');
    assert.equal(callback?.codeVerifier, verifier);
    assert.equal(await consumeMailOAuthCallback({ state, stateStore: store, nowMs: nowMs + 2 }), null);
  });
}

test('expired state is consumed and cannot be replayed', async () => {
  const store = new MemoryOAuthStateStore();
  const nowMs = 1_800_000_000_000;
  const result = await beginMailOAuthAuthorization({ uid: 'owner-1', config: googleConfig, stateStore: store, nowMs });
  const state = new URL(result.authorizationUrl).searchParams.get('state')!;
  assert.equal(await consumeMailOAuthCallback({ state, stateStore: store, nowMs: result.expiresAtMs }), null);
  assert.equal(store.records.size, 0);
});

test('untrusted or malformed callback state never reaches the store', async () => {
  const store = new MemoryOAuthStateStore();
  assert.equal(await consumeMailOAuthCallback({ state: 'bad-state', stateStore: store }), null);
  assert.equal(store.records.size, 0);
});

test('callback provisions sanitized metadata only after valid scopes and backend token storage', async () => {
  const store = new MemoryOAuthStateStore();
  const nowMs = 1_800_000_000_000;
  const start = await beginMailOAuthAuthorization({ uid: 'owner-1', config: googleConfig, stateStore: store, nowMs });
  const state = new URL(start.authorizationUrl).searchParams.get('state')!;
  const events: string[] = [];
  const metadata = { async upsert(_uid: string, _id: string, row: { status: string }) { events.push('metadata:' + row.status); }, async delete() { events.push('metadata:delete'); } };
  const credentials = { async saveTokens() { events.push('tokens:save'); }, async revoke() { events.push('tokens:revoke'); } };
  const exchanger = {
    async exchange() { events.push('code:exchange'); return { emailAddress: 'owner@gmail.com', grantedScopes: [...googleConfig.scopes], tokens: { accessToken: 'private-access', refreshToken: 'private-refresh', expiresAtMs: nowMs + 3_600_000 } }; },
    async revokeUnpersisted() { events.push('tokens:revoke-unpersisted'); },
  };
  const result = await completeMailOAuthCallback({ state, code: 'provider-code', stateStore: store, exchanger, metadata, credentials, nowMs: nowMs + 1 });
  assert.equal(result.connectionId, start.connectionId);
  assert.equal(result.maskedAddress, 'o***@gmail.com');
  assert.deepEqual(events, ['code:exchange', 'metadata:reauthorization_required', 'tokens:save', 'metadata:active']);
  assert.equal(JSON.stringify(result).includes('private-access'), false);
  assert.equal(JSON.stringify(result).includes('private-refresh'), false);
});

test('callback revokes an incomplete grant and never activates it', async () => {
  const store = new MemoryOAuthStateStore();
  const nowMs = 1_800_000_000_000;
  const start = await beginMailOAuthAuthorization({ uid: 'owner-1', config: googleConfig, stateStore: store, nowMs });
  const state = new URL(start.authorizationUrl).searchParams.get('state')!;
  const events: string[] = [];
  const metadata = { async upsert() { events.push('metadata'); }, async delete() {} };
  const credentials = { async saveTokens() { events.push('tokens:save'); }, async revoke() {} };
  const exchanger = {
    async exchange() { return { emailAddress: 'owner@gmail.com', grantedScopes: ['openid'], tokens: { accessToken: 'private-access', refreshToken: 'private-refresh', expiresAtMs: nowMs + 3_600_000 } }; },
    async revokeUnpersisted() { events.push('tokens:revoke-unpersisted'); },
  };
  await assert.rejects(completeMailOAuthCallback({ state, code: 'provider-code', stateStore: store, exchanger, metadata, credentials, nowMs: nowMs + 1 }), /did not grant/);
  assert.deepEqual(events, ['tokens:revoke-unpersisted']);
  assert.equal(await consumeMailOAuthCallback({ state, stateStore: store, nowMs: nowMs + 2 }), null);
});

test('rejects non-provider endpoints, HTTP redirects, invalid scopes, and empty UIDs', async () => {
  const store = new MemoryOAuthStateStore();
  await assert.rejects(beginMailOAuthAuthorization({ uid: '', config: googleConfig, stateStore: store }), /authenticated account/);
  await assert.rejects(beginMailOAuthAuthorization({ uid: 'owner-1', config: { ...googleConfig, authorizationEndpoint: 'https://attacker.example/auth' }, stateStore: store }), /endpoint is not allowed/);
  await assert.rejects(beginMailOAuthAuthorization({ uid: 'owner-1', config: { ...googleConfig, redirectUri: 'http://app.example.com/callback' }, stateStore: store }), /HTTPS/);
  await assert.rejects(beginMailOAuthAuthorization({ uid: 'owner-1', config: { ...googleConfig, scopes: ['scope with spaces'] }, stateStore: store }), /scopes are invalid/);
  assert.equal(store.records.size, 0);
});

test('Outlook provider scope aliases are normalized before required-consent validation', async () => {
  const store = new MemoryOAuthStateStore();
  const nowMs = 1_800_000_000_000;
  const start = await beginMailOAuthAuthorization({ uid: 'owner-1', config: outlookConfig, stateStore: store, nowMs });
  const state = new URL(start.authorizationUrl).searchParams.get('state')!;
  const authorization = await consumeMailOAuthCallback({ state, stateStore: store, nowMs: nowMs + 1 });
  assert.ok(authorization);
  const events: string[] = [];
  const result = await completeMailOAuthAuthorization({
    authorization, code: 'provider-code', nowMs: nowMs + 2,
    exchanger: { async exchange() { return { emailAddress: 'owner@outlook.com', grantedScopes: ['openid', 'email', 'offline_access', 'Mail.Read', 'User.Read'], tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAtMs: nowMs + 3_600_000 } }; }, async revokeUnpersisted() { events.push('revoke'); } },
    metadata: { async upsert(_uid: string, _id: string, row: { status: string }) { events.push(row.status); }, async delete() {} },
    credentials: { async saveTokens() { events.push('tokens'); }, async revoke() {} },
  });
  assert.equal(result.maskedAddress, 'o***@outlook.com');
  assert.deepEqual(result.grantedScopes, ['email', 'https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/User.Read', 'offline_access', 'openid']);
  assert.deepEqual(events, ['reauthorization_required', 'tokens', 'active']);
});

test('Google userinfo.email scope alias satisfies the requested email permission', async () => {
  const store = new MemoryOAuthStateStore();
  const nowMs = 1_800_000_000_000;
  const start = await beginMailOAuthAuthorization({ uid: 'owner-1', config: googleConfig, stateStore: store, nowMs });
  const state = new URL(start.authorizationUrl).searchParams.get('state')!;
  const authorization = await consumeMailOAuthCallback({ state, stateStore: store, nowMs: nowMs + 1 });
  assert.ok(authorization);
  const result = await completeMailOAuthAuthorization({
    authorization, code: 'provider-code', nowMs: nowMs + 2,
    exchanger: { async exchange() { return { emailAddress: 'owner@gmail.com', grantedScopes: ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/gmail.readonly'], tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAtMs: nowMs + 3_600_000 } }; }, async revokeUnpersisted() {} },
    metadata: { async upsert() {}, async delete() {} },
    credentials: { async saveTokens() {}, async revoke() {} },
  });
  assert.equal(result.provider, 'gmail');
});
