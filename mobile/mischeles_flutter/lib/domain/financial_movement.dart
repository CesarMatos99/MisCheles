class FinancialMovement {
  const FinancialMovement({
    required this.id,
    required this.kind,
    required this.amountMinor,
    required this.currency,
    required this.occurredOn,
    required this.monthKey,
    required this.categoryName,
    required this.description,
    required this.origin,
    this.paymentMethod = 'other',
    this.categoryId,
    this.savingsGoalId,
    this.transferGroupId,
    this.relatedSavingsMovementId,
    this.localSourceId,
    this.ownerUid,
    this.createdAt,
    this.cloudRevision,
    this.occurredAt,
    this.notes,
    this.bankName,
    this.bankReferenceHash,
    this.paymentInstrumentLastFour,
    this.importedCandidateId,
    this.dedupeKey,
    this.balanceAffecting = true,
  });

  final String id,
      kind,
      currency,
      occurredOn,
      monthKey,
      categoryName,
      description,
      origin;
  final String paymentMethod;
  final String? categoryId, savingsGoalId, transferGroupId;
  final String? relatedSavingsMovementId;
  final int amountMinor;
  final String? localSourceId, ownerUid, createdAt, cloudRevision;
  final String? occurredAt,
      notes,
      bankName,
      bankReferenceHash,
      paymentInstrumentLastFour;
  final String? importedCandidateId, dedupeKey;
  final bool balanceAffecting;

  Map<String, Object?> toMap() => {
    'id': id,
    'kind': kind,
    'amountMinor': amountMinor,
    'currency': currency,
    'occurredOn': occurredOn,
    'monthKey': monthKey,
    'categoryName': categoryName,
    'description': description,
    'paymentMethod': paymentMethod,
    'origin': origin,
    if (categoryId != null) 'categoryId': categoryId,
    if (savingsGoalId != null) 'savingsGoalId': savingsGoalId,
    if (transferGroupId != null) 'transferGroupId': transferGroupId,
    if (relatedSavingsMovementId != null)
      'relatedSavingsMovementId': relatedSavingsMovementId,
    if (localSourceId != null) 'localSourceId': localSourceId,
    if (ownerUid != null) 'ownerUid': ownerUid,
    if (createdAt != null) 'createdAt': createdAt,
    if (occurredAt != null) 'occurredAt': occurredAt,
    if (notes != null) 'notes': notes,
    if (bankName != null) 'bankName': bankName,
    if (bankReferenceHash != null) 'bankReferenceHash': bankReferenceHash,
    if (paymentInstrumentLastFour != null)
      'paymentInstrumentLastFour': paymentInstrumentLastFour,
    if (importedCandidateId != null) 'importedCandidateId': importedCandidateId,
    if (dedupeKey != null) 'dedupeKey': dedupeKey,
    if (cloudRevision != null) '_cloudRevision': cloudRevision,
    if (!balanceAffecting) 'balanceAffecting': false,
  };

  FinancialMovement withoutSavingsGoal() {
    final data = toMap()..remove('savingsGoalId');
    data['balanceAffecting'] = false;
    return FinancialMovement.fromMap(data);
  }

  factory FinancialMovement.fromMap(Map<String, Object?> map) =>
      FinancialMovement(
        id: map['id']! as String,
        kind: map['kind']! as String,
        amountMinor: (map['amountMinor'] as num).toInt(),
        currency: map['currency']! as String,
        occurredOn: map['occurredOn']! as String,
        monthKey: map['monthKey']! as String,
        categoryName: map['categoryName']! as String,
        description: map['description']! as String,
        paymentMethod: map['paymentMethod'] as String? ?? 'other',
        categoryId: map['categoryId'] as String?,
        savingsGoalId: map['savingsGoalId'] as String?,
        transferGroupId: map['transferGroupId'] as String?,
        relatedSavingsMovementId: map['relatedSavingsMovementId'] as String?,
        origin: map['origin']! as String,
        localSourceId: map['localSourceId'] as String?,
        ownerUid: map['ownerUid'] as String?,
        createdAt: map['createdAt'] as String?,
        occurredAt: map['occurredAt'] as String?,
        notes: map['notes'] as String?,
        bankName: map['bankName'] as String?,
        bankReferenceHash: map['bankReferenceHash'] as String?,
        paymentInstrumentLastFour: map['paymentInstrumentLastFour'] as String?,
        importedCandidateId: map['importedCandidateId'] as String?,
        dedupeKey: map['dedupeKey'] as String?,
        cloudRevision: map['_cloudRevision'] as String?,
        balanceAffecting: map['balanceAffecting'] as bool? ?? true,
      );
}
