import '../lib/domain/account_cache_purge_contract.dart';

Future<void> main() async {
  var clears = 0;
  var removed = 0;
  var migrated = 0;
  final skipped = await performAccountCachePurge(
    deletionPending: false,
    policyMigrated: true,
    clearPersistence: () async {
      clears++;
    },
    removeDeletionMarker: () async {
      removed++;
    },
    markPolicyMigrated: () async {
      migrated++;
    },
  );
  assert(skipped == AccountCachePurgeResult.notRequired);
  assert(clears == 0 && removed == 0 && migrated == 0);

  final legacyCleanup = await performAccountCachePurge(
    deletionPending: false,
    policyMigrated: false,
    clearPersistence: () async => clears++,
    removeDeletionMarker: () async => removed++,
    markPolicyMigrated: () async => migrated++,
  );
  assert(legacyCleanup == AccountCachePurgeResult.cleared);
  assert(clears == 1 && removed == 1 && migrated == 1);

  final retry = await performAccountCachePurge(
    deletionPending: true,
    policyMigrated: true,
    clearPersistence: () async => throw StateError('offline cache busy'),
    removeDeletionMarker: () async => removed++,
    markPolicyMigrated: () async => migrated++,
  );
  assert(retry == AccountCachePurgeResult.retryPending);
  assert(removed == 1 && migrated == 1);

  print('Account cache purge contract: PASS');
}
