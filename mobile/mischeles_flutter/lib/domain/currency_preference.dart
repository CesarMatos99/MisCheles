const Map<String, String> currencySymbols = <String, String>{
  'USD': r'$',
  'DOP': r'RD$',
  'EUR': '€',
  'MXN': r'MXN$',
  'COP': r'COP$',
  'PEN': 'S/',
  'CLP': r'CLP$',
  'ARS': r'ARS$',
};

const Map<String, (String, String)> currencyNames = <String, (String, String)>{
  'USD': ('Dólar estadounidense', 'US dollar'),
  'DOP': ('Peso dominicano', 'Dominican peso'),
  'EUR': ('Euro', 'Euro'),
  'MXN': ('Peso mexicano', 'Mexican peso'),
  'COP': ('Peso colombiano', 'Colombian peso'),
  'PEN': ('Sol peruano', 'Peruvian sol'),
  'CLP': ('Peso chileno', 'Chilean peso'),
  'ARS': ('Peso argentino', 'Argentine peso'),
};

bool isSupportedCurrencyCode(Object? value) =>
    value is String && currencySymbols.containsKey(value);

String currencySymbolForCode(String code) => currencySymbols[code] ?? code;

String currencyName(String language, String code) {
  final names = currencyNames[code];
  if (names == null) return code;
  return language == 'en' ? names.$2 : names.$1;
}

const legacyCurrencyPreferenceKey = 'mischeles_currency_v1';
const localCurrencyPreferenceKey = 'mischeles_currency_local_v1';

String accountCurrencyPreferenceKey(String uid) =>
    'mischeles_currency_account_' + uid + '_v1';

String resolveCurrencyPreference(String? scopedValue, String? legacyValue) {
  if (isSupportedCurrencyCode(scopedValue)) return scopedValue!;
  if (isSupportedCurrencyCode(legacyValue)) return legacyValue!;
  return 'DOP';
}
