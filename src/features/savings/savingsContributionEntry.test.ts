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

  test('Ahorro and each goal open the existing contribution form with its destination', () => {
    const savingsView = source('./SavingsView.tsx');
    const savingsModal = source('./SavingsModal.tsx');

    expect(savingsView).toContain('>Aportar dinero</button>');
    expect(savingsView).toContain("onOpenSavingsModal('deposit_from_month', goal.id)");
    expect(savingsView).toContain("onOpenSavingsModal('deposit_from_month', selectedGoal.id)");
    expect(savingsModal).toContain("setDestinationType(initialGoalId ? 'goal' : 'general')");
    expect(savingsModal).toContain("goalId: destinationType === 'goal' ? selectedGoalId : undefined");
    expect(savingsModal).toContain('financeApplication.addSavingsMovement({');
  });
});
