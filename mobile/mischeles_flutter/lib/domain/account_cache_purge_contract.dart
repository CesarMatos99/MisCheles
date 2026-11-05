enum AccountCachePurgeResult { notRequired, cleared, retryPending }

/// Orchestrates one-time Firestore disk-cache cleanup with retry-safe markers.
Future<AccountCachePurgeResult> performAccountCachePurge({
  required bool deletionPending,
  required bool policyMigrated,
  required Future<void> Function() clearPersistence,
  required Future<void> Function() removeDeletionMarker,
  required Future<void> Function() markPolicyMigrated,
}) async {
  if (!deletionPending && policyMigrated) {
    return AccountCachePurgeResult.notRequired;
  }
  try {
    await clearPersistence();
    await removeDeletionMarker();
    await markPolicyMigrated();
    return AccountCachePurgeResult.cleared;
  } catch (_) {
    // Leave durable markers as-is so a later cold start can retry the purge.
    return AccountCachePurgeResult.retryPending;
  }
}
