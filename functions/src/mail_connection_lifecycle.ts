import type { MailProvider } from './mail_import_contract';
import type { MailTokenBundle } from './encrypted_mail_token_vault';
import type { MailConnectionMetadataInput } from './firestore_mail_connection_store';

export interface MailConnectionMetadataLifecycleStore {
  upsert(uid: string, connectionId: string, input: MailConnectionMetadataInput): Promise<void>;
  delete(uid: string, connectionId: string): Promise<void>;
}
export interface MailConnectionCredentialLifecycle {
  saveTokens(uid: string, connectionId: string, provider: MailProvider, tokens: MailTokenBundle): Promise<void>;
  revoke(uid: string, connectionId: string, provider: MailProvider): Promise<void>;
}

/**
 * Provision credentials while keeping the connection non-active until both backend records exist.
 * OAuth callback handlers should pass only verified server-side provider data here.
 */
export async function activateMailConnection(input: {
  uid: string;
  connectionId: string;
  provider: MailProvider;
  emailAddress: string;
  grantedScopes: string[];
  connectedAt: string;
  tokens: MailTokenBundle;
  metadata: MailConnectionMetadataLifecycleStore;
  credentials: MailConnectionCredentialLifecycle;
}): Promise<void> {
  const connection = {
    provider: input.provider,
    emailAddress: input.emailAddress,
    grantedScopes: input.grantedScopes,
    connectedAt: input.connectedAt,
  } as const;
  await input.metadata.upsert(input.uid, input.connectionId, {
    ...connection,
    status: 'reauthorization_required',
  });
  await input.credentials.saveTokens(input.uid, input.connectionId, input.provider, input.tokens);
  await input.metadata.upsert(input.uid, input.connectionId, {
    ...connection,
    status: 'active',
  });
}

/** Revokes provider credentials first; a failed provider revocation leaves retryable metadata intact. */
export async function disconnectMailConnection(input: {
  uid: string;
  connectionId: string;
  provider: MailProvider;
  metadata: MailConnectionMetadataLifecycleStore;
  credentials: MailConnectionCredentialLifecycle;
}): Promise<void> {
  await input.credentials.revoke(input.uid, input.connectionId, input.provider);
  await input.metadata.delete(input.uid, input.connectionId);
}
