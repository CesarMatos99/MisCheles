import 'financial_movement.dart';

/// Returns the goal's ledger entries and only transaction mirrors that point to them.
List<FinancialMovement> savingsGoalDeletionGroup({
  required String goalId,
  required Iterable<FinancialMovement> movements,
}) {
  if (goalId.trim().isEmpty) {
    throw ArgumentError.value(goalId, 'goalId', 'Goal ID is required');
  }
  final records = movements.toList(growable: false);
  final goalMovementIds = records
      .where((movement) => movement.savingsGoalId == goalId)
      .map((movement) => movement.id)
      .toSet();
  return records
      .where(
        (movement) =>
            movement.savingsGoalId == goalId ||
            (movement.savingsGoalId == null &&
                !movement.kind.startsWith('savings_') &&
                movement.relatedSavingsMovementId != null &&
                goalMovementIds.contains(movement.relatedSavingsMovementId)),
      )
      .toList(growable: false);
}

bool isSavingsGoalDeletionRecord(
  FinancialMovement movement,
  String goalId,
  Set<String> goalMovementIds,
) =>
    movement.savingsGoalId == goalId ||
    (movement.savingsGoalId == null &&
        !movement.kind.startsWith('savings_') &&
        movement.relatedSavingsMovementId != null &&
        goalMovementIds.contains(movement.relatedSavingsMovementId));
