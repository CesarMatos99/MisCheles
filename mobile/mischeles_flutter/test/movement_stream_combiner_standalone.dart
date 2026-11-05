import 'dart:async';

import '../lib/domain/movement_stream_combiner.dart';

Future<void> main() async {
  final first = StreamController<List<Map<String, String>>>();
  final second = StreamController<List<Map<String, String>>>();
  var firstCancelled = false;
  var secondCancelled = false;
  first.onCancel = () => firstCancelled = true;
  second.onCancel = () => secondCancelled = true;
  final snapshots = <List<Map<String, String>>>[];
  final errors = <Object>[];
  final subscription = combineMovementCollections(
    first: first.stream,
    second: second.stream,
    occurredOn: (record) => record['occurredOn']!,
  ).listen(snapshots.add, onError: errors.add);

  first.add([
    {'id': 'expense', 'occurredOn': '2026-10-03'},
  ]);
  await Future<void>.delayed(Duration.zero);
  assert(snapshots.isEmpty, 'wait until both collections emit');
  second.add([
    {'id': 'saving', 'occurredOn': '2026-10-04'},
  ]);
  await Future<void>.delayed(Duration.zero);
  assert(snapshots.length == 1);
  assert(
    snapshots.last.map((item) => item['id']).join(',') == 'saving,expense',
  );

  first.add([
    {'id': 'new-expense', 'occurredOn': '2026-10-05'},
  ]);
  await Future<void>.delayed(Duration.zero);
  assert(snapshots.length == 2);
  assert(
    snapshots.last.map((item) => item['id']).join(',') == 'new-expense,saving',
    'retain the latest second-collection snapshot when the first changes',
  );

  final failure = StateError('offline');
  first.addError(failure);
  await Future<void>.delayed(Duration.zero);
  assert(errors.length == 1 && identical(errors.single, failure));

  await subscription.cancel();
  await Future<void>.delayed(Duration.zero);
  assert(firstCancelled && secondCancelled, 'cancel both Firestore listeners');
  await first.close();
  await second.close();
  print('Live movement stream combiner: PASS');
}
