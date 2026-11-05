import 'dart:convert';
import '../lib/domain/financial_movement.dart';

void main() {
  final source = FinancialMovement(
    id: 'movement-1',
    kind: 'expense',
    amountMinor: 12345,
    currency: 'DOP',
    occurredOn: '2026-10-28',
    occurredAt: '2026-10-28T14:30:00.000Z',
    monthKey: '2026-10',
    categoryName: 'Alimentación',
    description: 'Supermercado',
    notes: 'Compra semanal',
    bankName: 'Banco Ejemplo',
    bankReferenceHash: 'a' * 64,
    paymentInstrumentLastFour: '4321',
    paymentMethod: 'debit_card',
    origin: 'email_import',
    importedCandidateId: 'candidate-1',
  );
  final serialized =
      jsonDecode(jsonEncode(source.toMap())) as Map<String, Object?>;
  final restored = FinancialMovement.fromMap(serialized);
  assert(restored.occurredAt == source.occurredAt);
  assert(restored.notes == source.notes);
  assert(restored.bankName == source.bankName);
  assert(restored.bankReferenceHash == source.bankReferenceHash);
  assert(
    restored.paymentInstrumentLastFour == source.paymentInstrumentLastFour,
  );
  assert(!serialized.containsKey('bankReference'));
  assert(!jsonEncode(serialized).contains('43214321'));
  print('Financial movement safe metadata serialization: PASS');
}
