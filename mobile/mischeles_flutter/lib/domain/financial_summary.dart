import 'financial_movement.dart';

class FinancialSummary {
  const FinancialSummary({
    required this.initialIncomeMinor,
    required this.carryoverMinor,
    required this.additionalIncomeMinor,
    required this.totalIncomeMinor,
    required this.regularExpensesMinor,
    required this.totalExpensesMinor,
    required this.savingsContributionsMinor,
    required this.savingsWithdrawalsMinor,
    required this.directSavingsExpensesMinor,
    required this.availableMinor,
  });
  final int initialIncomeMinor,
      carryoverMinor,
      additionalIncomeMinor,
      totalIncomeMinor;
  final int regularExpensesMinor, totalExpensesMinor, savingsContributionsMinor;
  final int savingsWithdrawalsMinor, directSavingsExpensesMinor, availableMinor;

  factory FinancialSummary.calculate({
    required String monthKey,
    required int initialIncomeMinor,
    required int carryoverMinor,
    required Iterable<FinancialMovement> movements,
  }) {
    final byId = <String, FinancialMovement>{};
    for (final movement in movements) {
      if (movement.monthKey != monthKey) continue;
      final namespace = movement.kind.startsWith('savings_')
          ? 'savings:'
          : 'transactions:';
      byId['$namespace${movement.id}'] = movement;
    }
    int sum(String kind) => byId.values
        .where((movement) => movement.kind == kind && movement.amountMinor > 0)
        .fold(0, (total, movement) => total + movement.amountMinor);
    final additional = sum('income');
    final contributionMovements = byId.values
        .where((movement) => movement.kind == 'savings_contribution')
        .toList(growable: false);
    final contributionsById = {
      for (final movement in contributionMovements) movement.id: movement,
    };
    var regular = 0;
    var unmatchedSavingsContributions = 0;
    for (final movement in byId.values) {
      if (movement.kind != 'expense' || movement.amountMinor <= 0) continue;
      final linkedContribution = movement.relatedSavingsMovementId == null
          ? null
          : contributionsById[movement.relatedSavingsMovementId];
      if (linkedContribution != null) continue;
      if (movement.relatedSavingsMovementId != null ||
          movement.categoryName.trim().toLowerCase() == 'aporte al ahorro') {
        unmatchedSavingsContributions += movement.amountMinor;
        continue;
      }
      regular += movement.amountMinor;
    }
    final contribution =
        sum('savings_contribution') + unmatchedSavingsContributions;
    final withdrawal = sum('savings_withdrawal');
    final direct = sum('savings_direct_expense');
    final initial = initialIncomeMinor < 0 ? 0 : initialIncomeMinor;
    final carryover = carryoverMinor < 0 ? 0 : carryoverMinor;
    final income = initial + additional;
    return FinancialSummary(
      initialIncomeMinor: initial,
      carryoverMinor: carryover,
      additionalIncomeMinor: additional,
      totalIncomeMinor: income,
      regularExpensesMinor: regular,
      totalExpensesMinor: regular + direct,
      savingsContributionsMinor: contribution,
      savingsWithdrawalsMinor: withdrawal,
      directSavingsExpensesMinor: direct,
      // Savings withdrawals increase available cash. Transfers are neutral. A contribution
      // leaves month cash once, while a direct savings payment is not a monthly cash outflow.
      availableMinor: carryover + income + withdrawal - regular - contribution,
    );
  }
}
