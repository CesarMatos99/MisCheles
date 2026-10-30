# MisCheles: producto y arquitectura

## Experiencia del producto

MisCheles ayuda a entender cuánto dinero hay disponible, cuánto se ha gastado y qué parte está reservada. La interfaz debe sentirse continua: jerarquía tipográfica, espacio en blanco y separadores discretos. Las tarjetas se reservan para una decisión o dato que necesite énfasis.

La navegación prioriza Inicio, Movimientos, Presupuesto/Ahorro y Perfil. Las acciones de gasto, ingreso y transferencia son botones flotantes redondos con iconos, etiquetas accesibles y posiciones que respetan la navegación inferior y el área segura del dispositivo.

El usuario elige un color de acento, que debe mantener contraste legible en los temas claro y oscuro. El tema y el acento son preferencias visuales independientes.

## Reglas financieras

- Un gasto guarda monto, fecha, categoría, cuenta de origen y descripción opcional.
- Categorías personalizadas se guardan como categorías reutilizables; "Regalo" puede ser la categoría y "Para Juan" la descripción.
- Transferir dinero entre cuentas propias cambia sus saldos, no los ingresos ni los gastos consolidados.
- Retirar efectivo es una transferencia a una cuenta de efectivo. El usuario puede dejar el retiro como saldo de efectivo o desglosarlo en compras hijas. El informe cuenta las compras detalladas y no vuelve a contar el retiro como gasto.
- Una devolución revierte o compensa una operación con referencia a la original.
- Un pago de tarjeta reduce la deuda; las compras de tarjeta se registran como gasto una sola vez.
- Una operación bancaria importada conserva proveedor, buzón, mensaje de origen y estado de revisión.
- Si un movimiento manual coincide en monto, fecha, comercio y cuenta con uno importado, ofrecer vincular, registrar como otro o cancelar. Nunca descartar automáticamente una operación.

## Separación técnica

```text
Interfaz React
    ├── features/dashboard
    ├── features/transactions
    ├── features/savings
    └── features/profile
Servicios de aplicación
    ├── reglas de presupuesto y contabilización
    ├── importación y conciliación
    └── exportación y respaldo
Adaptadores de datos
    ├── web: IndexedDB
    ├── Android: SQLite mediante Capacitor
    └── nube opcional: API autenticada con autorización por usuario
```

Los componentes de pantalla no deben escribir directamente en almacenamiento. Las reglas financieras deben poder probarse sin navegador y cada operación de varias partes debe guardarse de forma atómica para evitar movimientos huérfanos.

## Seguridad y privacidad

- No incluir datos personales, PIN predeterminados ni secretos en el código distribuido.
- Un PIN local no equivale a cifrado. La protección de datos y credenciales debe diseñarse por plataforma.
- La cuenta de MisCheles es opcional. Vincular un correo para importación es un consentimiento separado del respaldo.
- Usar OAuth oficial de proveedores de correo; no solicitar ni almacenar contraseñas de Gmail u Outlook.
- Solicitar permisos mínimos, explicar alcance y retención, permitir desconectar buzones y borrar los datos derivados.
- Evitar almacenar cuerpos de correo. Extraer el mínimo dato transaccional necesario y borrar el contenido temporal.
- Aplicar autorización por usuario en servidor, limitar registros y no registrar tokens ni datos financieros en logs.
- Publicación requiere política de privacidad, declaración de seguridad de datos y flujo de eliminación de cuenta.

## Etapas de entrega

1. Consolidar diseño visual adaptable y navegación.
2. Definir y aislar el dominio financiero; corregir asociaciones de ahorro y transferencias.
3. Añadir almacenamiento versionado, respaldo/exportación y migraciones.
4. Incorporar cuentas, efectivo y tarjetas con conciliación.
5. Preparar integración Capacitor y almacenamiento nativo.
6. Añadir acceso opcional, sincronización y eliminación de cuenta.
7. Investigar bancos y proveedores de correo, conseguir ejemplos anonimizados y desarrollar conectores autorizados.
8. Realizar pruebas financieras, de seguridad y dispositivos antes de publicar.

Cada etapa debe quedar en un commit pequeño y reversible. La versión de producción y la instancia de prueba usan directorios y puertos distintos.
