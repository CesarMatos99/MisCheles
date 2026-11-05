import '../lib/domain/migration_owner_contract.dart';

void main() {
  requireMigrationOwner('owner-a', approvedOwnerUid: 'owner-a');
  for (final uid in ['owner-b', '', 'a/b']) {
    var rejected = false;
    try {
      requireMigrationOwner(uid, approvedOwnerUid: 'owner-a');
    } on StateError {
      rejected = true;
    }
    if (!rejected) throw StateError('Unexpected migration approval for $uid');
  }
  print('Migration owner approval: PASS');
}
