import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('responsive visual contract', () => {
  test('keeps the mobile baseline, safe areas and dark theme tokens', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('min-width: 320px');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain(':root.dark');
    expect(css).toContain('--app-primary: #012677');
    expect(css).toContain('--app-background: #f8f9fc');
  });
});
