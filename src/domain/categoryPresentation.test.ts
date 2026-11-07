import { describe, expect, test } from 'bun:test';
import { getCategoryPresentation } from './categoryPresentation';

describe('category presentation', () => {
  test('reuses the original identity for known categories', () => {
    const housing = getCategoryPresentation('Vivienda y Alquiler');
    expect(housing.icon).toBe('Home');
    expect(housing.color).toBe('#3b82f6');
  });

  test('assigns a stable non-neutral fallback to custom categories', () => {
    const first = getCategoryPresentation('Café del barrio');
    const second = getCategoryPresentation('Café del barrio');
    expect(second).toEqual(first);
    expect(first.icon).toBe('Tag');
    expect(first.color).not.toBe('#64748b');
  });
});
