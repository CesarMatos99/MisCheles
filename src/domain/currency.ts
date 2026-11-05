const DISPLAY_TO_CODE: Record<string, string> = {
  '$': 'USD', 'RD$': 'DOP', '€': 'EUR', 'MXN$': 'MXN',
  'COP$': 'COP', 'S/': 'PEN', 'CLP$': 'CLP', 'ARS$': 'ARS',
};
const CODE_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_TO_CODE).map(([display, code]) => [code, display]),
);
export function currencyCodeFromDisplay(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (/^[A-Z]{3}$/.test(text)) return text;
  return DISPLAY_TO_CODE[text] || 'DOP';
}
export function currencyDisplayFromCode(value: unknown, fallback = 'RD$'): string {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return CODE_TO_DISPLAY[text] || fallback;
}
