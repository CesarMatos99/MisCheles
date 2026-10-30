# Desarrollo local de MisCheles

Abre esta carpeta en VS Code. Se conserva Bun y su archivo de bloqueo del proyecto original.

## Docker

Con Docker Desktop iniciado y contenedores Linux activos, ejecuta en la terminal de VS Code:

```powershell
docker compose up --build
```

Abre http://localhost:5174. Edita archivos de src/ y guarda para ver los cambios. El puerto 5174 evita usar los habituales 3000 y 5173. Si esta ocupado:

```powershell
$env:MISCHELES_PORT = '5180'
docker compose up --build
```

Para detener: Ctrl+C y luego `docker compose down`. Para ejecutar en segundo plano: `docker compose up -d --build`. Para ver errores: `docker compose logs -f web`.

Al cambiar package.json o bun.lock, reconstruye con `docker compose up --build`. Las dependencias quedan en la imagen; no se montan node_modules de Windows.

## Verificaciones

Con el contenedor activo:

```powershell
docker compose exec web bun run lint
docker compose exec web bun run build
```

La configuracion Docker fue preparada pero no ejecutada en el entorno de Codex, donde no se detecto Docker. La primera construccion debe confirmar la disponibilidad de las dependencias del ZIP original.

## Estructura actual

- src/App.tsx: estado principal, navegacion y modales.
- src/components/: pantallas y componentes visuales.
- src/services/storage.ts: almacenamiento y calculos financieros actuales.
- src/services/biometricService.ts: autenticacion actual, pendiente de revision.
- src/services/exportService.ts: reportes.
- src/types/: tipos de datos.
- src/hooks/: comportamiento reutilizable.
- src/index.css: estilos.
- public/: iconos y recursos.
- vite.config.ts: servidor, compilacion y PWA.
- compose.yaml y Dockerfile: entorno de desarrollo.

## Datos y pruebas

La version original inicia con datos de demostracion y PIN 1234. No usar aun con datos reales. Los datos actuales estan en el navegador (localStorage), no en Docker. Cambiar de navegador, puerto u origen crea otro almacenamiento; detener el contenedor no borra los datos del navegador. La PWA se desactiva en desarrollo para evitar versiones antiguas cacheadas; permanece habilitada en la compilacion de produccion.

Para ver el diseno movil usa las herramientas de desarrollador del navegador. Para abrir en un celular de la misma red usa http://IP-DE-LA-PC:5174 y permite el puerto en el firewall solo para redes privadas. No es equivalente a probar Android nativo: algunas APIs necesitan HTTPS o un contexto seguro.

Capacitor, SQLite, el backend y los conectores bancarios todavia no estan implementados. Las pruebas de Android se incorporaran con Android Studio y un emulador o dispositivo real. No publicar una compilacion que dependa del servidor local de desarrollo.
