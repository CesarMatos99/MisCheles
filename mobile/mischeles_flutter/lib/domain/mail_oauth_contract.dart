class MailOAuthAuthorization {
  const MailOAuthAuthorization({
    required this.provider,
    required this.authorizationUrl,
    required this.connectionId,
    required this.expiresAtMs,
  });

  final String provider;
  final Uri authorizationUrl;
  final String connectionId;
  final int expiresAtMs;

  static const maxAuthorizationLifetimeMs = 15 * 60 * 1000;
  static final _connectionIdPattern = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );
  static final _opaqueTokenPattern = RegExp(r'^[A-Za-z0-9_-]{43}$');

  static MailOAuthAuthorization parse(
    Object? response,
    String provider, {
    int? nowMs,
  }) {
    if (provider != 'gmail' && provider != 'outlook') {
      throw const FormatException('Unsupported mail provider.');
    }
    if (response is! Map ||
        response['authorizationUrl'] is! String ||
        response['connectionId'] is! String ||
        response['expiresAtMs'] is! int) {
      throw const FormatException('Invalid mail authorization response.');
    }
    final connectionId = response['connectionId'] as String;
    final expiresAtMs = response['expiresAtMs'] as int;
    final uri = Uri.tryParse(response['authorizationUrl'] as String);
    final now = nowMs ?? DateTime.now().millisecondsSinceEpoch;
    final expectedHost = provider == 'gmail'
        ? 'accounts.google.com'
        : 'login.microsoftonline.com';
    final expectedPath = provider == 'gmail'
        ? uri?.path == '/o/oauth2/v2/auth'
        : uri != null &&
              RegExp(
                r'^/[a-zA-Z0-9._-]+/oauth2/v2\.0/authorize$',
              ).hasMatch(uri.path);
    final state = uri?.queryParameters['state'];
    final challenge = uri?.queryParameters['code_challenge'];
    final redirect = Uri.tryParse(uri?.queryParameters['redirect_uri'] ?? '');
    final validRedirect =
        redirect != null &&
        redirect.scheme == 'https' &&
        redirect.host.isNotEmpty &&
        redirect.userInfo.isEmpty;
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host != expectedHost ||
        uri.userInfo.isNotEmpty ||
        uri.hasFragment ||
        !expectedPath ||
        uri.queryParameters['response_type'] != 'code' ||
        uri.queryParameters['code_challenge_method'] != 'S256' ||
        state == null ||
        !_opaqueTokenPattern.hasMatch(state) ||
        challenge == null ||
        !_opaqueTokenPattern.hasMatch(challenge) ||
        !validRedirect ||
        !_connectionIdPattern.hasMatch(connectionId) ||
        expiresAtMs <= now ||
        expiresAtMs > now + maxAuthorizationLifetimeMs) {
      throw const FormatException(
        'Invalid or expired mail authorization response.',
      );
    }
    return MailOAuthAuthorization(
      provider: provider,
      authorizationUrl: uri,
      connectionId: connectionId,
      expiresAtMs: expiresAtMs,
    );
  }

  static bool isConnectionId(String value) =>
      _connectionIdPattern.hasMatch(value);
}
