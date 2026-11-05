import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mischeles_flutter/app.dart';

void main() {
  testWidgets('shows demo, local, and account entry modes', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ModeChooser(language: 'es', onLanguageChange: (_) {}),
      ),
    );

    expect(find.text('MisCheles'), findsOneWidget);
    expect(find.text('Probar la app'), findsOneWidget);
    expect(find.text('Usar sin cuenta'), findsOneWidget);
    expect(find.text('Iniciar sesión o crear cuenta'), findsOneWidget);
  });

  testWidgets('disables account access until Firebase is configured', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ModeChooser(language: 'es', onLanguageChange: (_) {}),
      ),
    );

    expect(
      find.text('La sincronización en la nube aún no está configurada.'),
      findsOneWidget,
    );
    final tileFinder = find.ancestor(
      of: find.text('Iniciar sesión o crear cuenta'),
      matching: find.byType(ListTile),
    );
    final tile = tester.widget<ListTile>(tileFinder);
    expect(tile.enabled, isFalse);
    expect(tile.onTap, isNull);
  });

  testWidgets('changes the selected language through its selector', (
    tester,
  ) async {
    String? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: ModeChooser(
          language: 'es',
          onLanguageChange: (value) => selected = value,
        ),
      ),
    );

    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('English').last);
    expect(selected, 'en');
  });
}
