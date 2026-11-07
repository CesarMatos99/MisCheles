import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

describe('brand resource contract', () => {
  test('header uses the wordmark while favicon and transparent PDF icon remain available', () => {
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    const html = readFileSync('index.html', 'utf8');
    const pdf = readFileSync('src/services/pdfReport.ts', 'utf8');
    expect(header).toContain('>MisCheles</span>');
    expect(header).not.toContain('<img');
    expect(html).toContain('href="/favicon.png"');
    expect(existsSync('public/favicon.png')).toBe(true);
    expect(existsSync('public/app-icon.png')).toBe(true);
    expect(pdf).toContain("path = '/app-icon.png'");
  });
});
