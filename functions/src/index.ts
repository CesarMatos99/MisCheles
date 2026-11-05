import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { AccountDeletionPolicyError, requireEligibleAccountDeletion, requireExplicitDeletionConfirmation } from './account_deletion_policy';
import { buildImportedMovement, ImportedCandidateReviewError, type ImportedCandidateForConfirmation, type ImportedMovementConfirmation } from './imported_candidate_review';
import { beginMailOAuthAuthorization, completeMailOAuthAuthorization, consumeMailOAuthCallback, type MailOAuthProviderConfig } from './mail_oauth_flow';
import { MailOAuthProviderAdapter } from './mail_oauth_provider_adapters';
import { EncryptedMailTokenVault, decodeMailTokenEncryptionKey, type MailTokenKeyring } from './encrypted_mail_token_vault';
import { FirestoreMailConnectionMetadataStore } from './firestore_mail_connection_store';
import { FirestorePrivateMailTokenStore } from './firestore_private_mail_token_store';
import { deleteExpiredMailOAuthStates, deletePendingMailOAuthStatesForUid, FirestoreMailOAuthStateStore } from './firestore_mail_oauth_state_store';
import { disconnectMailConnection } from './mail_connection_lifecycle';

const GMAIL_OAUTH_CLIENT_SECRET = defineSecret('GMAIL_OAUTH_CLIENT_SECRET');
const MICROSOFT_OAUTH_CLIENT_SECRET = defineSecret('MICROSOFT_OAUTH_CLIENT_SECRET');
const MAIL_TOKEN_KEYRING = defineSecret('MAIL_TOKEN_KEYRING');

if (getApps().length === 0) initializeApp();

/** Permanently removes the caller's complete Firestore tree and Firebase Auth identity. */
export const deleteMyAccount = onCall(
  {
    // Local emulator requests use its Auth emulator; deployed calls always require App Check.
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    timeoutSeconds: 540,
  },
  async (request) => {
    try {
      requireExplicitDeletionConfirmation(request.data?.confirmation);
    } catch (error) {
      if (error instanceof AccountDeletionPolicyError) throw new HttpsError(error.code, error.message);
      throw new HttpsError('failed-precondition', 'Explicit account deletion confirmation is required.');
    }
    let uid: string;
    try {
      uid = requireEligibleAccountDeletion(request.auth, Math.floor(Date.now() / 1000));
    } catch (error) {
      if (error instanceof AccountDeletionPolicyError) {
        throw new HttpsError(error.code, error.message);
      }
      throw new HttpsError('internal', 'Account deletion could not be authorized.');
    }

    const userRef = getFirestore().collection('users').doc(uid);
    try {
      // Remove pending one-time state/verifiers before deleting the account; completed token
      // bundles and their child collections are removed by recursiveDelete below.
      await deletePendingMailOAuthStatesForUid(getFirestore(), uid);
      // Admin recursiveDelete includes all descendant collections and cannot be spoofed by a client UID.
      // Mail OAuth credentials live outside users/{uid} and must be removed with the account.
      await Promise.all([
        getFirestore().recursiveDelete(userRef),
        getFirestore().recursiveDelete(getFirestore().collection('privateMailTokens').doc(uid)),
      ]);
      await getAuth().deleteUser(uid);
      return { deleted: true };
    } catch {
      // Never expose document paths, provider data, or raw Firebase errors to clients.
      throw new HttpsError('internal', 'Account deletion did not finish. You can retry from account settings.');
    }
  },
);


/** Confirms an imported mail candidate and writes its movement atomically in the same user's account. */
export const confirmImportedCandidate = onCall(
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to review imported movements.');
    if (request.auth?.token.email_verified !== true) {
      throw new HttpsError('permission-denied', 'Verify your Mis Cheles account before reviewing imported movements.');
    }
    const input = request.data as Partial<ImportedMovementConfirmation> | undefined;
    if (typeof input?.candidateId !== 'string' || !/^mail_[a-f0-9]{64}$/.test(input.candidateId)
      || typeof input.categoryName !== 'string'
      || (input.categoryId !== undefined && typeof input.categoryId !== 'string')
      || (input.description !== undefined && typeof input.description !== 'string')
      || (input.paymentMethod !== undefined && typeof input.paymentMethod !== 'string')
      || (input.confirmPossibleDuplicate !== undefined && typeof input.confirmPossibleDuplicate !== 'boolean')) {
      throw new HttpsError('invalid-argument', 'A candidate and valid category are required.');
    }
    const db = getFirestore();
    const candidateRef = db.collection('users').doc(uid).collection('importedCandidates').doc(input.candidateId);
    try {
      return await db.runTransaction(async (transaction) => {
        const candidateSnapshot = await transaction.get(candidateRef);
        if (!candidateSnapshot.exists) throw new HttpsError('not-found', 'The imported candidate no longer exists.');
        const candidate = candidateSnapshot.data() as ImportedCandidateForConfirmation & { schemaVersion?: unknown };
        if (candidate.ownerUid !== uid || candidate.id !== input.candidateId || candidate.schemaVersion !== 1) {
          throw new HttpsError('permission-denied', 'The imported candidate does not belong to this account.');
        }
        if (candidate.reviewStatus === 'confirmed' && candidate.confirmedMovementId) {
          const existingRef = db.collection('users').doc(uid).collection('transactions').doc(candidate.confirmedMovementId);
          const existing = await transaction.get(existingRef);
          if (existing.exists && existing.data()?.importedCandidateId === candidate.id) {
            return { movementId: candidate.confirmedMovementId, alreadyConfirmed: true };
          }
          throw new HttpsError('failed-precondition', 'The confirmed movement needs account review.');
        }
        const movementData = buildImportedMovement(uid, candidate, input as ImportedMovementConfirmation);
        const movementRef = db.collection('users').doc(uid).collection('transactions').doc(String(movementData.id));
        const movementSnapshot = await transaction.get(movementRef);
        if (movementSnapshot.exists) {
          if (movementSnapshot.data()?.importedCandidateId === candidate.id) {
            transaction.update(candidateRef, { reviewStatus: 'confirmed', confirmedMovementId: movementRef.id, updatedAt: new Date().toISOString() });
            return { movementId: movementRef.id, alreadyConfirmed: true };
          }
          throw new HttpsError('already-exists', 'A movement already uses this identifier.');
        }
        const now = new Date().toISOString();
        transaction.create(movementRef, { ...movementData, createdAt: now, updatedAt: now });
        transaction.update(candidateRef, {
          reviewStatus: 'confirmed',
          confirmedMovementId: movementRef.id,
          updatedAt: now,
        });
        return { movementId: movementRef.id, alreadyConfirmed: false };
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof ImportedCandidateReviewError) throw new HttpsError(error.code, error.message);
      throw new HttpsError('internal', 'The imported movement could not be confirmed. Please retry.');
    }
  },
);


/** Starts optional mail-provider consent; this does not authorize access to the Mis Cheles account. */
export const beginMailOAuth = onCall(
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to connect a mail provider.');
    if (request.auth?.token.email_verified !== true) throw new HttpsError('permission-denied', 'Verify your Mis Cheles account first.');
    const provider = request.data?.provider;
    if (provider !== 'gmail' && provider !== 'outlook') throw new HttpsError('invalid-argument', 'Choose Gmail or Outlook.');
    const clientId = provider === 'gmail' ? process.env.GMAIL_OAUTH_CLIENT_ID : process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const redirectUri = provider === 'gmail' ? process.env.GMAIL_OAUTH_REDIRECT_URI : process.env.MICROSOFT_OAUTH_REDIRECT_URI;
    const tenant = process.env.MICROSOFT_OAUTH_TENANT_ID || 'common';
    if (!clientId || !redirectUri || (provider === 'outlook' && !/^(common|organizations|consumers|[0-9a-f-]{36})$/i.test(tenant))) {
      throw new HttpsError('failed-precondition', 'Mail provider authorization is not configured yet.');
    }
    const config = provider === 'gmail'
      ? { provider, clientId, redirectUri, authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] }
      : { provider, clientId, redirectUri, authorizationEndpoint: 'https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0/authorize', scopes: ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/User.Read'] };
    try {
      const result = await beginMailOAuthAuthorization({ uid, config, stateStore: new FirestoreMailOAuthStateStore(getFirestore()) });
      return result;
    } catch {
      throw new HttpsError('failed-precondition', 'Mail provider authorization could not be started.');
    }
  },
);


/** Keeps abandoned PKCE verifiers from accumulating after users close provider consent. */
export const cleanupExpiredMailOAuthStates = onSchedule('every 24 hours', async () => {
  await deleteExpiredMailOAuthStates(getFirestore());
});


/** Provider redirect endpoint. It exchanges codes server-side and renders no token or mailbox data. */
export const completeMailOAuth = onRequest(
  {
    secrets: [GMAIL_OAUTH_CLIENT_SECRET, MICROSOFT_OAUTH_CLIENT_SECRET, MAIL_TOKEN_KEYRING],
    timeoutSeconds: 60,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store, max-age=0');
    response.set('Pragma', 'no-cache');
    response.set('X-Content-Type-Options', 'nosniff');
    response.set('Referrer-Policy', 'no-referrer');
    response.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    response.type('html');
    const finish = (status: number, message: string) => response.status(status).send('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mis Cheles</title><body><main><h1>Mis Cheles</h1><p>' + message + '</p><p>Puedes cerrar esta ventana y volver a la aplicación.</p></main></body></html>');
    if (request.method !== 'GET') return finish(405, 'Solicitud no permitida.');
    const state = request.query.state;
    if (request.query.error) {
      try { await consumeMailOAuthCallback({ state, stateStore: new FirestoreMailOAuthStateStore(getFirestore()) }); }
      catch { return finish(400, 'No se completó la autorización del correo.'); }
      return finish(400, 'No se completó la autorización del correo.');
    }
    try {
      const db = getFirestore();
      const stateStore = new FirestoreMailOAuthStateStore(db);
      const authorization = await consumeMailOAuthCallback({ state, stateStore });
      if (!authorization) return finish(400, 'La autorización venció o ya fue utilizada.');
      const provider = authorization.provider;
      const config = mailOAuthProviderConfig(provider);
      if (config.redirectUri !== authorization.redirectUri) return finish(400, 'La autorización venció o cambió de configuración.');
      const adapter = new MailOAuthProviderAdapter({
        gmail: { clientId: process.env.GMAIL_OAUTH_CLIENT_ID || '', clientSecret: GMAIL_OAUTH_CLIENT_SECRET.value() },
        outlook: { clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '', clientSecret: MICROSOFT_OAUTH_CLIENT_SECRET.value(), tenant: process.env.MICROSOFT_OAUTH_TENANT_ID || 'common' },
      });
      const keyring = parseMailTokenKeyring(MAIL_TOKEN_KEYRING.value());
      const metadata = new FirestoreMailConnectionMetadataStore(db, () => FieldValue.serverTimestamp());
      const tokenVault = new EncryptedMailTokenVault(
        new FirestorePrivateMailTokenStore(db, () => FieldValue.serverTimestamp()), adapter, adapter, keyring, metadata,
      );
      await completeMailOAuthAuthorization({
        authorization, code: request.query.code, exchanger: adapter, metadata, credentials: tokenVault,
      });
      return finish(200, 'El correo quedó conectado correctamente.');
    } catch {
      return finish(400, 'No se pudo completar la conexión. Vuelve a intentarlo desde Mis Cheles.');
    }
  },
);

function mailOAuthProviderConfig(provider: 'gmail' | 'outlook'): MailOAuthProviderConfig {
  if (provider === 'gmail') {
    return { provider, clientId: process.env.GMAIL_OAUTH_CLIENT_ID || '', redirectUri: process.env.GMAIL_OAUTH_REDIRECT_URI || '', authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] };
  }
  const tenant = process.env.MICROSOFT_OAUTH_TENANT_ID || 'common';
  return { provider, clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '', redirectUri: process.env.MICROSOFT_OAUTH_REDIRECT_URI || '', authorizationEndpoint: 'https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0/authorize', scopes: ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/User.Read'] };
}

function parseMailTokenKeyring(value: string): MailTokenKeyring {
  const parsed = JSON.parse(value) as { activeKeyId?: unknown; keys?: unknown };
  if (typeof parsed.activeKeyId !== 'string' || !parsed.keys || typeof parsed.keys !== 'object' || Array.isArray(parsed.keys)) throw new Error('Mail token keyring is invalid.');
  const entries = Object.entries(parsed.keys as Record<string, unknown>);
  if (entries.length < 1 || entries.length > 5) throw new Error('Mail token keyring is invalid.');
  const keys = new Map(entries.map(([id, key]) => {
    if (typeof key !== 'string') throw new Error('Mail token keyring is invalid.');
    return [id, decodeMailTokenEncryptionKey(key)] as const;
  }));
  return { activeKeyId: parsed.activeKeyId, keys };
}


/** Disconnects a caller-owned mail connection after provider-side revocation succeeds. */
export const disconnectMail = onCall(
  {
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    secrets: [GMAIL_OAUTH_CLIENT_SECRET, MICROSOFT_OAUTH_CLIENT_SECRET, MAIL_TOKEN_KEYRING],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to disconnect a mail provider.');
    if (request.auth?.token.email_verified !== true) throw new HttpsError('permission-denied', 'Verify your Mis Cheles account first.');
    const connectionId = request.data?.connectionId;
    const provider = request.data?.provider;
    if (typeof connectionId !== 'string' || !connectionId.trim() || connectionId.length > 256 || connectionId.includes('/')
      || (provider !== 'gmail' && provider !== 'outlook')) throw new HttpsError('invalid-argument', 'A valid mail connection is required.');
    try {
      const db = getFirestore();
      const metadata = new FirestoreMailConnectionMetadataStore(db, () => FieldValue.serverTimestamp());
      const adapter = new MailOAuthProviderAdapter({
        gmail: { clientId: process.env.GMAIL_OAUTH_CLIENT_ID || '', clientSecret: GMAIL_OAUTH_CLIENT_SECRET.value() },
        outlook: { clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '', clientSecret: MICROSOFT_OAUTH_CLIENT_SECRET.value(), tenant: process.env.MICROSOFT_OAUTH_TENANT_ID || 'common' },
      });
      const vault = new EncryptedMailTokenVault(new FirestorePrivateMailTokenStore(db, () => FieldValue.serverTimestamp()), adapter, adapter, parseMailTokenKeyring(MAIL_TOKEN_KEYRING.value()), metadata);
      await disconnectMailConnection({ uid, connectionId, provider, metadata, credentials: vault });
      return { disconnected: true };
    } catch {
      throw new HttpsError('failed-precondition', 'The provider could not revoke this connection. Retry or revoke consent from the provider account settings.');
    }
  },
);
