import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldEnableWebAppCheck } from './appCheckPolicy.ts';

const production = { enabled: true, productionBuild: true, usingEmulators: false, siteKey: 'public-site-key' };
test('enables App Check only for an explicitly configured production Firebase app', () => {
  assert.equal(shouldEnableWebAppCheck(production), true);
  assert.equal(shouldEnableWebAppCheck({ ...production, enabled: false }), false);
  assert.equal(shouldEnableWebAppCheck({ ...production, productionBuild: false }), false);
  assert.equal(shouldEnableWebAppCheck({ ...production, usingEmulators: true }), false);
  assert.equal(shouldEnableWebAppCheck({ ...production, siteKey: '  ' }), false);
});
