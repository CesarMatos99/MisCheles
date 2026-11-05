import { localizeCategoryName } from './categoryLabels.ts';
import { translate, type AppLanguage, type TranslationKey } from './catalog.ts';

export type AnalyticsMovementTypeLabel = 'all' | 'income' | 'expense' | 'savings';

export function analyticsFilterSummaryLabels(language: AppLanguage, category: string, movementType: AnalyticsMovementTypeLabel) {
  const categoryLabel = category === 'Todas' ? translate(language, 'allCategories') : localizeCategoryName(language, category);
  const movementKeys: Record<AnalyticsMovementTypeLabel, TranslationKey> = {
    all: 'allMovementTypes',
    income: 'incomeMovementType',
    expense: 'expenseMovementType',
    savings: 'savingsMovementType',
  };
  return { category: categoryLabel, movementType: translate(language, movementKeys[movementType]) };
}
