# MisCheles — cliente Android Flutter

Este proyecto contiene la base Flutter para Android. El identificador provisional de paquete es com.mischeles.app; confírmalo antes de publicar, ya que cambiarlo después de publicar crea otra aplicación en Play.

## Ejecutar en Android

Con Flutter, Android Studio y Android SDK instalados, desde esta carpeta ejecuta flutter pub get y después flutter run.

Flutter crea el local.properties de la máquina al ejecutar/compilar. No se incluye porque contiene rutas locales. El proyecto Android usa Kotlin, Gradle y el namespace provisional com.mischeles.app; la etiqueta es MisCheles y el launcher usa el icono de marca actual.

## Pruebas con Firebase Emulator Suite

Desde la raíz del repositorio, inicia solo los emuladores locales con firebase emulators:start --only auth,firestore,functions --project demo-mischeles. No se ha creado proyecto remoto y el alias de Firebase por defecto es demo-mischeles.

Para conectar Flutter Android al equipo anfitrión sin abrir puertos a la red local, con el dispositivo/emulador conectado ejecuta adb reverse tcp:9099 tcp:9099 y adb reverse tcp:8080 tcp:8080. Luego inicia con flutter run --dart-define=FIREBASE_USE_EMULATORS=true. Por defecto Flutter conecta a 127.0.0.1; puedes cambiarlo con FIREBASE_EMULATOR_HOST. En web, activa VITE_FIREBASE_USE_EMULATORS=true y el navegador usa 127.0.0.1. No actives el modo emulador en una compilación de producción.

## Firebase

La app arranca sin un proyecto Firebase. Para habilitar cuentas, define FIREBASE_API_KEY, FIREBASE_APP_ID, FIREBASE_MESSAGING_SENDER_ID y FIREBASE_PROJECT_ID mediante --dart-define. Para Google Sign-In en Android configura además GOOGLE_SERVER_CLIENT_ID con el ID OAuth público tipo Web y registra las huellas SHA-1/SHA-256 de firma en Firebase. No guardes secretos OAuth ni tokens bancarios en el cliente.

No se creó ningún proyecto, base de datos ni proveedor externo. Los modos demo y local usan espacios separados en almacenamiento local cifrado. La migración conserva el origen local y requiere vista previa y verificación de la copia remota.

### App Check

App Check para Android queda apagado por defecto y solo se activa si Firebase ya está configurado y se compila con `--dart-define=FIREBASE_APPCHECK_ENABLED=true`. Producción usa Play Integrity. Para una compilación debug conectada a un proyecto de prueba se puede seleccionar el proveedor debug con `--dart-define=FIREBASE_APPCHECK_DEBUG_PROVIDER=true`; el código fuerza Play Integrity en compilaciones release aunque se pase ese flag. Registra el token debug en Firebase Console y nunca lo uses en una compilación de Play. El modo Emulator Suite omite App Check. Registra las apps y revisa métricas en Firebase Console antes de activar enforcement. Este repositorio no activa enforcement ni publica cambios de consola.

## Verificación del dominio

Comandos desde esta carpeta (scripts autónomos, no requieren instalar Flutter packages):

dart test/financial_summary_contract_test.dart
dart test/movement_stream_combiner_standalone.dart
dart test/local_migration_mapper_standalone.dart
dart test/money_parser_standalone.dart
dart test/currency_preference_standalone.dart
dart test/category_localization_standalone.dart

Después de flutter pub get, ejecuta flutter test para las pruebas de widgets.

Desde la raíz del repositorio, dart mobile/mischeles_flutter/test/financial_summary_contract_test.dart verifica los vectores compartidos con la prueba TypeScript. Para compilar la app completa primero hay que instalar dependencias con flutter pub get; luego puedes comprobar el proyecto con flutter analyze y compilar un APK de depuración con flutter build apk --debug.
