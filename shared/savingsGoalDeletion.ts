export type SavingsGoalDeletionCollection = 'savingsMovements' | 'transactions';

export interface SavingsGoalDeletionEntry {
  collection: SavingsGoalDeletionCollection;
  id: string;
  savingsGoalId?: string | null;
  relatedSavingsMovementId?: string | null;
}

/** Identifies a goal's savings movements and only transaction mirrors linked to them. */
export function savingsGoalDeletionKeys(
  goalId: string,
  entries: readonly SavingsGoalDeletionEntry[],
): Set<string> {
  if (typeof goalId !== 'string' || !goalId.trim() || goalId.includes('/')) {
    throw new Error('Savings goal ID is invalid.');
  }
  const linkedMovementIds = new Set(
    entries
      .filter((entry) => entry.collection === 'savingsMovements' && entry.savingsGoalId === goalId)
      .map((entry) => entry.id),
  );
  const keys = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || entry.id.includes('/') || !entry.collection) {
      throw new Error('Savings deletion record is invalid.');
    }
    if ((entry.collection === 'savingsMovements' && entry.savingsGoalId === goalId)
      || (entry.collection === 'transactions' && typeof entry.relatedSavingsMovementId === 'string'
        && linkedMovementIds.has(entry.relatedSavingsMovementId))) {
      keys.add(entry.collection + ':' + entry.id);
    }
  }
  return keys;
}
