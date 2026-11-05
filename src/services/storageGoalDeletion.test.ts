import assert from 'node:assert/strict';
import test from 'node:test';

test('deleting a false savings goal removes its linked contribution mirrors only', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  values.set('mischeles_savings_goals_v3', JSON.stringify([{ id: 'goal-1', title: 'Viaje', targetAmount: 200, currentAmount: 100 }]));
  values.set('mischeles_savings_movements_v3', JSON.stringify([
    { id: 'save-1', monthKey: '2026-10', type: 'deposit_from_month', amount: 100, description: 'aporte', date: '2026-10-01', createdAt: 1, goalId: 'goal-1' },
    { id: 'save-other', monthKey: '2026-10', type: 'deposit_from_month', amount: 80, description: 'otro', date: '2026-10-01', createdAt: 1, goalId: 'goal-2' },
  ]));
  values.set('mischeles_transactions_v3', JSON.stringify([
    { id: 'mirror-1', monthKey: '2026-10', type: 'expense', amount: 100, category: 'Aporte al Ahorro', description: 'aporte', date: '2026-10-01', paymentMethod: 'Efectivo', createdAt: 1, relatedSavingsMovementId: 'save-1' },
    { id: 'mirror-other', monthKey: '2026-10', type: 'expense', amount: 80, category: 'Aporte al Ahorro', description: 'otro', date: '2026-10-01', paymentMethod: 'Efectivo', createdAt: 1, relatedSavingsMovementId: 'save-other' },
    { id: 'ordinary', monthKey: '2026-10', type: 'expense', amount: 20, category: 'Regalo', description: 'normal', date: '2026-10-01', paymentMethod: 'Efectivo', createdAt: 1 },
  ]));
  const { storageService } = await import('./storage.ts');
  storageService.deleteSavingsGoal('goal-1', 'fictional', '2026-10');
  const savings = JSON.parse(values.get('mischeles_savings_movements_v3')!);
  const transactions = JSON.parse(values.get('mischeles_transactions_v3')!);
  const goals = JSON.parse(values.get('mischeles_savings_goals_v3')!);
  assert.deepEqual(savings.map((item: { id: string }) => item.id), ['save-other']);
  assert.deepEqual(transactions.map((item: { id: string }) => item.id), ['mirror-other', 'ordinary']);
  assert.deepEqual(goals.map((item: { id: string }) => item.id), []);
});
