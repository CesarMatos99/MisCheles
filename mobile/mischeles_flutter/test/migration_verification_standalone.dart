import '../lib/domain/migration_verification.dart';

void main() {
  final valid = <String, dynamic>{
    'id': 'doc',
    'ownerUid': 'owner',
    'schemaVersion': 1,
    'origin': 'local_migration',
    'localSourceId': 'source',
    'sourceEntity': 'transactions',
    'amountMinor': 15000,
    'relatedSavingsMovementId': 'saving-1',
    'limits': [
      {'category': 'Food', 'amountMinor': 9000},
    ],
  };
  bool check(Map<String, dynamic> data, {String id = 'doc'}) =>
      isVerifiedMigrationRecord(
        documentId: id,
        expectedDocumentId: 'doc',
        uid: 'owner',
        sourceId: 'source',
        sourceEntity: 'transactions',
        expectedData: {
          'amountMinor': 15000,
          'relatedSavingsMovementId': 'saving-1',
          'limits': [
            {'category': 'Food', 'amountMinor': 9000},
          ],
        },
        data: data,
      );
  if (!check(valid)) throw StateError('Valid migration rejected');
  for (final entry in {
    'id': 'other',
    'ownerUid': 'other',
    'schemaVersion': 2,
    'origin': 'manual',
    'localSourceId': 'other',
  }.entries) {
    if (check({...valid, entry.key: entry.value}))
      throw StateError('Invalid metadata accepted');
  }
  if (check(valid, id: 'other')) throw StateError('Wrong document accepted');
  for (final patch in <Map<String, dynamic>>[
    {'amountMinor': 14000},
    {'relatedSavingsMovementId': 'saving-2'},
    {
      'limits': [
        {'category': 'Food', 'amountMinor': 9001},
      ],
    },
    {'limits': []},
  ]) {
    if (check({...valid, ...patch}))
      throw StateError('Modified payload accepted');
  }
  final missing = {...valid}..remove('amountMinor');
  if (check(missing)) throw StateError('Missing amount accepted');
  print('Migration record verification: PASS');
}
