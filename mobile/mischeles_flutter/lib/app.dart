import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'data/local_ledger.dart';
import 'domain/financial_analytics.dart';
import 'domain/financial_movement.dart';
import 'domain/financial_summary.dart';
import 'domain/currency_preference.dart';
import 'domain/category_localization.dart';
import 'domain/money_parser.dart';
import 'domain/local_migration_mapper.dart';
import 'domain/savings_balance.dart';
import 'domain/savings_movement_links.dart';
import 'firebase/account_auth_service.dart';
import 'firebase/account_repository.dart';
import 'firebase/firebase_bootstrap.dart';
import 'firebase/local_migration_service.dart';
import 'firebase/mail_import_inbox.dart';

const _languageStorageKey = 'mischeles_language_v1';
const _primary = Color(0xFF012677);

String _migrationKey(LocalMigrationRecord item) =>
    item.collection + ':' + item.sourceId;

String _migrationRecordLabel(LocalMigrationRecord item, String language) {
  final data = item.data;
  final kind = data['kind'];
  final category = data['categoryName'] ?? data['category'];
  final description = data['description'] ?? data['title'];
  final occurredOn =
      data['occurredOn'] ?? data['targetDate'] ?? data['monthKey'];
  final amountMinor =
      data['amountMinor'] ?? data['targetMinor'] ?? data['legacyBalanceMinor'];
  final recordType = switch (item.collection) {
    'transactions' => _text(language, 'Movimiento', 'Transaction'),
    'savingsMovements' => _text(
      language,
      'Movimiento de ahorro',
      'Savings movement',
    ),
    'savingsGoals' => _text(language, 'Meta de ahorro', 'Savings goal'),
    'monthConfigurations' => _text(
      language,
      'Configuración mensual',
      'Monthly setup',
    ),
    'categoryBudgets' => _text(language, 'Categoría', 'Category'),
    _ => item.collection,
  };
  final parts = <String>[recordType];
  if (kind is String) parts.add(kind.replaceAll('_', ' '));
  if (description is String && description.trim().isNotEmpty)
    parts.add(description.trim());
  if (category is String && category.trim().isNotEmpty)
    parts.add(category.trim());
  if (amountMinor is int && amountMinor > 0) {
    parts.add(
      'RD\$ ' + NumberFormat('#,##0.00', 'es_DO').format(amountMinor / 100),
    );
  }
  if (occurredOn is String && occurredOn.isNotEmpty) parts.add(occurredOn);
  return parts.join(' · ');
}

class MisChelesApp extends StatefulWidget {
  const MisChelesApp({super.key});
  static Future<void> initialize() async {
    if (FirebaseBootstrap.isConfigured) {
      await FirebaseBootstrap.initialize();
    }
  }

  @override
  State<MisChelesApp> createState() => _MisChelesAppState();
}

class _MisChelesAppState extends State<MisChelesApp> {
  String _language = 'es';
  @override
  void initState() {
    super.initState();
    _loadLanguage();
  }

  Future<void> _loadLanguage() async {
    final prefs = SharedPreferencesAsync();
    final saved = await prefs.getString(_languageStorageKey);
    if (mounted && (saved == 'es' || saved == 'en'))
      setState(() => _language = saved!);
  }

  Future<void> _setLanguage(String value) async {
    setState(() => _language = value);
    await SharedPreferencesAsync().setString(_languageStorageKey, value);
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'MisCheles',
    debugShowCheckedModeBanner: false,
    locale: Locale(_language),
    supportedLocales: const [Locale('es'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: _primary),
      useMaterial3: true,
    ),
    home: ModeChooser(language: _language, onLanguageChange: _setLanguage),
  );
}

String _text(String lang, String es, String en) => lang == 'en' ? en : es;

enum AppMode { demo, local, account }

class ModeChooser extends StatelessWidget {
  const ModeChooser({
    required this.language,
    required this.onLanguageChange,
    super.key,
  });
  final String language;
  final ValueChanged<String> onLanguageChange;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MisCheles'),
        actions: [
          Semantics(
            label: _text(language, 'Idioma', 'Language'),
            child: DropdownButton<String>(
              value: language,
              underline: const SizedBox.shrink(),
              onChanged: (value) {
                if (value != null) onLanguageChange(value);
              },
              items: const [
                DropdownMenuItem(value: 'es', child: Text('Español')),
                DropdownMenuItem(value: 'en', child: Text('English')),
              ],
            ),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 20),
          Text(
            _text(language, 'Hola 👋', 'Hello 👋'),
            style: Theme.of(
              context,
            ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            _text(
              language,
              'Elige cómo quieres usar Mis Cheles.',
              'Choose how you want to use Mis Cheles.',
            ),
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 28),
          _ModeTile(
            icon: Icons.auto_awesome_outlined,
            title: _text(language, 'Probar la app', 'Try the app'),
            subtitle: _text(
              language,
              'Explora con datos ficticios y separados.',
              'Explore with fictional, isolated data.',
            ),
            onTap: () => _open(context, AppMode.demo),
          ),
          ...[
            const SizedBox(height: 12),
            _ModeTile(
              icon: Icons.phone_android,
              title: _text(
                language,
                'Usar sin cuenta',
                'Use without an account',
              ),
              subtitle: _text(
                language,
                'Tus registros se quedan cifrados en este Android.',
                'Your records stay encrypted on this Android device.',
              ),
              onTap: () => _open(context, AppMode.local),
            ),
          ],
          const SizedBox(height: 12),
          _ModeTile(
            icon: Icons.cloud_outlined,
            title: _text(
              language,
              'Iniciar sesión o crear cuenta',
              'Sign in or create an account',
            ),
            subtitle: FirebaseBootstrap.isConfigured
                ? _text(
                    language,
                    'Sincroniza tus datos entre dispositivos.',
                    'Sync your data across devices.',
                  )
                : _text(
                    language,
                    'La sincronización en la nube aún no está configurada.',
                    'Cloud sync is not configured yet.',
                  ),
            onTap: FirebaseBootstrap.isConfigured
                ? () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AccountAccessScreen(
                        language: language,
                        onLanguageChange: onLanguageChange,
                      ),
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 24),
          Text(
            _text(
              language,
              'Puedes migrar tus registros locales a una cuenta más adelante; el teléfono conserva una copia hasta verificarla.',
              'You can move local records to an account later; this device keeps its copy until the cloud copy is verified.',
            ),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  Future<void> _open(BuildContext context, AppMode mode) async {
    if (mode == AppMode.demo) await LocalLedger.instance.seedDemoIfEmpty();
    if (!context.mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LedgerScreen(
          mode: mode,
          language: language,
          onLanguageChange: onLanguageChange,
        ),
      ),
    );
  }
}

class _ModeTile extends StatelessWidget {
  const _ModeTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Card(
    color: Theme.of(context).colorScheme.surface,
    child: ListTile(
      minVerticalPadding: 14,
      leading: Icon(icon, color: _primary),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(subtitle),
      ),
      enabled: onTap != null,
      trailing: onTap == null ? null : const Icon(Icons.chevron_right),
      onTap: onTap,
    ),
  );
}

class AccountAccessScreen extends StatefulWidget {
  const AccountAccessScreen({
    required this.language,
    required this.onLanguageChange,
    super.key,
  });
  final String language;
  final ValueChanged<String> onLanguageChange;
  @override
  State<AccountAccessScreen> createState() => _AccountAccessScreenState();
}

class _AccountAccessScreenState extends State<AccountAccessScreen> {
  String _language = 'es';
  final _displayName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _create = false;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _language = widget.language;
  }

  void _changeLanguage(String value) {
    setState(() => _language = value);
    widget.onLanguageChange(value);
  }

  @override
  void dispose() {
    _displayName.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = _language;
    if (!FirebaseBootstrap.isConfigured)
      return Scaffold(
        appBar: AppBar(
          title: Text(_text(lang, 'Cuenta Mis Cheles', 'Mis Cheles account')),
          actions: [
            _languageSelector(lang, _changeLanguage),
            const SizedBox(width: 8),
          ],
        ),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _text(
              lang,
              'La conexión de cuentas todavía no está habilitada. Falta configurar el proyecto Firebase de Mis Cheles. El modo local y la demostración siguen disponibles.',
              'Account access is not enabled yet. The Mis Cheles Firebase project must be configured. Local mode and the demo are still available.',
            ),
          ),
        ),
      );
    return Scaffold(
      appBar: AppBar(
        title: Text(_text(lang, 'Cuenta Mis Cheles', 'Mis Cheles account')),
        actions: [
          _languageSelector(lang, _changeLanguage),
          const SizedBox(width: 8),
        ],
      ),
      body: StreamBuilder<User?>(
        stream: AccountAuthService(FirebaseAuth.instance).changes,
        builder: (context, snapshot) {
          final user = snapshot.data;
          if (user != null)
            return LedgerScreen(
              mode: AppMode.account,
              language: lang,
              onLanguageChange: widget.onLanguageChange,
              user: user,
            );
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                _text(
                  lang,
                  _create ? 'Crear cuenta' : 'Iniciar sesión',
                  _create ? 'Create account' : 'Sign in',
                ),
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 20),
              if (_create) ...[
                TextField(
                  controller: _displayName,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  decoration: InputDecoration(
                    labelText: _text(lang, 'Nombre', 'Name'),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: InputDecoration(
                  labelText: _text(lang, 'Correo electrónico', 'Email address'),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                autofillHints: [
                  _create ? AutofillHints.newPassword : AutofillHints.password,
                ],
                decoration: InputDecoration(
                  labelText: _text(lang, 'Contraseña', 'Password'),
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(
                  _text(
                    lang,
                    _create ? 'Crear cuenta' : 'Entrar',
                    _create ? 'Create account' : 'Sign in',
                  ),
                ),
              ),
              if (!_create) ...[
                OutlinedButton.icon(
                  onPressed: _busy ? null : _signInGoogle,
                  icon: const Icon(Icons.account_circle_outlined),
                  label: Text(
                    _text(lang, 'Continuar con Google', 'Continue with Google'),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              TextButton(
                onPressed: () => setState(() => _create = !_create),
                child: Text(
                  _text(
                    lang,
                    _create ? 'Ya tengo cuenta' : 'Crear una cuenta',
                    _create ? 'I already have an account' : 'Create an account',
                  ),
                ),
              ),
              TextButton(
                onPressed: _resetPassword,
                child: Text(
                  _text(lang, 'Olvidé mi contraseña', 'Forgot password'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _submit() async {
    if (_create && _displayName.text.trim().isEmpty) {
      _message(_text(_language, 'Escribe tu nombre.', 'Enter your name.'));
      return;
    }
    if (_create && _password.text.length < 8) {
      _message(
        _text(
          _language,
          'La contraseña debe tener al menos 8 caracteres.',
          'Password must be at least 8 characters.',
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final auth = AccountAuthService(FirebaseAuth.instance);
      if (_create) {
        await auth.createAccount(
          _displayName.text,
          _email.text,
          _password.text,
        );
        if (mounted) {
          _message(
            _text(
              _language,
              'Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.',
              'Account created. Check your email and verify it before signing in.',
            ),
          );
        }
      } else {
        await auth.signIn(
          _email.text,
          _password.text,
          preferredLanguage: _language,
        );
      }
    } on FirebaseAuthException catch (error) {
      if (mounted)
        _message(
          error.code == 'email-not-verified'
              ? _text(
                  widget.language,
                  'Verifica tu correo antes de iniciar sesión. Te enviamos otro enlace.',
                  'Verify your email before signing in. We sent another link.',
                )
              : error.message ?? error.code,
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signInGoogle() async {
    setState(() => _busy = true);
    try {
      await AccountAuthService(
        FirebaseAuth.instance,
      ).signInWithGoogle(preferredLanguage: widget.language);
    } catch (_) {
      if (mounted) {
        _message(
          _text(
            _language,
            'No se pudo iniciar sesión con Google. Revisa la configuración de esta app e inténtalo de nuevo.',
            'Google sign-in failed. Check this app configuration and try again.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resetPassword() async {
    try {
      await AccountAuthService(
        FirebaseAuth.instance,
      ).sendPasswordReset(_email.text);
      if (mounted)
        _message(
          _text(
            widget.language,
            'Revisa tu correo para restablecer la contraseña.',
            'Check your email for a password reset link.',
          ),
        );
    } on FirebaseAuthException catch (error) {
      if (mounted) _message(error.message ?? error.code);
    }
  }

  void _message(String message) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(message)));
}

class LedgerScreen extends StatefulWidget {
  const LedgerScreen({
    required this.mode,
    required this.language,
    required this.onLanguageChange,
    this.user,
    super.key,
  });
  final AppMode mode;
  final String language;
  final ValueChanged<String> onLanguageChange;
  final User? user;
  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  List<FinancialMovement> _items = [];
  List<Map<String, Object?>> _goals = [];
  List<Map<String, Object?>> _budgets = [];
  List<Map<String, Object?>> _monthConfigurations = [];
  int _selectedTab = 0;
  int _statisticsSection = 0;
  int _evolutionMonthCount = 6;
  late String _compareFirstMonthKey;
  late String _compareSecondMonthKey;
  bool _loading = true;
  int _localRecordCount = 0;
  int _initialIncomeMinor = 0;
  int _carryoverMinor = 0;
  Map<String, Object?>? _monthConfiguration;
  late String _language;
  String _currencyCode = 'DOP';
  String _localCurrencyCode = 'DOP';
  StreamSubscription<List<Map<String, dynamic>>>? _accountSubscription;
  StreamSubscription<List<Map<String, dynamic>>>? _monthConfigSubscription;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>?
  _accountSettingsSubscription;
  StreamSubscription<List<Map<String, dynamic>>>? _goalsSubscription;
  StreamSubscription<List<Map<String, dynamic>>>? _budgetsSubscription;
  String get _modeKey => widget.mode == AppMode.demo ? 'demo' : 'local';
  @override
  void initState() {
    super.initState();
    _language = widget.language;
    _loadCurrencyPreference();
    final now = DateTime.now();
    _compareFirstMonthKey = DateFormat('yyyy-MM').format(now);
    _compareSecondMonthKey = DateFormat(
      'yyyy-MM',
    ).format(DateTime(now.year, now.month - 1));
    _load();
    if (widget.mode == AppMode.account) {
      _watchAccount();
      _watchMonthConfiguration();
      _watchAccountSettings();
      _watchAccountCollection('savingsGoals', (records) => _goals = records);
      _watchAccountCollection(
        'categoryBudgets',
        (records) => _budgets = records,
      );
    }
  }

  void _watchAccountCollection(
    String collection,
    void Function(List<Map<String, Object?>>) onRecords,
  ) {
    final user = widget.user;
    if (user == null) return;
    final subscription = AccountRepository(FirebaseFirestore.instance)
        .watchRecords(user.uid, collection)
        .listen((records) {
          if (mounted) {
            setState(
              () => onRecords(
                records.map((item) => Map<String, Object?>.from(item)).toList(),
              ),
            );
          }
        });
    if (collection == 'savingsGoals') {
      _goalsSubscription = subscription;
    } else {
      _budgetsSubscription = subscription;
    }
  }

  Future<void> _loadCurrencyPreference() async {
    final preferences = SharedPreferencesAsync();
    final legacy = await preferences.getString(legacyCurrencyPreferenceKey);
    final localStored = await preferences.getString(localCurrencyPreferenceKey);
    final localCurrency = resolveCurrencyPreference(localStored, legacy);
    if (localStored == null && isSupportedCurrencyCode(legacy)) {
      await preferences.setString(localCurrencyPreferenceKey, localCurrency);
    }
    final accountKey = widget.user == null
        ? null
        : accountCurrencyPreferenceKey(widget.user!.uid);
    final accountStored = accountKey == null
        ? null
        : await preferences.getString(accountKey);
    final selectedCurrency = widget.mode == AppMode.account
        ? resolveCurrencyPreference(accountStored, legacy)
        : localCurrency;
    if (mounted) {
      setState(() {
        _localCurrencyCode = localCurrency;
        _currencyCode = selectedCurrency;
      });
    }
  }

  void _watchAccountSettings() {
    final user = widget.user;
    if (user == null) return;
    _accountSettingsSubscription = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots()
        .listen((snapshot) {
          final settings = snapshot.data();
          final value = settings?['language'];
          final currency = settings?['preferredCurrency'];
          if (mounted &&
              isSupportedCurrencyCode(currency) &&
              currency != _currencyCode) {
            final code = currency as String;
            setState(() => _currencyCode = code);
            unawaited(
              SharedPreferencesAsync().setString(
                accountCurrencyPreferenceKey(user.uid),
                code,
              ),
            );
          }
          if ((value == 'es' || value == 'en') &&
              value != _language &&
              mounted) {
            final language = value as String;
            setState(() => _language = language);
            widget.onLanguageChange(language);
          }
        });
  }

  Future<void> _selectLanguage(String value) async {
    setState(() => _language = value);
    widget.onLanguageChange(value);
    if (widget.mode != AppMode.account) return;
    try {
      await AccountAuthService(
        FirebaseAuth.instance,
      ).saveLanguagePreference(value);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _text(
              value,
              'El idioma quedó guardado en este dispositivo, pero no se pudo sincronizar con la cuenta.',
              'The language was saved on this device, but could not be synced to the account.',
            ),
          ),
        ),
      );
    }
  }

  Future<void> _selectCurrency(String value) async {
    if (!isSupportedCurrencyCode(value)) return;
    setState(() {
      _currencyCode = value;
      if (widget.mode != AppMode.account) _localCurrencyCode = value;
    });
    final preferences = SharedPreferencesAsync();
    if (widget.mode == AppMode.account && widget.user != null) {
      await preferences.setString(
        accountCurrencyPreferenceKey(widget.user!.uid),
        value,
      );
    } else {
      await preferences.setString(localCurrencyPreferenceKey, value);
    }
    if (widget.mode != AppMode.account) return;
    try {
      await AccountAuthService(
        FirebaseAuth.instance,
      ).saveCurrencyPreference(value);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _text(
              _language,
              'La moneda quedó guardada en este dispositivo, pero no se pudo sincronizar con la cuenta.',
              'The currency was saved on this device, but could not be synced to the account.',
            ),
          ),
        ),
      );
    }
  }

  void _watchAccount() {
    final user = widget.user;
    if (user == null) return;
    _accountSubscription = AccountRepository(FirebaseFirestore.instance)
        .watchMovements(user.uid)
        .listen(
          (records) {
            final movements = records
                .map(
                  (data) => FinancialMovement.fromMap(
                    Map<String, Object?>.from(data),
                  ),
                )
                .toList();
            if (mounted) setState(() => _items = movements);
          },
          onError: (Object error) {
            if (mounted)
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    _text(
                      _language,
                      'No se pudieron actualizar los datos de la cuenta.',
                      'Could not refresh account data.',
                    ),
                  ),
                ),
              );
          },
        );
  }

  void _watchMonthConfiguration() {
    final user = widget.user;
    if (user == null) return;
    _monthConfigSubscription = AccountRepository(FirebaseFirestore.instance)
        .watchRecords(user.uid, 'monthConfigurations')
        .listen((records) {
          final monthKey = DateFormat('yyyy-MM').format(DateTime.now());
          Map<String, Object?>? selected;
          for (final record in records) {
            if (record['monthKey'] == monthKey) {
              selected = Map<String, Object?>.from(record);
              break;
            }
          }
          if (mounted) {
            setState(() {
              _monthConfigurations = records
                  .map((record) => Map<String, Object?>.from(record))
                  .toList();
              _monthConfiguration = selected;
              _initialIncomeMinor = _readMinor(
                selected,
                'initialIncomeMinor',
                'initialIncome',
              );
              _carryoverMinor = _readMinor(
                selected,
                'openingCarryoverMinor',
                'carryoverFromPrev',
              );
            });
          }
        });
  }

  @override
  void dispose() {
    _accountSubscription?.cancel();
    _monthConfigSubscription?.cancel();
    _accountSettingsSubscription?.cancel();
    _goalsSubscription?.cancel();
    _budgetsSubscription?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final monthKey = DateFormat('yyyy-MM').format(DateTime.now());
      List<Map<String, Object?>> configurations;
      List<Map<String, Object?>> goals;
      List<Map<String, Object?>> budgets;
      if (widget.mode == AppMode.account && widget.user != null) {
        final repository = AccountRepository(FirebaseFirestore.instance);
        final docs = await repository.listMovements(widget.user!.uid);
        _items = docs
            .map(
              (data) =>
                  FinancialMovement.fromMap(Map<String, Object?>.from(data)),
            )
            .toList();
        final remoteConfigs = await repository.listRecords(
          widget.user!.uid,
          'monthConfigurations',
        );
        configurations = remoteConfigs
            .map((data) => Map<String, Object?>.from(data))
            .toList();
        final remoteGoals = await repository.listRecords(
          widget.user!.uid,
          'savingsGoals',
        );
        final remoteBudgets = await repository.listRecords(
          widget.user!.uid,
          'categoryBudgets',
        );
        goals = remoteGoals
            .map((item) => Map<String, Object?>.from(item))
            .toList();
        budgets = remoteBudgets
            .map((item) => Map<String, Object?>.from(item))
            .toList();
        _localRecordCount = await LocalLedger.instance.recordCount('local');
      } else {
        _items = await LocalLedger.instance.movements(_modeKey);
        configurations = await LocalLedger.instance.records(
          _modeKey,
          'monthConfiguration',
        );
        goals = await LocalLedger.instance.records(_modeKey, 'savingsGoal');
        budgets = await LocalLedger.instance.records(
          _modeKey,
          'categoryBudget',
        );
      }
      Map<String, Object?>? selected;
      for (final config in configurations) {
        if (config['monthKey'] == monthKey) {
          selected = config;
          break;
        }
      }
      _goals = goals;
      _budgets = budgets;
      _monthConfigurations = configurations;
      _monthConfiguration = selected;
      _initialIncomeMinor = _readMinor(
        selected,
        'initialIncomeMinor',
        'initialIncome',
      );
      _carryoverMinor = _readMinor(
        selected,
        'openingCarryoverMinor',
        'carryoverFromPrev',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _readMinor(
    Map<String, Object?>? record,
    String minorKey,
    String majorKey,
  ) {
    if (record == null) return 0;
    final minor = record[minorKey];
    if (minor is num && minor.isFinite)
      return minor.round().clamp(0, 0x7fffffffffffffff).toInt();
    final major = record[majorKey];
    if (major is num && major.isFinite)
      return (major * 100).round().clamp(0, 0x7fffffffffffffff).toInt();
    if (major is String) {
      final parsed = num.tryParse(major);
      if (parsed != null && parsed.isFinite)
        return (parsed * 100).round().clamp(0, 0x7fffffffffffffff).toInt();
    }
    return 0;
  }

  Future<void> _configureMonth() async {
    final now = DateTime.now();
    final monthKey = DateFormat('yyyy-MM').format(now);
    final initialIncome = TextEditingController(
      text: (_initialIncomeMinor / 100).toStringAsFixed(2),
    );
    final carryover = TextEditingController(
      text: (_carryoverMinor / 100).toStringAsFixed(2),
    );
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_text(_language, 'Configurar mes', 'Set up month')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: initialIncome,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: _text(
                  _language,
                  'Ingreso del período',
                  'Period income',
                ),
              ),
            ),
            TextField(
              controller: carryover,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: _text(_language, 'Dinero arrastrado', 'Carryover'),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Guardar', 'Save')),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      initialIncome.dispose();
      carryover.dispose();
      return;
    }
    final incomeMinor = parseMoneyMinor(initialIncome.text);
    final carryoverMinor = parseMoneyMinor(carryover.text);
    initialIncome.dispose();
    carryover.dispose();
    if (incomeMinor == null || carryoverMinor == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _text(
              _language,
              'Escribe montos válidos, iguales o mayores que cero.',
              'Enter valid amounts equal to or greater than zero.',
            ),
          ),
        ),
      );
      return;
    }
    final data = <String, Object?>{
      'id': monthKey,
      'monthKey': monthKey,
      if (_monthConfiguration?['_cloudRevision'] is String)
        '_cloudRevision': _monthConfiguration?['_cloudRevision'],
      'createdAt':
          _monthConfiguration?['createdAt'] ??
          DateTime.now().toUtc().toIso8601String(),
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
      'initialIncomeMinor': incomeMinor,
      'openingCarryoverMinor': carryoverMinor,
      'autoRolloverEnabled':
          _monthConfiguration?['autoRolloverEnabled'] == true,
      'isConfigured': true,
    };
    try {
      if (widget.mode == AppMode.account && widget.user != null) {
        await AccountRepository(FirebaseFirestore.instance).saveRecord(
          widget.user!.uid,
          'monthConfigurations',
          {...data, 'ownerUid': widget.user!.uid, 'schemaVersion': 1},
        );
      } else {
        await LocalLedger.instance.saveRecord(
          _modeKey,
          'monthConfiguration',
          monthKey,
          data,
        );
      }
      await _load();
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(
                _language,
                'No se pudo guardar la configuración del mes.',
                'Could not save this month setup.',
              ),
            ),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final monthKey = DateFormat('yyyy-MM').format(now);
    final summary = FinancialSummary.calculate(
      monthKey: monthKey,
      initialIncomeMinor: _initialIncomeMinor,
      carryoverMinor: _carryoverMinor,
      movements: _items,
    );
    final currency = NumberFormat.currency(
      locale: _language == 'en' ? 'en_US' : 'es_DO',
      name: _currencyCode,
      symbol: currencySymbolForCode(_currencyCode),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.mode == AppMode.demo
              ? _text(_language, 'Modo de prueba', 'Demo mode')
              : widget.mode == AppMode.local
              ? _text(_language, 'Modo local', 'Local mode')
              : 'MisCheles',
        ),
        actions: [
          _languageSelector(_language, _selectLanguage),
          if (widget.mode == AppMode.demo)
            IconButton(
              tooltip: _text(
                _language,
                'Reiniciar datos de prueba',
                'Reset demo data',
              ),
              onPressed: _resetDemo,
              icon: const Icon(Icons.restart_alt),
            ),
          if (widget.mode == AppMode.account)
            IconButton(
              tooltip: _text(_language, 'Cerrar sesión', 'Sign out'),
              onPressed: () =>
                  AccountAuthService(FirebaseAuth.instance).signOut(),
              icon: const Icon(Icons.logout),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : IndexedStack(
              index: _selectedTab,
              children: [
                _homeTab(currency, summary, monthKey),
                _registerTab(currency),
                _savingsTab(currency),
                _statisticsTab(currency, monthKey),
                _profileTab(),
              ],
            ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTab,
        onDestinationSelected: (index) => setState(() => _selectedTab = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.pie_chart_outline),
            selectedIcon: const Icon(Icons.pie_chart),
            label: _text(_language, 'Inicio', 'Home'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long),
            label: _text(_language, 'Registro', 'Records'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.savings_outlined),
            selectedIcon: const Icon(Icons.savings),
            label: _text(_language, 'Ahorro', 'Savings'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.insights_outlined),
            selectedIcon: const Icon(Icons.insights),
            label: _text(_language, 'Estadísticas', 'Statistics'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person),
            label: _text(_language, 'Perfil', 'Profile'),
          ),
        ],
      ),
      floatingActionButton: _selectedTab <= 1
          ? FloatingActionButton(
              onPressed: () => _addMovement(),
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  void _showMessage(String spanish, String english) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(_text(_language, spanish, english))));
  }

  Widget _homeTab(
    NumberFormat currency,
    FinancialSummary summary,
    String monthKey,
  ) {
    final budgets = _budgets
        .where((item) => item['monthKey'] == monthKey)
        .toList();
    final expenses = _items.where(
      (item) =>
          item.monthKey == monthKey &&
          (item.kind == 'expense' || item.kind == 'savings_direct_expense'),
    );
    int spentFor(String name) => expenses
        .where((item) => item.categoryName == name)
        .fold<int>(0, (sum, item) => sum + item.amountMinor);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (widget.mode == AppMode.account && widget.user != null)
            MailImportInbox(uid: widget.user!.uid, language: _language),
          if (widget.mode == AppMode.account && _localRecordCount > 0)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _text(
                        _language,
                        'Datos locales disponibles',
                        'Local data available',
                      ),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _text(_language, 'Hay ', 'There are ') +
                          _localRecordCount.toString() +
                          _text(
                            _language,
                            ' registros en este Android. La copia local se conserva.',
                            ' local records on this Android. The device copy is kept.',
                          ),
                    ),
                    TextButton(
                      onPressed: _migrateLocalData,
                      child: Text(
                        _text(
                          _language,
                          'Revisar y migrar',
                          'Review and migrate',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (widget.mode == AppMode.demo)
            Text(
              _text(
                _language,
                'Datos de prueba separados de tus registros.',
                'Demo data is separate from your records.',
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _text(_language, 'Así va tu dinero', 'Your money this month'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              IconButton(
                tooltip: _text(_language, 'Configurar mes', 'Set up month'),
                onPressed: _configureMonth,
                icon: const Icon(Icons.tune),
              ),
            ],
          ),
          Text(
            _text(_language, 'Dinero disponible', 'Available money'),
            style: Theme.of(context).textTheme.labelLarge,
          ),
          Text(
            currency.format(summary.availableMinor / 100),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: _primary,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metric(
                  _text(_language, 'Ingreso del mes', 'Month income'),
                  currency.format(summary.totalIncomeMinor / 100),
                ),
              ),
              Expanded(
                child: _metric(
                  _text(_language, 'Gastado', 'Spent'),
                  currency.format(summary.totalExpensesMinor / 100),
                ),
              ),
              Expanded(
                child: _metric(
                  _text(_language, 'Ahorro acumulado', 'Total savings'),
                  currency.format(
                    (_goals.fold<int>(
                              0,
                              (sum, goal) => sum + _goalBalance(goal),
                            ) +
                            _generalSavingsBalance) /
                        100,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _text(_language, 'Categorías', 'Categories'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              TextButton.icon(
                onPressed: () => _editBudget(),
                icon: const Icon(Icons.edit_outlined),
                label: Text(
                  _text(_language, 'Editar categorías', 'Edit categories'),
                ),
              ),
            ],
          ),
          if (budgets.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                _text(
                  _language,
                  'Aún no asignas montos a categorías.',
                  'No category amounts set yet.',
                ),
              ),
            ),
          ...budgets.map((budget) {
            final name = budget['categoryName'] as String? ?? '';
            final assigned = _minor(budget, 'assignedMinor', 'amount');
            final spent = spentFor(name);
            final ratio = assigned > 0
                ? (spent / assigned).clamp(0.0, 1.0).toDouble()
                : 0.0;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(localizedCategoryLabel(_language, name)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    currency.format(spent / 100) +
                        ' ' +
                        _text(_language, 'gastados de', 'spent of') +
                        ' ' +
                        currency.format(assigned / 100),
                  ),
                  const SizedBox(height: 5),
                  LinearProgressIndicator(value: ratio),
                ],
              ),
              onTap: () => _editBudget(budget),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    currency.format((assigned - spent) / 100),
                    style: TextStyle(
                      color: spent > assigned
                          ? Colors.red
                          : Colors.green.shade700,
                    ),
                  ),
                  IconButton(
                    tooltip: _text(
                      _language,
                      'Eliminar categoría',
                      'Delete category',
                    ),
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => _deleteBudget(budget),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _metric(String label, String value) => Padding(
    padding: const EdgeInsets.only(right: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );

  Widget _registerTab(NumberFormat currency) => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          _text(_language, 'Movimientos', 'Transactions'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        if (_items.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Text(
              _text(
                _language,
                'Aún no hay movimientos.',
                'No transactions yet.',
              ),
            ),
          ),
        ..._items.map((item) {
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              item.kind == 'income' || item.kind == 'savings_withdrawal'
                  ? Icons.arrow_downward
                  : Icons.arrow_upward,
            ),
            title: Text(localizedCategoryLabel(_language, item.categoryName)),
            subtitle: Text(item.description + ' · ' + item.occurredOn),
            onTap: () => _addMovement(existing: item),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(currency.format(item.amountMinor / 100)),
                PopupMenuButton<String>(
                  tooltip: _text(
                    _language,
                    'Acciones del movimiento',
                    'Transaction actions',
                  ),
                  onSelected: (action) {
                    if (action == 'edit') _addMovement(existing: item);
                    if (action == 'delete') _deleteMovement(item);
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'edit',
                      child: Text(_text(_language, 'Editar', 'Edit')),
                    ),
                    PopupMenuItem(
                      value: 'delete',
                      child: Text(_text(_language, 'Eliminar', 'Delete')),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    ),
  );

  Future<void> _editBudget([Map<String, Object?>? existing]) async {
    final name = TextEditingController(
      text: existing?['categoryName'] as String? ?? '',
    );
    final assigned = TextEditingController(
      text: existing == null
          ? ''
          : (_minor(existing, 'assignedMinor', 'amount') / 100).toStringAsFixed(
              2,
            ),
    );
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          _text(
            _language,
            existing == null ? 'Nueva categoría' : 'Editar categoría',
            existing == null ? 'New category' : 'Edit category',
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: _text(_language, 'Categoría', 'Category'),
              ),
            ),
            TextField(
              controller: assigned,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: _text(_language, 'Monto mensual', 'Monthly amount'),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Guardar', 'Save')),
          ),
        ],
      ),
    );
    final categoryName = name.text.trim();
    final amountMinor = parseMoneyMinor(assigned.text);
    name.dispose();
    assigned.dispose();
    if (saved != true) return;
    if (categoryName.isEmpty || amountMinor == null || amountMinor < 0) {
      _showMessage(
        'Escribe una categoría y un monto válido.',
        'Enter a category and a valid amount.',
      );
      return;
    }
    final monthKey = DateFormat('yyyy-MM').format(DateTime.now());
    final now = DateTime.now().toUtc().toIso8601String();
    final id =
        existing?['id'] as String? ??
        'budget-' +
            monthKey +
            '-' +
            DateTime.now().microsecondsSinceEpoch.toString();
    final categoryId = categoryName.toLowerCase().replaceAll(
      RegExp(r'[^a-z0-9]+'),
      '-',
    );
    final record = <String, Object?>{
      'id': id,
      'monthKey': monthKey,
      'categoryId': categoryId,
      'categoryName': categoryName,
      'assignedMinor': amountMinor,
      'currency': existing?['currency'] ?? _currencyCode,
      'createdAt': existing?['createdAt'] ?? now,
      if (existing?['_cloudRevision'] is String)
        '_cloudRevision': existing?['_cloudRevision'],
      'updatedAt': now,
      if (widget.user != null) 'ownerUid': widget.user!.uid,
      if (widget.user != null) 'schemaVersion': 1,
    };
    try {
      if (widget.mode == AppMode.account && widget.user != null) {
        await AccountRepository(FirebaseFirestore.instance).saveRecord(
          widget.user!.uid,
          'categoryBudgets',
          Map<String, dynamic>.from(record),
        );
      } else {
        await LocalLedger.instance.saveRecord(
          _modeKey,
          'categoryBudget',
          id,
          record,
        );
      }
      await _load();
    } catch (_) {
      _showMessage(
        'No se pudo guardar la categoría.',
        'Could not save the category.',
      );
    }
  }

  Future<void> _deleteBudget(Map<String, Object?> budget) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_text(_language, 'Eliminar categoría', 'Delete category')),
        content: Text(
          _text(
            _language,
            'Solo se eliminará el monto asignado. Los movimientos existentes se conservarán.',
            'Only the assigned budget will be removed. Existing transactions will be kept.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Eliminar', 'Delete')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final id = budget['id'] as String?;
    if (id == null || id.isEmpty) return;
    try {
      if (widget.mode == AppMode.account && widget.user != null) {
        await AccountRepository(FirebaseFirestore.instance).deleteRecord(
          widget.user!.uid,
          'categoryBudgets',
          id,
          expectedRevision: budget['_cloudRevision'] as String?,
        );
      } else {
        await LocalLedger.instance.deleteRecord(_modeKey, 'categoryBudget', id);
      }
      await _load();
    } catch (error) {
      final conflict = error is AccountSyncConflictException;
      _showMessage(
        conflict
            ? 'La categoría cambió en otro dispositivo. Actualiza y vuelve a intentarlo.'
            : 'No se pudo eliminar el monto asignado.',
        conflict
            ? 'This category changed on another device. Refresh and try again.'
            : 'Could not delete the assigned budget.',
      );
    }
  }

  int _minor(Map<String, Object?> record, String minorKey, String majorKey) {
    final minor = record[minorKey];
    if (minor is num) return minor.toInt();
    final major = record[majorKey];
    if (major is num) return (major * 100).round();
    if (major is String) return ((num.tryParse(major) ?? 0) * 100).round();
    return 0;
  }

  int get _generalSavingsBalance => calculateGeneralSavingsBalanceMinor(_items);

  Widget _generalSavingsCard(NumberFormat currency) {
    final history =
        _items
            .where(
              (item) =>
                  item.savingsGoalId == null &&
                  item.kind.startsWith('savings_'),
            )
            .toList()
          ..sort((a, b) => b.occurredOn.compareTo(a.occurredOn));
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _text(_language, 'Ahorro general', 'General savings'),
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              currency.format(_generalSavingsBalance / 100),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            Wrap(
              spacing: 8,
              children: [
                TextButton.icon(
                  onPressed: () => _addSavings(null),
                  icon: const Icon(Icons.add),
                  label: Text(_text(_language, 'Aportar', 'Add')),
                ),
                TextButton.icon(
                  onPressed: () => _addSavings(null, withdrawal: true),
                  icon: const Icon(Icons.south_west),
                  label: Text(_text(_language, 'Retirar', 'Withdraw')),
                ),
              ],
            ),
            if (history.isNotEmpty) ...[
              const Divider(),
              Text(
                _text(_language, 'Movimientos recientes', 'Recent movements'),
                style: Theme.of(context).textTheme.labelLarge,
              ),
              ...history
                  .take(3)
                  .map(
                    (item) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(item.description),
                      subtitle: Text(
                        item.balanceAffecting
                            ? item.occurredOn
                            : item.occurredOn +
                                  ' · ' +
                                  _text(
                                    _language,
                                    'Historial de meta cerrada; no afecta el saldo',
                                    'Closed-goal history; does not affect balance',
                                  ),
                      ),
                      trailing: Text(
                        ((item.kind == 'savings_contribution' ||
                                    item.kind == 'savings_reallocation')
                                ? '+'
                                : '−') +
                            currency.format(item.amountMinor / 100),
                      ),
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }

  int _goalBalance(Map<String, Object?> goal) => calculateGoalBalanceMinor(
    goalId: goal['id'] as String? ?? '',
    openingBalanceMinor: _minor(goal, 'legacyBalanceMinor', 'currentAmount'),
    movements: _items,
  );

  Widget _savingsTab(NumberFormat currency) => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              _text(_language, 'Metas de ahorro', 'Savings goals'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            IconButton(
              onPressed: _createGoal,
              icon: const Icon(Icons.add_circle_outline),
              tooltip: _text(_language, 'Crear meta', 'Create goal'),
            ),
          ],
        ),
        _generalSavingsCard(currency),
        if (_goals.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Text(
              _text(
                _language,
                'Todavía no tienes metas. Crea una para organizar tus ahorros.',
                'You do not have any goals yet. Create one to organize your savings.',
              ),
            ),
          ),
        ..._goals.map((goal) {
          final target = _minor(goal, 'targetMinor', 'targetAmount');
          final balance = _goalBalance(goal);
          final ratio = target > 0
              ? (balance / target).clamp(0.0, 1.0).toDouble()
              : 0.0;
          final id = goal['id'] as String? ?? '';
          final history =
              _items.where((item) => item.savingsGoalId == id).toList()
                ..sort((a, b) => b.occurredOn.compareTo(a.occurredOn));
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          goal['title'] as String? ??
                              _text(_language, 'Meta', 'Goal'),
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      PopupMenuButton<String>(
                        tooltip: _text(
                          _language,
                          'Opciones de la meta',
                          'Goal options',
                        ),
                        onSelected: (action) {
                          if (action == 'edit') _editGoal(goal);
                          if (action == 'delete') _deleteGoal(goal);
                        },
                        itemBuilder: (context) => [
                          PopupMenuItem(
                            value: 'edit',
                            child: Text(_text(_language, 'Editar', 'Edit')),
                          ),
                          PopupMenuItem(
                            value: 'delete',
                            child: Text(
                              _text(_language, 'Eliminar meta', 'Delete goal'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    currency.format(balance / 100) +
                        ' ' +
                        _text(_language, 'de', 'of') +
                        ' ' +
                        currency.format(target / 100),
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(value: ratio),
                  Wrap(
                    spacing: 8,
                    children: [
                      TextButton.icon(
                        onPressed: () => _addSavings(goal),
                        icon: const Icon(Icons.add),
                        label: Text(_text(_language, 'Aportar', 'Add')),
                      ),
                      TextButton.icon(
                        onPressed: () => _addSavings(goal, withdrawal: true),
                        icon: const Icon(Icons.south_west),
                        label: Text(_text(_language, 'Retirar', 'Withdraw')),
                      ),
                    ],
                  ),
                  if (history.isNotEmpty) ...[
                    const Divider(),
                    Text(
                      _text(
                        _language,
                        'Movimientos de esta meta',
                        'Goal history',
                      ),
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    ...history
                        .take(5)
                        .map(
                          (item) => ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(item.description),
                            subtitle: Text(item.occurredOn),
                            trailing: Text(
                              currency.format(item.amountMinor / 100),
                            ),
                          ),
                        ),
                  ],
                ],
              ),
            ),
          );
        }),
      ],
    ),
  );

  List<String> _analyticsMonthKeys(String currentMonthKey) {
    final keys = <String>{
      currentMonthKey,
      _compareFirstMonthKey,
      _compareSecondMonthKey,
    };
    for (final movement in _items) {
      if (RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(movement.monthKey))
        keys.add(movement.monthKey);
    }
    for (final config in _monthConfigurations) {
      final key = config['monthKey'];
      if (key is String && RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(key))
        keys.add(key);
    }
    for (final budget in _budgets) {
      final key = budget['monthKey'];
      if (key is String && RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(key))
        keys.add(key);
    }
    return keys.toList()..sort((a, b) => b.compareTo(a));
  }

  MonthlyAnalytics _analyticsForMonth(String key) => FinancialAnalytics.month(
    monthKey: key,
    movements: _items,
    monthConfigurations: _monthConfigurations,
    categoryBudgets: _budgets,
  );

  String _analyticsMonthLabel(String key) {
    final parts = key.split('-').map(int.parse).toList();
    return DateFormat.yMMMM(
      _language == 'en' ? 'en_US' : 'es_DO',
    ).format(DateTime(parts[0], parts[1]));
  }

  Widget _statisticsTab(NumberFormat currency, String monthKey) {
    final months = _analyticsMonthKeys(monthKey);
    final firstKey = months.contains(_compareFirstMonthKey)
        ? _compareFirstMonthKey
        : months.first;
    final secondKey = months.contains(_compareSecondMonthKey)
        ? _compareSecondMonthKey
        : months.last;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          _text(_language, 'Estadísticas', 'Statistics'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SegmentedButton<int>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(
                value: 0,
                label: Text(_text(_language, 'Resumen', 'Summary')),
              ),
              ButtonSegment(
                value: 1,
                label: Text(_text(_language, 'Categorías', 'Categories')),
              ),
              ButtonSegment(
                value: 2,
                label: Text(_text(_language, 'Comparar', 'Compare')),
              ),
              ButtonSegment(
                value: 3,
                label: Text(_text(_language, 'Evolución', 'Trends')),
              ),
            ],
            selected: {_statisticsSection},
            onSelectionChanged: (values) =>
                setState(() => _statisticsSection = values.first),
          ),
        ),
        const SizedBox(height: 16),
        if (_statisticsSection == 0) _statisticsSummary(currency, monthKey),
        if (_statisticsSection == 1)
          _statisticsCategories(currency, _analyticsForMonth(monthKey)),
        if (_statisticsSection == 2)
          _statisticsCompare(currency, months, firstKey, secondKey),
        if (_statisticsSection == 3) _statisticsEvolution(currency, monthKey),
      ],
    );
  }

  Widget _statisticsSummary(NumberFormat currency, String monthKey) {
    final data = _analyticsForMonth(monthKey);
    final finances = data.summary;
    final savingsNet = data.savingsNetMinor;
    final income = finances.totalIncomeMinor;
    final dayParts = monthKey.split('-').map(int.parse).toList();
    final lastDay = DateTime(dayParts[0], dayParts[1] + 1, 0).day;
    final now = DateTime.now();
    final elapsedDays = dayParts[0] == now.year && dayParts[1] == now.month
        ? now.day
        : lastDay;
    final daily =
        (finances.totalExpensesMinor / (elapsedDays < 1 ? 1 : elapsedDays))
            .round();
    final spendRatio = income == 0 ? 0.0 : finances.totalExpensesMinor / income;
    final saveRatio = income == 0 ? 0.0 : savingsNet / income;
    final previousDate = DateTime(dayParts[0], dayParts[1] - 1);
    final previousKey = DateFormat('yyyy-MM').format(previousDate);
    final previous = _analyticsForMonth(previousKey);
    final advice = <(String, String)>[];
    for (final category in data.categories) {
      final budget = category.budgetMinor;
      if (budget == null) continue;
      if (category.spentMinor > budget) {
        advice.add((
          _text(_language, 'Presupuesto excedido: ', 'Budget exceeded: ') +
              localizedCategoryLabel(_language, category.name),
          _text(
                _language,
                'Superaste el monto asignado por ',
                'You went over the assigned amount by ',
              ) +
              currency.format((category.spentMinor - budget) / 100),
        ));
      } else if (budget > 0 && category.spentMinor >= budget * 0.8) {
        advice.add((
          _text(
                _language,
                'Te acercas al límite: ',
                'Approaching the limit: ',
              ) +
              category.name,
          currency.format(category.spentMinor / 100) +
              ' ' +
              _text(_language, 'de', 'of') +
              ' ' +
              currency.format(budget / 100) +
              ' ' +
              _text(_language, 'asignados.', 'assigned.'),
        ));
      }
    }
    if (previous.summary.totalExpensesMinor > 0 &&
        finances.totalExpensesMinor >
            previous.summary.totalExpensesMinor * 1.2) {
      advice.add((
        _text(_language, 'Tus gastos aumentaron', 'Your spending increased'),
        _text(_language, 'Subieron ', 'It increased by ') +
            currency.format(
              (finances.totalExpensesMinor -
                      previous.summary.totalExpensesMinor) /
                  100,
            ) +
            ' ' +
            _text(
              _language,
              'frente al mes anterior.',
              'compared with last month.',
            ),
      ));
    }
    if (data.categories.isNotEmpty && data.categories.first.share >= 0.35) {
      advice.add((
        _text(_language, 'Oportunidad de ahorro: ', 'Saving opportunity: ') +
            data.categories.first.name,
        _text(
          _language,
          'Es tu categoría de mayor gasto este mes.',
          'This is your highest-spending category this month.',
        ),
      ));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _analyticsMonthLabel(monthKey),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.75,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          children: [
            _statMetric(
              _text(_language, 'Ingresos', 'Income'),
              currency.format(income / 100),
              prominent: true,
            ),
            _statMetric(
              _text(_language, 'Gastos', 'Expenses'),
              currency.format(finances.totalExpensesMinor / 100),
              prominent: true,
            ),
            _statMetric(
              _text(_language, 'Ahorro neto', 'Net savings'),
              currency.format(savingsNet / 100),
              prominent: true,
            ),
            _statMetric(
              _text(_language, 'Disponible', 'Available'),
              currency.format(finances.availableMinor / 100),
              prominent: true,
            ),
            _statMetric(
              _text(_language, 'Gasto / ingreso', 'Spending / income'),
              (spendRatio * 100).toStringAsFixed(1) + '%',
            ),
            _statMetric(
              _text(_language, 'Ahorro / ingreso', 'Savings / income'),
              (saveRatio * 100).toStringAsFixed(1) + '%',
            ),
            _statMetric(
              _text(_language, 'Promedio diario', 'Daily average'),
              currency.format(daily / 100),
            ),
            _statMetric(
              _text(_language, 'Movimientos', 'Movements'),
              data.movementCount.toString(),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          _text(_language, 'Consejos de MisCheles', 'MisCheles tips'),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        if (advice.isEmpty)
          Text(
            data.movementCount == 0
                ? _text(
                    _language,
                    'Aún no hay movimientos reales para generar consejos.',
                    'There are no real transactions yet to generate tips.',
                  )
                : _text(
                    _language,
                    'No encontramos alertas de presupuesto con los registros actuales.',
                    'No budget alerts were found in the current records.',
                  ),
          ),
        ...advice.map(
          (item) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.lightbulb_outline, color: Colors.amber),
            title: Text(item.$1),
            subtitle: Text(item.$2),
          ),
        ),
      ],
    );
  }

  Widget _statMetric(String title, String value, {bool prominent = false}) =>
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: prominent
              ? Theme.of(
                  context,
                ).colorScheme.primaryContainer.withValues(alpha: 0.45)
              : Theme.of(
                  context,
                ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(title, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: prominent
                  ? Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    )
                  : Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
            ),
          ],
        ),
      );

  Widget _statisticsCategories(
    NumberFormat currency,
    MonthlyAnalytics data,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        _analyticsMonthLabel(data.monthKey),
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: 8),
      if (data.categories.isEmpty)
        Text(
          _text(
            _language,
            'No hay gastos ni categorías presupuestadas en este período.',
            'There are no expenses or budgeted categories in this period.',
          ),
        ),
      ...data.categories.map((category) {
        final remaining = category.remainingMinor;
        final progress = category.budgetUsage ?? category.share;
        return ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(localizedCategoryLabel(_language, category.name)),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                (category.share * 100).toStringAsFixed(1) +
                    '% ' +
                    _text(_language, 'del gasto total', 'of total spending'),
              ),
              const SizedBox(height: 5),
              LinearProgressIndicator(
                value: progress.clamp(0.0, 1.0).toDouble(),
                color: remaining != null && remaining < 0 ? Colors.red : null,
              ),
              if (category.budgetMinor != null)
                Text(
                  currency.format(category.spentMinor / 100) +
                      ' ' +
                      _text(_language, 'gastados de', 'spent of') +
                      ' ' +
                      currency.format(category.budgetMinor! / 100),
                ),
            ],
          ),
          trailing: remaining == null
              ? Text(currency.format(category.spentMinor / 100))
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      remaining >= 0
                          ? _text(_language, 'Restan ', 'Left ') +
                                currency.format(remaining / 100)
                          : _text(_language, 'Excedido ', 'Over by ') +
                                currency.format(remaining.abs() / 100),
                      style: TextStyle(
                        color: remaining < 0
                            ? Colors.red
                            : Colors.green.shade700,
                      ),
                    ),
                    Text((category.share * 100).toStringAsFixed(0) + '%'),
                  ],
                ),
        );
      }),
    ],
  );

  Widget _monthPicker(
    String label,
    String selected,
    List<String> months,
    ValueChanged<String> onChanged,
  ) => DropdownButtonFormField<String>(
    initialValue: selected,
    decoration: InputDecoration(labelText: label),
    items: months
        .map(
          (key) => DropdownMenuItem(
            value: key,
            child: Text(_analyticsMonthLabel(key)),
          ),
        )
        .toList(),
    onChanged: (value) {
      if (value != null) onChanged(value);
    },
  );

  Widget _differenceTile(
    String label,
    MetricDifference difference,
    NumberFormat currency,
  ) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label),
    trailing: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          currency.format(difference.amountMinor / 100),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        Text(
          difference.percent == null
              ? _text(
                  _language,
                  'Sin base porcentual',
                  'No percentage baseline',
                )
              : ((difference.percent! >= 0 ? '+' : '') +
                    (difference.percent! * 100).toStringAsFixed(1) +
                    '%'),
        ),
      ],
    ),
  );

  Widget _statisticsCompare(
    NumberFormat currency,
    List<String> months,
    String firstKey,
    String secondKey,
  ) {
    final first = _analyticsForMonth(firstKey);
    final second = _analyticsForMonth(secondKey);
    final comparison = FinancialAnalytics.compare(first: first, second: second);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _monthPicker(
          _text(_language, 'Primer mes', 'First month'),
          firstKey,
          months,
          (value) => setState(() => _compareFirstMonthKey = value),
        ),
        const SizedBox(height: 10),
        _monthPicker(
          _text(_language, 'Segundo mes', 'Second month'),
          secondKey,
          months,
          (value) => setState(() => _compareSecondMonthKey = value),
        ),
        const SizedBox(height: 12),
        _differenceTile(
          _text(_language, 'Diferencia de ingresos', 'Income difference'),
          comparison.income,
          currency,
        ),
        _differenceTile(
          _text(_language, 'Diferencia de gastos', 'Spending difference'),
          comparison.expenses,
          currency,
        ),
        _differenceTile(
          _text(
            _language,
            'Diferencia de ahorro neto',
            'Net savings difference',
          ),
          comparison.savings,
          currency,
        ),
        _differenceTile(
          _text(_language, 'Diferencia disponible', 'Available difference'),
          comparison.available,
          currency,
        ),
        const Divider(),
        Text(
          _text(_language, 'Gastos por categoría', 'Spending by category'),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        ...comparison.categoryDifferences.map((row) {
          final maximum = row.$2 > row.$3 ? row.$2 : row.$3;
          final scale = maximum < 1 ? 1 : maximum;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.$1,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 5),
                Text(
                  _analyticsMonthLabel(firstKey) +
                      ': ' +
                      currency.format(row.$2 / 100),
                ),
                LinearProgressIndicator(value: row.$2 / scale),
                const SizedBox(height: 4),
                Text(
                  _analyticsMonthLabel(secondKey) +
                      ': ' +
                      currency.format(row.$3 / 100),
                ),
                LinearProgressIndicator(
                  value: row.$3 / scale,
                  color: Theme.of(context).colorScheme.tertiary,
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _statisticsEvolution(NumberFormat currency, String currentMonthKey) {
    final series = FinancialAnalytics.evolution(
      endMonthKey: currentMonthKey,
      monthCount: _evolutionMonthCount,
      movements: _items,
      monthConfigurations: _monthConfigurations,
      categoryBudgets: _budgets,
    );
    var maximum = 1;
    for (final month in series) {
      if (month.summary.totalIncomeMinor > maximum)
        maximum = month.summary.totalIncomeMinor;
      if (month.summary.totalExpensesMinor > maximum)
        maximum = month.summary.totalExpensesMinor;
      if (month.savingsNetMinor > maximum) maximum = month.savingsNetMinor;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SegmentedButton<int>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment(
              value: 6,
              label: Text(_text(_language, '6 meses', '6 months')),
            ),
            ButtonSegment(
              value: 12,
              label: Text(_text(_language, '12 meses', '12 months')),
            ),
          ],
          selected: {_evolutionMonthCount},
          onSelectionChanged: (values) =>
              setState(() => _evolutionMonthCount = values.first),
        ),
        const SizedBox(height: 14),
        ...series.map(
          (month) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _analyticsMonthLabel(month.monthKey),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 5),
                Text(
                  _text(_language, 'Ingresos: ', 'Income: ') +
                      currency.format(month.summary.totalIncomeMinor / 100),
                ),
                LinearProgressIndicator(
                  value: month.summary.totalIncomeMinor / maximum,
                ),
                Text(
                  _text(_language, 'Gastos: ', 'Expenses: ') +
                      currency.format(month.summary.totalExpensesMinor / 100),
                ),
                LinearProgressIndicator(
                  value: month.summary.totalExpensesMinor / maximum,
                  color: Theme.of(context).colorScheme.error,
                ),
                Text(
                  _text(_language, 'Ahorro neto: ', 'Net savings: ') +
                      currency.format(month.savingsNetMinor / 100),
                ),
                LinearProgressIndicator(
                  value:
                      (month.savingsNetMinor > 0 ? month.savingsNetMinor : 0) /
                      maximum,
                  color: Theme.of(context).colorScheme.tertiary,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _profileTab() => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Text(
        _text(_language, 'Perfil y preferencias', 'Profile and preferences'),
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 16),
      if (FirebaseBootstrap.firestoreCachePurgeRetryPending)
        Card(
          color: Theme.of(context).colorScheme.errorContainer,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              _text(
                _language,
                'No se pudo limpiar la caché de nube anterior. Cierra y vuelve a abrir la app para reintentar; si el aviso continúa, borra los datos de Mis Cheles desde Ajustes del dispositivo. Tus datos locales se conservan.',
                'The previous cloud cache could not be cleared. Close and reopen the app to retry; if this message remains, clear Mis Cheles app data in device settings. Your local-only data is preserved.',
              ),
            ),
          ),
        ),
      if (widget.user != null) ...[
        Text(widget.user!.displayName ?? ''),
        Text(widget.user!.email ?? ''),
      ],
      Text(
        _text(_language, 'Modo: ', 'Mode: ') +
            (widget.mode == AppMode.account
                ? _text(_language, 'Cuenta sincronizada', 'Synced account')
                : widget.mode == AppMode.demo
                ? _text(_language, 'Prueba', 'Demo')
                : _text(_language, 'Local', 'Local')),
      ),
      const SizedBox(height: 16),
      DropdownButtonFormField<String>(
        initialValue: _language,
        decoration: InputDecoration(
          labelText: _text(_language, 'Idioma', 'Language'),
        ),
        items: const [
          DropdownMenuItem(value: 'es', child: Text('Español')),
          DropdownMenuItem(value: 'en', child: Text('English')),
        ],
        onChanged: (value) {
          if (value != null) _selectLanguage(value);
        },
      ),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(
        initialValue: _currencyCode,
        decoration: InputDecoration(
          labelText: _text(_language, 'Moneda preferida', 'Preferred currency'),
        ),
        items: currencySymbols.keys
            .map(
              (code) => DropdownMenuItem(
                value: code,
                child: Text(
                  '${currencySymbolForCode(code)}  ${currencyName(_language, code)}',
                ),
              ),
            )
            .toList(),
        onChanged: (value) {
          if (value != null) _selectCurrency(value);
        },
      ),
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.tune),
        title: Text(_text(_language, 'Configurar mes', 'Set up month')),
        onTap: _configureMonth,
      ),
      if (widget.mode == AppMode.account && _localRecordCount > 0)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.sync),
          title: Text(
            _text(_language, 'Migrar datos locales', 'Migrate local data'),
          ),
          subtitle: Text(
            _text(
              _language,
              'La copia local se conserva.',
              'The local copy is kept.',
            ),
          ),
          onTap: _migrateLocalData,
        ),
      if (widget.mode == AppMode.demo)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.restart_alt),
          title: Text(
            _text(_language, 'Reiniciar datos de prueba', 'Reset demo data'),
          ),
          onTap: _resetDemo,
        ),
      if (widget.mode == AppMode.account &&
          widget.user?.providerData.any(
                (provider) => provider.providerId == 'password',
              ) ==
              true)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.password),
          title: Text(
            _text(_language, 'Cambiar contraseña', 'Change password'),
          ),
          onTap: _changePassword,
        ),
      if (widget.mode == AppMode.account &&
          widget.user?.providerData.any(
                (provider) =>
                    provider.providerId == 'password' ||
                    provider.providerId == 'google.com',
              ) ==
              true)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.delete_outline, color: Colors.red),
          title: Text(
            _text(_language, 'Eliminar cuenta', 'Delete account'),
            style: const TextStyle(color: Colors.red),
          ),
          subtitle: Text(
            _text(
              _language,
              'Elimina la cuenta y sus datos sincronizados.',
              'Deletes the account and its synced data.',
            ),
          ),
          onTap: _deleteAccount,
        ),
      if (widget.mode == AppMode.account)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.logout),
          title: Text(_text(_language, 'Cerrar sesión', 'Sign out')),
          onTap: () => AccountAuthService(FirebaseAuth.instance).signOut(),
        ),
    ],
  );

  Future<void> _deleteAccount() async {
    final password = TextEditingController();
    final confirmation = TextEditingController();
    String? formError;
    final needsPassword =
        widget.user?.providerData.any(
          (provider) => provider.providerId == 'password',
        ) ==
        true;
    final values = await showDialog<List<String>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text(_text(_language, 'Eliminar cuenta', 'Delete account')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _text(
                  _language,
                  'Se eliminarán la cuenta y sus datos sincronizados. Esta acción no se puede deshacer. La caché de nube se limpiará al abrir la app nuevamente; los datos locales se conservan.',
                  'Your account and synced data will be deleted. This cannot be undone. The cloud cache will clear when the app opens again; local-only data is preserved.',
                ),
              ),
              if (needsPassword)
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: _text(
                      _language,
                      'Contraseña actual',
                      'Current password',
                    ),
                  ),
                ),
              TextField(
                controller: confirmation,
                decoration: InputDecoration(
                  labelText: _text(
                    _language,
                    'Escribe ELIMINAR',
                    'Type DELETE',
                  ),
                ),
              ),
              if (formError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    formError!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(_text(_language, 'Cancelar', 'Cancel')),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () {
                final expected = _language == 'en' ? 'DELETE' : 'ELIMINAR';
                if (confirmation.text.trim().toUpperCase() != expected ||
                    (needsPassword && password.text.isEmpty)) {
                  setDialogState(
                    () => formError = _text(
                      _language,
                      'Confirma la frase y la contraseña actual.',
                      'Confirm the phrase and your current password.',
                    ),
                  );
                  return;
                }
                Navigator.pop(dialogContext, [password.text, 'ELIMINAR']);
              },
              child: Text(
                _text(_language, 'Eliminar cuenta', 'Delete account'),
              ),
            ),
          ],
        ),
      ),
    );
    password.dispose();
    confirmation.dispose();
    if (values == null) return;
    try {
      await AccountAuthService(
        FirebaseAuth.instance,
      ).deleteAccount(confirmation: values[1], currentPassword: values[0]);
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(
                _language,
                'Cuenta eliminada. La caché de nube se limpiará al abrir la app nuevamente.',
                'Account deleted. The cloud cache will be cleared when the app opens again.',
              ),
            ),
          ),
        );
    } on FirebaseAuthException catch (error) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message ?? error.code)));
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(
                _language,
                'No se pudo eliminar la cuenta. Revisa la conexión y vuelve a intentarlo.',
                'Account deletion failed. Check your connection and try again.',
              ),
            ),
          ),
        );
    }
  }

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final next = TextEditingController();
    final confirm = TextEditingController();
    var obscureCurrent = true;
    var obscureNext = true;
    final values = await showDialog<List<String>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text(
            _text(_language, 'Cambiar contraseña', 'Change password'),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: current,
                obscureText: obscureCurrent,
                decoration: InputDecoration(
                  labelText: _text(
                    _language,
                    'Contraseña actual',
                    'Current password',
                  ),
                ),
              ),
              TextField(
                controller: next,
                obscureText: obscureNext,
                decoration: InputDecoration(
                  labelText: _text(
                    _language,
                    'Nueva contraseña (8 caracteres mínimo)',
                    'New password (8 characters minimum)',
                  ),
                ),
              ),
              TextField(
                controller: confirm,
                obscureText: obscureNext,
                decoration: InputDecoration(
                  labelText: _text(
                    _language,
                    'Confirmar nueva contraseña',
                    'Confirm new password',
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(_text(_language, 'Cancelar', 'Cancel')),
            ),
            FilledButton(
              onPressed: () {
                if (next.text.length < 8 || next.text != confirm.text) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        _text(
                          _language,
                          'La nueva contraseña debe tener al menos 8 caracteres y coincidir.',
                          'The new password must be at least 8 characters and match.',
                        ),
                      ),
                    ),
                  );
                  return;
                }
                Navigator.pop(dialogContext, [current.text, next.text]);
              },
              child: Text(_text(_language, 'Actualizar', 'Update')),
            ),
          ],
        ),
      ),
    );
    current.dispose();
    next.dispose();
    confirm.dispose();
    if (values == null) return;
    try {
      await AccountAuthService(
        FirebaseAuth.instance,
      ).changePassword(values[0], values[1]);
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(_language, 'Contraseña actualizada.', 'Password updated.'),
            ),
          ),
        );
    } on FirebaseAuthException catch (error) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message ?? error.code)));
    }
  }

  Future<void> _editGoal(Map<String, Object?> goal) async {
    final title = TextEditingController(text: goal['title'] as String? ?? '');
    final target = TextEditingController(
      text: (_minor(goal, 'targetMinor', 'targetAmount') / 100).toStringAsFixed(
        2,
      ),
    );
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_text(_language, 'Editar meta', 'Edit goal')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: _text(_language, 'Nombre', 'Name'),
              ),
            ),
            TextField(
              controller: target,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: _text(_language, 'Monto objetivo', 'Target amount'),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Guardar', 'Save')),
          ),
        ],
      ),
    );
    final name = title.text.trim();
    final targetMinor = parseMoneyMinor(target.text);
    title.dispose();
    target.dispose();
    if (saved != true) return;
    if (name.isEmpty || targetMinor == null || targetMinor <= 0) {
      _showMessage(
        'Escribe un nombre y monto objetivo válidos.',
        'Enter a name and valid target amount.',
      );
      return;
    }
    final id = goal['id'] as String?;
    if (id == null || id.isEmpty) return;
    final now = DateTime.now().toUtc().toIso8601String();
    final record = Map<String, Object?>.from(goal)
      ..['title'] = name
      ..['targetMinor'] = targetMinor
      ..['currency'] = goal['currency'] ?? _currencyCode
      ..['updatedAt'] = now;
    if (widget.user != null) {
      record['ownerUid'] = widget.user!.uid;
      record['schemaVersion'] = 1;
    }
    try {
      if (widget.mode == AppMode.account && widget.user != null) {
        await AccountRepository(FirebaseFirestore.instance).saveRecord(
          widget.user!.uid,
          'savingsGoals',
          Map<String, dynamic>.from(record),
        );
      } else {
        await LocalLedger.instance.saveRecord(
          _modeKey,
          'savingsGoal',
          id,
          record,
        );
      }
      await _load();
    } catch (_) {
      _showMessage(
        'No se pudo actualizar la meta.',
        'Could not update the goal.',
      );
    }
  }

  Future<void> _deleteGoal(Map<String, Object?> goal) async {
    final id = goal['id'] as String?;
    if (id == null || id.isEmpty) return;
    final title = goal['title'] as String? ?? _text(_language, 'Meta', 'Goal');
    final balance = _goalBalance(goal);
    final hasBalance = balance > 0;
    final money = NumberFormat.currency(
      locale: _language == 'en' ? 'en_US' : 'es_DO',
      name: _currencyCode,
      symbol: currencySymbolForCode(_currencyCode),
    ).format(balance / 100);
    final decision = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_text(_language, 'Eliminar meta', 'Delete goal')),
        content: Text(
          hasBalance
              ? _text(
                  _language,
                  'Esta meta tiene ' +
                      money +
                      '. Puedes liberar el saldo al dinero disponible o confirmar que los datos eran falsos. Al liberar el saldo se conservará el historial.',
                  'This goal has ' +
                      money +
                      '. You can release the balance to available money or confirm the records were false. Releasing it keeps the history.',
                )
              : _text(
                  _language,
                  'Elige si quieres conservar el historial o confirmar que estos registros eran datos falsos.',
                  'Choose whether to keep the history or confirm these records were false.',
                ),
        ),
        actionsOverflowDirection: VerticalDirection.up,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          if (hasBalance)
            TextButton(
              onPressed: () => Navigator.pop(context, 'false_data'),
              child: Text(
                _text(
                  _language,
                  'Nunca ahorré este dinero',
                  'This money was never saved',
                ),
              ),
            )
          else
            TextButton(
              onPressed: () => Navigator.pop(context, 'keep_history'),
              child: Text(
                _text(_language, 'Conservar historial', 'Keep history'),
              ),
            ),
          if (hasBalance)
            TextButton(
              onPressed: () => Navigator.pop(context, 'general'),
              child: Text(
                _text(
                  _language,
                  'Pasar al ahorro general',
                  'Move to general savings',
                ),
              ),
            ),
          if (hasBalance)
            FilledButton(
              onPressed: () => Navigator.pop(context, 'release'),
              child: Text(
                _text(_language, 'Liberar y eliminar', 'Release and delete'),
              ),
            )
          else
            FilledButton(
              onPressed: () => Navigator.pop(context, 'false_data'),
              child: Text(
                _text(_language, 'Eliminar datos falsos', 'Delete false data'),
              ),
            ),
        ],
      ),
    );
    if (decision == null) return;
    final linked = _items.where((item) => item.savingsGoalId == id).toList();
    final falseDataGroup = savingsGoalDeletionGroup(
      goalId: id,
      movements: _items,
    );
    try {
      if (decision == 'false_data') {
        if (widget.mode == AppMode.account && widget.user != null) {
          await AccountRepository(
            FirebaseFirestore.instance,
          ).discardSavingsGoalAsFalse(
            widget.user!.uid,
            id,
            falseDataGroup,
            goalRevision: goal['_cloudRevision'] as String?,
          );
        } else {
          await LocalLedger.instance.discardSavingsGoalAsFalse(
            _modeKey,
            id,
            falseDataGroup,
          );
        }
      } else if ((decision == 'release' || decision == 'general') &&
          hasBalance) {
        final now = DateTime.now();
        final release = FinancialMovement(
          id: 'goal-release-' + now.microsecondsSinceEpoch.toString(),
          kind: decision == 'general'
              ? 'savings_reallocation'
              : 'savings_withdrawal',
          amountMinor: balance,
          currency: _currencyCode,
          occurredOn: DateFormat('yyyy-MM-dd').format(now),
          monthKey: DateFormat('yyyy-MM').format(now),
          categoryName: _text(_language, 'Ahorro', 'Savings'),
          description:
              _text(
                _language,
                'Saldo liberado al cerrar ',
                'Balance released from ',
              ) +
              title,
          origin: 'manual',
        );
        if (widget.mode == AppMode.account && widget.user != null) {
          await AccountRepository(FirebaseFirestore.instance).closeSavingsGoal(
            widget.user!.uid,
            id,
            goalRevision: goal['_cloudRevision'] as String?,
            linkedMovements: linked,
            releaseMovement: release,
          );
        } else {
          await LocalLedger.instance.closeSavingsGoal(
            _modeKey,
            id,
            linkedMovements: linked,
            releaseMovement: release,
          );
        }
      } else {
        if (widget.mode == AppMode.account && widget.user != null) {
          await AccountRepository(FirebaseFirestore.instance).closeSavingsGoal(
            widget.user!.uid,
            id,
            goalRevision: goal['_cloudRevision'] as String?,
            linkedMovements: linked,
          );
        } else {
          await LocalLedger.instance.closeSavingsGoal(
            _modeKey,
            id,
            linkedMovements: linked,
          );
        }
      }
      await _load();
    } catch (error) {
      final tooManyRecords = error is StateError;
      final conflict = error is AccountSyncConflictException;
      _showMessage(
        tooManyRecords
            ? 'Esta meta tiene demasiado historial para cerrarse de forma segura desde el dispositivo.'
            : conflict
            ? 'La meta o su historial cambió en otro dispositivo. Actualiza y vuelve a intentarlo.'
            : 'No se pudo cerrar la meta. La operación no se completó.',
        tooManyRecords
            ? 'This goal has too much history to close safely from this device.'
            : conflict
            ? 'This goal or its history changed on another device. Refresh and try again.'
            : 'Could not close the goal. The operation did not complete.',
      );
    }
  }

  Future<void> _createGoal() async {
    final title = TextEditingController();
    final amount = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_text(_language, 'Nueva meta', 'New goal')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: _text(_language, 'Nombre', 'Name'),
              ),
            ),
            TextField(
              controller: amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: _text(_language, 'Monto objetivo', 'Target amount'),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Guardar', 'Save')),
          ),
        ],
      ),
    );
    final targetMinor = parseMoneyMinor(amount.text);
    final goalTitle = title.text.trim();
    title.dispose();
    amount.dispose();
    if (saved != true) return;
    if (goalTitle.isEmpty || targetMinor == null || targetMinor <= 0) {
      _showMessage(
        'Escribe un nombre y un monto objetivo válido.',
        'Enter a name and a valid target amount.',
      );
      return;
    }
    final id = 'goal-' + DateTime.now().microsecondsSinceEpoch.toString();
    final now = DateTime.now().toUtc().toIso8601String();
    final record = <String, Object?>{
      'id': id,
      'title': goalTitle,
      'targetMinor': targetMinor,
      'currency': _currencyCode,
      'createdAt': now,
      'updatedAt': now,
      if (widget.user != null) 'ownerUid': widget.user!.uid,
      if (widget.user != null) 'schemaVersion': 1,
    };
    try {
      if (widget.mode == AppMode.account && widget.user != null) {
        await AccountRepository(FirebaseFirestore.instance).saveRecord(
          widget.user!.uid,
          'savingsGoals',
          Map<String, dynamic>.from(record),
        );
      } else {
        await LocalLedger.instance.saveRecord(
          _modeKey,
          'savingsGoal',
          id,
          record,
        );
      }
      await _load();
    } catch (_) {
      _showMessage('No se pudo guardar la meta.', 'Could not save the goal.');
    }
  }

  Future<void> _addSavings(
    Map<String, Object?>? goal, {
    bool withdrawal = false,
  }) async {
    final amount = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          withdrawal
              ? goal == null
                    ? _text(
                        _language,
                        'Retirar de ahorro general',
                        'Withdraw from general savings',
                      )
                    : _text(
                        _language,
                        'Retirar de la meta',
                        'Withdraw from goal',
                      )
              : _text(_language, 'Registrar aporte', 'Add contribution'),
        ),
        content: TextField(
          controller: amount,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: _text(_language, 'Monto', 'Amount'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Guardar', 'Save')),
          ),
        ],
      ),
    );
    final amountMinor = parseMoneyMinor(amount.text);
    amount.dispose();
    if (saved != true) return;
    if (amountMinor == null || amountMinor <= 0) {
      _showMessage('Escribe un monto válido.', 'Enter a valid amount.');
      return;
    }
    if (withdrawal &&
        amountMinor >
            (goal == null ? _generalSavingsBalance : _goalBalance(goal))) {
      _showMessage(
        goal == null
            ? _text(
                _language,
                'El retiro supera el ahorro general.',
                'The withdrawal exceeds general savings.',
              )
            : _text(
                _language,
                'El retiro supera el saldo de esta meta.',
                'The withdrawal exceeds this goal balance.',
              ),
      );
      return;
    }
    final now = DateTime.now();
    final date = DateFormat('yyyy-MM-dd').format(now);
    final movement = FinancialMovement(
      id: 'sm-' + now.microsecondsSinceEpoch.toString(),
      kind: withdrawal ? 'savings_withdrawal' : 'savings_contribution',
      amountMinor: amountMinor,
      currency: _currencyCode,
      occurredOn: date,
      monthKey: DateFormat('yyyy-MM').format(now),
      categoryName:
          goal?['title'] as String? ??
          _text(_language, 'Ahorro general', 'General savings'),
      description:
          (withdrawal
              ? _text(_language, 'Retiro de ', 'Withdrawal from ')
              : _text(_language, 'Aporte a ', 'Contribution to ')) +
          (goal?['title'] as String? ?? _text(_language, 'general', 'general')),
      origin: 'manual',
      savingsGoalId: goal?['id'] as String?,
    );
    try {
      if (widget.mode == AppMode.account && widget.user != null) {
        await AccountRepository(
          FirebaseFirestore.instance,
        ).saveMovement(widget.user!.uid, movement);
      } else {
        await LocalLedger.instance.saveMovement(_modeKey, movement);
      }
      await _load();
    } catch (_) {
      _showMessage(
        'No se pudo guardar el aporte.',
        'Could not save the contribution.',
      );
    }
  }

  Future<void> _migrateLocalData() async {
    final user = widget.user;
    if (user == null) return;
    try {
      await _loadCurrencyPreference();
      final service = LocalMigrationService(FirebaseFirestore.instance);
      final preview = await service.preview(
        user.uid,
        preferredCurrency: _localCurrencyCode,
      );
      if (!mounted) return;
      final selectedKeys = preview.toUpload.map(_migrationKey).toSet();
      final selected = await showDialog<Set<String>>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, updateDialog) => AlertDialog(
            title: Text(
              _text(_language, 'Revisar migración', 'Review migration'),
            ),
            content: SizedBox(
              width: 440,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _text(
                          _language,
                          'Selecciona qué registros copiar. La copia local se conservará.\nDuplicados detectados: ',
                          'Choose which records to copy. The local copy will be kept.\nDuplicates detected: ',
                        ) +
                        preview.duplicates.toString() +
                        _text(
                          _language,
                          ' · Para revisar: ',
                          ' · Needs review: ',
                        ) +
                        preview.invalid.length.toString(),
                  ),
                  const SizedBox(height: 12),
                  if (preview.toUpload.isEmpty)
                    Text(
                      _text(
                        _language,
                        'No hay registros disponibles para copiar.',
                        'There are no records available to copy.',
                      ),
                    )
                  else
                    SizedBox(
                      height: 260,
                      child: ListView.builder(
                        itemCount: preview.toUpload.length,
                        itemBuilder: (context, index) {
                          final item = preview.toUpload[index];
                          final key = _migrationKey(item);
                          return CheckboxListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            value: selectedKeys.contains(key),
                            title: Text(
                              _migrationRecordLabel(item, _language),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            controlAffinity: ListTileControlAffinity.leading,
                            onChanged: (checked) => updateDialog(() {
                              if (checked == true) {
                                selectedKeys.add(key);
                              } else {
                                selectedKeys.remove(key);
                              }
                            }),
                          );
                        },
                      ),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    _text(_language, 'Seleccionados: ', 'Selected: ') +
                        selectedKeys.length.toString() +
                        _text(_language, ' de ', ' of ') +
                        preview.toUpload.length.toString(),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(_text(_language, 'Cancelar', 'Cancel')),
              ),
              FilledButton(
                onPressed: selectedKeys.isEmpty
                    ? null
                    : () => Navigator.pop(
                        context,
                        Set<String>.from(selectedKeys),
                      ),
                child: Text(
                  _text(_language, 'Copiar seleccionados', 'Copy selected'),
                ),
              ),
            ],
          ),
        ),
      );
      if (selected == null || selected.isEmpty) return;
      final approved = MigrationPreview(
        total: selected.length,
        duplicates: preview.duplicates,
        invalid: preview.invalid,
        toUpload: selectLocalMigrationRecords(preview.toUpload, selected),
      );
      await service.migrate(user.uid, approved);
      await _load();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(
                _language,
                'Copia verificada. Los datos locales se conservaron.',
                'Copy verified. Local data was kept.',
              ),
            ),
          ),
        );
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(
                    _language,
                    'No se completó la migración. La copia local sigue intacta: ',
                    'Migration was not completed. The local copy is intact: ',
                  ) +
                  error.toString(),
            ),
          ),
        );
    }
  }

  Future<void> _resetDemo() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          _text(_language, 'Reiniciar datos de prueba', 'Reset demo data'),
        ),
        content: Text(
          _text(
            _language,
            'Se restaurarán los ejemplos ficticios. Tus registros locales no se modificarán.',
            'Fictional examples will be restored. Your local records will not be changed.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Reiniciar', 'Reset')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await LocalLedger.instance.clearNamespace('demo');
    await LocalLedger.instance.seedDemoIfEmpty();
    if (mounted) await _load();
  }

  Future<void> _addMovement({FinancialMovement? existing}) async {
    final amount = TextEditingController(
      text: existing == null
          ? ''
          : (existing.amountMinor / 100).toStringAsFixed(2),
    );
    final description = TextEditingController(
      text: existing?.description ?? '',
    );
    final category = TextEditingController(text: existing?.categoryName ?? '');
    var kind = existing?.kind ?? 'expense';
    var paymentMethod = existing?.paymentMethod ?? 'other';
    var occurredOn =
        DateTime.tryParse(existing?.occurredOn ?? '') ?? DateTime.now();
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: Text(
            _text(
              _language,
              existing == null ? 'Nuevo movimiento' : 'Editar movimiento',
              existing == null ? 'New transaction' : 'Edit transaction',
            ),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: kind,
                  items: [
                    DropdownMenuItem(
                      value: 'expense',
                      child: Text(_text(_language, 'Gasto', 'Expense')),
                    ),
                    DropdownMenuItem(
                      value: 'income',
                      child: Text(_text(_language, 'Ingreso', 'Income')),
                    ),
                    DropdownMenuItem(
                      value: 'savings_contribution',
                      child: Text(
                        _text(
                          _language,
                          'Aporte a ahorro',
                          'Savings contribution',
                        ),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'savings_withdrawal',
                      child: Text(
                        _text(
                          _language,
                          'Retiro de ahorro',
                          'Savings withdrawal',
                        ),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'savings_direct_expense',
                      child: Text(
                        _text(
                          _language,
                          'Gasto desde ahorro',
                          'Expense from savings',
                        ),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'transfer',
                      child: Text(
                        _text(
                          _language,
                          'Transferencia propia',
                          'Internal transfer',
                        ),
                      ),
                    ),
                  ],
                  onChanged: (value) => update(() => kind = value ?? kind),
                  decoration: InputDecoration(
                    labelText: _text(_language, 'Tipo', 'Type'),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: _text(_language, 'Monto', 'Amount'),
                  ),
                ),
                TextField(
                  controller: category,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: _text(_language, 'Categoría', 'Category'),
                  ),
                ),
                TextField(
                  controller: description,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: _text(_language, 'Concepto', 'Description'),
                  ),
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () async {
                      final selected = await showDatePicker(
                        context: context,
                        initialDate: occurredOn,
                        firstDate: DateTime(2000),
                        lastDate: DateTime.now().add(
                          const Duration(days: 3650),
                        ),
                      );
                      if (selected != null) update(() => occurredOn = selected);
                    },
                    icon: const Icon(Icons.calendar_today_outlined),
                    label: Text(
                      DateFormat.yMMMd(
                        _language == 'en' ? 'en_US' : 'es_DO',
                      ).format(occurredOn),
                    ),
                  ),
                ),
                DropdownButtonFormField<String>(
                  value: paymentMethod,
                  items: [
                    DropdownMenuItem(
                      value: 'cash',
                      child: Text(_text(_language, 'Efectivo', 'Cash')),
                    ),
                    DropdownMenuItem(
                      value: 'debit_card',
                      child: Text(
                        _text(_language, 'Tarjeta de débito', 'Debit card'),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'credit_card',
                      child: Text(
                        _text(_language, 'Tarjeta de crédito', 'Credit card'),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'bank_transfer',
                      child: Text(
                        _text(
                          _language,
                          'Transferencia bancaria',
                          'Bank transfer',
                        ),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'other',
                      child: Text(_text(_language, 'Otro', 'Other')),
                    ),
                  ],
                  onChanged: (value) =>
                      update(() => paymentMethod = value ?? paymentMethod),
                  decoration: InputDecoration(
                    labelText: _text(
                      _language,
                      'Medio de pago (opcional)',
                      'Payment method (optional)',
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(_text(_language, 'Cancelar', 'Cancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(_text(_language, 'Guardar', 'Save')),
            ),
          ],
        ),
      ),
    );
    if (saved != true) {
      amount.dispose();
      description.dispose();
      category.dispose();
      return;
    }
    final amountMinor = parseMoneyMinor(amount.text);
    final categoryName = category.text.trim();
    final concept = description.text.trim();
    amount.dispose();
    description.dispose();
    category.dispose();
    if (amountMinor == null ||
        amountMinor <= 0 ||
        categoryName.isEmpty ||
        concept.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _text(
              _language,
              'Revisa el monto, la categoría y el concepto.',
              'Check the amount, category, and description.',
            ),
          ),
        ),
      );
      return;
    }
    final now = DateTime.now();
    final item = FinancialMovement(
      id: existing?.id ?? 'm-${now.microsecondsSinceEpoch}',
      kind: kind,
      amountMinor: amountMinor,
      currency: _currencyCode,
      occurredOn: DateFormat('yyyy-MM-dd').format(occurredOn),
      monthKey: DateFormat('yyyy-MM').format(occurredOn),
      categoryName: categoryName,
      description: concept,
      paymentMethod: paymentMethod,
      origin: existing?.origin ?? 'manual',
      categoryId: kind == 'expense' ? existing?.categoryId : null,
      savingsGoalId: kind.startsWith('savings_')
          ? existing?.savingsGoalId
          : null,
      transferGroupId: kind == 'transfer' ? existing?.transferGroupId : null,
      localSourceId: existing?.localSourceId,
      ownerUid: widget.user?.uid,
      createdAt: existing?.createdAt,
      cloudRevision: existing?.cloudRevision,
    );
    try {
      if (widget.mode == AppMode.account) {
        final repository = AccountRepository(FirebaseFirestore.instance);
        if (existing == null)
          await repository.saveMovement(widget.user!.uid, item);
        else
          await repository.updateMovement(widget.user!.uid, existing, item);
      } else {
        await LocalLedger.instance.saveMovement(_modeKey, item);
      }
      if (mounted) await _load();
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(
                _language,
                error is AccountSyncConflictException
                    ? 'Este movimiento cambió en otro dispositivo. Actualiza la vista y vuelve a aplicar tu cambio.'
                    : 'No se pudo guardar el movimiento.',
                error is AccountSyncConflictException
                    ? 'This movement changed on another device. Refresh and reapply your change.'
                    : 'The transaction could not be saved.',
              ),
            ),
          ),
        );
    }
  }

  Future<void> _deleteMovement(FinancialMovement item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          _text(_language, 'Eliminar movimiento', 'Delete transaction'),
        ),
        content: Text(
          _text(
            _language,
            '¿Quieres eliminar este movimiento?',
            'Delete this transaction?',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_text(_language, 'Cancelar', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_text(_language, 'Eliminar', 'Delete')),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      if (widget.mode == AppMode.account)
        await AccountRepository(
          FirebaseFirestore.instance,
        ).deleteMovement(widget.user!.uid, item);
      else
        await LocalLedger.instance.deleteRecord(_modeKey, 'movement', item.id);
      if (mounted) await _load();
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _text(
                _language,
                'No se pudo eliminar el movimiento.',
                'The transaction could not be deleted.',
              ),
            ),
          ),
        );
    }
  }
}

Widget _languageSelector(String language, ValueChanged<String> onChanged) =>
    PopupMenuButton<String>(
      tooltip: _text(language, 'Cambiar idioma', 'Change language'),
      initialValue: language,
      onSelected: onChanged,
      itemBuilder: (context) => const [
        PopupMenuItem(value: 'es', child: Text('Español')),
        PopupMenuItem(value: 'en', child: Text('English')),
      ],
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Center(
          child: Text(
            language.toUpperCase(),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ),
    );
