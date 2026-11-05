import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import 'account_firestore_cache_purge.dart';
import '../domain/account_cache_purge_contract.dart';

/// Firebase stays disabled until real app config is supplied or emulator mode is explicit.
class FirebaseBootstrap {
  static const useEmulators = bool.fromEnvironment(
    'FIREBASE_USE_EMULATORS',
    defaultValue: false,
  );
  static const appCheckEnabled = bool.fromEnvironment(
    'FIREBASE_APPCHECK_ENABLED',
    defaultValue: false,
  );
  static const appCheckDebugProvider = bool.fromEnvironment(
    'FIREBASE_APPCHECK_DEBUG_PROVIDER',
    defaultValue: false,
  );
  static const emulatorHost = String.fromEnvironment(
    'FIREBASE_EMULATOR_HOST',
    defaultValue: '127.0.0.1',
  );
  static const apiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: useEmulators ? 'demo-api-key' : '',
  );
  static const appId = String.fromEnvironment(
    'FIREBASE_APP_ID',
    defaultValue: useEmulators ? '1:1234567890:android:abcdef1234567890' : '',
  );
  static const senderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: useEmulators ? '1234567890' : '',
  );
  static const projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: useEmulators ? 'demo-mischeles' : '',
  );
  static bool firestoreCachePurgeRetryPending = false;

  static bool get isConfigured =>
      useEmulators ||
      [apiKey, appId, senderId, projectId].every((value) => value.isNotEmpty);

  static Future<void> initialize() async {
    if (!isConfigured) return;
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: apiKey,
        appId: appId,
        messagingSenderId: senderId,
        projectId: projectId,
      ),
    );
    final firestore = FirebaseFirestore.instance;
    firestore.settings = const Settings(persistenceEnabled: false);
    // App Check is opt-in and runs before Auth/Firestore use. Emulator mode skips attestation.
    if (appCheckEnabled && !useEmulators) {
      await FirebaseAppCheck.instance.activate(
        providerAndroid: appCheckDebugProvider && kDebugMode
            ? const AndroidDebugProvider()
            : const AndroidPlayIntegrityProvider(),
      );
    }
    if (useEmulators) {
      await FirebaseAuth.instance.useAuthEmulator(emulatorHost, 9099);
      firestore.useFirestoreEmulator(emulatorHost, 8080);
      FirebaseFunctions.instance.useFunctionsEmulator(emulatorHost, 5001);
    }
    // Keep cloud account records memory-only; local mode uses the encrypted SQLCipher ledger.
    // Purge any cache from an earlier version before the first account query/listener starts.
    firestoreCachePurgeRetryPending =
        await AccountFirestoreCachePurge.clearIfScheduled(firestore) ==
        AccountCachePurgeResult.retryPending;
  }
}
