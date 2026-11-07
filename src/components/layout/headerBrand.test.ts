import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('brand resource contract', () => {
  test('header and favicon point to the same resource', () => {
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    const html = readFileSync('index.html', 'utf8');
    expect(header).toContain('src="/favicon.png"');
    expect(html).toContain('href="/favicon.png"');
  });
});
