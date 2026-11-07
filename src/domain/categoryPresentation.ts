import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type CategoryDef } from '../constants/categories';

const FALLBACK_COLORS: ReadonlyArray<Pick<CategoryDef, 'color' | 'bgLight' | 'bgDark' | 'icon'>> = [
  { color: '#2563eb', bgLight: '#eff6ff', bgDark: '#1e3a8a', icon: 'Tag' },
  { color: '#0f766e', bgLight: '#f0fdfa', bgDark: '#134e4a', icon: 'Tag' },
  { color: '#b45309', bgLight: '#fffbeb', bgDark: '#78350f', icon: 'Tag' },
  { color: '#7c3aed', bgLight: '#f5f3ff', bgDark: '#4c1d95', icon: 'Tag' },
  { color: '#be185d', bgLight: '#fdf2f8', bgDark: '#831843', icon: 'Tag' },
  { color: '#0369a1', bgLight: '#f0f9ff', bgDark: '#0c4a6e', icon: 'Tag' },
];

function normalizeCategory(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-DO');
}

function categoryHash(value: string): number {
  return Array.from(normalizeCategory(value)).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

/** Reuses the original category identity and assigns a stable visual fallback to custom categories. */
export function getCategoryPresentation(category: string): CategoryDef {
  const known = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find((item) => normalizeCategory(item.name) === normalizeCategory(category));
  if (known) return known;
  const fallback = FALLBACK_COLORS[categoryHash(category) % FALLBACK_COLORS.length];
  return { id: 'custom-' + categoryHash(category), name: category, ...fallback };
}

export { normalizeCategory };
