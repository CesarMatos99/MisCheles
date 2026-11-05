/// Server-managed timestamps are validated separately from the source payload.
/// Every other source field must survive the copy, including nested budgets.
bool isVerifiedMigrationRecord({
  required String documentId,
  required String expectedDocumentId,
  required String uid,
  required String sourceId,
  required String sourceEntity,
  required Map<String, dynamic> expectedData,
  required Map<String, dynamic> data,
}) {
  if (documentId != expectedDocumentId ||
      data['id'] != expectedDocumentId ||
      data['ownerUid'] != uid ||
      data['schemaVersion'] != 1 ||
      data['origin'] != 'local_migration' ||
      data['sourceEntity'] != sourceEntity ||
      data['localSourceId'] != sourceId)
    return false;
  const managed = {
    'id',
    'ownerUid',
    'schemaVersion',
    'origin',
    'sourceEntity',
    'localSourceId',
    'createdAt',
    'updatedAt',
  };
  return expectedData.entries
      .where((entry) => !managed.contains(entry.key))
      .every(
        (entry) =>
            data.containsKey(entry.key) &&
            _sameValue(entry.value, data[entry.key]),
      );
}

bool _sameValue(Object? expected, Object? actual) {
  if (expected is Map) {
    if (actual is! Map || expected.length != actual.length) return false;
    return expected.entries.every(
      (entry) =>
          actual.containsKey(entry.key) &&
          _sameValue(entry.value, actual[entry.key]),
    );
  }
  if (expected is List) {
    if (actual is! List || expected.length != actual.length) return false;
    for (var index = 0; index < expected.length; index++) {
      if (!_sameValue(expected[index], actual[index])) return false;
    }
    return true;
  }
  return expected == actual;
}
