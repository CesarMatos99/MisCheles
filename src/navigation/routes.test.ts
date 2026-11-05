import assert from 'node:assert/strict';
import test from 'node:test';
import { activeTabForPath, isCanonicalAppPath, pathForActiveTab } from './routes.ts';

test('module routes resolve directly and remain canonical', () => {
  const cases = [
    ['/', 'dashboard'],
    ['/movimientos', 'transactions'],
    ['/estadisticas', 'statistics'],
    ['/ahorros', 'savings'],
    ['/perfil', 'profile'],
  ] as const;
  for (const [path, tab] of cases) {
    assert.equal(activeTabForPath(path), tab);
    assert.equal(pathForActiveTab(tab), path);
    assert.equal(isCanonicalAppPath(path), true);
  }
});

test('noncanonical and unknown paths resolve safely to Inicio', () => {
  assert.equal(activeTabForPath('/ahorros/'), 'savings');
  assert.equal(isCanonicalAppPath('/ahorros/'), false);
  assert.equal(activeTabForPath('/ruta-inexistente'), 'dashboard');
  assert.equal(isCanonicalAppPath('/ruta-inexistente'), false);
});
