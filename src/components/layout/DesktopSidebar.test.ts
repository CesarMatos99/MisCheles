import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesktopSidebar } from './DesktopSidebar';

test('desktop sidebar keeps the four primary modules and statistics shortcuts', () => {
  const html = renderToStaticMarkup(createElement(DesktopSidebar, {
    activeTab: 'statistics',
    analyticsSection: 'compare',
    onNavigate: () => undefined,
    onNavigateAnalytics: () => undefined,
  }));

  expect(html).toContain('MisCheles');
  expect(html).toContain('Inicio');
  expect(html).toContain('Registro');
  expect(html).toContain('Estadísticas');
  expect(html).toContain('Ahorro');
  expect(html).toContain('Categorías');
  expect(html).toContain('Comparar');
  expect(html).toContain('Evolución');
  expect(html).toContain('aria-current="page"');
  expect(html).toContain('hidden w-60');
});
