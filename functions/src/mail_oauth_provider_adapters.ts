import type { MailOAuthCodeExchanger, VerifiedMailOAuthGrant } from './mail_oauth_flow';
import type { MailProvider } from './mail_import_contract';
import type { MailProviderRevoker, MailProviderTokenRefresher, MailTokenBundle } from './encrypted_mail_token_vault';

export interface MailOAuthClientCredentials { clientId: string; clientSecret: string; tenant?: string; }
type FetchLike = typeof fetch;
type TokenResponse = { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: unknown; token_type?: unknown };

/** Provider HTTP adapter. Provider URLs are fixed here; secrets are supplied only by Functions Secret Manager. */
export class MailOAuthProviderAdapter implements MailOAuthCodeExchanger, MailProviderTokenRefresher, MailProviderRevoker {
  private readonly credentials: Readonly<Record<MailProvider, MailOAuthClientCredentials>>;
  private readonly fetcher: FetchLike;

  constructor(credentials: Readonly<Record<MailProvider, MailOAuthClientCredentials>>, fetcher: FetchLike = fetch) {
    this.credentials = credentials;
    this.fetcher = fetcher;
  }

  async exchange(input: { provider: MailProvider; code: string; codeVerifier: string; redirectUri: string }): Promise<VerifiedMailOAuthGrant> {
    const tokenResponse = await this.requestToken(input.provider, {
      grant_type: 'authorization_code', code: input.code, code_verifier: input.codeVerifier, redirect_uri: input.redirectUri,
    });
    const tokens = this.toBundle(tokenResponse);
    const grantedScopes = parseScopes(tokenResponse.scope);
    const emailAddress = await this.readMailboxAddress(input.provider, tokens.accessToken);
    return { emailAddress, grantedScopes, tokens };
  }

  async refresh(provider: MailProvider, refreshToken: string): Promise<Pick<MailTokenBundle, 'accessToken' | 'expiresAtMs'> & { refreshToken?: string }> {
    const tokenResponse = await this.requestToken(provider, { grant_type: 'refresh_token', refresh_token: refreshToken });
    const tokens = this.toBundle(tokenResponse, refreshToken);
    return tokens;
  }

  async revoke(provider: MailProvider, accessToken: string, refreshToken: string): Promise<void> {
    if (provider === 'outlook') {
      // Microsoft Graph has no per-token revoke endpoint. Never revoke all sessions for a mailbox.
      // The caller must keep connection metadata until the owner revokes consent at Microsoft.
      throw new Error('Outlook consent must be revoked by the mailbox owner.');
    }
    const response = await this.fetcher('https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken || accessToken }), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 400) throw new Error('Google token revocation failed.');
  }

  async revokeUnpersisted(provider: MailProvider, tokens: MailTokenBundle): Promise<void> {
    if (provider === 'gmail') return this.revoke(provider, tokens.accessToken, tokens.refreshToken);
    // Outlook cannot revoke only the newly issued token. Do not persist it; it expires naturally.
  }

  private async requestToken(provider: MailProvider, fields: Record<string, string>): Promise<TokenResponse> {
    const credentials = this.credentials[provider];
    if (!credentials?.clientId || !credentials.clientSecret) throw new Error('Mail OAuth client credentials are not configured.');
    const endpoint = provider === 'gmail'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://login.microsoftonline.com/' + encodeURIComponent(credentials.tenant || 'common') + '/oauth2/v2.0/token';
    const response = await this.fetcher(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ ...fields, client_id: credentials.clientId, client_secret: credentials.clientSecret }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error('Mail provider token exchange failed.');
    return body as TokenResponse;
  }

  private toBundle(response: TokenResponse, fallbackRefreshToken?: string): MailTokenBundle {
    const expiresIn = typeof response.expires_in === 'number' ? response.expires_in : Number(response.expires_in);
    const refreshToken = typeof response.refresh_token === 'string' && response.refresh_token ? response.refresh_token : fallbackRefreshToken;
    if (typeof response.access_token !== 'string' || !response.access_token || !refreshToken
      || !Number.isSafeInteger(expiresIn) || expiresIn <= 0 || expiresIn > 31_536_000) throw new Error('Mail provider returned incomplete credentials.');
    return { accessToken: response.access_token, refreshToken, expiresAtMs: Date.now() + expiresIn * 1000 };
  }

  private async readMailboxAddress(provider: MailProvider, accessToken: string): Promise<string> {
    const endpoint = provider === 'gmail'
      ? 'https://openidconnect.googleapis.com/v1/userinfo'
      : 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName';
    const response = await this.fetcher(endpoint, {
      headers: { authorization: 'Bearer ' + accessToken, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error('Mail provider identity could not be verified.');
    if (provider === 'gmail' && body.email_verified !== true) throw new Error('Google mailbox is not verified.');
    const address = provider === 'gmail' ? body.email : (body.mail || body.userPrincipalName);
    if (typeof address !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) throw new Error('Mail provider returned an invalid mailbox identity.');
    return address;
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (raw.length > 64_000) throw new Error('Mail provider response exceeded the supported size.');
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error('Mail provider returned an invalid response.');
  }
}

function parseScopes(value: unknown): string[] {
  if (typeof value !== 'string' || value.length > 8192) return [];
  return [...new Set(value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean))].slice(0, 20);
}
