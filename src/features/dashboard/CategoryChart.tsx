import React, { useState } from 'react';
import { PieChart as PieIcon, BarChart3, Tag, DollarSign, Filter, ChevronRight } from 'lucide-react';
import { Transaction, UserProfile, FinancialSummary } from '../../types';
import { EXPENSE_CATEGORIES } from '../../constants/categories';

interface CategoryChartProps {
  transactions: Transaction[];
  profile: UserProfile;
  summary: FinancialSummary;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export const CategoryChart: React.FC<CategoryChartProps> = ({
  transactions,
  profile,
  summary,
  selectedCategory,
  onSelectCategory,
}) => {
  const [chartType, setChartType] = useState<'donut' | 'bars'>('donut');

  // Filter only expenses
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalExpenseAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Group by category
  const categoryTotals: Record<string, { total: number; count: number; color: string }> = {};

  for (const exp of expenses) {
    if (!categoryTotals[exp.category]) {
      const match = EXPENSE_CATEGORIES.find((c) => c.name === exp.category);
      categoryTotals[exp.category] = {
        total: 0,
        count: 0,
        color: match?.color || '#64748b',
      };
    }
    categoryTotals[exp.category].total += exp.amount;
    categoryTotals[exp.category].count += 1;
  }

  const categoryList = Object.entries(categoryTotals)
    .map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      color: data.color,
      percent: totalExpenseAmount > 0 ? (data.total / totalExpenseAmount) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Donut chart path calculations
  let cumulativePercent = 0;
  const segments = categoryList.map((cat) => {
    const start = cumulativePercent;
    cumulativePercent += cat.percent;
    return {
      ...cat,
      startAngle: (start * 360) / 100,
      endAngle: (cumulativePercent * 360) / 100,
    };
  });

  const getCoordinatesForPercent = (percent: number, radius: number = 40) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [50 + radius * x, 50 + radius * y];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Gastos por Categoría
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total gastado: <span className="font-bold text-rose-500">{profile.currency} {totalExpenseAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setChartType('donut')}
            className={`p-1.5 rounded-lg transition ${
              chartType === 'donut'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Gráfico Circular"
          >
            <PieIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType('bars')}
            className={`p-1.5 rounded-lg transition ${
              chartType === 'bars'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Gráfico de Barras"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-xs">
          No hay gastos registrados en este período.
        </div>
      ) : (
        <div className="space-y-4">
          {chartType === 'donut' ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
              {/* Donut SVG */}
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  {segments.map((seg, idx) => {
                    const strokeDasharray = `${(seg.percent * 238.76) / 100} 238.76`;
                    const strokeDashoffset = -((seg.startAngle / 360) * 238.76);
                    const isSelected = selectedCategory === seg.name;

                    return (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth={isSelected ? '17' : '14'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        onClick={() => onSelectCategory(isSelected ? null : seg.name)}
                        className="cursor-pointer transition-all duration-300 hover:opacity-90"
                      />
                    );
                  })}
                </svg>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {selectedCategory ? 'Selección' : 'Categorías'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white max-w-[100px] truncate px-1">
                    {selectedCategory || `${categoryList.length} Rubros`}
                  </span>
                  {selectedCategory && (
                    <span className="text-[11px] font-bold text-rose-500">
                      {categoryList.find((c) => c.name === selectedCategory)?.percent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Legend Summary */}
              <div className="flex-1 w-full space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {categoryList.map((cat) => {
                  const isSelected = selectedCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      onClick={() => onSelectCategory(isSelected ? null : cat.name)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {cat.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {profile.currency} {cat.total.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          ({cat.percent.toFixed(0)}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Bar view */
            <div className="space-y-3 py-1">
              {categoryList.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <div
                    key={cat.name}
                    onClick={() => onSelectCategory(isSelected ? null : cat.name)}
                    className={`p-2.5 rounded-2xl cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {cat.name} ({cat.count} reg.)
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {profile.currency} {cat.total.toLocaleString()}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({cat.percent.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, cat.percent)}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filter notice if active */}
          {selectedCategory && (
            <div className="flex items-center justify-between p-2.5 bg-emerald-100/60 dark:bg-emerald-950/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Filter className="w-3.5 h-3.5" />
                Filtrando transacciones por: <strong>{selectedCategory}</strong>
              </span>
              <button
                onClick={() => onSelectCategory(null)}
                className="text-xs font-bold underline hover:opacity-80"
              >
                Quitar filtro
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
