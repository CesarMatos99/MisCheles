import 'dart:convert';
import 'dart:io';

import '../lib/domain/financial_movement.dart';
import '../lib/domain/financial_summary.dart';
import '../lib/domain/local_migration_mapper.dart';

void main() {
  const items = [
    FinancialMovement(
      id: 'income-1',
      kind: 'income',
      amountMinor: 30000,
      currency: 'DOP',
      occurredOn: '2026-10-02',
      monthKey: '2026-10',
      categoryName: 'Trabajo',
      description: '',
      origin: 'manual',
    ),
    FinancialMovement(
      id: 'expense-1',
      kind: 'expense',
      amountMinor: 12000,
      currency: 'DOP',
      occurredOn: '2026-10-03',
      monthKey: '2026-10',
      categoryName: 'Comida',
      description: '',
      origin: 'manual',
    ),
    FinancialMovement(
      id: 'save-1',
      kind: 'savings_contribution',
      amountMinor: 5000,
      currency: 'DOP',
      occurredOn: '2026-10-04',
      monthKey: '2026-10',
      categoryName: 'Ahorro',
      description: '',
      origin: 'manual',
    ),
    FinancialMovement(
      id: 'withdraw-1',
      kind: 'savings_withdrawal',
      amountMinor: 1000,
      currency: 'DOP',
      occurredOn: '2026-10-05',
      monthKey: '2026-10',
      categoryName: 'Ahorro',
      description: '',
      origin: 'manual',
    ),
    FinancialMovement(
      id: 'direct-1',
      kind: 'savings_direct_expense',
      amountMinor: 700,
      currency: 'DOP',
      occurredOn: '2026-10-06',
      monthKey: '2026-10',
      categoryName: 'Salud',
      description: '',
      origin: 'manual',
    ),
    FinancialMovement(
      id: 'old-1',
      kind: 'expense',
      amountMinor: 99999,
      currency: 'DOP',
      occurredOn: '2026-09-06',
      monthKey: '2026-09',
      categoryName: 'Otro',
      description: '',
      origin: 'manual',
    ),
  ];
  final result = FinancialSummary.calculate(
    monthKey: '2026-10',
    initialIncomeMinor: 100000,
    carryoverMinor: 8000,
    movements: items,
  );
  assert(result.totalIncomeMinor == 130000);
  assert(result.regularExpensesMinor == 12000);
  assert(result.totalExpensesMinor == 12700);
  assert(result.savingsContributionsMinor == 5000);
  assert(result.savingsWithdrawalsMinor == 1000);
  assert(result.availableMinor == 122000);
  assert(
    result.totalIncomeMinor !=
        result.totalIncomeMinor +
            result.carryoverMinor +
            result.savingsWithdrawalsMinor,
  );
  const linked = FinancialMovement(
    id: 'contribution-1',
    kind: 'savings_contribution',
    amountMinor: 12500,
    currency: 'DOP',
    occurredOn: '2026-10-07',
    monthKey: '2026-10',
    categoryName: 'Viaje',
    description: 'Aporte al viaje',
    paymentMethod: 'cash',
    origin: 'manual',
    savingsGoalId: 'goal-1',
    ownerUid: 'uid-1',
    createdAt: '2026-10-07T12:00:00Z',
  );
  final detached = linked.withoutSavingsGoal();
  assert(detached.savingsGoalId == null);
  assert(detached.id == linked.id);
  assert(detached.amountMinor == linked.amountMinor);
  assert(detached.occurredOn == linked.occurredOn);
  assert(detached.description == linked.description);
  assert(detached.paymentMethod == linked.paymentMethod);
  assert(detached.ownerUid == linked.ownerUid);
  assert(detached.createdAt == linked.createdAt);

  const mirror = FinancialMovement(
    id: 'mirror-1',
    kind: 'expense',
    amountMinor: 12500,
    currency: 'DOP',
    occurredOn: '2026-10-07',
    monthKey: '2026-10',
    categoryName: 'Aporte al Ahorro',
    description: 'Aporte al viaje',
    origin: 'manual',
    relatedSavingsMovementId: 'contribution-1',
  );
  assert(mirror.toMap()['relatedSavingsMovementId'] == 'contribution-1');
  assert(
    FinancialMovement.fromMap(mirror.toMap()).relatedSavingsMovementId ==
        'contribution-1',
  );
  final migratedMirror = mapLocalRecord('movement', {
    'id': 'mirror-1',
    'kind': 'expense',
    'amountMinor': 12500,
    'currency': 'DOP',
    'occurredOn': '2026-10-07',
    'monthKey': '2026-10',
    'categoryName': 'Aporte al Ahorro',
    'description': 'Aporte al viaje',
    'relatedSavingsMovementId': 'contribution-1',
  });
  assert(migratedMirror is LocalMigrationRecord);
  assert(
    (migratedMirror as LocalMigrationRecord).data['relatedSavingsMovementId'] ==
        'contribution-1',
  );

  final vectors =
      jsonDecode(
            File('shared/financial_summary_vectors.json').readAsStringSync(),
          )
          as Map<String, dynamic>;
  for (final scenario in vectors['cases'] as List<dynamic>) {
    final recordMaps = (scenario['records'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
    final movements = recordMaps.map(
      (record) => FinancialMovement(
        id: record['id'] as String,
        kind: record['kind'] as String,
        amountMinor: (record['amountMinor'] as num).toInt(),
        currency: 'DOP',
        occurredOn: '2026-10-01',
        monthKey: record['monthKey'] as String,
        categoryName: record['categoryName'] as String,
        description: '',
        origin: 'manual',
        relatedSavingsMovementId: record['relatedSavingsMovementId'] as String?,
      ),
    );
    final summary = FinancialSummary.calculate(
      monthKey: scenario['monthKey'] as String,
      initialIncomeMinor: (scenario['initialIncomeMinor'] as num).toInt(),
      carryoverMinor: (scenario['carryoverMinor'] as num).toInt(),
      movements: movements,
    );
    final expected = scenario['expected'] as Map<String, dynamic>;
    assert(summary.initialIncomeMinor == expected['initialIncomeMinor']);
    assert(summary.carryoverMinor == expected['carryoverMinor']);
    assert(summary.additionalIncomeMinor == expected['additionalIncomeMinor']);
    assert(summary.totalIncomeMinor == expected['totalIncomeMinor']);
    assert(summary.regularExpensesMinor == expected['regularExpensesMinor']);
    assert(summary.totalExpensesMinor == expected['totalExpensesMinor']);
    assert(
      summary.savingsContributionsMinor ==
          expected['savingsContributionsMinor'],
    );
    assert(
      summary.savingsWithdrawalsMinor == expected['savingsWithdrawalsMinor'],
    );
    assert(
      summary.directSavingsExpensesMinor ==
          expected['directSavingsExpensesMinor'],
    );
    assert(summary.availableMinor == expected['availableMinor']);
  }
  print('Financial summary contract vectors: PASS');
}
