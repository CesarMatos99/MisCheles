export function normalizeMoneyInput(input: string): string {
  const trimmed = input.trim();
  const negative = trimmed.startsWith('-');
  let value = trimmed.replace(/[^\d.,]/g, '');
  if (!value) return '';

  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? ',' : '.';
    const groupSeparator = decimalSeparator === ',' ? '.' : ',';
    value = value.split(groupSeparator).join('');
    if (decimalSeparator === ',') value = value.replace(',', '.');
  } else if (comma >= 0) {
    const parts = value.split(',');
    const decimalComma = parts.length === 2 && parts[1].length > 0 && parts[1].length < 3;
    value = decimalComma ? parts[0] + '.' + parts[1] : parts.join('');
  } else if (dot >= 0 && value.split('.').length > 2) {
    const parts = value.split('.');
    const final = parts.pop() || '';
    value = final.length > 0 && final.length < 3 ? parts.join('') + '.' + final : parts.join('') + final;
  }

  const pieces = value.split('.');
  const integer = pieces.shift() || '';
  const fraction = pieces.join('').replace(/\D/g, '');
  const normalized = fraction ? integer + '.' + fraction : integer;
  if (!normalized || normalized === '.') return '';
  return (negative ? '-' : '') + normalized;
}

export function formatMoneyInput(value: string | number): string {
  const normalized = normalizeMoneyInput(String(value));
  if (!normalized) return '';
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [rawInteger, rawFraction = ''] = unsigned.split('.');
  const integer = rawInteger.replace(/^0+(?=\d)/, '') || '0';
  const formatter = new Intl.NumberFormat('en-US');
  const group = formatter.formatToParts(1000).find((part) => part.type === 'group')?.value || ',';
  const decimal = formatter.formatToParts(1.1).find((part) => part.type === 'decimal')?.value || '.';
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (negative ? '-' : '') + groupedInteger + decimal + rawFraction.padEnd(2, '0');
}
