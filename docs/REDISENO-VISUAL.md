# Rediseño visual de MisCheles

## Alcance

Trabajo web sobre `feat/paypal-inspired-redesign`, desde el respaldo `d21aff7`
publicado en `feat/flutter-firebase-foundation`. No cambia reglas financieras,
persistencia, sincronización, autenticación, exportadores, Functions o Flutter.

La inspiración visual utiliza azul marino, azul de acción, superficies blancas
y fondo cálido; conserva la marca MisCheles, sus iconos y Plus Jakarta Sans.
Las preferencias de tema y acento ya guardadas se conservan.

## Sistema compartido

- Tokens de color y tipografía, variantes de Tailwind y tema oscuro en `src/index.css`.
- `PageHeader`, `PeriodSelector`, `ExportButton` y `MoneyField` mantienen sus props.
- `ModalShell`, `ModalSurface` y `FilterPanel` conservan sus eventos y ciclo de foco.
- Navegación móvil: Inicio, Registro, Estadísticas y Ahorro. Perfil en la cabecera.
- Áreas seguras, controles flexibles, importes que pueden partir línea y modales
  con altura máxima y desplazamiento interno.

## Pantallas

- Inicio: saldo disponible, ingresos y gastos del mes, transferencias al ahorro,
  saldo ahorrado, presupuestos y movimientos recientes. La clasificación de
  aportes reutiliza `isSavingsContributionTransaction`.
- Registro: búsqueda y filtros existentes, acciones visibles y filas que se
  reordenan en móvil sin cambiar los criterios ni las operaciones.
- Ahorro: saldo separado de objetivos, metas y progreso; historial del mes en
  la misma pantalla. La confirmación de eliminación reutiliza el modal común
  y conserva las tres resoluciones de saldo existentes.
- Estadísticas: mantiene Resumen, Categorías, Comparar y Evolución. Cabecera
  compartida, filtros integrados y barras horizontales en lectura rápida.
- Perfil, formularios y exportación: misma jerarquía visual y botones comunes.
  El contenido y las fórmulas de los archivos exportados permanecen intactos.

## Verificaciones ejecutadas

- `bun run test`: 167 pruebas correctas, cero fallos.
- `bun run lint`: TypeScript sin errores.
- `bun run build`: build y generación PWA correctos.
- Render estático de las cuatro vistas financieras con datos sintéticos y sin
  movimientos: correcto, sin NaN/Infinity ni mutaciones de los datos recibidos.
- Las cinco rutas devuelven HTTP 200 con la entrada SPA en un preview local
  independiente; esto verifica el servicio de rutas, no la interacción React.
- GitNexus MCP: análisis de impacto previo y `detect_changes` antes de commits.
- Sin diferencias de contenido respecto a `d21aff7` en dominio, servicios,
  aplicación, navegación, Functions, shared o Flutter.

El build conserva las advertencias previas de bundle grande y futura
compatibilidad del cargador de configuración de Vite. No se cambió su
configuración como parte del rediseño.

## Verificación interactiva pendiente

El host de navegador de la sesión no está disponible. No se declara aprobada
la comprobación visual real ni la apertura/cierre interactivo de modales.
No se reconstruyó ni modificó Docker o su servicio en localhost:5174.

Cuando haya navegador disponible, comprobar en 320, 390, 768 y 1280 px, en
ambos temas: ausencia de desplazamiento horizontal; filtros de movimientos y
estadísticas; cambio de período; formularios; foco, Escape y cierre de modales;
detalle de categoría y meta; las cuatro secciones estadísticas; configuración
de perfil y generación de PDF/Excel con datos de prueba.

GitNexus sigue sin FTS y sin embeddings. Las consultas estructurales funcionan;
sus límites de exploración de flujos impiden interpretar ausencias como prueba
de que no existen dependencias.
