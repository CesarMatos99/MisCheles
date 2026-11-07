import React from 'react';
import {
  Briefcase, Car, CreditCard, DollarSign, Droplets, Film, Gift, GraduationCap, HeartPulse, Home,
  MoreHorizontal, PawPrint, PiggyBank, PieChart, PlusCircle, ShoppingBag, Smartphone, Tag, TrendingUp,
  Utensils, Wifi, Zap,
} from 'lucide-react';
import { getCategoryPresentation } from '../../domain/categoryPresentation';

const ICONS = {
  Briefcase, Car, CreditCard, DollarSign, Droplets, Film, Gift, GraduationCap, HeartPulse, Home,
  MoreHorizontal, PawPrint, PiggyBank, PieChart, PlusCircle, ShoppingBag, Smartphone, Tag, TrendingUp,
  Utensils, Wifi, Zap,
} as const;

export function CategoryIcon({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' }) {
  const presentation = getCategoryPresentation(category);
  const Icon = ICONS[presentation.icon as keyof typeof ICONS] || Tag;
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return <span aria-hidden="true" className={'category-icon inline-flex shrink-0 items-center justify-center rounded-xl ' + dimension} style={{ '--category-color': presentation.color, '--category-bg': presentation.bgLight, '--category-bg-dark': presentation.bgDark } as React.CSSProperties}>
    <Icon className={iconSize} strokeWidth={2.2} />
  </span>;
}
