/** Verify persisted source fields, excluding destination-managed metadata. */
export function verifyMigratedRecord(input: {
  uid: string; collection: string; sourceId: string; documentId: string;
  actualDocumentId: string; expected: Record<string, unknown>; actual: Record<string, unknown>;
}): boolean {
  const { actual, expected } = input;
  if (input.actualDocumentId !== input.documentId || actual.id !== input.documentId ||
      actual.ownerUid !== input.uid || actual.schemaVersion !== 1 ||
      actual.origin !== 'local_migration' || actual.sourceEntity !== input.collection ||
      actual.localSourceId !== input.sourceId) return false;
  const managed = new Set(['id', 'ownerUid', 'schemaVersion', 'origin', 'sourceEntity',
    'localSourceId', 'createdAt', 'updatedAt', '_cloudRevision', 'cloudDocumentId']);
  return Object.entries(expected).filter(([key]) => !managed.has(key))
    .every(([key, value]) => Object.hasOwn(actual, key) && equalValue(value, actual[key]));
}
function equalValue(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.length === actual.length &&
    expected.every((value, index) => equalValue(value, actual[index]));
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    const left = expected as Record<string, unknown>, right = actual as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length &&
      Object.entries(left).every(([key, value]) => Object.hasOwn(right, key) && equalValue(value, right[key]));
  }
  return expected === actual;
}
