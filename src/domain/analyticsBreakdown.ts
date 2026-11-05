import type { Transaction, SavingsMovement } from '../types';
export function focusedBreakdown(type: 'income' | 'savings', transactions: Transaction[], savings: SavingsMovement[]) {
  const totals = new Map<string, { name: string; amount: number }>();
  const add = (id: string, name: string, amount: number) => {
    const previous = totals.get(id);
    totals.set(id, { name, amount: (previous?.amount || 0) + amount });
  };
  if (type === 'income') {
    for (const tx of transactions.filter(item => item.type === 'income')) add('category:' + tx.category, tx.category, tx.amount);
  } else {
    for (const movement of savings.filter(item => item.type === 'deposit_from_month')) {
      add(movement.goalId ? 'goal:' + movement.goalId : 'general',
        movement.goalTitle || (movement.goalId ? 'Meta de ahorro' : 'Ahorro general'), movement.amount);
    }
  }
  const total = [...totals.values()].reduce((sum, row) => sum + row.amount, 0);
  return [...totals].map(([id, row]) => ({ id, ...row, share: total > 0 ? row.amount / total * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
