import 'dart:convert';
import 'dart:io';

import '../lib/domain/account_movement_codec.dart';

void main() {
  final fixture =
      jsonDecode(
            File(
              'shared/savings_mirror_record_vectors.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;
  for (final item in fixture['cases'] as List<dynamic>) {
    final record = normalizeAccountMovement(item['collection'] as String, {
      'kind': item['storedKind'] as String,
    });
    assert(record['kind'] == item['expectedKind'], item['name'] as String);
  }
  print('Account movement migration compatibility: PASS');
}
