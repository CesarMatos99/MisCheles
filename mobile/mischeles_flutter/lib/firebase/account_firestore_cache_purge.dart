import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../domain/account_cache_purge_contract.dart';

/// Defers the Firestore disk-cache purge until the next process startup, before
/// account repositories or listeners can start the Firestore instance.
class AccountFirestoreCachePurge {
  static const _pendingKey = 'mischeles_firestore_cache_purge_pending_v1';
  static const _policyKey = 'mischeles_firestore_disk_cache_policy_v1';

  static Future<void> schedule() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool(_pendingKey, true);
  }

  static Future<AccountCachePurgeResult> clearIfScheduled(
    FirebaseFirestore firestore,
  ) async {
    final preferences = await SharedPreferences.getInstance();
    return performAccountCachePurge(
      deletionPending: preferences.getBool(_pendingKey) == true,
      policyMigrated: preferences.getBool(_policyKey) == true,
      clearPersistence: firestore.clearPersistence,
      removeDeletionMarker: () async {
        await preferences.remove(_pendingKey);
      },
      markPolicyMigrated: () async {
        await preferences.setBool(_policyKey, true);
      },
    );
  }
}
