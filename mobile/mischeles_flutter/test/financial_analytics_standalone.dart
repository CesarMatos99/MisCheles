import '../lib/domain/financial_analytics.dart';
import '../lib/domain/financial_movement.dart';

FinancialMovement movement(
  String id,
  String kind,
  String month,
  int amount,
  String category,
) => FinancialMovement(
  id: id,
  kind: kind,
  amountMinor: amount,
  currency: 'DOP',
  occurredOn: month + '-10',
  monthKey: month,
  categoryName: category,
  description: '',
  origin: 'manual',
);

void main() {
  final movements = [
    movement('income-a', 'income', '2026-12', 25000, 'Trabajo'),
    movement('expense-a', 'expense', '2026-12', 8000, 'Comida'),
    movement('expense-b', 'expense', '2026-12', 2000, 'Comida'),
    movement('expense-c', 'expense', '2026-12', 5000, 'Transporte'),
    movement('direct-a', 'savings_direct_expense', '2026-12', 1000, 'Salud'),
    movement('save-a', 'savings_contribution', '2026-12', 3000, 'Ahorro'),
    movement('expense-prev', 'expense', '2026-11', 4000, 'Comida'),
    movement('income-prev', 'income', '2026-11', 10000, 'Trabajo'),
  ];
  final configs = [
    {
      'monthKey': '2026-12',
      'initialIncomeMinor': 100000,
      'openingCarryoverMinor': 5000,
    },
    {
      'monthKey': '2026-11',
      'initialIncomeMinor': 50000,
      'openingCarryoverMinor': 0,
    },
  ];
  final budgets = [
    {'monthKey': '2026-12', 'categoryName': 'Comida', 'assignedMinor': 9000},
    {'monthKey': '2026-12', 'categoryName': 'Salud', 'assignedMinor': 2000},
  ];
  final december = FinancialAnalytics.month(
    monthKey: '2026-12',
    movements: movements,
    monthConfigurations: configs,
    categoryBudgets: budgets,
  );
  assert(december.summary.totalIncomeMinor == 125000);
  assert(december.summary.totalExpensesMinor == 16000);
  assert(december.summary.availableMinor == 112000);
  assert(december.movementCount == 6);
  assert(december.categories.first.name == 'Comida');
  assert(december.categories.first.spentMinor == 10000);
  assert(december.categories.first.remainingMinor == -1000);
  assert((december.categories.first.share - 0.625).abs() < 0.000001);

  final november = FinancialAnalytics.month(
    monthKey: '2026-11',
    movements: movements,
    monthConfigurations: configs,
  );
  final comparison = FinancialAnalytics.compare(
    first: november,
    second: december,
  );
  assert(comparison.income.amountMinor == 65000);
  assert((comparison.income.percent! - (65000 / 60000)).abs() < 0.000001);
  assert(comparison.expenses.amountMinor == 12000);
  assert(comparison.categoryDifferences.first.$1 == 'Comida');

  final evolution = FinancialAnalytics.evolution(
    endMonthKey: '2026-01',
    monthCount: 3,
    movements: movements,
    monthConfigurations: configs,
  );
  assert(
    evolution.map((item) => item.monthKey).join(',') ==
        '2025-11,2025-12,2026-01',
  );
  assert(evolution.first.summary.totalIncomeMinor == 0);
  final zeroBase = FinancialAnalytics.compare(
    first: evolution.first,
    second: november,
  );
  assert(zeroBase.income.percent == null);
  print('Financial analytics checks passed.');
}
