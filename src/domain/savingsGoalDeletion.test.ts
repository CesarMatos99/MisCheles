import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { savingsGoalDeletionKeys } from '../../shared/savingsGoalDeletion.ts';

test('uses the shared false-goal deletion vectors', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../shared/savings_goal_deletion_vectors.json', import.meta.url), 'utf8'));
  for (const scenario of fixture.cases) {
    assert.deepEqual(
      [...savingsGoalDeletionKeys(scenario.goalId, scenario.records)].sort(),
      [...scenario.expectedKeys].sort(),
      scenario.name,
    );
  }
});
