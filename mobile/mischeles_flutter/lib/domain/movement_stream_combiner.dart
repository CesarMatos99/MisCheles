import 'dart:async';

/// Combines two live record collections after both have emitted and keeps
/// publishing the latest snapshot from each source.
Stream<List<T>> combineMovementCollections<T>({
  required Stream<List<T>> first,
  required Stream<List<T>> second,
  required String Function(T) occurredOn,
}) {
  late StreamController<List<T>> controller;
  StreamSubscription<List<T>>? firstSubscription;
  StreamSubscription<List<T>>? secondSubscription;
  List<T>? firstRecords;
  List<T>? secondRecords;

  void publish() {
    if (!controller.hasListener ||
        firstRecords == null ||
        secondRecords == null) {
      return;
    }
    final combined = <T>[...firstRecords!, ...secondRecords!];
    combined.sort((a, b) => occurredOn(b).compareTo(occurredOn(a)));
    controller.add(combined);
  }

  controller = StreamController<List<T>>();
  controller.onListen = () {
    firstSubscription = first.listen((records) {
      firstRecords = records;
      publish();
    }, onError: controller.addError);
    secondSubscription = second.listen((records) {
      secondRecords = records;
      publish();
    }, onError: controller.addError);
  };
  controller.onCancel = () async {
    await firstSubscription?.cancel();
    await secondSubscription?.cancel();
  };
  return controller.stream;
}
