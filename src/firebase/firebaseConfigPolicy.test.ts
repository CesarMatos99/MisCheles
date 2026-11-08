import assert from 'node:assert/strict';
import test from 'node:test';
import { hasFirebaseWebConfig } from './firebaseConfigPolicy.ts';

const valid = { apiKey: 'public-key', authDomain: 'mischeles.example', projectId: 'mischeles-bd5a5', appId: 'web-app-id', messagingSenderId: '123456' };

test('Firebase Auth activates only with the complete public web configuration', () => {
  assert.equal(hasFirebaseWebConfig(valid), true);
  assert.equal(hasFirebaseWebConfig({ ...valid, apiKey: '' }), false);
  assert.equal(hasFirebaseWebConfig({ ...valid, messagingSenderId: '' }), false);
  assert.equal(hasFirebaseWebConfig({ ...valid, projectId: 'demo-mischeles' }), false);
  assert.equal(hasFirebaseWebConfig({ ...valid, projectId: 'demo-mischeles' }, true), true);
});
