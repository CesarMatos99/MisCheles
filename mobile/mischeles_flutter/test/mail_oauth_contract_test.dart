import '../lib/domain/mail_oauth_contract.dart';

void main() {
  const now = 1_800_000_000_000;
  final state = 'A'.padRight(43, 'a');
  final challenge = 'B'.padRight(43, 'b');
  const connectionId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  Map<String, Object> response(String provider, {int? expiry, String? url}) => {
    'connectionId': connectionId,
    'expiresAtMs': expiry ?? now + 600000,
    'authorizationUrl':
        url ??
        (provider == 'gmail'
            ? 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&code_challenge_method=S256&state=$state&code_challenge=$challenge&redirect_uri=https%3A%2F%2Fus-central1-demo.cloudfunctions.net%2FcompleteMailOAuth'
            : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?response_type=code&code_challenge_method=S256&state=$state&code_challenge=$challenge&redirect_uri=https%3A%2F%2Fus-central1-demo.cloudfunctions.net%2FcompleteMailOAuth'),
  };

  final gmail = MailOAuthAuthorization.parse(
    response('gmail'),
    'gmail',
    nowMs: now,
  );
  assert(gmail.provider == 'gmail');
  assert(gmail.connectionId == connectionId);
  final outlook = MailOAuthAuthorization.parse(
    response('outlook'),
    'outlook',
    nowMs: now,
  );
  assert(outlook.authorizationUrl.host == 'login.microsoftonline.com');
  assert(MailOAuthAuthorization.isConnectionId(connectionId));

  void rejects(Object? value, String provider) {
    var rejected = false;
    try {
      MailOAuthAuthorization.parse(value, provider, nowMs: now);
    } on FormatException {
      rejected = true;
    }
    assert(rejected, 'Expected invalid authorization to be rejected.');
  }

  rejects(
    response('gmail', url: 'http://accounts.google.com/o/oauth2/v2/auth'),
    'gmail',
  );
  rejects(
    response('gmail', url: 'https://attacker.example/o/oauth2/v2/auth'),
    'gmail',
  );
  rejects(
    response('gmail', url: 'https://user@accounts.google.com/o/oauth2/v2/auth'),
    'gmail',
  );
  rejects(response('gmail', expiry: now), 'gmail');
  rejects(response('gmail', expiry: now + 16 * 60 * 1000), 'gmail');
  rejects(
    response(
      'gmail',
      url: 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code',
    ),
    'gmail',
  );
  rejects(response('gmail'), 'outlook');
  final malformedId = response('gmail')..['connectionId'] = 'not-a-uuid';
  rejects(malformedId, 'gmail');

  print('Flutter mail OAuth contract: PASS');
}
