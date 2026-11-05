import 'dart:convert';
import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite_sqlcipher/sqflite.dart';
import '../domain/financial_movement.dart';
import '../domain/savings_movement_links.dart';

/// SQLCipher store with isolated demo and permanent-local namespaces.
class LocalLedger {
  LocalLedger._();
  static final instance = LocalLedger._();
  static const secureStorage = FlutterSecureStorage();
  static const keyName = 'mischeles_sqlcipher_key_v1';
  Database? _database;
  Future<Database>? _databaseOpening;

  /// Coalesces concurrent first reads so only one SQLCipher open/key creation runs.
  Future<Database> get database async {
    if (_database != null) return _database!;
    if (_databaseOpening != null) return _databaseOpening!;
    final opening = _openDatabase();
    _databaseOpening = opening;
    try {
      final opened = await opening;
      _database = opened;
      return opened;
    } catch (_) {
      _databaseOpening = null;
      rethrow;
    }
  }

  Future<Database> _openDatabase() async {
    var key = await secureStorage.read(key: keyName);
    if (key == null) {
      final random = Random.secure();
      key = List.generate(
        32,
        (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
      ).join();
      await secureStorage.write(key: keyName, value: key);
    }
    final directory = await getApplicationSupportDirectory();
    return openDatabase(
      path.join(directory.path, 'mischeles_local_v1.db'),
      password: key,
      version: 1,
      onCreate: (db, _) async {
        await db.execute(
          'CREATE TABLE records (mode TEXT NOT NULL, entity TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (mode, entity, id))',
        );
        await db.execute(
          'CREATE INDEX records_by_mode_entity ON records(mode, entity, updated_at)',
        );
      },
    );
  }

  void _validateMode(String mode) {
    if (mode != 'demo' && mode != 'local') {
      throw ArgumentError.value(
        mode,
        'mode',
        'Account records are stored in Firestore',
      );
    }
  }

  Future<int> recordCount(String mode) async {
    _validateMode(mode);
    var total = 0;
    for (final entity in _supportedEntities) {
      final rows = await (await database).rawQuery(
        'SELECT COUNT(*) AS count FROM records WHERE mode = ? AND entity = ?',
        [mode, entity],
      );
      total += (rows.first['count'] as int?) ?? 0;
    }
    return total;
  }

  Future<void> clearNamespace(String mode) async {
    _validateMode(mode);
    await (await database).delete(
      'records',
      where: 'mode = ?',
      whereArgs: [mode],
    );
  }

  Future<void> seedDemoIfEmpty() async {
    if ((await movements('demo')).isNotEmpty) return;
    final now = DateTime.now();
    final demoMovements = <FinancialMovement>[];
    final configs = <Map<String, Object?>>[];
    final budgets = <Map<String, Object?>>[];
    const monthlyBudgets = <String, int>{
      'Alimentación': 1200000,
      'Vivienda': 1800000,
      'Transporte': 450000,
      'Servicios': 700000,
      'Salud': 250000,
      'Entretenimiento': 300000,
    };
    for (var offset = 2; offset >= 0; offset--) {
      final period = DateTime(now.year, now.month - offset, 1);
      final monthKey =
          '${period.year}-${period.month.toString().padLeft(2, '0')}';
      final monthIndex = 2 - offset;
      configs.add({
        'id': monthKey,
        'monthKey': monthKey,
        'initialIncomeMinor': 6200000 + monthIndex * 250000,
        'openingCarryoverMinor': monthIndex == 0 ? 85000 : 120000,
        'autoRolloverEnabled': false,
        'isConfigured': true,
      });
      for (final entry in monthlyBudgets.entries) {
        budgets.add({
          'id': '${monthKey}-${entry.key.toLowerCase()}',
          'monthKey': monthKey,
          'categoryId': entry.key.toLowerCase(),
          'categoryName': entry.key,
          'amount': entry.value / 100,
        });
      }
      void add(
        String suffix,
        String kind,
        int day,
        int amountMinor,
        String category,
        String description,
      ) {
        final lastDay = DateTime(period.year, period.month + 1, 0).day;
        final safeDay = day.clamp(1, lastDay);
        final date = DateTime(period.year, period.month, safeDay);
        demoMovements.add(
          FinancialMovement(
            id: 'demo-${monthKey}-${suffix}',
            kind: kind,
            amountMinor: amountMinor,
            currency: 'DOP',
            occurredOn:
                '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
            monthKey: monthKey,
            categoryName: category,
            description: description,
            origin: 'manual',
          ),
        );
      }

      add(
        'income-extra',
        'income',
        3,
        275000,
        'Ingreso adicional',
        'Trabajo independiente',
      );
      add('rent', 'expense', 1, 1800000, 'Vivienda', 'Alquiler');
      add(
        'market-1',
        'expense',
        4,
        540000,
        'Alimentación',
        'Compra del supermercado',
      );
      add(
        'market-2',
        'expense',
        15,
        385000,
        'Alimentación',
        'Compra de la quincena',
      );
      add('transport-1', 'expense', 6, 125000, 'Transporte', 'Combustible');
      add(
        'transport-2',
        'expense',
        18,
        85000,
        'Transporte',
        'Transporte diario',
      );
      add(
        'electricity',
        'expense',
        8,
        225000,
        'Servicios',
        'Energía eléctrica',
      );
      add('internet', 'expense', 10, 185000, 'Servicios', 'Internet');
      add('phone', 'expense', 11, 85000, 'Servicios', 'Teléfono');
      add(
        'health',
        'expense',
        13,
        95000 + monthIndex * 15000,
        'Salud',
        'Farmacia',
      );
      add(
        'meal-out',
        'expense',
        20,
        160000,
        'Alimentación',
        'Comida fuera de casa',
      );
      add(
        'leisure',
        'expense',
        22,
        120000,
        'Entretenimiento',
        'Salida de fin de semana',
      );
      add(
        'savings-deposit',
        'savings_contribution',
        25,
        500000 + monthIndex * 25000,
        'Ahorro',
        'Aporte a Fondo de emergencia',
      );
      if (monthIndex == 2) {
        add(
          'savings-withdrawal',
          'savings_withdrawal',
          27,
          60000,
          'Ahorro',
          'Retiro parcial para imprevisto',
        );
        add('gift', 'expense', 28, 70000, 'Regalo', 'Regalo de cumpleaños');
      }
    }
    for (final item in demoMovements) {
      await saveMovement('demo', item);
    }
    for (final config in configs) {
      await saveRecord(
        'demo',
        'monthConfiguration',
        config['id']! as String,
        config,
      );
    }
    for (final budget in budgets) {
      await saveRecord(
        'demo',
        'categoryBudget',
        budget['id']! as String,
        budget,
      );
    }
    await saveRecord('demo', 'savingsGoal', 'demo-goal-emergency', {
      'id': 'demo-goal-emergency',
      'title': 'Fondo de emergencia',
      'targetAmount': 50000,
      'currentAmount': 15750,
      'targetDate': '${now.year + 1}-06-30',
      'color': '#012677',
    });
    await saveRecord('demo', 'savingsGoal', 'demo-goal-trip', {
      'id': 'demo-goal-trip',
      'title': 'Viaje familiar',
      'targetAmount': 35000,
      'currentAmount': 8500,
      'targetDate': '${now.year + 1}-12-15',
      'color': '#0f766e',
    });
  }

  static const _supportedEntities = {
    'movement',
    'savingsGoal',
    'monthConfiguration',
    'categoryBudget',
  };

  Future<List<Map<String, Object?>>> records(String mode, String entity) async {
    _validateMode(mode);
    if (!_supportedEntities.contains(entity)) {
      throw ArgumentError.value(entity, 'entity', 'Unknown local entity');
    }
    final rows = await (await database).query(
      'records',
      where: 'mode = ? AND entity = ?',
      whereArgs: [mode, entity],
      orderBy: 'updated_at DESC',
    );
    return rows.map((row) {
      final data = Map<String, Object?>.from(
        jsonDecode(row['payload']! as String) as Map,
      );
      data['id'] = row['id'];
      return data;
    }).toList();
  }

  Future<void> saveRecord(
    String mode,
    String entity,
    String id,
    Map<String, Object?> data,
  ) async {
    if (!_supportedEntities.contains(entity)) {
      throw ArgumentError.value(entity, 'entity', 'Unknown local entity');
    }
    if (mode != 'demo' && mode != 'local') {
      throw ArgumentError.value(
        mode,
        'mode',
        'Account records are stored in Firestore',
      );
    }
    await (await database).insert('records', {
      'mode': mode,
      'entity': entity,
      'id': id,
      'payload': jsonEncode(data),
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> deleteRecord(String mode, String entity, String id) async {
    _validateMode(mode);
    if (!_supportedEntities.contains(entity)) {
      throw ArgumentError.value(entity, 'entity', 'Unknown local entity');
    }
    await (await database).delete(
      'records',
      where: 'mode = ? AND entity = ? AND id = ?',
      whereArgs: [mode, entity, id],
    );
  }

  Future<List<FinancialMovement>> movements(String mode) async =>
      (await records(
        mode,
        'movement',
      )).map(FinancialMovement.fromMap).toList(growable: false);

  Future<void> saveMovement(String mode, FinancialMovement movement) =>
      saveRecord(mode, 'movement', movement.id, movement.toMap());

  Future<void> closeSavingsGoal(
    String mode,
    String goalId, {
    List<FinancialMovement> linkedMovements = const [],
    FinancialMovement? releaseMovement,
  }) async {
    _validateMode(mode);
    if (goalId.trim().isEmpty)
      throw ArgumentError.value(goalId, 'goalId', 'Goal ID is required');
    if (linkedMovements.any((movement) => movement.savingsGoalId != goalId)) {
      throw ArgumentError('A movement does not belong to this savings goal.');
    }
    if (releaseMovement != null &&
        (!(releaseMovement.kind == 'savings_withdrawal' ||
                releaseMovement.kind == 'savings_reallocation') ||
            releaseMovement.savingsGoalId != null)) {
      throw ArgumentError(
        'A released balance must be an unlinked savings movement.',
      );
    }
    final db = await database;
    await db.transaction((txn) async {
      for (final movement in linkedMovements) {
        final rows = await txn.query(
          'records',
          columns: ['payload'],
          where: 'mode = ? AND entity = ? AND id = ?',
          whereArgs: [mode, 'movement', movement.id],
          limit: 1,
        );
        if (rows.isEmpty) continue;
        final payload =
            Map<String, Object?>.from(
                jsonDecode(rows.first['payload'] as String) as Map,
              )
              ..remove('savingsGoalId')
              ..['balanceAffecting'] = false;
        await txn.update(
          'records',
          {
            'payload': jsonEncode(payload),
            'updated_at': DateTime.now().toUtc().toIso8601String(),
          },
          where: 'mode = ? AND entity = ? AND id = ?',
          whereArgs: [mode, 'movement', movement.id],
        );
      }
      if (releaseMovement != null) {
        await txn.insert('records', {
          'mode': mode,
          'entity': 'movement',
          'id': releaseMovement.id,
          'payload': jsonEncode(releaseMovement.toMap()),
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await txn.delete(
        'records',
        where: 'mode = ? AND entity = ? AND id = ?',
        whereArgs: [mode, 'savingsGoal', goalId],
      );
    });
  }

  Future<void> discardSavingsGoalAsFalse(
    String mode,
    String goalId,
    List<FinancialMovement> linkedMovements,
  ) async {
    _validateMode(mode);
    if (goalId.trim().isEmpty)
      throw ArgumentError.value(goalId, 'goalId', 'Goal ID is required');
    final goalMovementIds = linkedMovements
        .where((movement) => movement.savingsGoalId == goalId)
        .map((movement) => movement.id)
        .toSet();
    if (linkedMovements.any(
      (movement) =>
          !isSavingsGoalDeletionRecord(movement, goalId, goalMovementIds),
    )) {
      throw ArgumentError('A record does not belong to this savings goal.');
    }
    final db = await database;
    await db.transaction((txn) async {
      for (final movement in linkedMovements) {
        await txn.delete(
          'records',
          where: 'mode = ? AND entity = ? AND id = ?',
          whereArgs: [mode, 'movement', movement.id],
        );
      }
      await txn.delete(
        'records',
        where: 'mode = ? AND entity = ? AND id = ?',
        whereArgs: [mode, 'savingsGoal', goalId],
      );
    });
  }
}
