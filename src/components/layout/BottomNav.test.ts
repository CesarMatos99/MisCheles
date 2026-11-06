import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BottomNav } from './BottomNav';
import { LanguageProvider } from '../../i18n/LanguageContext';

test('mobile bottom navigation shows four modules and keeps Profile out of the bar', () => {
    const html = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(BottomNav, { activeTab: 'statistics', onChangeTab: () => undefined })),
    );
    expect((html.match(/<button/g) || []).length).toBe(4);
    expect(html).toContain('Inicio');
    expect(html).toContain('Registro');
    expect(html).toContain('Estadísticas');
    expect(html).toContain('Ahorro');
    expect(html).not.toContain('Perfil');
    expect(html).toContain('grid-cols-4');
});
