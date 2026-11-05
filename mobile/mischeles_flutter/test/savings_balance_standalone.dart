import '../lib/domain/financial_movement.dart';
import '../lib/domain/savings_balance.dart';

void main() {
  const goalId = 'goal-1';
  final movements = <FinancialMovement>[
    const FinancialMovement(
      id: 'g-contribution',
      kind: 'savings_contribution',
      amountMinor: 500,
      currency: 'DOP',
      occurredOn: '2026-10-01',
      monthKey: '2026-10',
      categoryName: 'Fondo',
      description: 'Aporte meta',
      origin: 'manual',
      savingsGoalId: goalId,
    ),
    const FinancialMovement(
      id: 'g-withdrawal',
      kind: 'savings_withdrawal',
      amountMinor: 200,
      currency: 'DOP',
      occurredOn: '2026-10-02',
      monthKey: '2026-10',
      categoryName: 'Fondo',
      description: 'Retiro meta',
      origin: 'manual',
      savingsGoalId: goalId,
    ),
    const FinancialMovement(
      id: 'general-contribution',
      kind: 'savings_contribution',
      amountMinor: 700,
      currency: 'DOP',
      occurredOn: '2026-10-03',
      monthKey: '2026-10',
      categoryName: 'Ahorro',
      description: 'Aporte general',
      origin: 'manual',
    ),
    const FinancialMovement(
      id: 'general-expense',
      kind: 'savings_direct_expense',
      amountMinor: 100,
      currency: 'DOP',
      occurredOn: '2026-10-04',
      monthKey: '2026-10',
      categoryName: 'Ahorro',
      description: 'Pago desde ahorro general',
      origin: 'manual',
    ),
    const FinancialMovement(
      id: 'other-goal-contribution',
      kind: 'savings_contribution',
      amountMinor: 999,
      currency: 'DOP',
      occurredOn: '2026-10-05',
      monthKey: '2026-10',
      categoryName: 'Otro',
      description: 'Otra meta',
      origin: 'manual',
      savingsGoalId: 'goal-2',
    ),
  ];
  assert(
    calculateGoalBalanceMinor(
          goalId: goalId,
          openingBalanceMinor: 1000,
          movements: movements,
        ) ==
        1300,
  );
  assert(calculateGeneralSavingsBalanceMinor(movements) == 600);
  final closedGoalHistory = movements
      .where((movement) => movement.savingsGoalId == goalId)
      .map((movement) => movement.withoutSavingsGoal())
      .toList();
  final released = FinancialMovement(
    id: 'goal-reallocation',
    kind: 'savings_reallocation',
    amountMinor: 1300,
    currency: 'DOP',
    occurredOn: '2026-10-06',
    monthKey: '2026-10',
    categoryName: 'Ahorro',
    description: 'Saldo de meta',
    origin: 'manual',
  );
  final afterClose = [
    ...closedGoalHistory,
    ...movements.where((movement) => movement.savingsGoalId != goalId),
    released,
  ];
  assert(
    closedGoalHistory.every(
      (movement) =>
          !movement.balanceAffecting && movement.savingsGoalId == null,
    ),
  );
  assert(
    calculateGoalBalanceMinor(
          goalId: goalId,
          openingBalanceMinor: 0,
          movements: afterClose,
        ) ==
        0,
  );
  assert(
    calculateGeneralSavingsBalanceMinor(afterClose) == 1900,
    'history is ignored and the released balance is added once',
  );
  print('Savings balance contract checks passed.');
}
