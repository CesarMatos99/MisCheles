import 'dart:convert';

/// Fallback revision for Firestore records predating server update timestamps.
/// Must stay byte-for-byte compatible with shared/syncRevision.ts.
String cloudRevisionContentToken(
  Map<String, Object?> record, {
  int? Function(Object?)? timestampMillis,
}) {
  String canonical(Object? value) {
    if (value is DateTime)
      return 'date:' + value.millisecondsSinceEpoch.toString();
    final millis = timestampMillis?.call(value);
    if (millis != null) return 'timestamp:' + millis.toString();
    if (value is List) return '[' + value.map(canonical).join(',') + ']';
    if (value is Map) {
      final keys =
          value.keys
              .whereType<String>()
              .where((key) => key != '_cloudRevision')
              .toList()
            ..sort();
      return '{' +
          keys
              .map((key) => jsonEncode(key) + ':' + canonical(value[key]))
              .join(',') +
          '}';
    }
    if (value is double && !value.isFinite) return 'null';
    if (value is num && value == value.toInt()) return value.toInt().toString();
    return jsonEncode(value) ?? 'undefined';
  }

  var hash = BigInt.parse('14695981039346656037');
  final mask = (BigInt.one << 64) - BigInt.one;
  final prime = BigInt.parse('1099511628211');
  final text = canonical(record);
  for (final unit in text.codeUnits) {
    hash = ((hash ^ BigInt.from(unit)) * prime) & mask;
  }
  return 'content:' + hash.toRadixString(16).padLeft(16, '0');
}

/// Mirrors the web write conflict rule for an absent/existing remote document.
bool isCloudRevisionStale({
  required String? expectedRevision,
  required bool remoteExists,
  required String? remoteRevision,
}) => remoteExists
    ? expectedRevision == null || expectedRevision != remoteRevision
    : expectedRevision != null;
