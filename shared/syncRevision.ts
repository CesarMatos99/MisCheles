export type RevisionToken = string;
export type RevisionedRecord = { updatedAt?: unknown; _cloudRevision?: unknown; [key: string]: unknown };

function canonical(value: unknown): string {
  if (value instanceof Date) return 'date:' + value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return 'timestamp:' + value.toMillis();
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).filter((key) => key !== '_cloudRevision').sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'undefined';
}

function contentToken(record: RevisionedRecord): string {
  const text = canonical(record);
  let hash = 14695981039346656037n;
  const mask = (1n << 64n) - 1n;
  for (let index = 0; index < text.length; index += 1) hash = ((hash ^ BigInt(text.charCodeAt(index))) * 1099511628211n) & mask;
  return 'content:' + hash.toString(16).padStart(16, '0');
}

/** Uses the server update time, with a deterministic content token for older records lacking one. */
export function cloudRevision(record: RevisionedRecord | null | undefined): RevisionToken | null {
  if (!record) return null;
  const value = record.updatedAt;
  if (typeof value === 'number' && Number.isFinite(value)) return 'time:' + value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return 'time:' + value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const stamp = value as { seconds?: unknown; nanoseconds?: unknown; toMillis: () => number };
    if (typeof stamp.seconds === 'number' && typeof stamp.nanoseconds === 'number') return 'time:' + stamp.seconds + ':' + stamp.nanoseconds;
    const revision = value.toMillis();
    if (Number.isFinite(revision)) return 'time:' + revision;
  }
  if (typeof record._cloudRevision === 'string' && record._cloudRevision) return record._cloudRevision;
  return contentToken(record);
}

/** Missing documents conflict only when a previously read revision existed. */
export function isStaleCloudWrite(expectedRevision: RevisionToken | null, remote: RevisionedRecord | null): boolean {
  if (!remote) return expectedRevision !== null;
  const currentRevision = cloudRevision(remote);
  return expectedRevision === null || expectedRevision !== currentRevision;
}

export class CloudRevisionConflictError extends Error {
  constructor() { super('Cloud record changed since this device last read it.'); this.name = 'CloudRevisionConflictError'; }
}
