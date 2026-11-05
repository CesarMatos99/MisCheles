import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAnalyticsFilters, evolutionMonthCount, type AnalyticsFiltersValue } from './analyticsFilterContract.ts';
const valid: AnalyticsFiltersValue = { mode: 'month', year: 2026, month: 11, from: '2026-11-01', to: '2026-11-30', category: 'Todas', movementType: 'all', firstKey: '2026-11', secondKey: '2026-10' };
test('filter application rejects malformed criteria without changing the draft', () => {
  assert.equal(validateAnalyticsFilters(valid, true), null);
  for (const patch of [{ month: 13 }, { year: 0 }, { firstKey: '2026-13' }, { secondKey: '2026-11' }]) assert.ok(validateAnalyticsFilters({ ...valid, ...patch }, true));
  assert.ok(validateAnalyticsFilters({ ...valid, mode: 'custom', from: '2026-02-30' }, false));
  assert.ok(validateAnalyticsFilters({ ...valid, mode: 'custom', from: '2026-12-01' }, false));
  assert.equal(valid.month, 11);
});
test('evolution follows the applied month or multi-month period', () => {
  assert.equal(evolutionMonthCount('month'), 1);
  assert.equal(evolutionMonthCount('6m'), 6);
  assert.equal(evolutionMonthCount('12m'), 12);
  assert.equal(evolutionMonthCount('year'), 12);
});
