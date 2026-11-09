import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWebAccessState } from './webModePolicy.ts';
import { resolveVisibleIdentity } from '../domain/visibleIdentity.ts';

test('web access stays private until authentication or an explicit demo choice', () => {
  assert.equal(resolveWebAccessState(false, null, false), 'restoring');
  assert.equal(resolveWebAccessState(true, null, false), 'visitor');
  assert.equal(resolveWebAccessState(true, null, true), 'demo');
  assert.equal(resolveWebAccessState(true, { emailVerified: true, providerData: [{ providerId: 'password' }] }, false), 'account');
});

test('password accounts require verified email while Google identity does not require a second verification flow', () => {
  assert.equal(resolveWebAccessState(true, { emailVerified: false, providerData: [{ providerId: 'password' }] }, false), 'verification');
  assert.equal(resolveWebAccessState(true, { emailVerified: false, providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] }, false), 'verification');
  assert.equal(resolveWebAccessState(true, { emailVerified: true, providerData: [{ providerId: 'password' }] }, false), 'account');
  assert.equal(resolveWebAccessState(true, { emailVerified: false, providerData: [{ providerId: 'google.com' }] }, false), 'account');
});

test('demo identity never reads Firebase or a previously saved profile identity', () => {
  const identity = resolveVisibleIdentity({
    name: 'Cuenta anterior', email: 'private@example.com', photoUrl: '/private-photo.png', currency: 'USD',
    biometricsEnabled: false, pinLockEnabled: true, monthlyTargetIncome: 98765,
  }, { displayName: 'Cuenta real', email: 'real@example.com', photoURL: '/real-photo.png' }, true);
  assert.equal(identity.name, 'Usuario de demostración');
  assert.equal(identity.accountEmail, '');
  assert.equal(identity.contactEmail, '');
  assert.equal(identity.photoUrl, '');
  assert.equal(identity.isDemo, true);
});

test('custom profile name is the visible identity and Firebase account email stays separate', () => {
  const identity = resolveVisibleIdentity({
    name: 'Nombre personalizado', email: 'contacto@example.com', photoUrl: '/mischeles-photo.png', currency: 'RD$',
    biometricsEnabled: false, pinLockEnabled: false, monthlyTargetIncome: 0,
  }, { displayName: 'Nombre de Google', email: 'cuenta@example.com', photoURL: '/google-photo.png' }, false);
  assert.equal(identity.name, 'Nombre personalizado');
  assert.equal(identity.firstName, 'Nombre');
  assert.equal(identity.accountEmail, 'cuenta@example.com');
  assert.equal(identity.contactEmail, 'contacto@example.com');
  assert.equal(identity.photoUrl, '/mischeles-photo.png');
});

test('Google identity supplies the initial display name, account email, and photo when no MisCheles overrides exist', () => {
  const profile = {
    name: '', email: '', photoUrl: '', currency: 'RD$',
    biometricsEnabled: false, pinLockEnabled: false, monthlyTargetIncome: 0,
  };
  const google = { displayName: 'Ana Pérez', email: 'ana@example.com', photoURL: '/google-photo.png' };
  const identity = resolveVisibleIdentity(profile, google, false);
  assert.equal(identity.name, google.displayName);
  assert.equal(identity.accountEmail, google.email);
  assert.equal(identity.photoUrl, google.photoURL);
});

test('email and password registration name remains the initial identity until customized in MisCheles', () => {
  const profile = {
    name: '', email: '', photoUrl: '', currency: 'RD$',
    biometricsEnabled: false, pinLockEnabled: false, monthlyTargetIncome: 0,
  };
  const registered = { displayName: 'Luis Ramos', email: 'luis@example.com', photoURL: null };
  const identity = resolveVisibleIdentity(profile, registered, false);
  assert.equal(identity.name, registered.displayName);
  assert.equal(identity.accountEmail, registered.email);
  assert.equal(identity.photoUrl, '');
});

test('an empty or generic profile name falls back to Firebase before the generic greeting', () => {
  const profile = {
    name: 'Usuario', email: '', photoUrl: '', currency: 'RD$',
    biometricsEnabled: false, pinLockEnabled: false, monthlyTargetIncome: 0,
  };
  assert.equal(resolveVisibleIdentity(profile, { displayName: 'Ana Pérez' }, false).name, 'Ana Pérez');
  const generic = resolveVisibleIdentity({ ...profile, name: '' }, null, false);
  assert.equal(generic.name, 'Usuario');
  assert.equal(generic.firstName, '');
});
