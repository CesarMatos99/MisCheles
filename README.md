# MisCheles

MisCheles mantiene su cliente web en React y agrega un cliente Android en Flutter. Ambos comparten el contrato financiero y el esquema de cuentas Firebase/Firestore. La arquitectura separa los registros ficticios, el uso local sin cuenta y la cuenta sincronizada.

## Modos de uso

- **Demostración:** registros de ejemplo aislados.
- **Local:** web guarda en el navegador; Android guarda en una base SQLCipher protegida por una clave del dispositivo. No requiere cuenta.
- **Cuenta:** Firebase Authentication y Firestore sincronizan registros por UID entre web y Android. Requiere configurar Firebase para cada plataforma.

Los datos locales no se borran al crear una cuenta. La aplicación ofrece una vista previa y permite seleccionar qué registros migrar. Gmail y Outlook están contemplados en el modelo y el contrato backend; la conexión OAuth y el procesamiento de mensajes todavía no están habilitados.

## Probar la web

Con Docker Desktop activo, desde la raíz:

```powershell
docker compose up --build -d
```

Abre [http://localhost:5174](http://localhost:5174). Para ver los registros usa `docker compose logs -f web`; para detener el contenedor usa `docker compose down`.

## Probar Android

Abre `mobile/mischeles_flutter` en VS Code con Flutter y Android SDK configurados. Ejecuta `flutter pub get` y `flutter run` para probar demo y almacenamiento local. La sincronización requiere configuración Firebase; la guía [DESARROLLO.md](DESARROLLO.md) explica los emuladores y sus banderas de configuración.

## Estructura

- `src/`: cliente web React, módulos y componentes.
- `src/domain/`: cálculos financieros y divisas del cliente web.
- `src/firebase/`: Auth, sincronización y repositorios Firestore web.
- `src/services/localMigrationService.ts`: vista previa y migración segura del almacenamiento web.
- `mobile/mischeles_flutter/`: cliente Android, dominio Dart, SQLCipher y Firebase.
- `shared/`: codec Firestore y vectores que comprueban el contrato financiero entre React y Flutter.
- `functions/`: funciones backend y contrato seguro para candidatos de notificaciones bancarias.
- `firestore.rules`: reglas de acceso por UID con denegación por defecto.

## Estado de configuración

El repositorio no incluye credenciales y no se ha creado un proyecto Firebase real. La cuenta requiere configurar las aplicaciones Firebase; los tokens OAuth de correo no se guardan en los clientes. El ID Android provisional es `com.mischeles.app`; debe confirmarse antes de publicar.

Consulta [DESARROLLO.md](DESARROLLO.md) para comandos y estado de verificación, y [la auditoría de arquitectura](docs/ARQUITECTURA-MULTIPLATAFORMA-Y-AUDITORIA.md) para decisiones, riesgos y etapas.
