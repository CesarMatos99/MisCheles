import assert from 'node:assert/strict';
import test from 'node:test';
import { googleSignInStrategy } from './googleSignInStrategy.ts';

test('Google sign-in uses redirect on mobile widths and popup on larger screens', () => {
  for (const width of [320, 375, 390, 430, 767]) assert.equal(googleSignInStrategy(width), 'redirect');
  for (const width of [768, 1024, 1440]) assert.equal(googleSignInStrategy(width), 'popup');
});
