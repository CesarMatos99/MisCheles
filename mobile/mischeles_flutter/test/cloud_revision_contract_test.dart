import 'dart:convert';
import 'dart:io';

import '../lib/domain/cloud_revision.dart';

class FakeFirestoreTimestamp {
  const FakeFirestoreTimestamp(this.milliseconds);
  final int milliseconds;
}

void main() {
  final vectors =
      jsonDecode(
            File('shared/revision_contract_vectors.json').readAsStringSync(),
          )
          as List<dynamic>;
  for (final vector in vectors) {
    final item = Map<String, dynamic>.from(vector as Map);
    final record = Map<String, Object?>.from(item['record'] as Map);
    assert(cloudRevisionContentToken(record) == item['expected']);
  }
  final timestampRevision = cloudRevisionContentToken(
    <String, Object?>{
      'id': 'legacy-timestamp',
      'createdAt': const FakeFirestoreTimestamp(1798675200123),
    },
    timestampMillis: (value) =>
        value is FakeFirestoreTimestamp ? value.milliseconds : null,
  );
  assert(timestampRevision == 'content:35d2989c9e709cfa');

  assert(
    !isCloudRevisionStale(
      expectedRevision: 'time:12:34',
      remoteExists: true,
      remoteRevision: 'time:12:34',
    ),
  );
  assert(
    isCloudRevisionStale(
      expectedRevision: 'time:12:33',
      remoteExists: true,
      remoteRevision: 'time:12:34',
    ),
  );
  assert(
    isCloudRevisionStale(
      expectedRevision: null,
      remoteExists: true,
      remoteRevision: 'time:12:34',
    ),
  );
  assert(
    isCloudRevisionStale(
      expectedRevision: 'time:12:34',
      remoteExists: false,
      remoteRevision: null,
    ),
  );
  assert(
    !isCloudRevisionStale(
      expectedRevision: null,
      remoteExists: false,
      remoteRevision: null,
    ),
  );
  print('Flutter cloud revision contract: PASS');
}
