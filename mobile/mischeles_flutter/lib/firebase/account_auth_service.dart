import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../domain/currency_preference.dart';
import 'account_firestore_cache_purge.dart';

class AccountAuthService {
  AccountAuthService(this._auth);
  static Future<void>? _googleInitialization;
  static const _googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );
  final FirebaseAuth _auth;
  Stream<User?> get changes => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;
  Future<UserCredential> createAccount(
    String displayName,
    String email,
    String password,
  ) async {
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    final user = credential.user!;
    final name = displayName.trim();
    await user.updateDisplayName(name);
    await user.sendEmailVerification();
    await _auth.signOut();
    return credential;
  }

  Future<UserCredential> signIn(
    String email,
    String password, {
    String preferredLanguage = 'es',
  }) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    final user = credential.user!;
    if (!user.emailVerified) {
      await user.sendEmailVerification();
      await _auth.signOut();
      throw FirebaseAuthException(
        code: 'email-not-verified',
        message: 'Verifica tu correo antes de iniciar sesión.',
      );
    }
    final reference = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid);
    final snapshot = await reference.get();
    final existing = snapshot.data() ?? <String, dynamic>{};
    final language =
        existing['language'] == 'en' || existing['language'] == 'es'
        ? existing['language'] as String
        : _supportedLanguage(preferredLanguage);
    final theme = ['light', 'dark', 'system'].contains(existing['theme'])
        ? existing['theme']
        : 'system';
    await reference.set({
      'ownerUid': user.uid,
      'schemaVersion': 1,
      'createdAt': existing['createdAt'] ?? FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'displayName': user.displayName ?? existing['displayName'] ?? '',
      'preferredCurrency': existing['preferredCurrency'] ?? 'DOP',
      'language': language,
      'theme': theme,
      'accentColor': existing['accentColor'] ?? '#012677',
      'syncEnabled': true,
    }, SetOptions(merge: true));
    return credential;
  }

  Future<UserCredential> signInWithGoogle({
    String preferredLanguage = 'es',
  }) async {
    final google = GoogleSignIn.instance;
    _googleInitialization ??= google.initialize(
      serverClientId: _googleServerClientId.isEmpty
          ? null
          : _googleServerClientId,
    );
    await _googleInitialization;
    final account = await google.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw FirebaseAuthException(code: 'missing-google-id-token');
    }
    final credential = await _auth.signInWithCredential(
      GoogleAuthProvider.credential(idToken: idToken),
    );
    final user = credential.user!;
    final reference = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid);
    final snapshot = await reference.get();
    final existing = snapshot.data() ?? <String, dynamic>{};
    final theme = ['light', 'dark', 'system'].contains(existing['theme'])
        ? existing['theme']
        : 'system';
    await reference.set({
      'ownerUid': user.uid,
      'schemaVersion': 1,
      'createdAt': existing['createdAt'] ?? FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'displayName': user.displayName ?? existing['displayName'] ?? '',
      'preferredCurrency': existing['preferredCurrency'] ?? 'DOP',
      'language': existing['language'] == 'en' || existing['language'] == 'es'
          ? existing['language'] as String
          : _supportedLanguage(preferredLanguage),
      'theme': theme,
      'accentColor': existing['accentColor'] ?? '#012677',
      'syncEnabled': true,
    }, SetOptions(merge: true));
    return credential;
  }

  String _supportedLanguage(String language) => language == 'en' ? 'en' : 'es';

  Future<void> sendPasswordReset(String email) =>
      _auth.sendPasswordResetEmail(email: email.trim());

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    final user = _auth.currentUser;
    if (user == null || user.email == null) {
      throw FirebaseAuthException(code: 'account-required');
    }
    if (!user.providerData.any(
      (provider) => provider.providerId == 'password',
    )) {
      throw FirebaseAuthException(code: 'password-provider-required');
    }
    final credential = EmailAuthProvider.credential(
      email: user.email!,
      password: currentPassword,
    );
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  }

  Future<void> deleteAccount({
    required String confirmation,
    String currentPassword = '',
  }) async {
    final user = _auth.currentUser;
    if (user == null) throw FirebaseAuthException(code: 'account-required');
    if (confirmation.trim().toUpperCase() != 'ELIMINAR') {
      throw ArgumentError(
        'Explicit account deletion confirmation is required.',
      );
    }
    if (user.providerData.any(
      (provider) => provider.providerId == 'password',
    )) {
      if (user.email == null || currentPassword.isEmpty) {
        throw FirebaseAuthException(code: 'current-password-required');
      }
      await user.reauthenticateWithCredential(
        EmailAuthProvider.credential(
          email: user.email!,
          password: currentPassword,
        ),
      );
    } else if (user.providerData.any(
      (provider) => provider.providerId == 'google.com',
    )) {
      final google = GoogleSignIn.instance;
      _googleInitialization ??= google.initialize(
        serverClientId: _googleServerClientId.isEmpty
            ? null
            : _googleServerClientId,
      );
      await _googleInitialization;
      final account = await google.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw FirebaseAuthException(code: 'missing-google-id-token');
      }
      await user.reauthenticateWithCredential(
        GoogleAuthProvider.credential(idToken: idToken),
      );
    } else {
      throw FirebaseAuthException(code: 'recent-login-required');
    }
    // If the process exits mid-delete, startup still clears Firestore's disk cache.
    await AccountFirestoreCachePurge.schedule();
    try {
      await FirebaseFunctions.instance.httpsCallable('deleteMyAccount').call({
        'confirmation': 'DELETE',
      });
    } catch (_) {
      // The account remains if server deletion failed, so retain its local cache.
      final preferences = await SharedPreferences.getInstance();
      await preferences.remove('mischeles_firestore_cache_purge_pending_v1');
      rethrow;
    }
    await _auth.signOut();
  }

  Future<void> saveCurrencyPreference(String currencyCode) async {
    if (!isSupportedCurrencyCode(currencyCode)) {
      throw ArgumentError.value(
        currencyCode,
        'currencyCode',
        'Unsupported currency',
      );
    }
    final user = _auth.currentUser;
    if (user == null) return;
    await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
      'preferredCurrency': currencyCode,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> saveLanguagePreference(String language) async {
    if (language != 'es' && language != 'en') {
      throw ArgumentError.value(language, 'language', 'Unsupported language');
    }
    final user = _auth.currentUser;
    if (user == null) return;
    await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
      'language': language,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> signOut() => _auth.signOut();
}
