Map<String, Object?> normalizeAccountMovement(
  String collectionName,
  Map<String, Object?> source,
) {
  final data = Map<String, Object?>.from(source);
  // Repair legacy web migrations that wrote a transaction mirror as a savings
  // movement. Keep the transaction as an expense; the link/label logic handles
  // its transfer treatment without double-counting the savings movement.
  if (collectionName == 'transactions' &&
      data['kind'] == 'savings_contribution') {
    data['kind'] = 'expense';
  }
  return data;
}
