import 'package:cloud_firestore/cloud_firestore.dart';
import '../data/local_ledger.dart';
import '../domain/local_migration_mapper.dart';
import '../domain/migration_owner_contract.dart';
import '../domain/migration_verification.dart';

class MigrationPreview {
  const MigrationPreview({
    required this.ownerUid,
    required this.total,
    required this.duplicates,
    required this.invalid,
    required this.toUpload,
  });
  final String ownerUid;
  final int total, duplicates;
  final List<InvalidLocalRecord> invalid;
  final List<LocalMigrationRecord> toUpload;
}

/// Copies supported local financial records into their canonical UID collection.
/// The encrypted source database is never deleted or modified by migration.
class LocalMigrationService {
  LocalMigrationService(this._firestore);
  final FirebaseFirestore _firestore;
  CollectionReference<Map<String, dynamic>> _collection(
    String uid,
    String name,
  ) => _firestore.collection('users').doc(uid).collection(name);

  Future<MigrationPreview> preview(
    String uid, {
    String preferredCurrency = 'DOP',
  }) async {
    requireMigrationOwner(uid);
    const queryLimit = 30;
    final invalid = <InvalidLocalRecord>[];
    final candidates = <LocalMigrationRecord>[];
    for (final entity in localMigrationEntities.keys) {
      final records = await LocalLedger.instance.records('local', entity);
      for (final data in records) {
        final mapped = mapLocalRecord(
          entity,
          data,
          preferredCurrency: preferredCurrency,
        );
        if (mapped is InvalidLocalRecord) {
          invalid.add(mapped);
        } else {
          candidates.add(mapped as LocalMigrationRecord);
        }
      }
    }

    final reconciled = reconcileSavingsGoalOpeningBalances(candidates);
    candidates
      ..clear()
      ..addAll(reconciled.records);
    invalid.addAll(reconciled.invalid);

    // Query only migration source IDs in bounded chunks; fetching every cloud
    // transaction just to check duplicates would grow costly for long histories.
    final existingKeys = <String>{};
    final grouped = <String, List<LocalMigrationRecord>>{};
    for (final item in candidates) {
      grouped.putIfAbsent(item.collection, () => []).add(item);
    }
    for (final entry in grouped.entries) {
      final target = _collection(uid, entry.key);
      final sourceIds = entry.value
          .map((item) => item.sourceId)
          .toSet()
          .toList();
      for (var offset = 0; offset < sourceIds.length; offset += queryLimit) {
        final chunk = sourceIds.skip(offset).take(queryLimit).toList();
        final matches = await target
            .where('localSourceId', whereIn: chunk)
            .get();
        for (final document in matches.docs) {
          final sourceId = document.data()['localSourceId'];
          if (sourceId is String) existingKeys.add('${entry.key}:$sourceId');
          existingKeys.add('${entry.key}:${document.id}');
        }
      }
      for (final item in entry.value) {
        if ((await target.doc(item.documentId).get()).exists) {
          existingKeys.add('${entry.key}:${item.documentId}');
        }
      }
    }

    final pending = <LocalMigrationRecord>[];
    final seen = <String>{};
    for (final record in candidates) {
      final key = '${record.collection}:${record.sourceId}';
      if (!seen.add(key) ||
          existingKeys.contains(key) ||
          existingKeys.contains('${record.collection}:${record.documentId}')) {
        continue;
      }
      pending.add(record);
    }
    return MigrationPreview(
      ownerUid: uid,
      total: candidates.length + invalid.length,
      duplicates: candidates.length - pending.length,
      invalid: List.unmodifiable(invalid),
      toUpload: List.unmodifiable(pending),
    );
  }

  Future<void> migrate(String uid, MigrationPreview approved) async {
    requireMigrationOwner(uid, approvedOwnerUid: approved.ownerUid);
    const batchLimit = 400;
    const verificationLimit = 30;
    final groups = <String, List<LocalMigrationRecord>>{};
    for (final item in approved.toUpload) {
      groups.putIfAbsent(item.collection, () => []).add(item);
    }
    for (final entry in groups.entries) {
      final target = _collection(uid, entry.key);
      final items = entry.value;
      for (var offset = 0; offset < items.length; offset += batchLimit) {
        final chunk = items.skip(offset).take(batchLimit).toList();
        await _firestore.runTransaction((transaction) async {
          final references = chunk
              .map((item) => target.doc(item.documentId))
              .toList();
          final snapshots = await Future.wait(
            references.map((reference) => transaction.get(reference)),
          );
          if (snapshots.any((snapshot) => snapshot.exists)) {
            throw StateError(
              'Un destino de migración ya existe. Actualiza la vista previa; no se sobrescribió ningún registro.',
            );
          }
          for (var index = 0; index < chunk.length; index++) {
            final item = chunk[index];
            final reference = references[index];
            transaction.set(reference, {
              ...item.data,
              'id': reference.id,
              'ownerUid': uid,
              'schemaVersion': 1,
              'origin': 'local_migration',
              'sourceEntity': item.collection,
              'localSourceId': item.sourceId,
              'createdAt':
                  item.data['createdAt'] ?? FieldValue.serverTimestamp(),
              'updatedAt': FieldValue.serverTimestamp(),
            });
          }
        });
      }
      for (var offset = 0; offset < items.length; offset += verificationLimit) {
        final chunk = items.skip(offset).take(verificationLimit).toList();
        final verified = await target
            .where(
              'localSourceId',
              whereIn: chunk.map((item) => item.sourceId).toList(),
            )
            .get();
        final byId = {
          for (final document in verified.docs) document.id: document,
        };
        if (!chunk.every((item) {
          final document = byId[item.documentId];
          return document != null &&
              isVerifiedMigrationRecord(
                documentId: document.id,
                expectedDocumentId: item.documentId,
                uid: uid,
                sourceId: item.sourceId,
                sourceEntity: item.collection,
                expectedData: item.data,
                data: document.data(),
              );
        })) {
          throw StateError(
            'La verificación remota está incompleta. Los datos locales se conservaron.',
          );
        }
      }
    }
  }
}
