import '../lib/domain/currency_preference.dart';

void main() {
  const expected = <String, String>{
    'USD': r'$',
    'DOP': r'RD$',
    'EUR': '€',
    'MXN': r'MXN$',
    'COP': r'COP$',
    'PEN': 'S/',
    'CLP': r'CLP$',
    'ARS': r'ARS$',
  };
  for (final entry in expected.entries) {
    if (!isSupportedCurrencyCode(entry.key) ||
        currencySymbolForCode(entry.key) != entry.value) {
      throw StateError('Currency mapping mismatch for ' + entry.key);
    }
  }
  if (isSupportedCurrencyCode('ZZZ') || isSupportedCurrencyCode(null)) {
    throw StateError('Unsupported currency code was accepted.');
  }
  if (currencyName('es', 'DOP') != 'Peso dominicano' ||
      currencyName('en', 'DOP') != 'Dominican peso') {
    throw StateError('Currency names do not follow the selected language.');
  }
  if (localCurrencyPreferenceKey == legacyCurrencyPreferenceKey ||
      localCurrencyPreferenceKey == accountCurrencyPreferenceKey('uid-1') ||
      resolveCurrencyPreference('USD', 'DOP') != 'USD' ||
      resolveCurrencyPreference(null, 'EUR') != 'EUR' ||
      resolveCurrencyPreference(null, null) != 'DOP') {
    throw StateError('Scoped local and account currency preferences diverged.');
  }
  print('Currency preference checks passed.');
}
