import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { MailProvider, MailTokenVault } from './mail_import_contract';

export interface MailTokenBundle { accessToken: string; refreshToken: string; expiresAtMs: number; }
export interface EncryptedMailTokenEnvelope { version: 1; keyId: string; nonce: string; tag: string; ciphertext: string; }
export interface StoredMailTokenRecord { provider: MailProvider; connectionId: string; revision: number; envelope: EncryptedMailTokenEnvelope; }

/** This adapter must use a backend-only store path denied to every client by Firestore Rules. */
export interface PrivateMailTokenStore {
  read(uid: string, connectionId: string): Promise<StoredMailTokenRecord | null>;
  compareAndSet(uid: string, connectionId: string, expectedRevision: number | null, next: StoredMailTokenRecord): Promise<boolean>;
  deleteIfRevisionMatches(uid: string, connectionId: string, expectedRevision: number): Promise<boolean>;
}
export interface MailProviderTokenRefresher { refresh(provider: MailProvider, refreshToken: string): Promise<Pick<MailTokenBundle, 'accessToken' | 'expiresAtMs'> & { refreshToken?: string }>; }
export interface MailProviderRevoker { revoke(provider: MailProvider, accessToken: string, refreshToken: string): Promise<void>; }
export interface MailConnectionAccessReader { isActive(uid: string, connectionId: string, provider: MailProvider): Promise<boolean>; }

export type MailTokenKeyring = { activeKeyId: string; keys: ReadonlyMap<string, Uint8Array> };

export class EncryptedMailTokenVault implements MailTokenVault {
  private readonly keyring: MailTokenKeyring;
  private readonly store: PrivateMailTokenStore;
  private readonly refresher: MailProviderTokenRefresher;
  private readonly revoker: MailProviderRevoker;
  private readonly connectionAccess: MailConnectionAccessReader;
  private readonly now: () => number;
  constructor(
    store: PrivateMailTokenStore,
    refresher: MailProviderTokenRefresher,
    revoker: MailProviderRevoker,
    keyring: MailTokenKeyring,
    connectionAccess: MailConnectionAccessReader,
    now: () => number = Date.now,
  ) {
    this.store = store; this.refresher = refresher; this.revoker = revoker; this.connectionAccess = connectionAccess; this.now = now;
    if (!keyring.activeKeyId || !keyring.keys.has(keyring.activeKeyId)) throw new Error('Mail token encryption key is not configured.');
    for (const [id, key] of keyring.keys) if (!id || key.byteLength !== 32) throw new Error('Mail token encryption keys must contain 32 bytes.');
    this.keyring = keyring;
  }

  async saveTokens(uid: string, connectionId: string, provider: MailProvider, tokens: MailTokenBundle): Promise<void> {
    this.validateScope(uid, connectionId, provider);
    this.validateTokens(tokens);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await this.store.read(uid, connectionId);
      if (current && current.provider !== provider) throw new Error('Mail connection provider does not match.');
      const revision = current?.revision ?? null;
      const next: StoredMailTokenRecord = {
        provider, connectionId, revision: (current?.revision ?? 0) + 1,
        envelope: this.encrypt(uid, connectionId, provider, tokens),
      };
      if (await this.store.compareAndSet(uid, connectionId, revision, next)) return;
    }
    throw new Error('Mail token update conflicted repeatedly.');
  }

  async getValidAccessToken(uid: string, connectionId: string, provider: MailProvider): Promise<string> {
    this.validateScope(uid, connectionId, provider);
    if (!await this.connectionAccess.isActive(uid, connectionId, provider)) throw new Error('Mail connection is not active for this account.');
    const record = await this.store.read(uid, connectionId);
    if (!record || record.provider !== provider || record.connectionId !== connectionId) throw new Error('Mail connection credentials are unavailable.');
    const tokens = this.decrypt(uid, connectionId, provider, record.envelope);
    if (tokens.expiresAtMs > this.now() + 60_000) return tokens.accessToken;
    if (!tokens.refreshToken) throw new Error('Mail connection requires authorization again.');
    let refreshed: Awaited<ReturnType<MailProviderTokenRefresher['refresh']>>;
    try { refreshed = await this.refresher.refresh(provider, tokens.refreshToken); }
    catch {
      // Provider refresh tokens may be single-use. If another worker already rotated this
      // connection, prefer its persisted result instead of prompting the owner to reconnect.
      const latest = await this.store.read(uid, connectionId);
      if (latest && latest.revision > record.revision && latest.provider === provider) {
        const latestTokens = this.decrypt(uid, connectionId, provider, latest.envelope);
        if (latestTokens.expiresAtMs > this.now() + 5_000) return latestTokens.accessToken;
      }
      throw new Error('Mail connection refresh failed. Authorization may need renewal.');
    }
    const nextTokens: MailTokenBundle = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || tokens.refreshToken,
      expiresAtMs: refreshed.expiresAtMs,
    };
    this.validateTokens(nextTokens);
    const next: StoredMailTokenRecord = {
      provider, connectionId, revision: record.revision + 1,
      envelope: this.encrypt(uid, connectionId, provider, nextTokens),
    };
    if (await this.store.compareAndSet(uid, connectionId, record.revision, next)) return nextTokens.accessToken;
    // Another worker rotated the same refresh token. Use its latest valid result instead of replaying it.
    const latest = await this.store.read(uid, connectionId);
    if (!latest || latest.provider !== provider) throw new Error('Mail connection credentials changed during refresh.');
    const latestTokens = this.decrypt(uid, connectionId, provider, latest.envelope);
    if (latestTokens.expiresAtMs <= this.now() + 5_000) throw new Error('Mail connection refresh conflicted. Retry synchronization.');
    return latestTokens.accessToken;
  }

  async revoke(uid: string, connectionId: string, provider: MailProvider): Promise<void> {
    this.validateScope(uid, connectionId, provider);
    const record = await this.store.read(uid, connectionId);
    if (!record) return;
    if (record.provider !== provider) throw new Error('Mail connection provider does not match.');
    const tokens = this.decrypt(uid, connectionId, provider, record.envelope);
    try { await this.revoker.revoke(provider, tokens.accessToken, tokens.refreshToken); }
    catch { throw new Error('Mail provider access could not be revoked. Retry disconnecting it.'); }
    if (!await this.store.deleteIfRevisionMatches(uid, connectionId, record.revision)) {
      throw new Error('Mail connection changed during revocation. Retry disconnecting it.');
    }
  }

  private encrypt(uid: string, connectionId: string, provider: MailProvider, tokens: MailTokenBundle): EncryptedMailTokenEnvelope {
    const keyId = this.keyring.activeKeyId;
    const key = this.keyring.keys.get(keyId)!;
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(this.aad(uid, connectionId, provider, keyId));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
    return { version: 1, keyId, nonce: nonce.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') };
  }

  private decrypt(uid: string, connectionId: string, provider: MailProvider, envelope: EncryptedMailTokenEnvelope): MailTokenBundle {
    if (envelope.version !== 1 || !envelope.keyId || !envelope.nonce || !envelope.tag || !envelope.ciphertext) throw new Error('Encrypted mail token record is malformed.');
    const key = this.keyring.keys.get(envelope.keyId);
    if (!key) throw new Error('Encrypted mail token key version is unavailable.');
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64url'));
      decipher.setAAD(this.aad(uid, connectionId, provider, envelope.keyId));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
      const tokens = JSON.parse(plaintext) as MailTokenBundle;
      this.validateTokens(tokens);
      return tokens;
    } catch {
      throw new Error('Encrypted mail token record failed authentication.');
    }
  }

  private aad(uid: string, connectionId: string, provider: MailProvider, keyId: string): Buffer {
    return Buffer.from(JSON.stringify(['mischeles-mail-token-v1', uid, provider, connectionId, keyId]), 'utf8');
  }
  private validateScope(uid: string, connectionId: string, provider: MailProvider): void {
    if (!uid.trim() || uid.includes('/') || !connectionId.trim() || connectionId.includes('/') || (provider !== 'gmail' && provider !== 'outlook')) throw new Error('Mail token owner or connection is invalid.');
  }
  private validateTokens(tokens: MailTokenBundle): void {
    if (!tokens || typeof tokens.accessToken !== 'string' || !tokens.accessToken.trim() || typeof tokens.refreshToken !== 'string' || !tokens.refreshToken.trim() || !Number.isSafeInteger(tokens.expiresAtMs) || tokens.expiresAtMs <= 0) throw new Error('Mail provider credentials are invalid.');
  }
}

/** Parses a base64url or 64-character hex key supplied by a Functions Secret, never a client env var. */
export function decodeMailTokenEncryptionKey(value: string): Uint8Array {
  const source = value.trim();
  const isHex = /^[a-f0-9]{64}$/i.test(source);
  const isBase64Url = /^[A-Za-z0-9_-]{43}$/.test(source);
  if (!isHex && !isBase64Url) throw new Error('Mail token encryption key must be 32 bytes in base64url or hex.');
  const key = isHex ? Buffer.from(source, 'hex') : Buffer.from(source, 'base64url');
  if (key.byteLength !== 32) throw new Error('Mail token encryption key must decode to exactly 32 bytes.');
  return key;
}
