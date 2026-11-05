import 'financial_movement.dart';

/// Calculates a goal balance from its opening value and all linked savings ledger entries.
int calculateGoalBalanceMinor({
  required String goalId,
  required int openingBalanceMinor,
  required Iterable<FinancialMovement> movements,
}) => movements
    .where((item) => item.savingsGoalId == goalId && item.balanceAffecting)
    .fold<int>(openingBalanceMinor, (balance, item) {
      if (item.kind == 'savings_contribution')
        return balance + item.amountMinor;
      if (item.kind == 'savings_withdrawal' ||
          item.kind == 'savings_direct_expense') {
        return balance - item.amountMinor;
      }
      return balance;
    });

/// Calculates savings held outside named goals from unassigned savings movements.
int calculateGeneralSavingsBalanceMinor(
  Iterable<FinancialMovement> movements,
) => movements
    .where(
      (item) =>
          item.savingsGoalId == null &&
          item.balanceAffecting &&
          item.kind.startsWith('savings_'),
    )
    .fold<int>(0, (balance, item) {
      if (item.kind == 'savings_contribution' ||
          item.kind == 'savings_reallocation') {
        return balance + item.amountMinor;
      }
      if (item.kind == 'savings_withdrawal' ||
          item.kind == 'savings_direct_expense') {
        return balance - item.amountMinor;
      }
      return balance;
    });
