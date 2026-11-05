# CORRECCIONES INTEGRALES DE MIS CHELES — REACT

Necesito que revises y corrijas los problemas funcionales, financieros y visuales que se muestran en las capturas adjuntas.

Esta tarea forma parte de la finalización de React. No comiences Flutter ni cambies la arquitectura aprobada.

**IMPORTANTE:** No quiero soluciones superficiales ni cambios aislados de CSS. Revisa los componentes, servicios, estados, modelos y flujos que originan cada problema. Conserva las funcionalidades existentes y evita duplicar lógica.

## 1. ESTADÍSTICAS: ORGANIZACIÓN Y FILTROS

La pantalla de Estadísticas presenta demasiada información simultáneamente y no facilita su interpretación.

Rediseña su organización para que el usuario pueda seleccionar qué información desea consultar.

Incorpora filtros funcionales para:
- Período: mes, año, últimos 6 meses, últimos 12 meses y rango personalizado.
- Categoría.
- Tipo de movimiento, cuando corresponda.
- Comparación entre períodos.

Organiza los indicadores de manera jerárquica:
- Resumen financiero.
- Ingresos y gastos.
- Dinero destinado a ahorro.
- Dinero disponible.
- Análisis por categorías.
- Comparaciones y evolución.

Evita mostrar todos los detalles al mismo tiempo. Los filtros deben actualizar los indicadores, gráficos y resultados de forma coherente.

Elimina el texto o bloque explicativo que aparece al final de Estadísticas si resulta redundante o no aporta información relevante.

Actualmente aparecen dos botones «Exportar» o «Exportar Reporte». Deja solamente uno, con una ubicación consistente.

## 2. UNIFICAR EL DISEÑO DEL MÓDULO AHORRO

Revisa la segunda captura y compara el módulo Ahorro con Inicio, Registro y Estadísticas.

La estructura visual de todo el proyecto debe mantener un mismo sistema de diseño:
- Ancho del contenido.
- Márgenes y espaciados.
- Encabezados.
- Tipografía y jerarquía.
- Botones.
- Tarjetas.
- Bordes y radios.
- Navegación.
- Comportamiento responsive.

No significa que todas las pantallas deban tener la misma distribución, sino que deben sentirse parte de la misma aplicación.

Conserva la identidad visual actual de Mis Cheles.

## 3. CORREGIR EL REGISTRO DE MOVIMIENTOS DESDE UNA META

Este es un problema funcional importante.

Cuando el usuario entra en una meta de ahorro y pulsa el botón «+», actualmente aparece un formulario o selector que muestra todas las metas.

Eso no debe ocurrir.

Si el usuario entra en una meta específica, el formulario debe conocer automáticamente esa meta y permitir registrar directamente:
- Aporte a esa meta.
- Retiro de esa meta, si está permitido por las reglas actuales.

La meta debe quedar preseleccionada y no debe mostrarse un selector innecesario con todas las metas.

Aplica el mismo principio contextual a los demás módulos y categorías: cuando el usuario inicia una operación desde un elemento específico, el formulario debe utilizar ese contexto.

## 4. REVISAR TODOS LOS MODALES Y FORMULARIOS

Audita los puntos de entrada de:
- Gastos.
- Ingresos.
- Aportes a ahorro.
- Retiros de ahorro.
- Aportes a metas.
- Retiros de metas.
- Edición de movimientos.
- Operaciones desde categorías.
- Operaciones desde el módulo Ahorro.
- Operaciones desde Inicio.

Los formularios deben presentar únicamente los campos relevantes para la operación seleccionada.

Evita mostrar selectores, campos o listas que no correspondan al contexto.

## 5. CORREGIR LA CATEGORÍA AHORROS

Actualmente, cuando se agrega dinero a la categoría «Ahorros», se representa como dinero gastado.

Esto es incorrecto desde el punto de vista de la presentación financiera.

Cuando el usuario destina dinero a ahorro:
- Debe disminuir el dinero disponible del mes.
- Debe aumentar el dinero acumulado en ahorro.
- No debe contabilizarse como gasto de consumo.
- No debe aparecer como dinero gastado en la categoría.
- Debe mostrarse como dinero ahorrado, aportado o destinado a ahorro.

Revisa las pantallas Inicio, Registro, Ahorro y Estadísticas para mantener una representación coherente.

## 6. CONECTAR LOS APORTES DE INICIO CON EL MÓDULO AHORRO

Si desde Inicio el usuario registra dinero en la categoría «Ahorros», ese importe debe aparecer en el módulo Ahorro.

Al registrar el movimiento desde Inicio, debe poder seleccionar el destino:

- Ahorro general.
- Una meta de ahorro específica.

Si selecciona una meta, el aporte debe incrementar el progreso de esa meta.

Si selecciona ahorro general, debe incrementar el fondo de ahorro general.

El movimiento debe quedar correctamente relacionado con su destino y reflejarse en todos los módulos.

No debe ser necesario registrar el mismo aporte dos veces.

## 7. CORREGIR LA CONTABILIZACIÓN DE LOS AHORROS

Revisa la captura donde el ahorro aparece como gasto.

Comprueba las fórmulas y servicios responsables de:
- Gastos totales.
- Gastos por categoría.
- Disponible mensual.
- Dinero destinado a ahorro.
- Saldo acumulado de ahorro.
- Progreso de metas.
- Estadísticas y porcentajes.

Respeta las reglas financieras aprobadas:

- Los aportes a ahorro son transferencias internas, no consumo.
- Los aportes disminuyen el dinero disponible del mes.
- Los retiros de ahorro aumentan el disponible, pero no son ingresos nuevos.
- Los gastos pagados directamente desde ahorro cuentan como consumo, pero no deben descontarse otra vez del efectivo mensual.
- Las transferencias entre fondos propios no deben duplicar movimientos ni saldos.

Si existen movimientos espejo, conserva su relación mediante identificadores y evita contabilizarlos dos veces.

No soluciones un problema visual modificando artificialmente los importes o las fórmulas.

## 8. CREAR UN SISTEMA REUTILIZABLE DE MODALES

Quiero mejorar la arquitectura de los formularios y modales.

Revisa los modales existentes y crea componentes reutilizables cuando tenga sentido.

El sistema debe permitir:
- Título y descripción configurables.
- Contenido dinámico.
- Acciones principales y secundarias.
- Validaciones.
- Mensajes de error.
- Estados de carga.
- Confirmaciones para operaciones importantes.
- Cierre y cancelación consistentes.
- Diseño responsive.
- Accesibilidad y navegación por teclado.

Los formularios específicos deben conservar su lógica de negocio, pero utilizar una estructura visual compartida.

Evita crear un componente excesivamente complejo que concentre toda la lógica de la aplicación.

Separa responsabilidades:
- Contenedor modal reutilizable.
- Componentes de formulario.
- Validaciones.
- Servicios financieros.
- Operaciones de persistencia.

Simplifica el diseño actual: menos elementos simultáneos, mejor jerarquía visual y campos más claros.

## 9. PRUEBAS OBLIGATORIAS

Después de implementar los cambios, prueba al menos estos escenarios:

1. Registrar un gasto normal y verificar que disminuya el disponible y aumente el consumo.
2. Registrar un aporte a ahorro general desde Inicio.
3. Comprobar que aparezca en el módulo Ahorro.
4. Registrar un aporte a una meta desde Inicio.
5. Comprobar que se actualice la meta correspondiente.
6. Entrar en una meta y registrar un aporte con el botón «+», sin mostrar otras metas.
7. Registrar un retiro de ahorro y comprobar su efecto en el disponible.
8. Registrar un gasto pagado directamente desde ahorro.
9. Comprobar que los aportes no aparezcan como gastos de consumo.
10. Comprobar que los movimientos espejo no dupliquen saldos.
11. Revisar los filtros de Estadísticas.
12. Comprobar que la exportación de reportes siga funcionando.

Ejecuta las pruebas automatizadas disponibles y la compilación de React. Si alguna prueba está bloqueada por el entorno, identifica el bloqueo sin afirmar que pasó.

## 10. CRITERIOS DE CALIDAD

- No elimines funcionalidades existentes.
- No cambies reglas financieras aprobadas.
- No introduzcas datos ficticios en la aplicación real.
- No dupliques componentes ni servicios innecesariamente.
- Mantén compatibilidad con Firebase y la arquitectura actual.
- Conserva el diseño responsive.
- No desarrolles Flutter durante esta tarea.

Al terminar, entrega un informe con los cambios realizados, los escenarios probados, los resultados y cualquier pendiente.

**Objetivo: dejar las pantallas y operaciones de React coherentes, sencillas, reutilizables y financieramente correctas para que pueda comenzar mis pruebas personales.**