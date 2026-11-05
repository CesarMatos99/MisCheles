import 'package:flutter/widgets.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await MisChelesApp.initialize();
  runApp(const MisChelesApp());
}
