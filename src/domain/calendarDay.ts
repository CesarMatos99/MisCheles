/** Parse a calendar date without rolling invalid days into the next month. */
export function parseCalendarDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setHours(0, 0, 0, 0); date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : new Date(NaN);
}

/** A transaction's selected accounting month must match its calendar date. */
export function isCalendarDayInMonth(value: string, monthKey: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthKey)
    && !Number.isNaN(parseCalendarDay(value).getTime())
    && value.slice(0, 7) === monthKey;
}
