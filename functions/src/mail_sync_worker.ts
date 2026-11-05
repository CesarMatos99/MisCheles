import { processBankNotice } from './mail_import_contract';
import type { CandidatePersistence, MailAuthContext, MailProvider, MailTokenVault, SafeMessageReader } from './mail_import_contract';
import { syncMailConnection } from './mail_sync_contract';
import type { MailProviderDeltaSource, MailSyncCheckpointStore, MailSyncResult } from './mail_sync_contract';

/** Backend-only composition for paging provider messages into reviewed candidates.
 * Callers must supply a configured parser-backed SafeMessageReader; this module
 * does not activate OAuth, schedule jobs, or expose message bodies to clients.
 */
export function syncMailWithCandidateReview(input: {
  auth: MailAuthContext | null;
  connectionId: string;
  provider: MailProvider;
  checkpointStore: MailSyncCheckpointStore;
  source: MailProviderDeltaSource;
  tokenVault: MailTokenVault;
  reader: SafeMessageReader;
  persistence: CandidatePersistence;
  now?: () => number;
  maxPages?: number;
}): Promise<MailSyncResult> {
  return syncMailConnection({
    auth: input.auth,
    connectionId: input.connectionId,
    provider: input.provider,
    checkpointStore: input.checkpointStore,
    source: input.source,
    tokenVault: input.tokenVault,
    now: input.now,
    maxPages: input.maxPages,
    processMessage: (message, auth, now, accessToken) => processBankNotice({
      auth,
      connectionId: input.connectionId,
      message,
      tokenVault: input.tokenVault,
      reader: input.reader,
      persistence: input.persistence,
      providerAccessToken: accessToken,
      now,
    }),
  });
}
