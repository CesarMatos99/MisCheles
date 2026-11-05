import 'dart:convert';
import 'dart:io';

import '../lib/domain/local_migration_mapper.dart';

void main() {
  final idVectors =
      jsonDecode(
            File(
              'shared/migration_document_id_vectors.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;
  for (final item in idVectors['cases'] as List<dynamic>) {
    assert(
      localMigrationDocumentId(
            item['collection'] as String,
            item['sourceId'] as String,
          ) ==
          item['documentId'],
    );
  }

  final privacyRecord =
      mapLocalRecord('movement', {
            'id': 'private-fields',
            'kind': 'expense',
            'amountMinor': 500,
            'currency': 'DOP',
            'occurredOn': '2026-10-01',
            'monthKey': '2026-10',
            'categoryName': 'Comida',
            'description': 'Compra',
            'bankReferenceHash': 'a' * 64,
            'paymentInstrumentLastFour': '4321',
            'accessToken': 'secret',
            'refreshToken': 'secret',
            'bankReference': 'raw-ref',
            'cardNumber': '4111111111111111',
            'cvv': '123',
            'ownerUid': 'another-user',
          })
          as LocalMigrationRecord;
  final legacySnapshot =
      privacyRecord.data['legacySnapshot'] as Map<String, Object?>;
  assert(legacySnapshot['bankReferenceHash'] == 'a' * 64);
  assert(legacySnapshot['paymentInstrumentLastFour'] == '4321');
  for (final key in [
    'accessToken',
    'refreshToken',
    'bankReference',
    'cardNumber',
    'cvv',
    'ownerUid',
  ]) {
    assert(!legacySnapshot.containsKey(key));
  }

  final expense = mapLocalRecord('movement', {
    'id': 'expense-1',
    'kind': 'expense',
    'amountMinor': 12550,
    'currency': 'DOP',
    'occurredOn': '2026-10-12',
    'monthKey': '2026-10',
    'categoryName': 'Comida',
    'description': 'Compra',
    'origin': 'manual',
  });
  assert(expense is LocalMigrationRecord);
  expense as LocalMigrationRecord;
  assert(expense.collection == 'transactions');
  assert(expense.data['amountMinor'] == 12550);
  assert(expense.data['paymentMethod'] == 'other');
  final cash =
      mapLocalRecord('movement', {
            'id': 'cash-1',
            'kind': 'expense',
            'amountMinor': 100,
            'currency': 'DOP',
            'occurredOn': '2026-10-12',
            'monthKey': '2026-10',
            'paymentMethod': 'cash',
          })
          as LocalMigrationRecord;
  assert(cash.data['paymentMethod'] == 'cash');
  final oldCard =
      mapLocalRecord('movement', {
            'id': 'old-card-1',
            'kind': 'expense',
            'amountMinor': 100,
            'currency': 'DOP',
            'occurredOn': '2026-10-12',
            'monthKey': '2026-10',
            'paymentMethod': 'Tarjeta de Crédito',
          })
          as LocalMigrationRecord;
  assert(oldCard.data['paymentMethod'] == 'credit_card');
  assert(expense.data['localSourceId'] == null);

  final savings =
      mapLocalRecord('movement', {
            'id': 'save-1',
            'kind': 'savings_contribution',
            'amountMinor': 2500,
            'currency': 'DOP',
            'occurredOn': '2026-10-15',
            'monthKey': '2026-10',
            'categoryName': 'Ahorro',
            'description': 'Aporte',
          })
          as LocalMigrationRecord;
  assert(savings.collection == 'savingsMovements');

  final mirror =
      mapLocalRecord('movement', {
            'id': 'mirror-save-1',
            'kind': 'expense',
            'amountMinor': 2500,
            'currency': 'DOP',
            'occurredOn': '2026-10-15',
            'monthKey': '2026-10',
            'categoryName': 'Aporte al Ahorro',
            'relatedSavingsMovementId': 'save-1',
          })
          as LocalMigrationRecord;
  assert(mirror.collection == 'transactions');
  assert(mirror.data['kind'] == 'expense');
  assert(mirror.data['relatedSavingsMovementId'] == savings.sourceId);

  final goal =
      mapLocalRecord('savingsGoal', {
            'id': 'goal-1',
            'title': 'Viaje',
            'targetAmount': 10000,
            'currentAmount': 1200,
          })
          as LocalMigrationRecord;
  assert(goal.data['targetMinor'] == 1000000);
  assert(goal.data['legacyBalanceMinor'] == 120000);
  assert(goal.data['currency'] == 'DOP');

  final usdGoal =
      mapLocalRecord('savingsGoal', {
            'id': 'goal-usd',
            'title': 'Travel',
            'targetAmount': 10,
          }, preferredCurrency: 'USD')
          as LocalMigrationRecord;
  assert(usdGoal.data['currency'] == 'USD');

  final usdBudget =
      mapLocalRecord('categoryBudget', {
            'monthKey': '2026-10',
            'category': 'Internet',
            'amount': 10,
          }, preferredCurrency: 'USD')
          as LocalMigrationRecord;
  assert(usdBudget.data['currency'] == 'USD');

  final explicitCurrencyGoal =
      mapLocalRecord('savingsGoal', {
            'id': 'goal-eur',
            'title': 'Euro goal',
            'targetAmount': 10,
            'currency': 'EUR',
          }, preferredCurrency: 'USD')
          as LocalMigrationRecord;
  assert(explicitCurrencyGoal.data['currency'] == 'EUR');

  final linkedContribution =
      mapLocalRecord('movement', {
            'id': 'linked-save-1',
            'kind': 'savings_contribution',
            'amountMinor': 50000,
            'currency': 'DOP',
            'occurredOn': '2026-10-15',
            'monthKey': '2026-10',
            'savingsGoalId': 'goal-live',
          })
          as LocalMigrationRecord;
  final linkedWithdrawal =
      mapLocalRecord('movement', {
            'id': 'linked-withdraw-1',
            'kind': 'savings_withdrawal',
            'amountMinor': 20000,
            'currency': 'DOP',
            'occurredOn': '2026-10-16',
            'monthKey': '2026-10',
            'savingsGoalId': 'goal-live',
          })
          as LocalMigrationRecord;
  final snapshotGoal =
      mapLocalRecord('savingsGoal', {
            'id': 'goal-live',
            'title': 'Fondo',
            'targetAmount': 1000,
            'currentAmount': 300,
          })
          as LocalMigrationRecord;
  final balancePreview = reconcileSavingsGoalOpeningBalances([
    linkedContribution,
    linkedWithdrawal,
    snapshotGoal,
  ]);
  final reconciledGoal = balancePreview.records.singleWhere(
    (record) => record.collection == 'savingsGoals',
  );
  assert(reconciledGoal.data['legacyBalanceMinor'] == 0);
  assert(
    balancePreview.records
            .where((record) => record.collection == 'savingsMovements')
            .length ==
        2,
  );

  final inconsistentPreview = reconcileSavingsGoalOpeningBalances([
    linkedContribution,
    mapLocalRecord('savingsGoal', {
          'id': 'goal-live',
          'title': 'Fondo',
          'targetAmount': 1000,
          'currentAmount': 100,
        })
        as LocalMigrationRecord,
  ]);
  assert(inconsistentPreview.records.isEmpty);
  assert(inconsistentPreview.invalid.length == 2);

  final budget =
      mapLocalRecord('categoryBudget', {
            'monthKey': '2026-10',
            'category': 'Internet',
            'amount': 2100,
          })
          as LocalMigrationRecord;
  assert(budget.collection == 'categoryBudgets');
  assert(budget.sourceId == '2026-10:Internet');
  assert(budget.data['assignedMinor'] == 210000);

  final config =
      mapLocalRecord('monthConfiguration', {
            'monthKey': '2026-10',
            'initialIncome': 65000,
            'carryoverFromPrev': 2000,
          })
          as LocalMigrationRecord;
  assert(config.data['initialIncomeMinor'] == 6500000);
  assert(config.data['openingCarryoverMinor'] == 200000);

  final invalid = mapLocalRecord('movement', {
    'id': 'bad-date',
    'kind': 'expense',
    'amountMinor': 500,
    'currency': 'DOP',
    'occurredOn': '2026-02-30',
    'monthKey': '2026-02',
  });
  assert(invalid is InvalidLocalRecord);

  final zeroMovement = mapLocalRecord('movement', {
    'id': 'zero-movement',
    'kind': 'expense',
    'amountMinor': 0,
    'currency': 'DOP',
    'occurredOn': '2026-10-12',
    'monthKey': '2026-10',
  });
  assert(zeroMovement is InvalidLocalRecord);

  final fractionalMinor = mapLocalRecord('movement', {
    'id': 'fractional-minor',
    'kind': 'expense',
    'amountMinor': 1.5,
    'currency': 'DOP',
    'occurredOn': '2026-10-12',
    'monthKey': '2026-10',
  });
  assert(fractionalMinor is InvalidLocalRecord);

  final unsafeMinor = mapLocalRecord('movement', {
    'id': 'unsafe-minor',
    'kind': 'expense',
    'amountMinor': 9007199254740992,
    'currency': 'DOP',
    'occurredOn': '2026-10-12',
    'monthKey': '2026-10',
  });
  assert(unsafeMinor is InvalidLocalRecord);

  final fractionalCent = mapLocalRecord('savingsGoal', {
    'id': 'fractional-cent',
    'title': 'Meta',
    'targetAmount': 1.005,
  });
  assert(fractionalCent is InvalidLocalRecord);

  final invalidBalance = mapLocalRecord('savingsGoal', {
    'id': 'invalid-balance',
    'title': 'Meta',
    'targetAmount': 100,
    'currentAmount': 'not a number',
  });
  assert(invalidBalance is InvalidLocalRecord);

  final selectedRecords = selectLocalMigrationRecords(
    [expense, savings, goal],
    {localMigrationSelectionKey(goal)},
  );
  assert(selectedRecords.length == 1);
  assert(identical(selectedRecords.single, goal));
  assert(localMigrationSelectionKey(goal) == 'savingsGoals:goal-1');

  print('Local migration mapper checks passed.');
}
