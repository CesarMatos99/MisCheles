import 'dart:convert';
import 'dart:io';

import '../lib/domain/financial_movement.dart';
import '../lib/domain/savings_movement_links.dart';

void main() {
  const goalId = 'goal-1';
  const contributionId = 'save-1';
  const withdrawalId = 'save-2';
  const movements = <FinancialMovement>[
    FinancialMovement(
      id: contributionId,
      kind: 'savings_contribution',
      amountMinor: 15000,
      currency: 'DOP',
      occurredOn: '2026-10-01',
      monthKey: '2026-10',
      categoryName: 'Viaje',
      description: 'Aporte',
      origin: 'manual',
      savingsGoalId: goalId,
    ),
    FinancialMovement(
      id: 'mirror-1',
      kind: 'expense',
      amountMinor: 15000,
      currency: 'DOP',
      occurredOn: '2026-10-01',
      monthKey: '2026-10',
      categoryName: 'Aporte al Ahorro',
      description: 'Aporte',
      origin: 'manual',
      relatedSavingsMovementId: contributionId,
    ),
    FinancialMovement(
      id: withdrawalId,
      kind: 'savings_withdrawal',
      amountMinor: 3000,
      currency: 'DOP',
      occurredOn: '2026-10-02',
      monthKey: '2026-10',
      categoryName: 'Viaje',
      description: 'Retiro',
      origin: 'manual',
      savingsGoalId: goalId,
    ),
    FinancialMovement(
      id: 'mirror-other',
      kind: 'expense',
      amountMinor: 2000,
      currency: 'DOP',
      occurredOn: '2026-10-02',
      monthKey: '2026-10',
      categoryName: 'Aporte al Ahorro',
      description: 'Otro aporte',
      origin: 'manual',
      relatedSavingsMovementId: 'save-other-goal',
    ),
    FinancialMovement(
      id: 'other-goal',
      kind: 'savings_contribution',
      amountMinor: 8000,
      currency: 'DOP',
      occurredOn: '2026-10-03',
      monthKey: '2026-10',
      categoryName: 'Otra meta',
      description: 'Aporte ajeno',
      origin: 'manual',
      savingsGoalId: 'goal-2',
    ),
    FinancialMovement(
      id: 'unlinked-expense',
      kind: 'expense',
      amountMinor: 500,
      currency: 'DOP',
      occurredOn: '2026-10-04',
      monthKey: '2026-10',
      categoryName: 'Regalo',
      description: 'Sin relación',
      origin: 'manual',
    ),
  ];
  final group = savingsGoalDeletionGroup(goalId: goalId, movements: movements);
  assert(group.map((item) => item.id).toSet().length == 3);
  assert(
    group.map((item) => item.id).toSet().containsAll({
      contributionId,
      withdrawalId,
      'mirror-1',
    }),
  );
  assert(!group.any((item) => item.id == 'mirror-other'));
  assert(!group.any((item) => item.id == 'other-goal'));
  assert(!group.any((item) => item.id == 'unlinked-expense'));
  final sharedVectors =
      jsonDecode(
            File(
              'shared/savings_goal_deletion_vectors.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;
  for (final scenario in sharedVectors['cases'] as List<dynamic>) {
    final entries = (scenario['records'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
    final movements = entries.map((record) {
      final collection = record['collection'] as String;
      return FinancialMovement(
        id: record['id'] as String,
        kind: record['kind'] as String,
        amountMinor: 1,
        currency: 'DOP',
        occurredOn: '2026-10-01',
        monthKey: '2026-10',
        categoryName: '',
        description: '',
        origin: 'manual',
        savingsGoalId: collection == 'savingsMovements'
            ? record['savingsGoalId'] as String?
            : null,
        relatedSavingsMovementId: record['relatedSavingsMovementId'] as String?,
      );
    }).toList();
    final selected = savingsGoalDeletionGroup(
      goalId: scenario['goalId'] as String,
      movements: movements,
    );
    final keys =
        selected
            .map(
              (item) =>
                  (item.kind.startsWith('savings_')
                      ? 'savingsMovements'
                      : 'transactions') +
                  ':' +
                  item.id,
            )
            .toList()
          ..sort();
    final expected =
        (scenario['expectedKeys'] as List<dynamic>).cast<String>().toList()
          ..sort();
    assert(keys.toString() == expected.toString(), scenario['name'] as String);
  }
  print('Savings linked mirror deletion contract: PASS');
}
