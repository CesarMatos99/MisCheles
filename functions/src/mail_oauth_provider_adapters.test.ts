import assert from 'node:assert/strict';
import test from 'node:test';
import { MailOAuthProviderAdapter } from './mail_oauth_provider_adapters.ts';

const credentials = {
  gmail: { clientId: 'google-id', clientSecret: 'google-secret' },
  outlook: { clientId: 'ms-id', clientSecret: 'ms-secret', tenant: 'common' },
};

function response(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('Google callback exchanges code, verifies the mailbox, and returns only grant data to backend', async () => {
  const urls: string[] = [];
  const adapter = new MailOAuthProviderAdapter(credentials, async (input) => {
    const url = String(input); urls.push(url);
    if (url.endsWith('/token')) return response({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/gmail.readonly' });
    return response({ email: 'user@gmail.com', email_verified: true });
  });
  const grant = await adapter.exchange({ provider: 'gmail', code: 'code', codeVerifier: 'verifier', redirectUri: 'https://app.example.com/callback' });
  assert.equal(grant.emailAddress, 'user@gmail.com');
  assert.deepEqual(grant.grantedScopes, ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly']);
  assert.equal(grant.tokens.refreshToken, 'refresh');
  assert.equal(urls[0], 'https://oauth2.googleapis.com/token');
  assert.equal(urls[1], 'https://openidconnect.googleapis.com/v1/userinfo');
});

test('Outlook callback resolves the connected mailbox through Microsoft Graph', async () => {
  const adapter = new MailOAuthProviderAdapter(credentials, async (input) => String(input).includes('/token')
    ? response({ access_token: 'access', refresh_token: 'refresh', expires_in: '3600', scope: 'openid email offline_access Mail.Read User.Read' })
    : response({ mail: 'user@outlook.com', userPrincipalName: 'alias@outlook.com' }));
  const grant = await adapter.exchange({ provider: 'outlook', code: 'code', codeVerifier: 'verifier', redirectUri: 'https://app.example.com/callback' });
  assert.equal(grant.emailAddress, 'user@outlook.com');
  assert.deepEqual(grant.grantedScopes, ['openid', 'email', 'offline_access', 'Mail.Read', 'User.Read']);
});

test('provider failures and unverified Google mailbox do not produce a grant', async () => {
  const google = new MailOAuthProviderAdapter(credentials, async (input) => String(input).endsWith('/token')
    ? response({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'openid email' })
    : response({ email: 'user@gmail.com', email_verified: false }));
  await assert.rejects(google.exchange({ provider: 'gmail', code: 'code', codeVerifier: 'verifier', redirectUri: 'https://app.example.com/callback' }), /not verified/);
  const microsoft = new MailOAuthProviderAdapter(credentials, async () => response({ error: 'invalid_grant' }, false, 400));
  await assert.rejects(microsoft.exchange({ provider: 'outlook', code: 'code', codeVerifier: 'verifier', redirectUri: 'https://app.example.com/callback' }), /exchange failed/);
});

test('refresh preserves rotated-token semantics and Outlook revocation stays owner-controlled', async () => {
  const adapter = new MailOAuthProviderAdapter(credentials, async () => response({ access_token: 'new-access', expires_in: 1800 }));
  const refreshed = await adapter.refresh('gmail', 'old-refresh');
  assert.equal(refreshed.refreshToken, 'old-refresh');
  await assert.rejects(adapter.revoke('outlook', 'access', 'refresh'), /owner/);
});
