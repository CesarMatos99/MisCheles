import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRestoredWebMode } from './webModePolicy.ts';

test('web restores demo and persistent local modes separately and preserves unmarked legacy records', () => {
  assert.equal(resolveRestoredWebMode(null, false), null);
  assert.equal(resolveRestoredWebMode('demo', false), 'demo');
  assert.equal(resolveRestoredWebMode('local', false), 'local');
  assert.equal(resolveRestoredWebMode(null, true), 'legacyLocal');
  assert.equal(resolveRestoredWebMode('local', true), 'local');
});
