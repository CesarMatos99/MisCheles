import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter/services.dart';
import '../domain/mail_oauth_contract.dart';

class MailReviewCandidate {
  const MailReviewCandidate({
    required this.id,
    required this.provider,
    required this.reviewStatus,
    required this.transactionType,
    required this.occurredOn,
    required this.amountMinor,
    required this.currency,
    required this.merchant,
    required this.description,
    required this.paymentHint,
  });
  final String id, provider, reviewStatus, transactionType, occurredOn;
  final int amountMinor;
  final String currency, merchant, description;
  final String? paymentHint;
  static MailReviewCandidate? fromDocument(
    String uid,
    QueryDocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data();
    final amount = data['amountMinor'];
    final status = data['reviewStatus'];
    final provider = data['provider'];
    final kind = data['transactionType'];
    if (data['ownerUid'] != uid ||
        (status != 'pending_review' && status != 'possible_duplicate') ||
        (provider != 'gmail' && provider != 'outlook') ||
        (kind != 'income' && kind != 'expense') ||
        amount is! int ||
        amount <= 0 ||
        data['occurredOn'] is! String ||
        data['currency'] is! String ||
        data['merchant'] is! String ||
        data['description'] is! String)
      return null;
    final hint = data['paymentHint'];
    const methods = {
      'cash',
      'debit_card',
      'credit_card',
      'bank_transfer',
      'other',
    };
    return MailReviewCandidate(
      id: document.id,
      provider: provider as String,
      reviewStatus: status as String,
      transactionType: kind as String,
      occurredOn: data['occurredOn'] as String,
      amountMinor: amount,
      currency: data['currency'] as String,
      merchant: data['merchant'] as String,
      description: data['description'] as String,
      paymentHint: hint is String && methods.contains(hint) ? hint : null,
    );
  }
}

class MailConnectionSummary {
  const MailConnectionSummary({
    required this.id,
    required this.provider,
    required this.maskedAddress,
    required this.status,
  });
  final String id, provider, maskedAddress, status;
  static MailConnectionSummary? fromDocument(
    String uid,
    QueryDocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data();
    final provider = data['provider'];
    final status = data['status'];
    final masked = data['maskedAddress'];
    if (data['ownerUid'] != uid ||
        data['id'] != document.id ||
        (provider != 'gmail' && provider != 'outlook') ||
        (status != 'active' &&
            status != 'reauthorization_required' &&
            status != 'disconnected') ||
        masked is! String)
      return null;
    return MailConnectionSummary(
      id: document.id,
      provider: provider as String,
      maskedAddress: masked as String,
      status: status as String,
    );
  }
}

class MailImportRepository {
  MailImportRepository(this._db, this._functions, this._auth);
  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;
  final FirebaseAuth _auth;
  static const _oauthChannel = MethodChannel('com.mischeles.app/mail_oauth');

  Stream<List<MailConnectionSummary>> watchConnections(String uid) => _db
      .collection('users')
      .doc(uid)
      .collection('mailConnections')
      .snapshots()
      .map(
        (snapshot) => snapshot.docs
            .map((doc) => MailConnectionSummary.fromDocument(uid, doc))
            .whereType<MailConnectionSummary>()
            .toList(),
      );

  Future<Uri> beginOAuth(String uid, String provider) async {
    _requireVerifiedOwner(uid);
    if (provider != 'gmail' && provider != 'outlook') {
      throw ArgumentError('Invalid mail provider.');
    }
    final result = await _functions.httpsCallable('beginMailOAuth').call(
      <String, Object?>{'provider': provider},
    );
    final authorization = MailOAuthAuthorization.parse(result.data, provider);
    return authorization.authorizationUrl;
  }

  Future<void> openOAuthUrl(Uri uri) async {
    final allowed =
        uri.scheme == 'https' &&
        (uri.host == 'accounts.google.com' ||
            uri.host == 'login.microsoftonline.com');
    if (!allowed) throw ArgumentError('Mail authorization URL is not allowed.');
    final opened = await _oauthChannel.invokeMethod<bool>(
      'openAuthorization',
      uri.toString(),
    );
    if (opened != true) throw StateError('Could not open authorization page.');
  }

  Future<void> disconnect(
    String uid,
    String connectionId,
    String provider,
  ) async {
    _requireVerifiedOwner(uid);
    if (!MailOAuthAuthorization.isConnectionId(connectionId) ||
        (provider != 'gmail' && provider != 'outlook')) {
      throw ArgumentError('Invalid mail connection.');
    }
    final result = await _functions.httpsCallable('disconnectMail').call(
      <String, Object?>{'connectionId': connectionId, 'provider': provider},
    );
    final data = result.data;
    if (data is! Map || data['disconnected'] != true) {
      throw StateError('Mail connection could not be disconnected.');
    }
  }

  CollectionReference<Map<String, dynamic>> _candidates(String uid) {
    if (uid.trim().isEmpty || uid.contains('/')) {
      throw ArgumentError('A valid UID is required.');
    }
    return _db.collection('users').doc(uid).collection('importedCandidates');
  }

  Stream<List<MailReviewCandidate>> watchCandidates(String uid) =>
      _candidates(uid).snapshots().map((snapshot) {
        final items = snapshot.docs
            .map((d) => MailReviewCandidate.fromDocument(uid, d))
            .whereType<MailReviewCandidate>()
            .toList();
        items.sort((a, b) => b.occurredOn.compareTo(a.occurredOn));
        return items;
      });
  Future<void> ignoreCandidate(String uid, String candidateId) async {
    _requireVerifiedOwner(uid);
    if (!RegExp(r'^mail_[a-f0-9]{64}$').hasMatch(candidateId))
      throw ArgumentError('Invalid candidate ID.');
    final ref = _candidates(uid).doc(candidateId);
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(ref);
      if (!snapshot.exists) return;
      final data = snapshot.data()!;
      if (data['ownerUid'] != uid)
        throw StateError('Candidate owner mismatch.');
      final status = data['reviewStatus'];
      if (status == 'ignored') return;
      if (status != 'pending_review' && status != 'possible_duplicate')
        throw StateError('Candidate is no longer available.');
      tx.update(ref, {
        'reviewStatus': 'ignored',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  Future<String> confirmCandidate({
    required String uid,
    required MailReviewCandidate candidate,
    required String categoryName,
    required String paymentMethod,
  }) {
    _requireVerifiedOwner(uid);
    if (candidate.reviewStatus == 'possible_duplicate')
      throw StateError('Explicit duplicate confirmation is required.');
    return _confirm(candidate, categoryName, paymentMethod, false);
  }

  Future<String> confirmPossibleDuplicate({
    required String uid,
    required MailReviewCandidate candidate,
    required String categoryName,
    required String paymentMethod,
  }) {
    _requireVerifiedOwner(uid);
    if (candidate.reviewStatus != 'possible_duplicate')
      throw StateError('This candidate is not marked as a possible duplicate.');
    return _confirm(candidate, categoryName, paymentMethod, true);
  }

  Future<String> _confirm(
    MailReviewCandidate candidate,
    String categoryName,
    String paymentMethod,
    bool duplicate,
  ) async {
    if (categoryName.trim().isEmpty || categoryName.length > 120)
      throw ArgumentError('A valid category is required.');
    const methods = {
      'cash',
      'debit_card',
      'credit_card',
      'bank_transfer',
      'other',
    };
    if (!methods.contains(paymentMethod))
      throw ArgumentError('Invalid payment method.');
    final result = await _functions
        .httpsCallable('confirmImportedCandidate')
        .call(<String, Object?>{
          'candidateId': candidate.id,
          'categoryName': categoryName.trim(),
          'description': candidate.description.isNotEmpty
              ? candidate.description
              : candidate.merchant,
          'paymentMethod': paymentMethod,
          if (duplicate) 'confirmPossibleDuplicate': true,
        });
    final data = result.data;
    if (data is! Map || data['movementId'] is! String)
      throw StateError('Invalid confirmation response.');
    return data['movementId'] as String;
  }

  void _requireVerifiedOwner(String uid) {
    final user = _auth.currentUser;
    if (user == null || user.uid != uid || !user.emailVerified)
      throw StateError('A verified signed-in owner is required.');
  }
}

class MailImportInbox extends StatelessWidget {
  const MailImportInbox({required this.uid, required this.language, super.key});
  final String uid, language;
  bool get _en => language == 'en';
  @override
  Widget build(
    BuildContext context,
  ) => StreamBuilder<List<MailReviewCandidate>>(
    stream: MailImportRepository(
      FirebaseFirestore.instance,
      FirebaseFunctions.instance,
      FirebaseAuth.instance,
    ).watchCandidates(uid),
    builder: (context, snapshot) {
      final title = _en
          ? 'Bank email notifications'
          : 'Notificaciones bancarias por correo';
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 28),
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            _en
                ? 'Mis Cheles sign-in is separate from permission to read Gmail or Outlook.'
                : 'El inicio de sesión de Mis Cheles es independiente del permiso para leer Gmail u Outlook.',
          ),
          const SizedBox(height: 8),
          _MailConnectionsPanel(uid: uid, language: language),
          const SizedBox(height: 8),
          if (snapshot.hasError)
            Text(
              _en
                  ? 'Could not load imported movements.'
                  : 'No se pudieron cargar los movimientos importados.',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            )
          else if (!snapshot.hasData)
            const LinearProgressIndicator()
          else if (snapshot.data!.isEmpty)
            Text(
              _en
                  ? 'No imported bank notifications are waiting for review.'
                  : 'No hay notificaciones bancarias importadas pendientes de revisión.',
              style: Theme.of(context).textTheme.bodySmall,
            )
          else
            ...snapshot.data!.map(
              (c) => _MailCandidateTile(
                candidate: c,
                uid: uid,
                language: language,
              ),
            ),
        ],
      );
    },
  );
}

class _MailConnectionsPanel extends StatefulWidget {
  const _MailConnectionsPanel({required this.uid, required this.language});
  final String uid, language;
  @override
  State<_MailConnectionsPanel> createState() => _MailConnectionsPanelState();
}

class _MailConnectionsPanelState extends State<_MailConnectionsPanel> {
  String _busy = '';
  String? _message;
  bool get _en => widget.language == 'en';
  MailImportRepository get _repository => MailImportRepository(
    FirebaseFirestore.instance,
    FirebaseFunctions.instance,
    FirebaseAuth.instance,
  );

  Future<void> _connect(String provider) async {
    setState(() {
      _busy = provider;
      _message = null;
    });
    try {
      final uri = await _repository.beginOAuth(widget.uid, provider);
      await _repository.openOAuthUrl(uri);
      if (mounted)
        setState(
          () => _message = _en
              ? 'Finish authorization in your browser, then return to Mis Cheles.'
              : 'Completa la autorización en el navegador y vuelve a Mis Cheles.',
        );
    } catch (_) {
      if (mounted)
        setState(
          () => _message = _en
              ? 'Could not start email authorization. Check your account and try again.'
              : 'No se pudo iniciar la autorización. Revisa tu cuenta e inténtalo de nuevo.',
        );
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _disconnect(MailConnectionSummary connection) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_en ? 'Disconnect mailbox?' : '¿Desconectar el correo?'),
        content: Text(
          _en
              ? 'Mis Cheles will remove its saved connection and stop syncing this mailbox.'
              : 'Mis Cheles eliminará la conexión guardada y dejará de sincronizar este correo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_en ? 'Cancel' : 'Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_en ? 'Disconnect' : 'Desconectar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() {
      _busy = connection.id;
      _message = null;
    });
    try {
      await _repository.disconnect(
        widget.uid,
        connection.id,
        connection.provider,
      );
    } catch (_) {
      if (mounted)
        setState(
          () => _message = connection.provider == 'outlook'
              ? (_en
                    ? 'Microsoft does not support revoking one mailbox token here. Remove Mis Cheles from your Microsoft account permissions, then retry.'
                    : 'Microsoft no permite revocar aquí un token individual. Elimina Mis Cheles de los permisos de tu cuenta Microsoft y vuelve a intentarlo.')
              : (_en
                    ? 'Could not revoke this mailbox. Try again.'
                    : 'No se pudo revocar este correo. Inténtalo de nuevo.'),
        );
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  @override
  Widget build(BuildContext context) =>
      StreamBuilder<List<MailConnectionSummary>>(
        stream: _repository.watchConnections(widget.uid),
        builder: (context, snapshot) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton(
                  onPressed: _busy.isNotEmpty ? null : () => _connect('gmail'),
                  child: Text(
                    _busy == 'gmail'
                        ? (_en ? 'Connecting…' : 'Conectando…')
                        : (_en ? 'Connect Gmail' : 'Conectar Gmail'),
                  ),
                ),
                OutlinedButton(
                  onPressed: _busy.isNotEmpty
                      ? null
                      : () => _connect('outlook'),
                  child: Text(
                    _busy == 'outlook'
                        ? (_en ? 'Connecting…' : 'Conectando…')
                        : (_en ? 'Connect Outlook' : 'Conectar Outlook'),
                  ),
                ),
              ],
            ),
            if (snapshot.hasError)
              Text(
                _en
                    ? 'Could not load connected mailboxes.'
                    : 'No se pudieron cargar los correos conectados.',
              ),
            for (final connection
                in snapshot.data ?? const <MailConnectionSummary>[])
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  (connection.provider == 'gmail' ? 'Gmail' : 'Outlook') +
                      ' · ' +
                      connection.maskedAddress,
                ),
                subtitle: Text(
                  connection.status == 'active'
                      ? (_en ? 'Connected' : 'Conectado')
                      : connection.status == 'reauthorization_required'
                      ? (_en ? 'Reconnect required' : 'Requiere reconexión')
                      : (_en ? 'Disconnected' : 'Desconectado'),
                ),
                trailing: connection.status == 'disconnected'
                    ? null
                    : TextButton(
                        onPressed: _busy.isNotEmpty
                            ? null
                            : () => _disconnect(connection),
                        child: Text(_en ? 'Disconnect' : 'Desconectar'),
                      ),
              ),
            if (_message != null)
              Text(
                _message!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      );
}

class _MailCandidateTile extends StatefulWidget {
  const _MailCandidateTile({
    required this.candidate,
    required this.uid,
    required this.language,
  });
  final MailReviewCandidate candidate;
  final String uid, language;
  @override
  State<_MailCandidateTile> createState() => _MailCandidateTileState();
}

class _MailCandidateTileState extends State<_MailCandidateTile> {
  final _category = TextEditingController();
  String _payment = 'other';
  bool _busy = false;
  String? _error;
  bool get _en => widget.language == 'en';
  @override
  void initState() {
    super.initState();
    _payment = widget.candidate.paymentHint ?? 'other';
  }

  @override
  void dispose() {
    _category.dispose();
    super.dispose();
  }

  Future<void> _submit({required bool duplicateConfirmed}) async {
    if (_category.text.trim().isEmpty) {
      setState(
        () => _error = _en
            ? 'Choose a category first.'
            : 'Escribe una categoría antes de continuar.',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repo = MailImportRepository(
        FirebaseFirestore.instance,
        FirebaseFunctions.instance,
        FirebaseAuth.instance,
      );
      if (duplicateConfirmed) {
        await repo.confirmPossibleDuplicate(
          uid: widget.uid,
          candidate: widget.candidate,
          categoryName: _category.text.trim(),
          paymentMethod: _payment,
        );
      } else {
        await repo.confirmCandidate(
          uid: widget.uid,
          candidate: widget.candidate,
          categoryName: _category.text.trim(),
          paymentMethod: _payment,
        );
      }
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _en
                  ? 'Movement added to Transactions.'
                  : 'Movimiento agregado a Registro.',
            ),
          ),
        );
    } catch (_) {
      if (mounted)
        setState(
          () => _error = _en
              ? 'Could not register this movement. Try again.'
              : 'No se pudo registrar el movimiento. Inténtalo de nuevo.',
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _ignore() async {
    setState(() => _busy = true);
    try {
      await MailImportRepository(
        FirebaseFirestore.instance,
        FirebaseFunctions.instance,
        FirebaseAuth.instance,
      ).ignoreCandidate(widget.uid, widget.candidate.id);
    } catch (_) {
      if (mounted)
        setState(
          () => _error = _en
              ? 'Could not ignore this movement.'
              : 'No se pudo ignorar este movimiento.',
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.candidate;
    final money = NumberFormat.currency(
      locale: _en ? 'en_US' : 'es_DO',
      name: c.currency,
    ).format(c.amountMinor / 100);
    final duplicate = c.reviewStatus == 'possible_duplicate';
    final kind = c.transactionType == 'income'
        ? (_en ? 'Income' : 'Ingreso')
        : _en
        ? 'Expense'
        : 'Gasto';
    final dateLabel =
        (c.provider == 'gmail' ? 'Gmail' : 'Outlook') +
        ' · ' +
        c.occurredOn +
        ' · ' +
        kind;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.merchant,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text(dateLabel),
                    ],
                  ),
                ),
                Text(
                  money,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            if (duplicate) ...[
              const SizedBox(height: 8),
              Text(
                _en
                    ? 'A similar movement exists. Confirm only if it should be a separate transaction.'
                    : 'Hay un movimiento parecido. Confirma solo si debe registrarse como una transacción distinta.',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 10),
            TextField(
              controller: _category,
              maxLength: 120,
              decoration: InputDecoration(
                labelText: _en ? 'Category' : 'Categoría',
                counterText: '',
              ),
            ),
            DropdownButtonFormField<String>(
              initialValue: _payment,
              decoration: InputDecoration(
                labelText: _en ? 'Payment method' : 'Medio de pago',
              ),
              items: [
                DropdownMenuItem(
                  value: 'cash',
                  child: Text(_en ? 'Cash' : 'Efectivo'),
                ),
                DropdownMenuItem(
                  value: 'debit_card',
                  child: Text(_en ? 'Debit card' : 'Tarjeta de débito'),
                ),
                DropdownMenuItem(
                  value: 'credit_card',
                  child: Text(_en ? 'Credit card' : 'Tarjeta de crédito'),
                ),
                DropdownMenuItem(
                  value: 'bank_transfer',
                  child: Text(_en ? 'Bank transfer' : 'Transferencia bancaria'),
                ),
                DropdownMenuItem(
                  value: 'other',
                  child: Text(_en ? 'Other' : 'Otro'),
                ),
              ],
              onChanged: _busy
                  ? null
                  : (v) {
                      if (v != null) setState(() => _payment = v);
                    },
            ),
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            Wrap(
              spacing: 8,
              children: [
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => _submit(duplicateConfirmed: duplicate),
                  child: Text(
                    _busy
                        ? (_en ? 'Please wait…' : 'Espera…')
                        : duplicate
                        ? (_en ? 'Register as new' : 'Registrar como nuevo')
                        : _en
                        ? 'Register movement'
                        : 'Registrar movimiento',
                  ),
                ),
                TextButton(
                  onPressed: _busy ? null : _ignore,
                  child: Text(_en ? 'Ignore' : 'Ignorar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
