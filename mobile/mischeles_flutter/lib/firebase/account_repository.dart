import '../domain/cloud_revision.dart';
import '../domain/account_movement_codec.dart';
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../domain/financial_movement.dart';
import '../domain/savings_movement_links.dart';
import '../domain/movement_stream_combiner.dart';

class AccountSyncConflictException implements Exception {
  const AccountSyncConflictException(this.recordId);
  final String recordId;
  @override
  String toString() =>
      'A record changed on another device. Refresh it before saving.';
}

class AccountRepository {
  AccountRepository(this._firestore);
  final FirebaseFirestore _firestore;
  CollectionReference<Map<String, dynamic>> _collection(
    String uid,
    String path,
  ) {
    _validateUid(uid);
    return _firestore.collection('users').doc(uid).collection(path);
  }

  CollectionReference<Map<String, dynamic>> _transactions(String uid) =>
      _collection(uid, 'transactions');
  CollectionReference<Map<String, dynamic>> _savingsMovements(String uid) =>
      _collection(uid, 'savingsMovements');

  Map<String, dynamic> _documentData(
    QueryDocumentSnapshot<Map<String, dynamic>> doc,
    String collectionName,
  ) {
    final raw = doc.data();
    final data = <String, dynamic>{
      ...normalizeAccountMovement(
        collectionName,
        Map<String, Object?>.from(raw),
      ),
      'id': doc.id,
    };
    final createdAt = data['createdAt'];
    if (createdAt is Timestamp) {
      data['createdAt'] = createdAt.toDate().toUtc().toIso8601String();
    }
    final updatedAt = raw['updatedAt'];
    if (updatedAt is Timestamp) {
      data['_cloudRevision'] =
          'time:${updatedAt.seconds}:${updatedAt.nanoseconds}';
      data['updatedAt'] = updatedAt.toDate().toUtc().toIso8601String();
    } else {
      data['_cloudRevision'] = cloudRevisionContentToken(
        <String, Object?>{...raw, 'id': doc.id},
        timestampMillis: (value) =>
            value is Timestamp ? value.toDate().millisecondsSinceEpoch : null,
      );
    }
    return data;
  }

  Future<List<Map<String, dynamic>>> listMovements(String uid) async {
    final results = await Future.wait([
      _transactions(uid).get(),
      _savingsMovements(uid).get(),
    ]);
    final records = [
      ...results[0].docs.map((doc) => _documentData(doc, 'transactions')),
      ...results[1].docs.map((doc) => _documentData(doc, 'savingsMovements')),
    ];
    records.sort(
      (a, b) => (b['occurredOn'] as String? ?? '').compareTo(
        a['occurredOn'] as String? ?? '',
      ),
    );
    return records;
  }

  /// Combines current and savings movements so both clients see the same ledger updates live.
  Stream<List<Map<String, dynamic>>> watchMovements(String uid) =>
      combineMovementCollections(
        first: _transactions(uid).snapshots().map(
          (snapshot) => snapshot.docs
              .map((doc) => _documentData(doc, 'transactions'))
              .toList(),
        ),
        second: _savingsMovements(uid).snapshots().map(
          (snapshot) => snapshot.docs
              .map((doc) => _documentData(doc, 'savingsMovements'))
              .toList(),
        ),
        occurredOn: (record) => record['occurredOn'] as String? ?? '',
      );

  Map<String, Object?> _movementPayload(
    String uid,
    FinancialMovement movement,
  ) {
    final data = movement.toMap()..remove('_cloudRevision');
    return {
      ...data,
      'ownerUid': uid,
      'schemaVersion': 1,
      'createdAt': movement.createdAt ?? FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'paymentMethod': movement.paymentMethod,
    };
  }

  String? _revisionOf(Map<String, dynamic>? data, String documentId) {
    if (data == null) return null;
    final updatedAt = data['updatedAt'];
    if (updatedAt is Timestamp) {
      return 'time:${updatedAt.seconds}:${updatedAt.nanoseconds}';
    }
    return cloudRevisionContentToken(
      <String, Object?>{...data, 'id': documentId},
      timestampMillis: (value) =>
          value is Timestamp ? value.toDate().millisecondsSinceEpoch : null,
    );
  }

  void _requireCurrentRevision(
    String id,
    String? expected,
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final current = _revisionOf(snapshot.data(), snapshot.id);
    if (isCloudRevisionStale(
      expectedRevision: expected,
      remoteExists: snapshot.exists,
      remoteRevision: current,
    )) {
      throw AccountSyncConflictException(id);
    }
  }

  CollectionReference<Map<String, dynamic>> _movementCollection(
    String uid,
    FinancialMovement movement,
  ) => movement.kind.startsWith('savings_')
      ? _savingsMovements(uid)
      : _transactions(uid);

  Future<void> saveMovement(String uid, FinancialMovement movement) async {
    final reference = _movementCollection(uid, movement).doc(movement.id);
    final payload = _movementPayload(uid, movement);
    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(reference);
      _requireCurrentRevision(movement.id, movement.cloudRevision, snapshot);
      transaction.set(reference, payload);
    });
  }

  Future<void> updateMovement(
    String uid,
    FinancialMovement previous,
    FinancialMovement next,
  ) async {
    final oldReference = _movementCollection(uid, previous).doc(previous.id);
    final newReference = _movementCollection(uid, next).doc(next.id);
    final payload = _movementPayload(uid, next);
    await _firestore.runTransaction((transaction) async {
      final oldSnapshot = await transaction.get(oldReference);
      _requireCurrentRevision(previous.id, previous.cloudRevision, oldSnapshot);
      if (oldReference.path != newReference.path) {
        final destination = await transaction.get(newReference);
        if (destination.exists) throw AccountSyncConflictException(next.id);
        transaction.delete(oldReference);
      }
      transaction.set(newReference, payload);
    });
  }

  Future<void> deleteMovement(String uid, FinancialMovement movement) async {
    final reference = _movementCollection(uid, movement).doc(movement.id);
    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(reference);
      _requireCurrentRevision(movement.id, movement.cloudRevision, snapshot);
      transaction.delete(reference);
    });
  }

  Future<List<Map<String, dynamic>>> listRecords(
    String uid,
    String name,
  ) async {
    _validateUid(uid);
    _validateCollection(name);
    final snapshot = await _collection(uid, name).get();
    return snapshot.docs
        .map((doc) => _documentData(doc, name))
        .toList(growable: false);
  }

  static const accountCollections = <String>{
    'transactions',
    'savingsMovements',
    'savingsGoals',
    'monthConfigurations',
    'categoryBudgets',
  };

  void _validateCollection(String name) {
    if (!accountCollections.contains(name)) {
      throw ArgumentError.value(name, 'name', 'Unknown account collection');
    }
  }

  void _validateUid(String uid) {
    if (uid.trim().isEmpty)
      throw ArgumentError.value(uid, 'uid', 'UID is required');
  }

  /// Watches a UID-scoped shared collection using the same document contract as React.
  Stream<List<Map<String, dynamic>>> watchRecords(String uid, String name) {
    _validateUid(uid);
    _validateCollection(name);
    return _collection(uid, name).snapshots().map(
      (snapshot) => snapshot.docs
          .map((doc) => _documentData(doc, name))
          .toList(growable: false),
    );
  }

  /// Persists a validated shared document. Security Rules remain the final authority.
  Future<void> saveRecord(
    String uid,
    String name,
    Map<String, dynamic> record,
  ) async {
    _validateUid(uid);
    _validateCollection(name);
    final id = record['id'];
    if (id is! String ||
        id.trim().isEmpty ||
        record['ownerUid'] != uid ||
        record['schemaVersion'] != 1) {
      throw ArgumentError(
        'Record ID, owner UID, or schema version is invalid.',
      );
    }
    final reference = _collection(uid, name).doc(id);
    final expectedRevision = record['_cloudRevision'] as String?;
    final payload = Map<String, dynamic>.from(record)
      ..remove('_cloudRevision')
      ..putIfAbsent('createdAt', FieldValue.serverTimestamp)
      ..['updatedAt'] = FieldValue.serverTimestamp();
    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(reference);
      _requireCurrentRevision(id, expectedRevision, snapshot);
      transaction.set(reference, payload);
    });
  }

  Future<void> closeSavingsGoal(
    String uid,
    String goalId, {
    required String? goalRevision,
    List<FinancialMovement> linkedMovements = const [],
    FinancialMovement? releaseMovement,
  }) async {
    _validateUid(uid);
    if (goalId.trim().isEmpty)
      throw ArgumentError.value(goalId, 'goalId', 'Goal ID is required');
    final references =
        <
          String,
          (DocumentReference<Map<String, dynamic>>, FinancialMovement)
        >{};
    for (final movement in linkedMovements) {
      if (movement.savingsGoalId != goalId) {
        throw ArgumentError('A movement does not belong to this savings goal.');
      }
      final reference = _movementCollection(uid, movement).doc(movement.id);
      references[reference.path] = (reference, movement);
    }
    if (releaseMovement != null &&
        (!(releaseMovement.kind == 'savings_withdrawal' ||
                releaseMovement.kind == 'savings_reallocation') ||
            releaseMovement.savingsGoalId != null)) {
      throw ArgumentError(
        'A released balance must be an unlinked savings movement.',
      );
    }
    if (references.length + 1 + (releaseMovement == null ? 0 : 1) > 500) {
      throw StateError(
        'This goal has too much history for a safe client-side cleanup.',
      );
    }
    final goalReference = _collection(uid, 'savingsGoals').doc(goalId);
    final releaseReference = releaseMovement == null
        ? null
        : _savingsMovements(uid).doc(releaseMovement.id);
    await _firestore.runTransaction((transaction) async {
      final goalSnapshot = await transaction.get(goalReference);
      _requireCurrentRevision(goalId, goalRevision, goalSnapshot);
      for (final entry in references.values) {
        final (reference, movement) = entry;
        final snapshot = await transaction.get(reference);
        _requireCurrentRevision(movement.id, movement.cloudRevision, snapshot);
      }
      if (releaseReference != null) {
        final releaseSnapshot = await transaction.get(releaseReference);
        _requireCurrentRevision(releaseMovement!.id, null, releaseSnapshot);
      }
      for (final entry in references.values) {
        final (reference, movement) = entry;
        final detached = movement.withoutSavingsGoal();
        final detachedPayload = _movementPayload(uid, detached)
          ..['savingsGoalId'] = FieldValue.delete();
        transaction.set(reference, detachedPayload, SetOptions(merge: true));
      }
      if (releaseReference != null) {
        transaction.set(
          releaseReference,
          _movementPayload(uid, releaseMovement!),
        );
      }
      transaction.delete(goalReference);
    });
  }

  Future<void> discardSavingsGoalAsFalse(
    String uid,
    String goalId,
    List<FinancialMovement> linkedMovements, {
    required String? goalRevision,
  }) async {
    _validateUid(uid);
    if (goalId.trim().isEmpty)
      throw ArgumentError.value(goalId, 'goalId', 'Goal ID is required');
    final goalMovementIds = linkedMovements
        .where((movement) => movement.savingsGoalId == goalId)
        .map((movement) => movement.id)
        .toSet();
    final references = <String, DocumentReference<Map<String, dynamic>>>{};
    for (final movement in linkedMovements) {
      if (!isSavingsGoalDeletionRecord(movement, goalId, goalMovementIds)) {
        throw ArgumentError('A record does not belong to this savings goal.');
      }
      final reference = _movementCollection(uid, movement).doc(movement.id);
      references[reference.path] = reference;
    }
    // Keep destructive cleanup atomic. Firestore batches allow at most 500
    // writes, including the goal document. Larger cleanup belongs in an
    // authenticated backend job instead of partially deleting client history.
    if (references.length > 499) {
      throw StateError(
        'This goal has too many linked records for a safe client-side cleanup.',
      );
    }
    final goalReference = _collection(uid, 'savingsGoals').doc(goalId);
    final movementsByPath = <String, FinancialMovement>{};
    for (final movement in linkedMovements) {
      final reference = _movementCollection(uid, movement).doc(movement.id);
      movementsByPath[reference.path] = movement;
    }
    await _firestore.runTransaction((transaction) async {
      final goalSnapshot = await transaction.get(goalReference);
      _requireCurrentRevision(goalId, goalRevision, goalSnapshot);
      for (final entry in references.entries) {
        final movement = movementsByPath[entry.key]!;
        final snapshot = await transaction.get(entry.value);
        _requireCurrentRevision(movement.id, movement.cloudRevision, snapshot);
      }
      for (final reference in references.values) {
        transaction.delete(reference);
      }
      transaction.delete(goalReference);
    });
  }

  Future<void> deleteRecord(
    String uid,
    String name,
    String id, {
    required String? expectedRevision,
  }) async {
    _validateUid(uid);
    _validateCollection(name);
    if (id.trim().isEmpty)
      throw ArgumentError.value(id, 'id', 'Record ID is required');
    final reference = _collection(uid, name).doc(id);
    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(reference);
      _requireCurrentRevision(id, expectedRevision, snapshot);
      transaction.delete(reference);
    });
  }
}
