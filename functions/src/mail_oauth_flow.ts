import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { activateMailConnection, type MailConnectionCredentialLifecycle, type MailConnectionMetadataLifecycleStore } from './mail_connection_lifecycle';
import type { MailTokenBundle } from './encrypted_mail_token_vault';
import { maskMailAddress } from './firestore_mail_connection_store';
import type { MailProvider } from './mail_import_contract';

export const MAIL_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export interface MailOAuthProviderConfig {
  provider: MailProvider;
  clientId: string;
  authorizationEndpoint: string;
  redirectUri: string;
  scopes: readonly string[];
}

/** Contains short-lived authorization state and PKCE verifier; backend storage only. */
export interface PendingMailAuthorization {
  stateHash: string;
  connectionId: string;
  uid: string;
  provider: MailProvider;
  codeVerifier: string;
  redirectUri: string;
  scopes: string[];
  createdAtMs: number;
  expiresAtMs: number;
}

export interface MailOAuthStateStore {
  create(record: PendingMailAuthorization): Promise<void>;
  /** Atomically consumes one state record; expired or reused states return null. */
  consume(stateHash: string, nowMs: number): Promise<PendingMailAuthorization | null>;
}

export interface MailOAuthStartResult {
  authorizationUrl: string;
  connectionId: string;
  expiresAtMs: number;
}

export interface VerifiedMailOAuthGrant {
  emailAddress: string;
  grantedScopes: string[];
  tokens: MailTokenBundle;
}

export interface MailOAuthCodeExchanger {
  exchange(input: { provider: MailProvider; code: string; codeVerifier: string; redirectUri: string }): Promise<VerifiedMailOAuthGrant>;
  revokeUnpersisted(provider: MailProvider, tokens: MailTokenBundle): Promise<void>;
}

export interface MailOAuthCompletion {
  connectionId: string;
  provider: MailProvider;
  maskedAddress: string;
  grantedScopes: string[];
}

/** Starts an authorization-code + PKCE flow. Provider credentials remain server-configured. */
export async function beginMailOAuthAuthorization(input: {
  uid: string;
  config: MailOAuthProviderConfig;
  stateStore: MailOAuthStateStore;
  nowMs?: number;
  random?: (size: number) => Uint8Array;
}): Promise<MailOAuthStartResult> {
  const { config } = input;
  validateConfiguration(input.uid, config);
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('Authorization time is invalid.');
  const random = input.random ?? randomBytes;
  const stateValue = Buffer.from(random(32)).toString('base64url');
  const codeVerifier = Buffer.from(random(32)).toString('base64url');
  if (!STATE_PATTERN.test(stateValue) || !VERIFIER_PATTERN.test(codeVerifier)) throw new Error('Authorization state generator is invalid.');
  const stateHash = sha256(stateValue);
  const codeChallenge = Buffer.from(createHash('sha256').update(codeVerifier).digest()).toString('base64url');
  const expiresAtMs = nowMs + MAIL_OAUTH_STATE_TTL_MS;
  const authorizationUrl = new URL(config.authorizationEndpoint);
  const params = authorizationUrl.searchParams;
  params.set('client_id', config.clientId.trim());
  params.set('redirect_uri', config.redirectUri);
  params.set('response_type', 'code');
  params.set('scope', [...new Set(config.scopes.map((scope) => scope.trim()))].join(' '));
  params.set('state', stateValue);
  params.set('code_challenge', codeChallenge);
  params.set('code_challenge_method', 'S256');
  if (config.provider === 'gmail') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  } else {
    params.set('response_mode', 'query');
    params.set('prompt', 'select_account');
  }
  const connectionId = randomUUID();
  await input.stateStore.create({
    stateHash,
    connectionId,
    uid: input.uid,
    provider: config.provider,
    codeVerifier,
    redirectUri: config.redirectUri,
    scopes: [...new Set(config.scopes.map((scope) => scope.trim()))],
    createdAtMs: nowMs,
    expiresAtMs,
  });
  return { authorizationUrl: authorizationUrl.toString(), connectionId, expiresAtMs };
}

/** Exchanges a validated provider callback and activates only the consented, verified mailbox. */
export async function completeMailOAuthCallback(input: {
  state: unknown;
  code: unknown;
  stateStore: MailOAuthStateStore;
  exchanger: MailOAuthCodeExchanger;
  metadata: MailConnectionMetadataLifecycleStore;
  credentials: MailConnectionCredentialLifecycle;
  nowMs?: number;
}): Promise<MailOAuthCompletion> {
  const authorization = await consumeMailOAuthCallback({ state: input.state, stateStore: input.stateStore, nowMs: input.nowMs });
  if (!authorization) throw new Error('OAuth authorization state is invalid, expired, or already used.');
  return completeMailOAuthAuthorization({ ...input, authorization });
}

/** Completes a state that the HTTP callback has already atomically consumed. */
export async function completeMailOAuthAuthorization(input: {
  authorization: PendingMailAuthorization;
  code: unknown;
  exchanger: MailOAuthCodeExchanger;
  metadata: MailConnectionMetadataLifecycleStore;
  credentials: MailConnectionCredentialLifecycle;
  nowMs?: number;
}): Promise<MailOAuthCompletion> {
  if (typeof input.code !== 'string' || !input.code.trim() || input.code.length > 8192 || /[\u0000-\u001f]/.test(input.code)) {
    throw new Error('OAuth authorization code is invalid.');
  }
  const authorization = input.authorization;
  validateAuthorizationContext(authorization, input.nowMs ?? Date.now());
  const grant = await input.exchanger.exchange({
    provider: authorization.provider,
    code: input.code,
    codeVerifier: authorization.codeVerifier,
    redirectUri: authorization.redirectUri,
  });
  const grantedScopes = grant && Array.isArray(grant.grantedScopes)
    ? [...new Set(grant.grantedScopes.filter((scope) => typeof scope === 'string').map((scope) => normalizeGrantedScope(authorization.provider, scope.trim())).filter(Boolean))].sort()
    : [];
  const hasRequiredScopes = Boolean(grant) && authorization.scopes.every((scope) => grantedScopes.includes(scope));
  const validGrant = Boolean(grant) && typeof grant.emailAddress === 'string' && grant.emailAddress.trim().length <= 254
    && grant.tokens && typeof grant.tokens.accessToken === 'string' && grant.tokens.accessToken.length > 0
    && typeof grant.tokens.refreshToken === 'string' && grant.tokens.refreshToken.length > 0
    && Number.isSafeInteger(grant.tokens.expiresAtMs)
    && grantedScopes.length > 0 && grantedScopes.length <= 20;
  if (!validGrant || !hasRequiredScopes) {
    if (grant?.tokens?.accessToken && grant?.tokens?.refreshToken) {
      try { await input.exchanger.revokeUnpersisted(authorization.provider, grant.tokens); } catch { /* Do not persist or activate an incomplete grant. */ }
    }
    throw new Error(hasRequiredScopes ? 'Provider authorization response is invalid.' : 'Provider did not grant the requested mail permissions.');
  }
  const connectedAt = new Date(input.nowMs ?? Date.now()).toISOString();
  const maskedAddress = maskMailAddress(grant.emailAddress);
  await activateMailConnection({
    uid: authorization.uid,
    connectionId: authorization.connectionId,
    provider: authorization.provider,
    emailAddress: grant.emailAddress,
    grantedScopes,
    connectedAt,
    tokens: grant.tokens,
    metadata: input.metadata,
    credentials: input.credentials,
  });
  return { connectionId: authorization.connectionId, provider: authorization.provider, maskedAddress, grantedScopes };
}

/** Resolves a callback's untrusted state into a one-time backend authorization context. */
export function consumeMailOAuthCallback(input: {
  state: unknown;
  stateStore: MailOAuthStateStore;
  nowMs?: number;
}): Promise<PendingMailAuthorization | null> {
  if (typeof input.state !== 'string' || !STATE_PATTERN.test(input.state)) return Promise.resolve(null);
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return Promise.resolve(null);
  return input.stateStore.consume(sha256(input.state), nowMs);
}

function validateConfiguration(uid: string, config: MailOAuthProviderConfig): void {
  if (typeof uid !== 'string' || !uid.trim() || uid.length > 128 || uid.includes('/')) {
    throw new Error('A valid authenticated account is required.');
  }
  if (config.provider !== 'gmail' && config.provider !== 'outlook') throw new Error('Mail provider is invalid.');
  if (typeof config.clientId !== 'string' || !config.clientId.trim() || config.clientId.length > 512) throw new Error('OAuth client ID is not configured.');
  let endpoint: URL;
  let redirect: URL;
  try { endpoint = new URL(config.authorizationEndpoint); redirect = new URL(config.redirectUri); }
  catch { throw new Error('OAuth endpoint configuration is invalid.'); }
  if (endpoint.protocol !== 'https:' || redirect.protocol !== 'https:') throw new Error('OAuth endpoints must use HTTPS.');
  if (config.provider === 'gmail' && (endpoint.hostname !== 'accounts.google.com' || endpoint.pathname !== '/o/oauth2/v2/auth')) throw new Error('Google OAuth endpoint is not allowed.');
  if (config.provider === 'outlook' && (endpoint.hostname !== 'login.microsoftonline.com' || !/^\/[a-zA-Z0-9._-]+\/oauth2\/v2\.0\/authorize$/.test(endpoint.pathname))) throw new Error('Microsoft OAuth endpoint is not allowed.');
  if (!Array.isArray(config.scopes) || config.scopes.length === 0 || config.scopes.length > 20 || config.scopes.some((scope) => typeof scope !== 'string' || !scope.trim() || scope.length > 256 || /[\u0000-\u0020]/.test(scope.trim()))) throw new Error('OAuth scopes are invalid.');
}

export function mailOAuthStateHash(state: string): string {
  if (!STATE_PATTERN.test(state)) throw new Error('Authorization state is invalid.');
  return sha256(state);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeGrantedScope(provider: MailProvider, scope: string): string {
  if (provider === 'gmail' && scope.toLowerCase() === 'https://www.googleapis.com/auth/userinfo.email') return 'email';
  if (provider === 'outlook') {
    const normalized = scope.toLowerCase();
    if (normalized === 'mail.read' || normalized === 'https://graph.microsoft.com/mail.read') return 'https://graph.microsoft.com/Mail.Read';
    if (normalized === 'user.read' || normalized === 'https://graph.microsoft.com/user.read') return 'https://graph.microsoft.com/User.Read';
  }
  return scope;
}

function validateAuthorizationContext(authorization: PendingMailAuthorization, nowMs: number): void {
  if (!authorization || !HASH_PATTERN.test(authorization.stateHash) || typeof authorization.uid !== 'string'
    || !authorization.uid.trim() || authorization.uid.length > 128 || authorization.uid.includes('/')
    || typeof authorization.connectionId !== 'string' || !authorization.connectionId.trim() || authorization.connectionId.includes('/')
    || (authorization.provider !== 'gmail' && authorization.provider !== 'outlook')
    || !VERIFIER_PATTERN.test(authorization.codeVerifier) || !Number.isSafeInteger(nowMs)
    || !Number.isSafeInteger(authorization.expiresAtMs) || authorization.expiresAtMs <= nowMs
    || authorization.expiresAtMs - authorization.createdAtMs !== MAIL_OAUTH_STATE_TTL_MS
    || !Array.isArray(authorization.scopes) || authorization.scopes.length < 1 || authorization.scopes.length > 20) {
    throw new Error('OAuth authorization context is invalid or expired.');
  }
}
