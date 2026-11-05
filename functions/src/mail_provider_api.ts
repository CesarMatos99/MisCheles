import type { MailProvider, ParsedBankNotice, ProviderMessageRef, SafeMessageReader } from './mail_import_contract';
import type { MailProviderDeltaSource } from './mail_sync_contract';

type FetchLike = typeof fetch;
type Cursor = { version: 1; provider: 'gmail'; historyId: string; pageToken?: string; pendingIds?: string[]; targetHistoryId?: string };

export class MailProviderDeltaError extends Error {
  readonly provider: MailProvider;
  readonly status: number;
  constructor(provider: MailProvider, status: number, message: string) { super(message); this.provider = provider; this.status = status; }
}

/** Gmail history and Microsoft Graph delta reader. Cursors are opaque and must remain backend-only. */
export class MailApiDeltaSource implements MailProviderDeltaSource {
  private readonly fetcher: FetchLike;
  private readonly now: () => number;
  constructor(fetcher: FetchLike = fetch, now: () => number = Date.now) { this.fetcher = fetcher; this.now = now; }

  async fetchPage(input: { uid: string; connectionId: string; provider: MailProvider; accessToken: string; initialized: boolean; cursor: string | null }) {
    if (!input.accessToken || input.accessToken.length > 16_384) throw new Error('A valid provider access token is required.');
    if (input.provider === 'gmail') return this.fetchGmail(input.accessToken, input.initialized, input.cursor);
    return this.fetchOutlook(input.accessToken, input.initialized, input.cursor);
  }

  private async fetchGmail(token: string, initialized: boolean, cursorValue: string | null) {
    if (!initialized) {
      const profile = await this.getJson('gmail', 'https://gmail.googleapis.com/gmail/v1/users/me/profile', token);
      const historyId = profile.historyId;
      if (typeof historyId !== 'string' || !/^\d{1,32}$/.test(historyId)) throw new Error('Gmail returned an invalid history checkpoint.');
      return { messages: [], initialized: true, nextCursor: encodeCursor({ version: 1, provider: 'gmail', historyId }), hasMore: false };
    }
    const cursor = decodeCursor(cursorValue);
    if (cursor.pendingIds?.length) {
      const ids = cursor.pendingIds.slice(0, 50);
      const messages = await this.gmailMessageRefs(ids, token);
      const pendingIds = cursor.pendingIds.slice(ids.length);
      const hasMore = pendingIds.length > 0 || Boolean(cursor.pageToken);
      const nextCursor = hasMore
        ? encodeCursor({ ...cursor, pendingIds, ...(pendingIds.length ? {} : {}) })
        : encodeCursor({ version: 1, provider: 'gmail', historyId: cursor.targetHistoryId || cursor.historyId });
      return { messages, initialized: true, nextCursor, hasMore };
    }
    const params = new URLSearchParams({ startHistoryId: cursor.historyId, maxResults: '50', labelId: 'INBOX', historyTypes: 'messageAdded' });
    if (cursor.pageToken) params.set('pageToken', cursor.pageToken);
    const response = await this.fetcher('https://gmail.googleapis.com/gmail/v1/users/me/history?' + params.toString(), { headers: { authorization: 'Bearer ' + token, accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    const body = await readJson(response, 'gmail');
    if (!response.ok) throw new MailProviderDeltaError('gmail', response.status, response.status === 404 ? 'Gmail history checkpoint expired; mailbox needs a fresh baseline.' : 'Gmail message history could not be read.');
    const historyId = body.historyId;
    if (typeof historyId !== 'string' || !/^\d{1,32}$/.test(historyId)) throw new Error('Gmail returned an invalid history checkpoint.');
    const ids = new Set<string>();
    if (Array.isArray(body.history)) for (const record of body.history) {
      if (!record || typeof record !== 'object') continue;
      const added = (record as Record<string, unknown>).messagesAdded;
      if (!Array.isArray(added)) continue;
      for (const item of added) {
        const message = item && typeof item === 'object' ? (item as Record<string, unknown>).message : null;
        const id = message && typeof message === 'object' ? (message as Record<string, unknown>).id : null;
        if (typeof id === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(id)) ids.add(id);
      }
    }
    const allIds = [...ids];
    if (allIds.length > 500) throw new Error('Gmail history page is too large to checkpoint safely.');
    const nextPageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined;
    const current = decodeCursor(cursorValue);
    const firstIds = allIds.slice(0, 50);
    const messages = await this.gmailMessageRefs(firstIds, token);
    const pendingIds = allIds.slice(firstIds.length);
    const hasMore = pendingIds.length > 0 || Boolean(nextPageToken);
    const nextCursor = hasMore
      ? encodeCursor({ version: 1, provider: 'gmail', historyId: current.historyId, pageToken: nextPageToken, pendingIds, targetHistoryId: historyId })
      : encodeCursor({ version: 1, provider: 'gmail', historyId });
    return { messages, initialized: true, nextCursor, hasMore };
  }

  private async gmailMessageRefs(ids: string[], token: string): Promise<ProviderMessageRef[]> {
    const messages: ProviderMessageRef[] = [];
    for (const id of ids) {
      const body = await this.getJson('gmail', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(id) + '?format=metadata&metadataHeaders=Date', token);
      if (!body || typeof body.internalDate !== 'string' || !/^\d{1,16}$/.test(body.internalDate)) continue;
      const receivedAt = new Date(Number(body.internalDate)).toISOString();
      messages.push({ provider: 'gmail', providerMessageId: id, receivedAt });
    }
    return messages;
  }

  private async fetchOutlook(token: string, initialized: boolean, cursorValue: string | null) {
    let url: string;
    if (!initialized) {
      const start = new Date(this.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const initial = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta');
      initial.searchParams.set('$select', 'id,receivedDateTime');
      initial.searchParams.set('$top', '50');
      initial.searchParams.set('$filter', 'receivedDateTime ge ' + start);
      url = initial.toString();
    } else {
      url = decodeOutlookCursor(cursorValue);
    }
    const response = await this.fetcher(url, { headers: { authorization: 'Bearer ' + token, accept: 'application/json', Prefer: 'outlook.body-content-type="text"' }, signal: AbortSignal.timeout(15_000) });
    const body = await readJson(response, 'outlook');
    if (!response.ok) throw new MailProviderDeltaError('outlook', response.status, 'Outlook message delta could not be read.');
    if (!Array.isArray(body.value)) throw new Error('Outlook returned an invalid delta page.');
    const messages: ProviderMessageRef[] = [];
    for (const item of body.value) {
      if (!item || typeof item !== 'object' || '@removed' in item) continue;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== 'string' || row.id.length > 4096 || typeof row.receivedDateTime !== 'string' || !Number.isFinite(Date.parse(row.receivedDateTime))) continue;
      messages.push({ provider: 'outlook', providerMessageId: row.id, receivedAt: new Date(row.receivedDateTime).toISOString() });
    }
    const nextLink = body['@odata.nextLink'];
    const deltaLink = body['@odata.deltaLink'];
    if (typeof nextLink === 'string') return { messages, initialized: true, nextCursor: validateOutlookCursor(nextLink), hasMore: true };
    if (typeof deltaLink === 'string') return { messages, initialized: true, nextCursor: validateOutlookCursor(deltaLink), hasMore: false };
    throw new Error('Outlook omitted its delta checkpoint.');
  }

  private async getJson(provider: MailProvider, url: string, token: string): Promise<Record<string, unknown>> {
    const response = await this.fetcher(url, { headers: { authorization: 'Bearer ' + token, accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    const body = await readJson(response, provider);
    if (!response.ok) throw new MailProviderDeltaError(provider, response.status, provider === 'gmail' && response.status === 404 ? 'Gmail history checkpoint expired; mailbox needs a fresh baseline.' : 'Mail provider request failed.');
    return body;
  }
}

export interface BankNoticeParserInput { provider: MailProvider; from: string; subject: string; text: string; receivedAt: string; }
export interface BankNoticeParser { parse(input: BankNoticeParserInput): ParsedBankNotice | null; }

export class MailParserConfigurationError extends Error {
  constructor() {
    super('No bank notification parsers are configured. Mail synchronization is paused to preserve the provider cursor.');
    this.name = 'MailParserConfigurationError';
  }
}

/** Retrieves one changed message in memory and sends only its text to explicit bank parsers. */
export class MailApiSafeMessageReader implements SafeMessageReader {
  private readonly fetcher: FetchLike;
  private readonly parsers: readonly BankNoticeParser[];
  constructor(fetcher: FetchLike = fetch, parsers: readonly BankNoticeParser[] = []) {
    if (!Array.isArray(parsers) || parsers.length === 0 || parsers.some((parser) => typeof parser?.parse !== 'function')) throw new MailParserConfigurationError();
    this.fetcher = fetcher;
    this.parsers = parsers;
  }

  async readProviderNotice(token: string, message: ProviderMessageRef): Promise<ParsedBankNotice | null> {
    if (!token || token.length > 16_384 || !message.providerMessageId.trim()) return null;
    const item = message.provider === 'gmail'
      ? await this.readGmailMessage(token, message)
      : await this.readOutlookMessage(token, message);
    if (!item) return null;
    for (const parser of this.parsers) {
      const parsed = parser.parse(item);
      if (parsed) return parsed;
    }
    return null;
  }

  private async readGmailMessage(token: string, message: ProviderMessageRef): Promise<BankNoticeParserInput | null> {
    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(message.providerMessageId) + '?format=full';
    const response = await this.fetcher(url, { headers: { authorization: 'Bearer ' + token, accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    const body = await readJson(response, 'gmail');
    if (!response.ok) throw new MailProviderDeltaError('gmail', response.status, 'Gmail message could not be read.');
    const payload = body.payload;
    if (!payload || typeof payload !== 'object') return null;
    const headers = (payload as Record<string, unknown>).headers;
    const headerRows = Array.isArray(headers) ? headers : [];
    const header = (name: string) => { const row = headerRows.find((value) => value && typeof value === 'object' && String((value as Record<string, unknown>).name).toLowerCase() === name.toLowerCase()) as Record<string, unknown> | undefined; return typeof row?.value === 'string' ? row.value.slice(0, 500) : ''; };
    const bodyText = gmailText(payload as Record<string, unknown>);
    if (!bodyText || bodyText.length > 100_000) return null;
    return { provider: 'gmail', from: header('From'), subject: header('Subject'), text: bodyText.slice(0, 32_000), receivedAt: message.receivedAt };
  }

  private async readOutlookMessage(token: string, message: ProviderMessageRef): Promise<BankNoticeParserInput | null> {
    const url = 'https://graph.microsoft.com/v1.0/me/messages/' + encodeURIComponent(message.providerMessageId) + '?$select=from,subject,body,receivedDateTime';
    const response = await this.fetcher(url, { headers: { authorization: 'Bearer ' + token, accept: 'application/json', Prefer: 'outlook.body-content-type="text"' }, signal: AbortSignal.timeout(15_000) });
    const body = await readJson(response, 'outlook');
    if (!response.ok) throw new MailProviderDeltaError('outlook', response.status, 'Outlook message could not be read.');
    const from = body.from && typeof body.from === 'object' ? (body.from as Record<string, unknown>).emailAddress : null;
    const sender = from && typeof from === 'object' ? (from as Record<string, unknown>).address : '';
    const content = body.body && typeof body.body === 'object' ? (body.body as Record<string, unknown>).content : '';
    if (typeof content !== 'string' || !content || content.length > 100_000) return null;
    return { provider: 'outlook', from: typeof sender === 'string' ? sender.slice(0, 500) : '', subject: typeof body.subject === 'string' ? body.subject.slice(0, 500) : '', text: content.slice(0, 32_000), receivedAt: message.receivedAt };
  }
}

function gmailText(payload: Record<string, unknown>): string {
  let plain = ''; let html = '';
  const visit = (part: unknown) => {
    if (!part || typeof part !== 'object') return;
    const row = part as Record<string, unknown>;
    const body = row.body && typeof row.body === 'object' ? row.body as Record<string, unknown> : {};
    if (typeof body.data === 'string') {
      const decoded = Buffer.from(body.data, 'base64url').toString('utf8');
      if (decoded.length > 100_000) return;
      if (row.mimeType === 'text/plain') plain += decoded + '\n';
      else if (row.mimeType === 'text/html') html += decoded + '\n';
    }
    if (Array.isArray(row.parts)) for (const child of row.parts) visit(child);
  };
  visit(payload);
  if (plain) return plain.trim();
  return html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
}

function encodeCursor(cursor: Cursor): string {
  const encoded = Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  if (encoded.length > 16_384) throw new Error('Gmail checkpoint exceeded the supported size.');
  return encoded;
}
function decodeCursor(value: string | null): Cursor {
  if (!value || value.length > 16_384 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Gmail checkpoint is missing or invalid.');
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { throw new Error('Gmail checkpoint is malformed.'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('Gmail checkpoint is malformed.');
  const cursor = parsed as Record<string, unknown>;
  if (cursor.version !== 1 || cursor.provider !== 'gmail' || typeof cursor.historyId !== 'string' || !/^\d{1,32}$/.test(cursor.historyId)
    || (cursor.pageToken !== undefined && (typeof cursor.pageToken !== 'string' || cursor.pageToken.length > 4096))
    || (cursor.targetHistoryId !== undefined && (typeof cursor.targetHistoryId !== 'string' || !/^\d{1,32}$/.test(cursor.targetHistoryId)))
    || (cursor.pendingIds !== undefined && (!Array.isArray(cursor.pendingIds) || cursor.pendingIds.length > 500 || cursor.pendingIds.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(id))))) throw new Error('Gmail checkpoint is malformed.');
  return cursor as unknown as Cursor;
}
function validateOutlookCursor(value: string): string {
  if (value.length > 16_384) throw new Error('Outlook checkpoint exceeded the supported size.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'graph.microsoft.com' || !/^\/v1\.0\/me\/mailFolders\/(?:inbox|[A-Za-z0-9_+=.-]{1,2048})\/messages\/delta$/.test(url.pathname)) throw new Error('Outlook checkpoint URL is not allowed.');
  return url.toString();
}
function decodeOutlookCursor(value: string | null): string {
  if (!value) throw new Error('Outlook checkpoint is missing.');
  return validateOutlookCursor(value);
}
async function readJson(response: Response, provider: MailProvider): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new Error('Mail provider response exceeded the supported size.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error(provider + ' returned an invalid response.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(provider + ' returned an invalid response.');
  return value as Record<string, unknown>;
}
