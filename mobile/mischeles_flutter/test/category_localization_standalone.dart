import '../lib/domain/category_localization.dart';

void main() {
  const checks = <String, String>{
    'Alimentación y Supermercado': 'Food and Groceries',
    'Energía eléctrica': 'Electricity',
    'Aporte al Ahorro': 'Savings Contribution',
    'Regalo': 'Gift',
  };
  for (final entry in checks.entries) {
    if (localizedCategoryLabel('en', entry.key) != entry.value) {
      throw StateError(
        'English category mapping failed for ' + entry.key + '.',
      );
    }
    if (localizedCategoryLabel('es', entry.key) != entry.key) {
      throw StateError(
        'Spanish category mapping changed stored label ' + entry.key + '.',
      );
    }
  }
  const custom = 'Dentista local';
  if (localizedCategoryLabel('en', custom) != custom) {
    throw StateError('Custom category label was unexpectedly changed.');
  }
  print('Category localization checks passed.');
}
