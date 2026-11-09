import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('savings contribution entry points', () => {
  test('the savings category exposes contribution separately from its budget action', () => {
    const categoryDetail = source('../dashboard/CategoryDetailView.tsx');
    const app = source('../../App.tsx');

    expect(categoryDetail).toContain('onOpenSavingsModal: () => void');
    expect(categoryDetail).toContain('onClick={onOpenSavingsModal}');
    expect(categoryDetail).toContain('Aportar dinero</button>');
    expect(categoryDetail).toContain("{budget ? 'Editar monto' : 'Asignar monto'}");
    expect(app).toContain("onOpenSavingsModal={() => handleOpenSavingsModal('deposit_from_month')}");
  });

  test('Inicio opens contributions directly from Mis categorías without selecting the category', () => {
    const dashboard = source('../dashboard/DashboardView.tsx');
    const app = source('../../App.tsx');

    expect(dashboard).toContain('aria-label="Aportar dinero al ahorro"');
    expect(dashboard).toContain('onClick={onOpenSavingsModal}');
    expect(app).toContain("onOpenSavingsModal={() => handleOpenSavingsModal('deposit_from_month')}");
  });

  test('Ahorro and each goal open the existing contribution form with its destination', () => {
    const savingsView = source('./SavingsView.tsx');
    const savingsModal = source('./SavingsModal.tsx');

    expect(savingsView).toContain('>Aportar dinero</button>');
    expect(savingsView).toContain("goals.length > 0 && <button type=\"button\" onClick={() => onOpenSavingsModal('deposit_from_month', undefined, 'goal')}");
    expect(savingsView).toContain("onOpenSavingsModal('deposit_from_month', goal.id)");
    expect(savingsView).toContain("onOpenSavingsModal('deposit_from_month', selectedGoal.id)");
    expect(savingsModal).toContain("setDestinationType(initialGoalId ? 'goal' : initialDestinationType)");
    expect(savingsModal).toContain("goalId: destinationType === 'goal' ? selectedGoalId : undefined");
    expect(savingsModal).toContain('financeApplication.addSavingsMovement({');
  });

  test('goal creation fields align without a nested card and Profile uses the shared content width', () => {
    const savingsView = source('./SavingsView.tsx');
    const profileView = source('../profile/ProfileView.tsx');

    expect(savingsView).toContain('xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]');
    expect(savingsView).toContain('h-14 w-full rounded-xl');
    expect(savingsView).toContain('space-y-4 border-t border-slate-200 pt-4');
    expect(profileView).toContain('app-profile mx-auto w-full max-w-none');
    expect(profileView).not.toContain('max-w-5xl');
  });
});
