import assert from 'node:assert/strict';
import test from 'node:test';
import { MailApiDeltaSource, MailApiSafeMessageReader, MailParserConfigurationError } from './mail_provider_api.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('mail reader refuses an empty or invalid parser registry before sync can consume a cursor', () => {
  assert.throws(() => new MailApiSafeMessageReader(async () => { throw new Error('Fetch must not happen.'); }), MailParserConfigurationError);
  assert.throws(() => new MailApiSafeMessageReader(async () => new Response(), [null as never]), MailParserConfigurationError);
});

test('Gmail baseline records only a history checkpoint, then reads newly added inbox message metadata', async () => {
  const calls: string[] = [];
  const source = new MailApiDeltaSource(async (input) => {
    const url = String(input); calls.push(url);
    if (url.endsWith('/profile')) return json({ historyId: '100' });
    if (url.includes('/history?')) return json({ historyId: '105', history: [{ messagesAdded: [{ message: { id: 'message-1' } }] }] });
    if (url.endsWith('/messages/message-1?format=metadata&metadataHeaders=Date')) return json({ internalDate: '1793520000000' });
    throw new Error('Unexpected Gmail endpoint: ' + url);
  });
  const baseline = await source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'gmail', accessToken: 'secret', initialized: false, cursor: null });
  assert.equal(baseline.messages.length, 0); assert.equal(baseline.initialized, true); assert.equal(baseline.hasMore, false);
  const page = await source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'gmail', accessToken: 'secret', initialized: true, cursor: baseline.nextCursor });
  assert.deepEqual(page.messages, [{ provider: 'gmail', providerMessageId: 'message-1', receivedAt: new Date(1793520000000).toISOString() }]);
  assert.equal(page.hasMore, false); assert.ok(calls[1].includes('startHistoryId=100')); assert.equal(calls.length, 3);
});

test('Gmail history pagination checkpoints pending IDs without skipping messages', async () => {
  const ids = Array.from({ length: 53 }, (_, index) => 'm' + index);
  let metadataCalls = 0; let historyCalls = 0;
  const source = new MailApiDeltaSource(async (input) => {
    const url = String(input);
    if (url.endsWith('/profile')) return json({ historyId: '200' });
    if (url.includes('/history?')) { historyCalls += 1; return json({ historyId: '205', history: [{ messagesAdded: ids.map((id) => ({ message: { id } })) }] }); }
    if (url.includes('/messages/m')) { metadataCalls += 1; return json({ internalDate: '1793520000000' }); }
    throw new Error('Unexpected endpoint');
  });
  const baseline = await source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'gmail', accessToken: 'x', initialized: false, cursor: null });
  const first = await source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'gmail', accessToken: 'x', initialized: true, cursor: baseline.nextCursor });
  assert.equal(first.messages.length, 50); assert.equal(first.hasMore, true);
  const second = await source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'gmail', accessToken: 'x', initialized: true, cursor: first.nextCursor });
  assert.equal(second.messages.length, 3); assert.equal(second.hasMore, false);
  assert.equal(metadataCalls, 53); assert.equal(historyCalls, 1);
});

test('Outlook delta uses a bounded first-sync date and accepts only Graph mailbox delta URLs', async () => {
  let requested = '';
  const next = 'https://graph.microsoft.com/v1.0/me/mailFolders/AAMkAAA=/messages/delta?$skiptoken=opaque';
  const delta = 'https://graph.microsoft.com/v1.0/me/mailFolders/AAMkAAA=/messages/delta?$deltatoken=opaque';
  const source = new MailApiDeltaSource(async (input) => {
    requested = String(input);
    return requested.includes('$skiptoken')
      ? json({ value: [{ id: 'outlook-id', receivedDateTime: '2026-10-31T12:00:00Z' }], '@odata.deltaLink': delta })
      : json({ value: [], '@odata.nextLink': next });
  }, () => Date.parse('2026-11-01T00:00:00Z'));
  const first = await source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'outlook', accessToken: 'x', initialized: false, cursor: null });
  assert.ok(requested.includes('receivedDateTime+ge+2026-10-18'));
  assert.equal(first.hasMore, true); assert.equal(first.messages.length, 0);
  const page = await source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'outlook', accessToken: 'x', initialized: true, cursor: first.nextCursor });
  assert.deepEqual(page.messages, [{ provider: 'outlook', providerMessageId: 'outlook-id', receivedAt: '2026-10-31T12:00:00.000Z' }]);
  assert.equal(page.hasMore, false); assert.equal(page.nextCursor, delta);
});

test('changed message body is consumed in memory and only a parser result leaves the adapter', async () => {
  const body = Buffer.from('Card purchase RD$ 250 at Market on 2026-10-31').toString('base64url');
  let parsedInput: unknown;
  const reader = new MailApiSafeMessageReader(async () => json({ payload: {
    headers: [{ name: 'From', value: 'alerts@bank.example' }, { name: 'Subject', value: 'Purchase notification' }],
    mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: body } }],
  } }), [{ parse(input) { parsedInput = input; return { transactionType: 'expense', occurredOn: '2026-10-31', amountMinor: 25000, currency: 'DOP', merchant: 'Market', description: 'Card purchase' }; } }]);
  const result = await reader.readProviderNotice('token', { provider: 'gmail', providerMessageId: 'id-1', receivedAt: '2026-10-31T12:00:00Z' });
  assert.equal(result?.amountMinor, 25000);
  assert.deepEqual(parsedInput, { provider: 'gmail', from: 'alerts@bank.example', subject: 'Purchase notification', text: 'Card purchase RD$ 250 at Market on 2026-10-31', receivedAt: '2026-10-31T12:00:00Z' });
  assert.equal(JSON.stringify(result).includes('alerts@bank.example'), false);
});

test('invalid provider cursor URLs are rejected before any fetch', async () => {
  const source = new MailApiDeltaSource(async () => { throw new Error('Fetch must not happen.'); });
  await assert.rejects(source.fetchPage({ uid: 'u', connectionId: 'c', provider: 'outlook', accessToken: 'x', initialized: true, cursor: 'https://attacker.example/v1.0/me/mailFolders/inbox/messages/delta' }), /not allowed/);
});
