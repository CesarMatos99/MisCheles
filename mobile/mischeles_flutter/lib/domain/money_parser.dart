/// Parses a decimal monetary input into exact minor units.
/// A comma is accepted as the decimal separator; grouping separators are rejected.
int? parseMoneyMinor(String text) {
  final normalized = text.trim().replaceAll(',', '.');
  if (normalized.isEmpty) return 0;
  if (!RegExp(r'^\d+(?:\.\d{1,2})?$').hasMatch(normalized)) return null;
  final parts = normalized.split('.');
  final whole = BigInt.tryParse(parts.first);
  if (whole == null) return null;
  final cents = parts.length == 1 ? 0 : int.parse(parts[1].padRight(2, '0'));
  final minor = whole * BigInt.from(100) + BigInt.from(cents);
  if (minor > BigInt.from(9007199254740991)) return null;
  return minor.toInt();
}
