import 'financial_movement.dart';
import 'financial_summary.dart';

class CategoryAnalytics {
  const CategoryAnalytics({
    required this.name,
    required this.spentMinor,
    required this.totalExpenseMinor,
    required this.budgetMinor,
  });
  final String name;
  final int spentMinor;
  final int totalExpenseMinor;
  final int? budgetMinor;
  double get share =>
      totalExpenseMinor == 0 ? 0 : spentMinor / totalExpenseMinor;
  int? get remainingMinor =>
      budgetMinor == null ? null : budgetMinor! - spentMinor;
  double? get budgetUsage => budgetMinor == null || budgetMinor == 0
      ? null
      : spentMinor / budgetMinor!;
}

class MonthlyAnalytics {
  const MonthlyAnalytics({
    required this.monthKey,
    required this.summary,
    required this.movementCount,
    required this.categories,
  });
  final String monthKey;
  final FinancialSummary summary;
  final int movementCount;
  final List<CategoryAnalytics> categories;
  int get savingsNetMinor =>
      summary.savingsContributionsMinor - summary.savingsWithdrawalsMinor;
}

class MetricDifference {
  const MetricDifference({required this.amountMinor, required this.percent});
  final int amountMinor;

  /// Null means the baseline is zero, so a percentage is undefined.
  final double? percent;
}

class MonthlyComparison {
  const MonthlyComparison({
    required this.first,
    required this.second,
    required this.income,
    required this.expenses,
    required this.savings,
    required this.available,
    required this.categoryDifferences,
  });
  final MonthlyAnalytics first;
  final MonthlyAnalytics second;
  final MetricDifference income;
  final MetricDifference expenses;
  final MetricDifference savings;
  final MetricDifference available;
  final List<(String name, int firstMinor, int secondMinor)>
  categoryDifferences;
}

class FinancialAnalytics {
  const FinancialAnalytics._();

  static MonthlyAnalytics month({
    required String monthKey,
    required Iterable<FinancialMovement> movements,
    Iterable<Map<String, Object?>> monthConfigurations = const [],
    Iterable<Map<String, Object?>> categoryBudgets = const [],
  }) {
    Map<String, Object?>? configuration;
    for (final record in monthConfigurations) {
      if (record['monthKey'] == monthKey) {
        configuration = record;
        break;
      }
    }
    final initial = _minor(
      configuration,
      'initialIncomeMinor',
      'initialIncome',
    );
    final carryover = _minor(
      configuration,
      'openingCarryoverMinor',
      'carryoverFromPrev',
    );
    final periodMovements = <String, FinancialMovement>{};
    for (final movement in movements) {
      if (movement.monthKey == monthKey)
        periodMovements[movement.id] = movement;
    }
    final summary = FinancialSummary.calculate(
      monthKey: monthKey,
      initialIncomeMinor: initial,
      carryoverMinor: carryover,
      movements: periodMovements.values,
    );
    final budgetsByName = <String, int>{};
    for (final budget in categoryBudgets) {
      if (budget['monthKey'] != monthKey) continue;
      final name = (budget['categoryName'] ?? budget['category'])
          ?.toString()
          .trim();
      if (name == null || name.isEmpty) continue;
      budgetsByName[name] = _minor(budget, 'assignedMinor', 'amount');
    }
    final spentByName = <String, int>{};
    for (final movement in periodMovements.values) {
      if (movement.kind != 'expense' &&
          movement.kind != 'savings_direct_expense')
        continue;
      spentByName.update(
        movement.categoryName,
        (amount) => amount + movement.amountMinor,
        ifAbsent: () => movement.amountMinor,
      );
    }
    final total = spentByName.values.fold<int>(
      0,
      (sum, amount) => sum + amount,
    );
    final names = {...spentByName.keys, ...budgetsByName.keys}.toList()
      ..sort((a, b) {
        final amountOrder = (spentByName[b] ?? 0).compareTo(
          spentByName[a] ?? 0,
        );
        return amountOrder != 0
            ? amountOrder
            : a.toLowerCase().compareTo(b.toLowerCase());
      });
    final categories = names
        .map(
          (name) => CategoryAnalytics(
            name: name,
            spentMinor: spentByName[name] ?? 0,
            totalExpenseMinor: total,
            budgetMinor: budgetsByName[name],
          ),
        )
        .toList(growable: false);
    return MonthlyAnalytics(
      monthKey: monthKey,
      summary: summary,
      movementCount: periodMovements.length,
      categories: categories,
    );
  }

  static MonthlyComparison compare({
    required MonthlyAnalytics first,
    required MonthlyAnalytics second,
  }) {
    MetricDifference difference(int before, int after) => MetricDifference(
      amountMinor: after - before,
      percent: before <= 0 ? null : (after - before) / before,
    );
    final firstCategories = {
      for (final category in first.categories)
        category.name: category.spentMinor,
    };
    final secondCategories = {
      for (final category in second.categories)
        category.name: category.spentMinor,
    };
    final names = {...firstCategories.keys, ...secondCategories.keys}.toList()
      ..sort((a, b) {
        final order = (secondCategories[b] ?? 0).compareTo(
          secondCategories[a] ?? 0,
        );
        return order != 0 ? order : a.toLowerCase().compareTo(b.toLowerCase());
      });
    return MonthlyComparison(
      first: first,
      second: second,
      income: difference(
        first.summary.totalIncomeMinor,
        second.summary.totalIncomeMinor,
      ),
      expenses: difference(
        first.summary.totalExpensesMinor,
        second.summary.totalExpensesMinor,
      ),
      savings: difference(first.savingsNetMinor, second.savingsNetMinor),
      available: difference(
        first.summary.availableMinor,
        second.summary.availableMinor,
      ),
      categoryDifferences: names
          .map(
            (name) =>
                (name, firstCategories[name] ?? 0, secondCategories[name] ?? 0),
          )
          .toList(growable: false),
    );
  }

  static List<MonthlyAnalytics> evolution({
    required String endMonthKey,
    required int monthCount,
    required Iterable<FinancialMovement> movements,
    Iterable<Map<String, Object?>> monthConfigurations = const [],
    Iterable<Map<String, Object?>> categoryBudgets = const [],
  }) {
    if (!_validMonth(endMonthKey))
      throw ArgumentError.value(endMonthKey, 'endMonthKey');
    if (monthCount < 1 || monthCount > 120)
      throw RangeError.range(monthCount, 1, 120, 'monthCount');
    final parts = endMonthKey.split('-').map(int.parse).toList();
    final end = DateTime(parts[0], parts[1]);
    return List<MonthlyAnalytics>.generate(monthCount, (index) {
      final date = DateTime(end.year, end.month - monthCount + index + 1);
      final key =
          date.year.toString() + '-' + date.month.toString().padLeft(2, '0');
      return month(
        monthKey: key,
        movements: movements,
        monthConfigurations: monthConfigurations,
        categoryBudgets: categoryBudgets,
      );
    }, growable: false);
  }

  static int _minor(
    Map<String, Object?>? record,
    String minorKey,
    String majorKey,
  ) {
    if (record == null) return 0;
    final minor = record[minorKey];
    if (minor is num && minor.isFinite) return minor.round();
    final major = record[majorKey];
    if (major is num && major.isFinite) return (major * 100).round();
    if (major is String) {
      final parsed = num.tryParse(major);
      if (parsed != null && parsed.isFinite) return (parsed * 100).round();
    }
    return 0;
  }

  static bool _validMonth(String value) =>
      RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(value);
}
