export const DEFAULT_ACCENT_COLOR = '#012677';

export const ACCENT_COLORS = [
  { name: 'Azul MisCheles', value: DEFAULT_ACCENT_COLOR },
  { name: 'Verde esmeralda', value: '#047857' },
  { name: 'Morado', value: '#6D28D9' },
  { name: 'Turquesa', value: '#0F7490' },
  { name: 'Naranja', value: '#C2410C' },
  { name: 'Rosa', value: '#BE185D' },
  { name: 'Gris grafito', value: '#374151' },
] as const;

const supportedAccentColors = new Map(ACCENT_COLORS.map(({ value }) => [value.toLowerCase(), value]));

export function normalizeAccentColor(value: string | null | undefined): string {
  return supportedAccentColors.get(value?.trim().toLowerCase() || '') || DEFAULT_ACCENT_COLOR;
}
