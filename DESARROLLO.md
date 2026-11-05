# Desarrollo local de MisCheles

La rama feat/flutter-firebase-foundation conserva el cliente web React y añade el cliente Android Flutter. El modo local funciona sin crear cuenta; las cuentas requieren configurar Firebase por entorno. No se han creado recursos Firebase/Google Play ni se han desplegado reglas o funciones.

## Web con Docker

Con Docker Desktop iniciado y contenedores Linux activos, desde la carpeta del proyecto ejecuta en PowerShell:

```powershell
docker compose up --build
```

Abre http://localhost:5174. Para detener, usa Ctrl+C y docker compose down. Para segundo plano, usa docker compose up -d --build.

El Dockerfile usa bun install durante esta etapa porque package.json ya incluye Firebase y bun.lock todavía no se ha regenerado. Antes de un build reproducible, ejecuta bun install --lockfile-only con Bun y conexión al registro, versiona bun.lock y restaura --frozen-lockfile en el Dockerfile. Este entorno de Codex no pudo conectarse al registro npm, así que el lockfile sigue pendiente.

## Firebase Emulator Suite

El proyecto local apunta al ID de demostración demo-mischeles y configura Auth en el puerto 9099 y Firestore en 8080, enlazados a 127.0.0.1. No cambies .firebaserc a un proyecto real para pruebas de rutina.

```powershell
firebase emulators:start --only auth,firestore,functions --project demo-mischeles
```

En la web, habilita VITE_FIREBASE_USE_EMULATORS=true en el entorno local. Para Android Emulator usa adb reverse tcp:9099 tcp:9099 y adb reverse tcp:8080 tcp:8080, y ejecuta Flutter con --dart-define=FIREBASE_USE_EMULATORS=true. No se verificó una sesión real contra Emulator Suite en este entorno.

## Android Flutter

El proyecto se encuentra en mobile/mischeles_flutter. Flutter usa almacenamiento local SQLCipher para modo local/demo y Firestore para la cuenta autenticada. El manifiesto solicita Internet para Firebase y excluye los datos locales de Auto Backup y de las transferencias Android entre dispositivos; la copia entre dispositivos se realiza mediante la sincronización explícita de una cuenta MisCheles. El ID Android provisional es com.mischeles.app; no debe publicarse antes de confirmar identidad, firma y configuración Firebase.

Para preparar herramientas/dependencias localmente, abre mobile/mischeles_flutter en VS Code con Flutter y Android SDK configurados; luego ejecuta flutter pub get, flutter analyze y flutter test. En este entorno, pub get no logró conectarse a pub.dev y falta una dependencia SQLCipher en la caché, así que el build APK sigue sin verificarse. El análisis del dominio financiero Dart sí pasa.

## Estructura

- src/: aplicación React, módulos y componentes web existentes.
- src/domain/: cálculos financieros y divisas independientes de la UI.
- src/firebase/: autenticación, repositorio Firestore, sincronización y llamadas protegidas.
- functions/: limpieza de cuenta autenticada y contrato base para importaciones; requiere Firebase CLI y dependencias locales para probarlo.
- src/services/localMigrationService.ts: vista previa y copia segura de datos web a una cuenta.
- mobile/mischeles_flutter/: cliente Android, dominio, almacenamiento local cifrado y repositorios Firebase.
- shared/: contrato versionado y vectores de resumen financiero para comparar clientes.
- functions/src/mail_import_contract.ts: contrato backend y deduplicación para futura lectura autorizada de Gmail/Outlook; no incluye OAuth ni procesamiento ejecutable.
- firestore.rules: reglas locales; requieren pruebas en emulador antes de cualquier despliegue.
- docs/ARQUITECTURA-MULTIPLATAFORMA-Y-AUDITORIA.md: arquitectura, decisiones, riesgos y avance detallado.

## Verificación actual

- Rama: feat/flutter-firebase-foundation.
- Pruebas TypeScript de dominio, migración, almacenamiento, sincronización y contratos backend: 49/49 pasan en una copia temporal con resolución de imports para Node 24.
- Pruebas Dart standalone: 8/8 pasan, incluido el contrato financiero compartido y la selección de registros para migrar. dart analyze del mapeador de migración no reporta problemas.
- Dart format verifica los archivos Flutter editados; no detecta cambios de formato pendientes. git diff --check y la revisión de espacios en fuentes/documentación pasan.
- React ofrece demo, local sin cuenta y cuenta; Flutter contempla demo, local SQLCipher y cuenta. La migración selectiva conserva los originales.
- No se pudo completar dart pub get ni pnpm install: Pub.dev y npm registry fallan con errores de red/EACCES aunque se autorizó la conexión. Sin dependencias no se pueden completar build web/Android, flutter analyze integral ni Firebase Emulator Suite. El formato/parser de Dart detectó y ayudó a corregir una duplicación de imports en app.dart; queda pendiente compilar Flutter con sus paquetes para validar tipos y APIs.
- No hay Firebase CLI ni Java disponibles; no existe proyecto Firebase real. No se crearon cuentas externas ni se desplegaron reglas o funciones. Docker daemon no está accesible en este entorno.

El almacenamiento web local conserva localStorage y separa demostración, modo local y UID de cuenta. La migración ofrece vista previa, selección por registro y conserva el origen. Android guarda demo/local en SQLCipher con clave en almacenamiento seguro y excluye los datos del respaldo automático. El PIN/biometría web existente no constituye cifrado ni debe presentarse como autenticación fuerte.
