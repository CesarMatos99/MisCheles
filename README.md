# MisCheles

Aplicación para organizar ingresos, gastos, presupuesto mensual y ahorro. La interfaz se comparte entre web y Android; la capa de almacenamiento y las integraciones nativas se conectarán por plataforma.

## Desarrollo

Este repositorio usa Bun, Vite, React y TypeScript. Con Docker Desktop activo:

```powershell
docker compose up --build -d
```

La web estará en `http://localhost:5174`. Los cambios en `src/` se reflejan en el navegador. Para ver los registros usa `docker compose logs -f web`; para detener el servicio usa `docker compose down`.

## Estructura

```text
src/
  components/       # Elementos compartidos, navegación, diálogos y controles
  features/         # Pantallas agrupadas por dominio funcional
  constants/        # Categorías y opciones de catálogo
  hooks/            # Estado y comportamiento reutilizable
  services/         # Persistencia y exportación
  types/            # Contratos de datos
  App.tsx           # Composición de la aplicación y estado de navegación
```

Las decisiones de producto, contabilidad y seguridad están en `docs/PRODUCTO-Y-ARQUITECTURA.md`.

## Estado actual

El prototipo todavía usa `localStorage`, incluye datos demostrativos y no implementa autenticación, respaldo en la nube, base SQLite nativa ni importación bancaria. La interfaz actual es una propuesta de rediseño en curso; aún requiere revisión visual y compilación antes de reemplazar la versión principal.
