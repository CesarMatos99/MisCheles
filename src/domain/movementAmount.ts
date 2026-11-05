/** Parse a positive amount compatible with the shared integer minor-unit model. */
export function parseMovementAmount(input: string): number | null {
  const text = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor / 100 : null;
}
