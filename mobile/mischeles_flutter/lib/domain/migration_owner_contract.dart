/// Bind approval to the account whose remote records were reviewed.
void requireMigrationOwner(String uid, {String? approvedOwnerUid}) {
  if (uid.trim().isEmpty ||
      uid.length > 128 ||
      uid.contains('/') ||
      (approvedOwnerUid != null && uid != approvedOwnerUid)) {
    throw StateError(
      'La cuenta de destino cambió. Actualiza la vista previa antes de migrar.',
    );
  }
}
