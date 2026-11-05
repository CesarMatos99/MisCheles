import assert from 'node:assert/strict';
import test from 'node:test';
import { clearAccountScope, preferredUnauthenticatedScope, setStorageScope, storageService } from './storage.ts';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

test('demo, local, and account records are isolated and legacy local data is preserved', () => {
  const memory = new MemoryStorage();
  memory.setItem('unrelated_application_key', 'preserve-me');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });

  setStorageScope('local');
  assert.equal(preferredUnauthenticatedScope(), 'local');
  memory.setItem('mischeles_web_mode_v1', 'demo');
  assert.equal(preferredUnauthenticatedScope(), 'demo');
  memory.setItem('mischeles_web_mode_v1', 'local');
  assert.deepEqual(storageService.getTransactions(), []);
  assert.deepEqual(storageService.getSavingsMovements(), []);
  assert.deepEqual(storageService.getSavingsGoals(), []);
  assert.equal(storageService.getProfile().name, '');
  assert.equal(storageService.getProfile().pinLockEnabled, false);
  const localTx = storageService.addTransaction({
    monthKey: '2026-10', type: 'expense', amount: 125, category: 'Regalo',
    description: 'Regalo Juan', date: '2026-10-31', paymentMethod: 'Efectivo',
  });
  storageService.setCloudRevision('transactions', localTx.id, 'time:42');
  assert.equal(JSON.parse(memory.getItem('mischeles_transactions_v3') || '[]')[0]?._cloudRevision, 'time:42');

  setStorageScope('demo');
  const demoTransactions = storageService.getTransactions();
  assert.ok(demoTransactions.length > 0);
  assert.ok(!demoTransactions.some((item) => item.id === localTx.id));
  assert.ok(storageService.getSavingsGoals().length > 0);
  assert.equal(storageService.getProfile().pinLockEnabled, false);
  storageService.resetAllData();
  assert.ok(storageService.getTransactions().length > 0, 'demo examples are restored on the next read');
  assert.equal(memory.getItem('unrelated_application_key'), 'preserve-me', 'reset only removes Mis Cheles keys');

  setStorageScope({ accountUid: 'uid-one' });
  assert.deepEqual(storageService.getTransactions(), []);
  assert.equal(storageService.getMonthConfig('2026-09'), null);
  assert.deepEqual(storageService.getSavingsMovements(), []);
  assert.deepEqual(storageService.getSavingsGoals(), []);
  storageService.applyCloudSnapshot('categoryBudgets', [{
    id: '2026-10:Internet', monthKey: '2026-10', category: 'Internet', amount: 400,
    cloudDocumentId: 'cloud-budget-1', _cloudRevision: 'time:42:7',
  }], new Set());
  const accountBudgets = storageService.getCategoryBudgets('2026-10');
  assert.equal(accountBudgets[0]?._cloudRevision, 'time:42:7');
  storageService.saveCategoryBudgets('2026-10', [{ category: 'Internet', amount: 500 }]);
  assert.equal(storageService.getCategoryBudgets('2026-10')[0]?._cloudRevision, 'time:42:7');

  storageService.applyCloudSnapshot('monthConfigurations', [{
    id: '2026-10', monthKey: '2026-10', year: 2026, month: 10, initialIncome: 1000,
    carryoverFromPrev: 0, autoRolloverEnabled: true, isConfigured: true,
    cloudDocumentId: 'cloud-month-1', _cloudRevision: 'time:50:9',
  }], new Set());
  storageService.saveMonthConfig({ monthKey: '2026-10', year: 2026, month: 10, initialIncome: 1250, carryoverFromPrev: 0, autoRolloverEnabled: true, isConfigured: true });
  assert.equal((storageService.getMonthConfig('2026-10') as unknown as Record<string, unknown>)._cloudRevision, 'time:50:9');
  assert.equal((storageService.getMonthConfig('2026-10') as unknown as Record<string, unknown>).cloudDocumentId, 'cloud-month-1');

  const accountTx = storageService.addTransaction({
    monthKey: '2026-10', type: 'expense', amount: 125, category: 'Regalo',
    description: 'Regalo Juan', date: '2026-10-31', paymentMethod: 'Efectivo',
  });
  assert.equal(storageService.getTransactions()[0]?.id, accountTx.id);
  const cloudEcho = { ...accountTx, amount: 999 };
  storageService.applyCloudSnapshot('transactions', [cloudEcho], new Set(), new Set([accountTx.id]));
  assert.equal(storageService.getTransactions()[0]?.amount, accountTx.amount);
  storageService.applyCloudSnapshot('transactions', [cloudEcho], new Set([accountTx.id]));
  assert.equal(storageService.getTransactions()[0]?.amount, 999);

  setStorageScope('local');
  assert.deepEqual(storageService.getTransactions().map((item) => item.id), [localTx.id]);
  setStorageScope({ accountUid: 'uid-two' });
  assert.deepEqual(storageService.getTransactions(), []);
  const secondAccountTx = storageService.addTransaction({
    monthKey: '2026-10', type: 'expense', amount: 500, category: 'Otro',
    description: 'Solo cuenta 2', date: '2026-10-31', paymentMethod: 'Efectivo',
  });
  assert.throws(() => storageService.resetAllData());
  assert.equal(storageService.getTransactions()[0]?.id, secondAccountTx.id);
  setStorageScope({ accountUid: 'uid-one' });
  assert.ok(storageService.getTransactions().some((item) => item.id === accountTx.id));
  assert.ok(!storageService.getTransactions().some((item) => item.id === secondAccountTx.id));
  setStorageScope({ accountUid: 'uid-two' });
  assert.ok(storageService.getTransactions().some((item) => item.id === secondAccountTx.id));
  setStorageScope('local');
});


test('account savings balances use the opening amount plus linked movement history once', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope({ accountUid: 'savings-balance-test' });
  storageService.saveSavingsGoals([{ id: 'goal-1', title: 'Fondo', targetAmount: 1000, currentAmount: 100 }]);
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'deposit_from_month', amount: 50, description: 'Aporte', date: '2026-10-01', goalId: 'goal-1' });
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'withdraw_to_month', amount: 20, description: 'Retiro', date: '2026-10-02', goalId: 'goal-1' });
  assert.equal(storageService.getSavingsGoals()[0]?.currentAmount, 130);
  assert.equal(storageService.getTotalSavingsVault(), 130);
  const rawGoals = JSON.parse((globalThis.localStorage as unknown as MemoryStorage).getItem('mischeles_scope_savings-balance-test_mischeles_savings_goals_v3') || '[]');
  assert.equal(rawGoals[0]?.currentAmount, 100, 'account storage keeps the opening balance; the ledger derives the current balance');
  storageService.saveSavingsGoals([{ ...storageService.getSavingsGoals()[0]!, title: 'Fondo actualizado' }]);
  assert.equal(storageService.getSavingsGoals()[0]?.currentAmount, 130, 'editing goal metadata preserves its derived balance');
  setStorageScope('local');
});


test('closing a savings goal preserves history but transfers its balance exactly once', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');
  storageService.saveSavingsGoals([{ id: 'goal-close', title: 'Meta', targetAmount: 1000, currentAmount: 0 }]);
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'deposit_from_month', amount: 100, description: 'Aporte', date: '2026-10-01', goalId: 'goal-close' });
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'withdraw_to_month', amount: 20, description: 'Retiro', date: '2026-10-02', goalId: 'goal-close' });
  assert.equal(storageService.getTotalSavingsVault(), 80);
  storageService.deleteSavingsGoal('goal-close', 'general', '2026-10');
  assert.deepEqual(storageService.getSavingsGoals(), []);
  assert.equal(storageService.getTotalSavingsVault(), 80, 'historic goal movements do not double count after closing');
  const history = storageService.getSavingsMovements();
  assert.equal(history.filter((item) => item.balanceAffecting === false).length, 2);
  assert.equal(history.filter((item) => item.type === 'goal_to_general').reduce((sum, item) => sum + item.amount, 0), 80);
  setStorageScope({ accountUid: 'closing-goal-account' });
  storageService.saveSavingsGoals([{ id: 'account-goal', title: 'Meta cuenta', targetAmount: 1000, currentAmount: 100 }]);
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'deposit_from_month', amount: 50, description: 'Aporte', date: '2026-10-01', goalId: 'account-goal' });
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'withdraw_to_month', amount: 20, description: 'Retiro', date: '2026-10-02', goalId: 'account-goal' });
  assert.equal(storageService.getTotalSavingsVault(), 130);
  storageService.deleteSavingsGoal('account-goal', 'general', '2026-10');
  assert.equal(storageService.getTotalSavingsVault(), 130, 'account opening balance and explicit reassignment are not double counted');
  assert.ok(storageService.getSavingsMovements().filter((item) => item.goalId == null).every((item) => item.balanceAffecting === false || item.type === 'goal_to_general'));
  setStorageScope('local');
});


test('closing a savings goal into the month removes only its live balance and keeps history inert', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');
  storageService.saveSavingsGoals([{ id: 'goal-month', title: 'Meta', targetAmount: 1000, currentAmount: 0 }]);
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'deposit_from_month', amount: 100, description: 'Aporte', date: '2026-10-01', goalId: 'goal-month' });
  storageService.addSavingsMovement({ monthKey: '2026-10', type: 'withdraw_to_month', amount: 20, description: 'Retiro', date: '2026-10-02', goalId: 'goal-month' });
  storageService.deleteSavingsGoal('goal-month', 'month', '2026-10');
  assert.equal(storageService.getTotalSavingsVault(), 0);
  const movements = storageService.getSavingsMovements();
  assert.equal(movements.filter((item) => item.balanceAffecting === false).length, 2);
  assert.equal(movements.filter((item) => item.type === 'withdraw_to_month' && item.goalId == null && item.balanceAffecting !== false).reduce((sum, item) => sum + item.amount, 0), 80);
  setStorageScope('local');
});


test('clearing a deleted account removes only its namespaced local mirror', () => {
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  memory.setItem('mischeles_scope_uid-one_mischeles_transactions_v3', 'account-data');
  memory.setItem('mischeles_scope_uid-two_mischeles_transactions_v3', 'other-account');
  memory.setItem('mischeles_transactions_v3', 'legacy-local');
  memory.setItem('unrelated_application_key', 'keep');
  clearAccountScope('uid-one');
  assert.equal(memory.getItem('mischeles_scope_uid-one_mischeles_transactions_v3'), null);
  assert.equal(memory.getItem('mischeles_scope_uid-two_mischeles_transactions_v3'), 'other-account');
  assert.equal(memory.getItem('mischeles_transactions_v3'), 'legacy-local');
  assert.equal(memory.getItem('unrelated_application_key'), 'keep');
  assert.throws(() => clearAccountScope('../other'));
});

test('real storage operations preserve consumption, monthly cash, general savings and goal mirrors', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');
  const monthKey = '2026-11', date = '2026-11-01';
  storageService.saveMonthConfig({ monthKey, year: 2026, month: 11, initialIncome: 1000, carryoverFromPrev: 0, autoRolloverEnabled: false, isConfigured: true });
  storageService.saveSavingsGoals([{ id: 'verified-goal', title: 'Meta de prueba aislada', targetAmount: 500, currentAmount: 0 }]);
  storageService.addTransaction({ monthKey, date, type: 'expense', amount: 100, category: 'Comida', description: 'Consumo', paymentMethod: 'Efectivo' });
  assert.equal(storageService.getFinancialSummary(monthKey).availableBalance, 900);
  const general = storageService.addSavingsMovement({ monthKey, date, type: 'deposit_from_month', amount: 200, description: 'Aporte general', destinationType: 'general' });
  assert.equal(storageService.getFinancialSummary(monthKey).availableBalance, 700);
  assert.equal(storageService.getTotalSavingsVault(), 200);
  const goal = storageService.addSavingsMovement({ monthKey, date, type: 'deposit_from_month', amount: 150, description: 'Aporte meta', destinationType: 'goal', goalId: 'verified-goal' });
  assert.equal(storageService.getSavingsGoals()[0].currentAmount, 150);
  assert.equal(storageService.getFinancialSummary(monthKey).availableBalance, 550);
  assert.equal(storageService.getTotalSavingsVault(), 350);
  const mirrors = storageService.getTransactions().filter(tx => tx.relatedSavingsMovementId);
  assert.deepEqual(new Set(mirrors.map(tx => tx.relatedSavingsMovementId)), new Set([general.id, goal.id]));
  assert.equal(mirrors.length, 2);
  assert.equal(storageService.getFinancialSummary(monthKey).totalExpenses, 100);
  storageService.addSavingsMovement({ monthKey, date, type: 'withdraw_to_month', amount: 50, description: 'Retiro general', destinationType: 'general' });
  storageService.addSavingsMovement({ monthKey, date, type: 'direct_expense', amount: 25, description: 'Pago desde ahorro', destinationType: 'general', category: 'Salud' });
  const summary = storageService.getFinancialSummary(monthKey);
  assert.equal(summary.availableBalance, 600);
  assert.equal(summary.totalIncome, 1000);
  assert.equal(summary.totalExpenses, 125);
  assert.equal(summary.regularExpenses, 100);
  assert.equal(summary.totalSavingsVault, 275);
  assert.equal(storageService.getSavingsGoals()[0].currentAmount, 150);
});

test('editing a savings mirror updates its canonical contribution and goal without new records', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');
  storageService.saveSavingsGoals([{ id: 'goal-edit', title: 'Meta', targetAmount: 1000, currentAmount: 0 }]);
  const contribution = storageService.addSavingsMovement({ monthKey: '2026-11', date: '2026-11-01', type: 'deposit_from_month', amount: 100, description: 'Aporte', destinationType: 'goal', goalId: 'goal-edit' });
  const mirror = storageService.getTransactions().find(tx => tx.relatedSavingsMovementId === contribution.id)!;
  storageService.updateTransaction({ ...mirror, amount: 150, description: 'Aporte corregido', date: '2026-11-02' });
  assert.equal(storageService.getSavingsMovements().length, 1);
  assert.equal(storageService.getTransactions().length, 1);
  assert.equal(storageService.getSavingsMovements()[0].id, contribution.id);
  assert.equal(storageService.getSavingsMovements()[0].amount, 150);
  assert.equal(storageService.getSavingsGoals()[0].currentAmount, 150);
  assert.equal(storageService.getTotalSavingsVault(), 150);
  assert.equal(storageService.getFinancialSummary('2026-11').totalExpenses, 0);
});

test('rejected mirror reduction preserves data and deleting the mirror removes its contribution', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');
  storageService.saveSavingsGoals([{ id: 'goal-guard', title: 'Meta', targetAmount: 1000, currentAmount: 0 }]);
  const contribution = storageService.addSavingsMovement({ monthKey: '2026-11', date: '2026-11-01', type: 'deposit_from_month', amount: 100, description: 'Aporte', destinationType: 'goal', goalId: 'goal-guard' });
  const mirror = storageService.getTransactions().find(tx => tx.relatedSavingsMovementId === contribution.id)!;
  const withdrawal = storageService.addSavingsMovement({ monthKey: '2026-11', date: '2026-11-02', type: 'withdraw_to_month', amount: 80, description: 'Retiro', destinationType: 'goal', goalId: 'goal-guard' });
  assert.throws(() => storageService.updateTransaction({ ...mirror, amount: 10 }), /ya retirado/);
  assert.equal(storageService.getSavingsMovements().find(sm => sm.id === contribution.id)?.amount, 100);
  assert.equal(storageService.getTransactions().find(tx => tx.id === mirror.id)?.amount, 100);
  assert.equal(storageService.getSavingsGoals()[0].currentAmount, 20);
  assert.throws(() => storageService.deleteTransaction(mirror.id), /ya se retiró o gastó/);
  assert.equal(storageService.getTransactions().length, 1);
  assert.equal(storageService.getSavingsMovements().length, 2);
  storageService.deleteSavingsMovement(withdrawal.id);
  storageService.deleteTransaction(mirror.id);
  assert.equal(storageService.getSavingsMovements().length, 0);
  assert.equal(storageService.getTransactions().length, 0);
  assert.equal(storageService.getSavingsGoals()[0].currentAmount, 0);
  assert.equal(storageService.getTotalSavingsVault(), 0);
});


test('legacy local PIN is removed from profile storage and exposed once for secure migration', () => {
  const memory = new MemoryStorage();
  const session = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');
  memory.setItem('mischeles_user_profile_v2', JSON.stringify({ name: 'Local', email: '', photoUrl: '', currency: 'RD$', pinCode: '7391', biometricsEnabled: true, pinLockEnabled: true, monthlyTargetIncome: 0 }));
  const profile = storageService.getProfile() as unknown as Record<string, unknown>;
  assert.equal(profile.pinCode, undefined);
  assert.equal(profile.biometricsEnabled, false);
  assert.equal(profile.pinLockEnabled, true);
  assert.equal(JSON.parse(memory.getItem('mischeles_user_profile_v2') || '{}').pinCode, undefined);
  assert.equal(storageService.takeLegacyLockPin(), '7391');
  assert.equal(storageService.takeLegacyLockPin(), null);
});
