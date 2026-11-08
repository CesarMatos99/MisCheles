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

  test('header greets the current first name on desktop and leaves entry actions to the mobile FAB', () => {
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    const app = readFileSync('src/App.tsx', 'utf8');
    const floatingActions = readFileSync('src/components/layout/FloatingActions.tsx', 'utf8');
    expect(header).toContain('user?.displayName?.trim() || profile.name');
    expect(header).toContain('identityName.trim().split');
    expect(header).toContain('¡Hola');
    expect(header).toContain('hidden min-w-0 truncate text-base font-semibold text-app-foreground lg:block');
    expect(header).not.toContain('Nuevo registro');
    expect(header).not.toContain('onExpense');
    expect(app).toContain('<FloatingActions');
    expect(floatingActions).toContain('lg:hidden');
  });
});
