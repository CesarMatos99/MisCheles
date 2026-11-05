const localMigrationEntities = <String, String>{
  'movement': 'transactions',
  'savingsGoal': 'savingsGoals',
  'monthConfiguration': 'monthConfigurations',
  'categoryBudget': 'categoryBudgets',
};

class LocalMigrationRecord {
  const LocalMigrationRecord({
    required this.collection,
    required this.sourceId,
    required this.documentId,
    required this.data,
  });
  final String collection, sourceId, documentId;
  final Map<String, Object?> data;
}

class InvalidLocalRecord {
  const InvalidLocalRecord(this.entity, this.sourceId, this.reason);
  final String entity, sourceId, reason;
}

Object mapLocalRecord(
  String entity,
  Map<String, Object?> data, {
  String preferredCurrency = 'DOP',
}) {
  final collection = localMigrationEntities[entity];
  if (collection == null)
    return InvalidLocalRecord(entity, '', 'Tipo de registro no admitido.');
  final sourceId = _sourceId(entity, data);
  if (sourceId.isEmpty)
    return InvalidLocalRecord(
      entity,
      sourceId,
      'No tiene identificador estable.',
    );
  final now = DateTime.now().toUtc().toIso8601String();
  final base = <String, Object?>{
    'schemaVersion': 1,
    'createdAt': _timestamp(data['createdAt']) ?? now,
    'updatedAt': now,
    'legacySnapshot': _safeLegacySnapshot(entity, data),
  };

  if (entity == 'movement') {
    final amountMinor = _integer(data['amountMinor']);
    final currency = data['currency'] is String
        ? _string(data['currency'])
        : (_validCurrency(preferredCurrency) ? preferredCurrency : 'DOP');
    final kind = _string(data['kind']);
    final occurredOn = _string(data['occurredOn']);
    final monthKey = _string(data['monthKey']);
    if (amountMinor == null || amountMinor <= 0)
      return InvalidLocalRecord(
        entity,
        sourceId,
        'El movimiento debe tener un monto entero seguro mayor que cero.',
      );
    if (!_validCurrency(currency) ||
        !_validDate(occurredOn) ||
        !_validMonth(monthKey))
      return InvalidLocalRecord(
        entity,
        sourceId,
        'Moneda, fecha o mes inválido.',
      );
    const validKinds = {
      'income',
      'expense',
      'savings_contribution',
      'savings_withdrawal',
      'savings_direct_expense',
      'savings_reallocation',
      'transfer',
    };
    if (!validKinds.contains(kind))
      return InvalidLocalRecord(
        entity,
        sourceId,
        'Tipo de movimiento no admitido.',
      );
    final movementCollection = kind.startsWith('savings_')
        ? 'savingsMovements'
        : 'transactions';
    return LocalMigrationRecord(
      collection: movementCollection,
      sourceId: sourceId,
      documentId: _documentId(movementCollection, sourceId),
      data: {
        ...base,
        'kind': kind,
        'amountMinor': amountMinor,
        'currency': currency,
        'occurredOn': occurredOn,
        'monthKey': monthKey,
        'categoryName': _string(data['categoryName']),
        'description': _string(data['description']),
        'paymentMethod': _paymentClassifier(data['paymentMethod']),
        if (data['savingsGoalId'] is String)
          'savingsGoalId': data['savingsGoalId'],
        if (data['relatedSavingsMovementId'] is String)
          'relatedSavingsMovementId': data['relatedSavingsMovementId'],
        if (data['balanceAffecting'] == false) 'balanceAffecting': false,
      },
    );
  }

  if (entity == 'savingsGoal') {
    final targetMinor = _minorFrom(data, ['targetMinor'], ['targetAmount']);
    final title = _string(data['title']).trim();
    final currency = _string(data['currency'], 'DOP');
    if (targetMinor == null ||
        targetMinor < 0 ||
        title.isEmpty ||
        !_validCurrency(currency))
      return InvalidLocalRecord(
        entity,
        sourceId,
        'Meta, monto o moneda inválidos.',
      );
    final hasLegacyBalance =
        data['legacyBalanceMinor'] != null || data['currentAmount'] != null;
    final parsedLegacyBalance = _minorFrom(
      data,
      ['legacyBalanceMinor'],
      ['currentAmount'],
    );
    if (hasLegacyBalance &&
        (parsedLegacyBalance == null || parsedLegacyBalance < 0)) {
      return InvalidLocalRecord(
        entity,
        sourceId,
        'El saldo actual de la meta no es válido.',
      );
    }
    final legacyBalance = parsedLegacyBalance ?? 0;
    return LocalMigrationRecord(
      collection: collection,
      sourceId: sourceId,
      documentId: _documentId(collection, sourceId),
      data: {
        ...base,
        'title': title,
        'targetMinor': targetMinor,
        'legacyBalanceMinor': legacyBalance,
        'currency': currency,
        if (data['targetDate'] is String &&
            _validDate(data['targetDate'] as String))
          'targetDate': data['targetDate'],
      },
    );
  }

  if (entity == 'monthConfiguration') {
    final monthKey = _string(data['monthKey']);
    final initialIncome = _minorFrom(
      data,
      ['initialIncomeMinor'],
      ['initialIncome'],
    );
    final carryover = _minorFrom(
      data,
      ['openingCarryoverMinor'],
      ['carryoverFromPrev'],
    );
    if (!_validMonth(monthKey) ||
        initialIncome == null ||
        initialIncome < 0 ||
        carryover == null ||
        carryover < 0)
      return InvalidLocalRecord(
        entity,
        sourceId,
        'Mes, ingreso inicial o arrastre inválidos.',
      );
    return LocalMigrationRecord(
      collection: collection,
      sourceId: sourceId,
      documentId: _documentId(collection, sourceId),
      data: {
        ...base,
        'monthKey': monthKey,
        'initialIncomeMinor': initialIncome,
        'openingCarryoverMinor': carryover,
        'autoRolloverEnabled': data['autoRolloverEnabled'] == true,
      },
    );
  }

  final monthKey = _string(data['monthKey']);
  final categoryName = _string(data['categoryName'] ?? data['category']).trim();
  final assignedMinor = _minorFrom(
    data,
    ['assignedMinor', 'amountMinor'],
    ['amount'],
  );
  final currency = _string(data['currency'], 'DOP');
  if (!_validMonth(monthKey) ||
      categoryName.isEmpty ||
      assignedMinor == null ||
      assignedMinor < 0 ||
      !_validCurrency(currency))
    return InvalidLocalRecord(
      entity,
      sourceId,
      'Mes, categoría, monto o moneda inválidos.',
    );
  final categoryId = _string(data['categoryId'], _slug(categoryName));
  return LocalMigrationRecord(
    collection: collection,
    sourceId: sourceId,
    documentId: _documentId(collection, sourceId),
    data: {
      ...base,
      'monthKey': monthKey,
      'categoryId': categoryId,
      'categoryName': categoryName,
      'assignedMinor': assignedMinor,
      'currency': currency,
    },
  );
}

String _sourceId(String entity, Map<String, Object?> data) {
  if (data['id'] is String && (data['id'] as String).trim().isNotEmpty)
    return (data['id'] as String).trim();
  final month = _string(data['monthKey']);
  if (entity == 'monthConfiguration' && month.isNotEmpty) return month;
  if (entity == 'categoryBudget' && month.isNotEmpty) {
    final category = _string(data['categoryName'] ?? data['category']);
    if (category.isNotEmpty) return '$month:$category';
  }
  return '';
}

String _documentId(String collection, String sourceId) {
  final safe = sourceId.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
  final stem = safe.length > 60 ? safe.substring(0, 60) : safe;
  return 'legacy_${collection}_${stem.isEmpty ? 'record' : stem}_${_stableHash(sourceId)}';
}

String localMigrationDocumentId(String collection, String sourceId) =>
    _documentId(collection, sourceId);

Map<String, Object?> _safeLegacySnapshot(
  String entity,
  Map<String, Object?> data,
) {
  const fields = <String, List<String>>{
    'movement': [
      'id',
      'kind',
      'amountMinor',
      'currency',
      'occurredOn',
      'monthKey',
      'categoryName',
      'description',
      'paymentMethod',
      'origin',
      'categoryId',
      'savingsGoalId',
      'relatedSavingsMovementId',
      'transferGroupId',
      'occurredAt',
      'notes',
      'bankName',
      'bankReferenceHash',
      'paymentInstrumentLastFour',
      'importedCandidateId',
      'dedupeKey',
      'balanceAffecting',
    ],
    'savingsGoal': [
      'id',
      'title',
      'targetMinor',
      'legacyBalanceMinor',
      'targetAmount',
      'currentAmount',
      'currency',
      'targetDate',
      'icon',
      'color',
    ],
    'monthConfiguration': [
      'monthKey',
      'initialIncomeMinor',
      'initialIncome',
      'openingCarryoverMinor',
      'carryoverFromPrev',
      'autoRolloverEnabled',
      'rolloverAction',
      'rolloverGoalId',
      'rolloverGoalTitle',
      'notes',
      'isConfigured',
    ],
    'categoryBudget': [
      'monthKey',
      'categoryId',
      'categoryName',
      'category',
      'assignedMinor',
      'amountMinor',
      'amount',
      'currency',
    ],
  };
  final allowed = fields[entity] ?? const <String>[];
  return {
    for (final key in allowed)
      if (data.containsKey(key)) key: data[key],
  };
}

String _stableHash(String value) {
  var hash = 2166136261;
  for (final unit in value.codeUnits)
    hash = ((hash ^ unit) * 16777619) & 0xffffffff;
  return hash.toRadixString(16).padLeft(8, '0');
}

String _paymentClassifier(Object? value) {
  final text = _string(value).trim().toLowerCase();
  if (text == 'cash' || text.contains('efectivo')) return 'cash';
  if (text == 'debit_card' ||
      text.contains('débito') ||
      text.contains('debito'))
    return 'debit_card';
  if (text == 'credit_card' ||
      text.contains('crédito') ||
      text.contains('credito'))
    return 'credit_card';
  if (text == 'bank_transfer' || text.contains('transfer'))
    return 'bank_transfer';
  return 'other';
}

String _slug(String value) => value
    .trim()
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
    .replaceAll(RegExp(r'^-+|-+$'), '');
String _string(Object? value, [String fallback = '']) =>
    value is String ? value : fallback;
const _maxSafeMinor = 9007199254740991;
int? _integer(Object? value) {
  if (value is int) return value.abs() <= _maxSafeMinor ? value : null;
  if (value is num &&
      value.isFinite &&
      value == value.truncateToDouble() &&
      value.abs() <= _maxSafeMinor) {
    return value.toInt();
  }
  return null;
}

int? _minorFrom(
  Map<String, Object?> data,
  List<String> minorKeys,
  List<String> majorKeys,
) {
  for (final key in minorKeys) {
    if (data[key] != null) return _integer(data[key]);
  }
  for (final key in majorKeys) {
    final major = data[key];
    final text = major is num && major.isFinite
        ? major.toString()
        : major is String
        ? major.trim()
        : '';
    final match = RegExp(r'^(\d+)(?:\.(\d{1,2}))?$').firstMatch(text);
    if (match == null) return null;
    final whole = BigInt.parse(match.group(1)!);
    final fraction = BigInt.parse((match.group(2) ?? '').padRight(2, '0'));
    final minor = whole * BigInt.from(100) + fraction;
    if (minor > BigInt.from(_maxSafeMinor)) return null;
    return minor.toInt();
  }
  return null;
}

String? _timestamp(Object? value) {
  if (value is DateTime) return value.toUtc().toIso8601String();
  if (value is String) {
    final parsed = DateTime.tryParse(value);
    if (parsed != null) return parsed.toUtc().toIso8601String();
  }
  return null;
}

bool _validCurrency(String value) => RegExp(r'^[A-Z]{3}$').hasMatch(value);
bool _validMonth(String value) =>
    RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(value);
bool _validDate(String value) {
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) return false;
  final parsed = DateTime.tryParse('${value}T00:00:00Z');
  return parsed != null && parsed.toIso8601String().substring(0, 10) == value;
}

class SavingsBalanceReconciliation {
  const SavingsBalanceReconciliation(this.records, this.invalid);
  final List<LocalMigrationRecord> records;
  final List<InvalidLocalRecord> invalid;
}

/// Converts legacy goal snapshots into opening balances without counting their
/// already-included linked contribution and withdrawal history a second time.
SavingsBalanceReconciliation reconcileSavingsGoalOpeningBalances(
  List<LocalMigrationRecord> records,
) {
  final netByGoal = <String, int>{};
  for (final record in records) {
    if (record.collection != 'savingsMovements') continue;
    final goalId = record.data['savingsGoalId'];
    final amount = record.data['amountMinor'];
    if (goalId is! String || amount is! int) continue;
    final delta = record.data['balanceAffecting'] == false
        ? 0
        : record.data['kind'] == 'savings_contribution'
        ? amount
        : -amount;
    netByGoal[goalId] = (netByGoal[goalId] ?? 0) + delta;
  }

  final invalidGoalIds = <String>{};
  final invalid = <InvalidLocalRecord>[];
  final adjusted = <LocalMigrationRecord>[];
  for (final record in records) {
    if (record.collection != 'savingsGoals') {
      adjusted.add(record);
      continue;
    }
    final snapshot = record.data['legacyBalanceMinor'];
    final opening =
        (snapshot is int ? snapshot : 0) - (netByGoal[record.sourceId] ?? 0);
    if (opening < 0) {
      invalidGoalIds.add(record.sourceId);
      invalid.add(
        InvalidLocalRecord(
          'savingsGoal',
          record.sourceId,
          'El historial vinculado supera el saldo actual de la meta; requiere revisión.',
        ),
      );
      continue;
    }
    adjusted.add(
      LocalMigrationRecord(
        collection: record.collection,
        sourceId: record.sourceId,
        documentId: record.documentId,
        data: {...record.data, 'legacyBalanceMinor': opening},
      ),
    );
  }

  if (invalidGoalIds.isNotEmpty) {
    adjusted.removeWhere((record) {
      final goalId = record.collection == 'savingsMovements'
          ? record.data['savingsGoalId']
          : null;
      if (goalId is! String || !invalidGoalIds.contains(goalId)) return false;
      invalid.add(
        InvalidLocalRecord(
          'savingsMovement',
          record.sourceId,
          'Se excluye junto con una meta cuyo saldo requiere revisión; el original local se conserva.',
        ),
      );
      return true;
    });
  }
  return SavingsBalanceReconciliation(
    List.unmodifiable(adjusted),
    List.unmodifiable(invalid),
  );
}

String localMigrationSelectionKey(LocalMigrationRecord record) =>
    record.collection + ':' + record.sourceId;

List<LocalMigrationRecord> selectLocalMigrationRecords(
  Iterable<LocalMigrationRecord> records,
  Set<String> selectedKeys,
) => records
    .where(
      (record) => selectedKeys.contains(localMigrationSelectionKey(record)),
    )
    .toList(growable: false);
