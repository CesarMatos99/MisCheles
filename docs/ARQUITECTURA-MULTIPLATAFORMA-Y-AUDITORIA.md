## Puerta de revisión del usuario (2026-11-01)

La ejecución activa se limita a consolidar React y su integración Firebase. Cuando la web esté estable, ejecutable, probada y con los errores detectados corregidos, detener el avance y entregar informe, bloqueos e instrucciones de ejecución para revisión personal del usuario. Flutter no se retoma automáticamente: requiere autorización expresa posterior a esa revisión. Se conserva todo su código existente. Las correcciones solicitadas se aplicarán primero a React y se volverán a validar.

## Secuencia de ejecución vigente (2026-11-01)

React es la referencia funcional. Orden aprobado: consolidar y verificar React → estabilizar contratos TypeScript/Dart → completar Flutter existente → integración cruzada real. Se conserva todo el código previo. No se desarrollarán funcionalidades equivalentes en ambos clientes simultáneamente.

La finalización requiere evidencia de build y pruebas de ambos clientes, Firebase configurado, reglas y Functions probadas, sincronización real bidireccional, paridad financiera y migración sin pérdidas ni duplicados. Los contratos aislados no prueban esas integraciones. El avance se informará por funcionalidades verificadas, sin porcentajes estimados.

# MisCheles: auditoría y propuesta multiplataforma

Estado al 2026-11-01: implementación parcial en la rama feat/flutter-firebase-foundation. Hay cimientos React/Firebase, Flutter, reglas locales, migración y contrato de correo; faltan paridad funcional móvil, endurecimiento completo de autenticación, integración OAuth ejecutable y verificación con builds/emuladores. No se han creado recursos externos ni se han migrado/borrado registros. Esta auditoría se actualiza como estado vivo; las observaciones iniciales de abajo describen el checkout antes de esta rama.

## Resumen ejecutivo

El checkout contiene una aplicación web React 19 + TypeScript + Vite, organizada por módulos funcionales y ejecutada en desarrollo con Bun/Docker. La persistencia actual es local en el navegador. No se encontró Firebase, Firestore, reglas, backend de aplicación ni un proyecto Flutter en este repositorio. Por tanto, aquí no existe hoy una cuenta de usuario compartida ni sincronización entre dispositivos.

La solución recomendada es conservar React para la web y desarrollar Android en Flutter. Firebase Authentication y Cloud Firestore serían la identidad y fuente de datos compartida de las cuentas registradas. El modo sin cuenta permanece disponible con almacenamiento local de cada plataforma. Vincular correos bancarios será un consentimiento separado y opcional.

La arquitectura y el modelo deben contemplar desde ahora el origen de cada movimiento, la propiedad del usuario, la sincronización y la importación. La conexión OAuth y el procesamiento de correos pueden llegar en otra etapa, sin rehacer el modelo financiero.

## Hallazgos de la auditoría inicial (línea base histórica)

### Aplicación y persistencia

- React 19, TypeScript, Vite y Tailwind; PWA para instalación web. El Dockerfile y compose.yaml sirven el servidor Vite de desarrollo. No constituyen un backend de producción.
- src/services/storage.ts lee y escribe directamente en localStorage. Las preferencias de perfil, presupuesto, movimientos y metas no se guardan en un servidor.
- Las claves locales no identifican dueño ni tienen un esquema versionado común.
- El servicio genera registros de demostración al faltar ciertas claves. Puede quedar una mezcla de ejemplos y registros reales en el mismo navegador.
- El correo del perfil es un dato local editable, no una identidad verificada.
- UserProfile incluye pinCode; actualmente el PIN predeterminado es 1234 y se persiste como texto. No debe migrarse a una cuenta ni tratarse como contraseña.
- El bloqueo usa sessionStorage. La comprobación biométrica depende de WebAuthn sin un desafío de servidor registrado, y la pantalla contiene una ruta de desbloqueo simulado. No es una garantía de seguridad para una aplicación financiera.
- resetAllData ejecuta localStorage.clear(), lo que elimina todas las claves del origen, no solamente las de MisCheles. Debe sustituirse por borrado acotado y confirmado antes de ofrecer gestión real de cuentas.
- La exportación actual genera Excel y PDF; no hay un flujo de restauración/importación de respaldo validado.

### Dominio financiero

- Transaction tiene ingreso/gasto, monto, categoría, descripción, fecha de calendario y medio de pago en texto. No tiene hora, UID, notas, cuenta identificada, origen manual/importado ni referencia de importación.
- SavingsMovement separa aportes, retiros y gastos directos de ahorro. La asociación con una meta usa goalId; SavingsGoal también mantiene currentAmount. Al sincronizar habrá que definir una única fuente de verdad y mantener coherente el saldo con su historial.
- MonthConfig guarda ingreso inicial y arrastre; presupuesto y configuración mensual están separados de transacciones.
- No existe una entidad general de cuentas/carteras que represente efectivo, banco o tarjeta. El medio de pago es una cadena y no permite calcular saldos por cuenta.
- Los módulos actuales de inicio, movimientos, ahorros, estadísticas y perfil se pueden conservar como presentación; los cambios necesarios se concentran en servicios de datos, contratos y flujos de cuenta.
- La relación entre aportes de ahorro y transacciones enlazadas debe preservarse usando identificadores estables para evitar contar dos veces una operación.

### Firebase, autenticación y servicios externos

- No se encontró firebase.json, .firebaserc, reglas o índices de Firestore, carpeta de Cloud Functions, dependencia Firebase ni configuración de Android.
- Tampoco se encontró pubspec.yaml, por lo que Flutter todavía no forma parte del checkout.
- No hay operaciones Firebase Authentication. No hay registro, verificación, recuperación, sesiones, cuenta Google ni eliminación de cuenta.
- No es posible confirmar desde este repositorio si existe un proyecto Firebase en la consola externa. Antes de conectarlo se necesitará identificar el proyecto y comprobar su configuración sin modificarlo.
- package.json y .env.example mencionan Google GenAI/GEMINI_API_KEY. Hay que confirmar si esta capacidad se usa antes de tomar decisiones sobre ella; ninguna clave privada debe terminar en el bundle cliente.

## Riesgos prioritarios

1. **Pérdida o mezcla de datos al migrar.** La información actual está por origen/navegador y puede incluir datos de demostración. No hay identidad que permita asignar automáticamente los registros a una persona.
2. **Acceso local a finanzas.** localStorage no es una bóveda cifrada. El PIN está en texto y la biometría actual no debe presentarse como autenticación fuerte.
3. **Ausencia de aislamiento multiusuario.** No hay UID ni autorización; antes de sincronizar será obligatorio definir el dueño y denegar acceso a otros usuarios.
4. **Operaciones financieras parcialmente duplicadas.** Algunos aportes generan también una transacción enlazada. El esquema remoto debe conservar esa relación y hacer operaciones idempotentes.
5. **Eliminación demasiado amplia.** localStorage.clear() no está limitado a claves de MisCheles.
6. **Incompatibilidad documental.** La documentación previa nombra Capacitor/SQLite, mientras el objetivo actual es Flutter/Firebase. Debe quedar una sola arquitectura aprobada.
7. **Requisitos externos.** OAuth de Gmail puede requerir verificación adicional según los permisos; Google Play también requerirá política de privacidad, Data Safety y eliminación de cuenta.

## Arquitectura objetivo aprobada e iniciada

### Plataformas

- **Web:** mantener React y el diseño actual. Sin cuenta se conserva el modo local basado en localStorage; para sesión autenticada se usan Firebase Authentication y Firestore.
- **Android:** Flutter con los SDK oficiales de Firebase y las mismas rutas/contratos de Firestore.
- **Modo local sin cuenta:** en la web se conserva el almacenamiento actual del navegador con separación de espacios para demo y cuentas; no requiere registro y luego puede migrarse con vista previa. En Android se usa SQLite cifrado (SQLCipher) con clave protegida por el dispositivo.
- **Modo con cuenta:** Firestore es la fuente compartida; usar la persistencia offline oficial cuando esté disponible y reconciliar escrituras al reconectar.
- **Lógica financiera:** mover cálculos y reglas a un dominio independiente de React, Flutter y Firebase. Las pantallas llaman servicios de aplicación, no escriben directamente en localStorage o Firestore.

### Separación de identidad y correo bancario

- Una cuenta MisCheles se autentica con Firebase Authentication.
- Vincular Gmail u Outlook es opcional, requiere consentimiento OAuth independiente y nunca comparte ni solicita la contraseña del buzón.
- Un usuario puede usar cuenta y respaldo sin vincular correo; también puede usar la app local sin crear cuenta.
- Los secretos OAuth se procesan en backend. El cliente solo recibe estado de conexión y resultados autorizados. No guardar tokens de proveedor en localStorage, en Firestore legible por el usuario ni en logs.
- Las Cloud Functions/backend se reservan para operaciones que necesiten secreto, verificación, deduplicación central o limpieza coordinada. El resto puede usar Firebase con reglas estrictas por UID.

### Contrato de datos inicial

Cada entidad sincronizable tendrá identificador estable, ownerUid, schemaVersion, createdAt y updatedAt. Las fechas se almacenarán con una zona horaria definida; el movimiento conservará la fecha local del usuario y, si se captura, una hora separada.

Colecciones propuestas:

- users/{uid}: perfil financiero y preferencias no secretas.
- users/{uid}/transactions/{transactionId}: registro manual/importado con tipo, monto, categoría, descripción, fecha, paymentMethodId opcional, source, importCandidateId opcional y referencia de movimiento relacionado.
- users/{uid}/savingsMovements/{movementId}: aporte, retiro o pago directo, con goalId opcional y transactionId enlazado opcional.
- users/{uid}/savingsGoals/{goalId}: meta, objetivo y fechas; el saldo se deriva del saldo de apertura más los movimientos vinculados. En la migración desde React, currentAmount legado se trata como una instantánea que ya incluye esos movimientos: se resta el neto histórico para guardar el saldo de apertura. Si el neto excede la instantánea, se excluyen juntos la meta y sus movimientos vinculados para revisión, manteniendo intacta la fuente local.
- users/{uid}/monthConfigurations/{yyyy-MM}: inicio del mes, arrastre y preferencias.
- users/{uid}/categoryBudgets/{budgetId}: categoría, período y monto.
- users/{uid}/mailConnections/{connectionId}: proveedor, dirección autorizada, permisos otorgados, estado y cursor de sincronización; nunca tokens ni cuerpo de correo.
- users/{uid}/importedCandidates/{candidateId}: campos financieros mínimos extraídos, origen, hash/id de mensaje, estado pending_review/confirmed/ignored/possible_duplicate y enlace al movimiento confirmado. Antes de habilitar importaciones se debe fijar política y vencimiento de retención; el plazo aún no está decidido.

Para nuevas cuentas, la ruta por UID será la frontera primaria de aislamiento. Las reglas de Firestore verificarán request.auth.uid == uid y denegarán por defecto. La app no podrá escribir credenciales ni alterar campos administrados por backend. Las reglas se probarán con Firebase Emulator antes de desplegarlas.

## Contrato de saldos de metas

Las cuentas sincronizadas guardan en legacyBalanceMinor el saldo de apertura y reconstruyen el saldo actual sumando aportes y restando retiros/gastos directos asociados. Los datos locales antiguos de React mantienen currentAmount como instantánea del saldo final; durante la importación se descuenta el neto de su historial vinculado para evitar contabilizarlo dos veces. Las actualizaciones posteriores desde la sesión de cuenta conservan el saldo de apertura almacenado. Si el historial no concuerda y produciría un saldo de apertura negativo, la vista previa aparta la meta y su historial para revisión en lugar de subir registros huérfanos. Al cerrar una meta con saldo, los movimientos vinculados se conservan con balanceAffecting=false y se separan de la meta; un solo movimiento savings_reallocation pasa el importe al fondo general, o savings_withdrawal lo devuelve al mes. Los registros históricos siguen disponibles, pero ya no modifican el saldo activo ni vuelven a sumarse durante sincronización/migración.

## Migración sin reemplazar datos

1. Mantener el almacenamiento local actual intacto y generar una exportación legible antes de cualquier migración.
2. Detectar las claves locales existentes sin borrarlas ni sobrescribirlas. Mostrar un resumen de movimientos, metas y configuraciones a importar.
3. Permitir revisar y excluir registros de demostración, duplicados o información que el usuario no quiera subir.
4. Copiar a la cuenta autenticada con IDs estables y una operación idempotente; no mover ni borrar el origen durante la importación.
5. Verificar conteos y totales financieros antes/después y mostrar errores por registro.
6. Conservar exportación y posibilidad de reintentar/continuar; borrar datos locales solo mediante solicitud explícita de eliminación y después de confirmar copia/retención.
7. La migración de datos de cuentas existentes solo se ejecutará tras definir titularidad, política de privacidad y flujo aprobado.

### Almacenamiento local Android

La base SQLCipher y las preferencias de almacenamiento local quedan excluidas de Auto Backup y de la transferencia Android dispositivo a dispositivo. Esto conserva el modo local dentro del dispositivo donde se creó. El respaldo entre dispositivos se ofrece mediante la sincronización explícita de una cuenta MisCheles en Firestore. El manifiesto mantiene el permiso Internet necesario para Firebase.

## Importación futura de correos

1. Conector de proveedor solicita el alcance mínimo mediante OAuth.
2. Backend recibe mensajes autorizados y procesa solo notificaciones relevantes.
3. Parser crea candidato normalizado; no guarda el cuerpo completo salvo justificación y retención aprobada.
4. Deduplicar primero por proveedor + mensaje, después por referencia bancaria; como respaldo comparar entidad, monto, fecha/hora y últimos dígitos disponibles.
5. Una coincidencia con registro manual se marca como posible duplicado; nunca crea un segundo gasto automáticamente.
6. La opción de registro automático se habilita aparte, con reglas de confianza configurables y un historial de auditoría.
7. Desconectar revoca permisos, detiene sincronización y permite eliminar datos derivados según la política acordada.

## Plan de trabajo y puertas de aprobación

### Fase 0 — Aprobación de arquitectura (documentación)
- Confirmar si ya existe proyecto Firebase, su identificador y si contiene datos o usuarios reales.
- Acordar las entidades de cuentas/carteras y si el ingreso inicial representa un movimiento financiero o un saldo de apertura.
- Cerrar esquema, modo invitado, sincronización y flujo de migración.
- No tocar aún Firebase, cuentas o reglas.

### Fase 1 — Base técnica sin migrar usuarios
- Crear configuración Firebase por entorno y Emulator Suite.
- Añadir interfaces de repositorio y pruebas del dominio financiero.
- Definir esquema Firestore, índices y reglas en local.
- Revisar autenticación y reglas con emuladores; no desplegar hasta aprobación.

### Fase 2 — Cuenta opcional y respaldo
- Registro, verificación, acceso, Google, recuperación, sesión y cierre.
- Sincronización de datos con UID y control de conflictos.
- Migración local revisable, idempotente y con respaldo.
- Eliminación de cuenta con vista previa y limpieza comprobable.

### Fase 3 — Aplicación Flutter
- Crear proyecto Flutter separado, identidad visual compartida y navegación equivalente.
- Implementar almacenamiento local invitado y repositorio Firestore autenticado.
- Validar Android real y sincronización cruzada con web.

### Fase 4 — Integraciones y publicación
- Conexión OAuth de Gmail/Graph y procesamiento backend por etapas.
- Revisión de duplicados, reglas de categorización y auditoría.
- Privacidad, Data Safety, solicitud web de borrado, Crashlytics y preparación de Google Play.

## Decisiones que requieren confirmación antes de componentes críticos

- ¿El proyecto Firebase mencionado ya existe fuera de este repositorio? Se necesita el project ID y lectura de su configuración para auditarlo sin cambiar nada.
- ¿El modo sin cuenta debe ser completamente local, y al crear cuenta se ofrece importar una copia de sus datos?
- ¿Se mantendrá “Ingreso inicial del mes” como entrada del período, o se modelará como saldo de apertura separado de ingresos?

El usuario autorizó implementar el plan en la rama feat/flutter-firebase-foundation. Confirmó que todavía no existe proyecto Firebase y que el ingreso inicial se cuenta como ingreso del período. No se despliega ni crea infraestructura externa en esta implementación local.


## Avance de implementación (2026-10-31)

- Se conserva la app React y su almacenamiento actual; se añadió un selector persistente español/inglés.
- Se añadió un motor financiero con pruebas para la regla confirmada: el ingreso inicial cuenta como ingreso del período; arrastre y retiros de ahorro afectan disponible, no ingresos; aportes reducen efectivo una sola vez y gastos directos de ahorro se cuentan como consumo.
- Se añadieron contratos versionados compartidos para movimientos en centavos enteros, configuración mensual, presupuestos, metas, conexiones de correo y candidatos importados. Medios de pago son clasificadores; no se modelan saldos de tarjetas/cuentas.
- Se añadió un servicio de vista previa de migración del localStorage existente. No llama a getters que crean datos seed; detecta fixtures de demostración, excluye muestras por defecto, no migra PIN/biometría/foto ni correo no verificado, muestra duplicados y requiere confirmación. Verifica las copias después de escribir y conserva siempre el origen. Aún falta conectarlo a un repositorio Firebase Web.
- Se inició el cliente Flutter en mobile/mischeles_flutter: selección de demo/local/cuenta, preferencias de idioma, autenticación email/contraseña y recuperación, almacenamiento local SQLCipher con clave en Android Keystore, repositorio Firestore con UID, copia local a cuenta con vista previa y verificación, y ejemplos ficticios aislados/resetables. No hay paridad de funciones con React todavía.
- Se añadieron firebase.json para emuladores locales, proyecto de emulador demo-mischeles, reglas Firestore de denegación por defecto y contrato backend de importación de correo. Las reglas bloquean el acceso del cliente a conexiones OAuth; los tokens deben permanecer en backend/Secret Manager. Nada de esto se ha desplegado.
- Se generó la plataforma Android de Flutter en mobile/mischeles_flutter/android mediante el snapshot del SDK en una copia temporal, sin cambiar las ACL de Windows. El ID provisional y namespace son com.mischeles.app; la etiqueta es MisCheles y se usa el icono actual de la app. La compilación completa sigue pendiente por dependencias no disponibles.
- No hay proyecto Firebase; Auth Web/Firestore Web, Functions ejecutables y pruebas del emulador siguen pendientes. El repositorio tiene reglas/configuración local, no credenciales.

## Propiedad de cuentas, nube y publicación

- No se creó ni se seleccionó una cuenta de Google, un proyecto Firebase/Google Cloud, un perfil de facturación ni una cuenta de Play Console durante esta implementación. No hay credenciales de producción en el repositorio.
- Recomendación: el propietario debe ser una cuenta de Google controlada por el usuario o, si existe una empresa legalmente registrada, una cuenta corporativa administrada por ella. Activar verificación en dos pasos y recuperación segura. No compartir contraseñas; conceder acceso a colaboradores mediante roles de IAM y Play Console con privilegios mínimos.
- Firebase/Google Cloud y Play Console son recursos distintos, aunque pueden pertenecer al mismo dueño. Si todavía no existe una empresa registrada con D-U-N-S, iniciar Play Console como cuenta personal; valorar una cuenta de organización solo cuando la entidad esté lista y sus datos legales/publicación puedan verificarse.
- El proyecto Firebase debe crearse bajo esa propiedad, con presupuestos/alertas antes de activar Blaze. Spark sirve para desarrollo inicial; Cloud Functions y otros servicios backend facturables pueden requerir Blaze. No subir claves de servicio, OAuth secrets ni tokens al repositorio.
- Decisión pendiente del usuario: indicar qué cuenta será la propietaria y si existe entidad empresarial antes de crear Firebase o Play Console. Ningún recurso remoto debe provisionarse como parte del trabajo local.

## Decisiones externas pendientes antes de producción

- ID Android provisional: com.mischeles.app. Alternativas: com.mischeles.mobile y app.mischeles.android. Debe elegirse antes de publicar.
- Ubicación Firestore (comparación oficial revisada el 2026-10-31):
  - `us-east1` (Carolina del Sur): base regional con opción de ejecutar Cloud Functions en la misma región; opción razonable para República Dominicana y usuarios de Norteamérica con gasto inicial controlado.
  - `northamerica-south1` (Querétaro): alternativa regional orientada a México/Latinoamérica; medir latencia desde República Dominicana y mercados objetivo antes de escoger.
  - `nam7`: multi-región con réplicas en Iowa y Virginia del Norte; prioriza disponibilidad y durabilidad, con SLA publicado de 99.999% frente a 99.99% regional. Implica mayor costo que una región y la región cercana recomendada para Functions es `us-central1`.
  Google indica que una región puede reducir costos y latencia de escritura, mientras que multi-región aumenta disponibilidad/durabilidad; Firestore no permite cambiar la ubicación después de crear la base. Una sola ubicación no optimiza latencia en todos los continentes. **Recomendación pendiente:** medir `us-east1` y `northamerica-south1` desde RD y decidir si la prioridad de lanzamiento es costo/latencia regional o SLA multi-región; no provisionar hasta fijar la decisión. La monetización se resuelve en producto y backend, no seleccionando una región. [Ubicaciones y SLA de Firestore](https://firebase.google.com/docs/firestore/locations), [precios de Firestore](https://cloud.google.com/firestore/pricing), [regiones de Cloud Functions](https://firebase.google.com/docs/functions/locations). **No se ha elegido ni provisionado una región.**
- Selector de idioma con Español (República Dominicana) y English (United States) en web y Flutter; la preferencia local se conserva y las cuentas comparten idioma entre plataformas. La traducción de formularios React/Flutter aún no es completa.

## Avance incremental en la rama (2026-10-31)

### Ya agregado al repositorio

- La preferencia de idioma español/inglés está disponible en la entrada y preferencias de React y Flutter. Se conserva en local y se sincroniza en cuentas. La cobertura de traducción completa sigue siendo pendiente.
- Los tokens de revisión se basan en segundos y nanosegundos del timestamp de Firestore, compartidos por React y Flutter. Las operaciones móviles de edición, eliminación y cierre de metas rechazan registros que hayan cambiado en otro dispositivo.
- Los presupuestos por categoría conservan metadatos de revisión y documento al cargarse y editarse, de modo que las modificaciones remotas no se escriban a ciegas.

- Cliente web Firebase modular con Auth y Firestore, apagado mientras no se proporcionen los identificadores públicos de la aplicación. Las conexiones a emuladores requieren activación explícita; la plantilla no apunta a producción.
- Servicio de cuenta web con correo y contraseña, restablecimiento, verificación de correo, inicio Google y sesión de navegador, más escucha de cambios de autenticación. El perfil se activa y sincroniza tras verificar el correo. Esto autentica Mis Cheles y no solicita permiso OAuth de Gmail u Outlook.
- Pantalla de cuenta dentro del perfil. Si falta la configuración Firebase, informa que el modo local sigue disponible y no envía datos.
- Flujo de migración web enlazado a Firestore con vista previa, detección de ejemplos, registros inválidos, duplicados y espejos de ahorros. La copia requiere confirmación, se verifica después de escribir y nunca elimina los datos locales. La carga Firestore se divide en lotes.
- Repositorio React con rutas UID fijas, escuchas en tiempo real y operaciones agrupadas para los cinco tipos de colecciones compartidas. El cache web ahora usa espacios locales separados por UID y no siembra ejemplos en el espacio de una cuenta. Los cambios pendientes tienen una cola persistente local por UID; los snapshots protegen ediciones/borrados pendientes y los reintentos son idempotentes. Las ediciones y borrados comparan revisiones remotas dentro de transacciones; los conflictos se conservan en una cola persistente y ofrecen elegir versión local o remota. Los documentos remotos conservan su ID al editar desde web y los borrados resuelven por ID de origen. Los códigos de moneda guardados en la nube usan ISO-4217. En Flutter, el libro escucha en tiempo real transacciones, movimientos de ahorro, metas, presupuestos, configuración mensual y preferencias. El libro móvil ofrece navegación por Resumen, Registro, Ahorro, Estadísticas y Perfil; permite configurar el ingreso inicial/arrastre, crear metas y vincularles aportes, mostrando su balance e historial ligado; además muestra presupuestos por categoría y métricas agregadas desde registros reales. La vista previa de migración abarca movimientos, metas, presupuestos y configuración mensual; separa transacciones de movimientos de ahorro, informa duplicados y registros inválidos, y verifica cada colección después de la copia. Los datos locales cifrados se conservan. Los mapeadores web y Flutter rechazan movimientos de cero, centavos no enteros o fuera del rango seguro, y saldos de metas existentes malformados; esos registros se muestran para revisión sin reemplazarlos por cero. El mantenimiento móvil de presupuestos (crear/editar/eliminar), aportes y retiros vinculados a metas, edición y cierre de metas ya están disponibles. Cerrar una meta con saldo registra una liberación de efectivo y conserva el historial; marcarla como dato falso elimina los movimientos enlazados y la meta en una única escritura local/transacción o lote Firestore. El borrado cloud del cliente se limita a 499 movimientos vinculados por el máximo de 500 operaciones del lote; sobre ese límite debe usarse un proceso autenticado de backend, todavía pendiente.
- Se corrigieron las reglas de Firestore para el perfil de usuario: permiten la creación parcial segura necesaria para activar sincronización y validan cada preferencia solo cuando se envía. React inicializa el perfil antes de activar el sync. Las reglas prohíben escrituras del cliente en conexiones de correo y limitan lectura a campos de estado permitidos; su sintaxis todavía debe confirmarse con Firebase Emulator.
- La confirmación de candidatos de correo exige una escritura atómica con el movimiento enlazado en `transactions`, propiedad del mismo UID, `origin=email_import` e `importedCandidateId` coincidente. La regla de lectura permite ese enlace tras confirmar; no se admiten importaciones de correo a la colección de ahorros. Los modelos compartidos y las reglas ya usan el mismo estado `pending_review` y el mismo metadato de conexión saneado (`maskedAddress`, `grantedScopes`); la bóveda de tokens y la deduplicación reciben UID, proveedor y conexión para validar propiedad. Las pruebas unitarias del contrato pasan, pero las reglas aún requieren prueba en Emulator Suite.
- Selector de idioma Español / English en la web y Android, con preferencia local. El selector web está en Apariencia; Android permite cambiarlo en la pantalla inicial, la cuenta y la barra superior del libro. React sincroniza la selección con el documento de usuario; Flutter ahora observa el campo `language` y guarda los cambios en Firestore además de la preferencia local. Al iniciar una cuenta nueva, web y Android toman como idioma inicial el que el usuario seleccionó en ese dispositivo; las cuentas existentes conservan su elección. Los idiomas publicados en el selector hoy son Español (República Dominicana) e English (United States). La traducción completa de pantallas sigue pendiente.
- Se corrigió el reinicio duplicado en Flutter y la verificación de lotes de Firestore respeta el máximo de 30 valores de whereIn.

### Aún pendiente para considerar terminada la arquitectura implementada

- Probar la sincronización bidireccional web/Flutter con emuladores y verificar la resolución de conflictos concurrentes. La web compara revisiones remotas y permite elegir qué versión conservar; Flutter ahora rechaza ediciones/borrados desactualizados y cierra metas en transacciones con revisión de la meta y sus movimientos.
- Crear limpieza backend autenticada para historiales que excedan el límite cliente de Firestore; probar paridad de filtros y operaciones desde ambos clientes.
- Completar traducciones de todas las pantallas, formularios, avisos y exportaciones; por ahora las opciones y el contexto están preparados y varias superficies principales traducidas.
- Regenerar bun.lock para incluir el SDK firebase, ejecutar la instalación bloqueada y verificar build web y pruebas TypeScript.
- Resolver Flutter packages y compilar Android. El scaffolding nativo ya está; el intento de pub get falla al conectarse a pub.dev.
- Crear proyecto Firebase, decidir región, configurar Authentication/Firestore y ejecutar reglas contra emuladores; nada de esto está desplegado desde este trabajo.
- Implementar los proveedores OAuth de Gmail/Outlook y procesadores backend; actualmente existe el contrato de importación, la base para deduplicación y el modelo de candidatos, sin tokens ni credenciales. El contrato valida la fecha calendario, monto seguro entero, moneda ISO y comercio; pruebas cubren idempotencia incluso con webhooks concurrentes y cotejo con movimientos manuales. La persistencia futura debe implementar guardado atómico por ID determinista.

La resolución de Flutter packages se intentó con red aprobada; pub.dev devolvió error de socket y no se generó pubspec.lock. Se generó Android scaffolding, pero todavía no pudo ejecutarse el analizador de todo el cliente ni compilar Android. Las pruebas Dart autónomas no requieren paquetes externos. Los tests TypeScript de dominio y correo pasaron en copias temporales con Node 24; Bun/tsx aún no está disponible, así que falta ejecutar el comando oficial.

Las comprobaciones Dart standalone pasan para el dominio financiero, analítica por períodos, presupuestos, comparación entre meses/años, evolución, mapeo de migración y parser monetario. El dominio Dart fue analizado sin errores. En Node 24 pasaron las pruebas del dominio financiero/moneda y cuatro pruebas del contrato de correo; las pruebas de migración web y aislamiento por UID también pasan al ejecutar copias temporales con resolución de imports ajustada para Node. Bun/tsx no está instalado, por lo que falta el runner oficial del proyecto.

La configuración Android ya existe. El SDK instalado aún rechaza abrir C:/flutter/bin/cache/lockfile (EPERM); una copia temporal permitió ejecutar flutter create sin modificar permisos del sistema. flutter pub get online devuelve error de socket a pub.dev; offline confirma que sqflite_sqlcipher no está en la caché local. No se generó pubspec.lock, así que siguen pendientes el análisis completo, widget tests y APK. Tampoco se pudo ejecutar Firebase Emulator Rules tests ni el build React: bun.lock aún no incluye el SDK Firebase y el contenedor usa instalación congelada.

Las reglas Firestore están revisadas estáticamente, pero su compilación y pruebas con emulador siguen pendientes.


## Trabajo incremental de esta revisión

- Flutter ahora tiene una opción explícita de Firebase Emulator Suite: Auth y Firestore conectan a demo-mischeles solo con FIREBASE_USE_EMULATORS=true; sin esa bandera y sin configuración pública, Firebase queda apagado. README documenta adb reverse para probar Android sin abrir emuladores a la LAN. La suite aún no se pudo ejecutar desde este entorno.

- Android scaffolding generado: applicationId/namespace provisional com.mischeles.app, MainActivity bajo el paquete correcto, nombre visible MisCheles e iconos de launcher que reutilizan public/app-icon.png. Se reemplazó el test de contador Flutter que dejó la plantilla por pruebas de entrada demo/local/cuenta y del selector de idioma. README Android actualizado.

- Las reglas Firestore ahora requieren que el token de Firebase confirme email verificado. Crear una cuenta ya no escribe su perfil en Firestore antes de verificar; el documento se crea al iniciar sesión verificada. Google Sign-In se mantiene cubierto por la misma regla de identidad verificada.

- El contrato de importación ahora exige un contexto Auth de usuario verificado antes de consultar el token OAuth o leer/procesar mensajes. El contrato exige si el aviso representa ingreso o gasto. El cotejo sugiere posibles duplicados usando dirección, fecha, moneda y monto exactos; no combina registros automáticamente. El hash financiero no incluye el proveedor, para reconocer el mismo movimiento detectado por Gmail y Outlook.

- Las reglas Firestore rechazan montos no enteros, negativos donde no corresponden y valores mayores que el entero seguro de JavaScript. La prueba también comprueba que limpiar una demo no borre claves ajenas a Mis Cheles. Estas reglas aún deben compilarse y probarse en Emulator Suite.

- Se incorporó shared/financial_summary_vectors.json como contrato de resultados financieros. Las pruebas React y Flutter leen esos mismos casos y comprueban ingresos, gastos, aportes/retiros, ahorro directo y disponible; así un cambio de lógica divergente falla en una de las plataformas.

- La web muestra una elección inicial entre demo, uso local vacío y acceso con cuenta. Las nuevas instalaciones guardan los ejemplos en un espacio demo aislado; los registros locales anteriores permanecen en su espacio y entran sin reescritura. El modo local nuevo ya no crea transacciones de ejemplo. La autenticación desde la pantalla inicial mantiene la verificación de correo y la sincronización asociada al UID.
- Web y Flutter ya contemplan registro por correo, verificación antes de activar la cuenta, recuperación de contraseña y Google Sign-In. La primera sesión verificada crea/actualiza preferencias con UID y habilita sincronización preservando los valores existentes. La conexión externa de Google requiere aún configurar el proveedor, OAuth client ID y huellas de firma; cambio de contraseña ya tiene reautenticación en React/Flutter; la eliminación se ejecuta por callable backend con verificación de App Check y autenticación reciente, pendiente de validar en Emulator Suite. La política de limpieza del caché persistente Android sigue pendiente antes de publicar.
- La región de Firestore sigue sin elegirse ni aprovisionarse. La comparación y recomendación condicional actualizada está en Arquitectura objetivo; se debe medir la latencia de clientes previstos antes de provisionar. Un plan de pago deberá aplicar derechos de cuenta (entitlements) validados en backend.
- La demostración Android se amplió de cuatro movimientos estáticos a un historial dinámico de tres meses, con 41 movimientos, ingresos extra, presupuestos por categoría, configuración mensual y dos metas. Todos los IDs se separan bajo el espacio `demo`; reiniciar demo vuelve a crear esos ejemplos. El modo local no se siembra con datos ficticios.
- Estadísticas Flutter ahora tiene Resumen, Categorías, Comparar y Evolución. Los cálculos salen del dominio financiero sobre movimientos/configuraciones/presupuestos reales: ocho indicadores con jerarquía, consejos basados en presupuestos y mes anterior, ranking de gastos, comparación de dos meses/años, diferencias monetarias/porcentuales y tendencias de 6/12 meses. Las reglas de suma usan el contrato financiero y una prueba standalone cubre presupuesto excedido, porcentajes, comparación y cruce de año.
- El libro Android ya permite crear, editar y eliminar movimientos de todos los tipos financieros, con monto validado en centavos, fecha, concepto, categoría y medio de pago. Si una edición cambia el movimiento entre colecciones de ahorro y transacciones, la cuenta usa una escritura batch para moverlo sin dejar una copia duplicada.
- El selector de idioma español/inglés está disponible en React (Perfil > Apariencia) y Flutter (Perfil), y también en el acceso principal de Flutter. React guarda el idioma en localStorage y escucha cambios sincronizados; Flutter lo conserva en preferencias del dispositivo y, en modo cuenta, guarda/escucha la preferencia en el documento del UID. Antes de publicar hay que completar la traducción de todos los textos visibles, mensajes, formatos de fecha/número y exportaciones en ambas plataformas; la cobertura actual sigue siendo parcial.
- La sincronización optimista compara revisiones antes de cambios y eliminaciones. React preserva ambas versiones si detecta conflicto; en Flutter la operación se rechaza con mensaje de actualización. Se incluyen transacciones para cierre/eliminación de metas, y pruebas de aislamiento confirman que los presupuestos mantienen su revisión al editarse.


En esta revisión se generó android/ desde una copia temporal del SDK: el Flutter original sigue devolviendo EPERM para C:/flutter/bin/cache/lockfile, así que no se cambiaron ACL del sistema. La red a pub.dev falló, por lo que no se descargaron paquetes ni se compiló APK. Se ejecutaron el contrato financiero compartido, el análisis del dominio, el parser monetario y el mapeador de migración.


## Actualización de progreso — 2026-10-31

- Flutter ahora expone la preferencia de moneda del perfil con los mismos códigos ISO-4217 aceptados por React. Los nombres de categorías estándar se localizan en las vistas React y Flutter en inglés sin traducir ni reescribir el valor guardado; las categorías personalizadas se conservan literalmente. La elección se guarda localmente en demo/local y, en cuenta, en users/{uid}.preferredCurrency; la escucha remota también actualiza el dispositivo. Formateo y movimientos nuevos usan esa preferencia sin convertir importes ni modificar registros existentes.
- El catálogo de moneda de Android tiene una prueba standalone y análisis Dart independiente. Los seis scripts standalone Android (contrato financiero, analítica, mapeo de migración, parser, moneda y etiquetas de categoría) pasan; el formateador pudo analizar los 21 archivos Dart.
- Node 24 ejecutó 25 pruebas TypeScript y de contrato en una copia temporal con extensiones .ts ajustadas: 25 pasan. `git diff --check` también pasa.
- Se volvió a intentar descargar Flutter dependencies después de habilitar acceso de red; pub.dev sigue sin aceptar conexión, no hay pubspec.lock ni package_config y no se pudo producir build/APK. No se provisionó Firebase.


- React ahora normaliza Timestamp Firestore a ISO al leer documentos y conserva la precisión original como _cloudRevision, igual que Flutter; el tipo común acepta el timestamp nativo o ISO de la migración. La prueba del codec y la suite completa, incluido el contrato backend de correo, pasan: 29/29.

- La proyección local de una edición conserva el ID cloud y el token de revisión fuera de legacySnapshot; así la escritura optimista apunta al documento existente en vez de aparentar un conflicto. Una prueba de regresión confirma identidad, token y exclusión de metadatos internos de la instantánea.
- La edición de configuración mensual ahora mezcla los cambios del formulario con el objeto existente para preservar cloudDocumentId y _cloudRevision. La prueba de aislamiento actualiza una configuración descargada y verifica ambos metadatos.

- El codec compartido también elimina cloudDocumentId y _cloudRevision del payload al guardar; el repositorio web aplica el encoder en escrituras por lote y transaccionales para respetar los campos permitidos por Firestore Rules.

- SQLCipher ahora coalesce las aperturas concurrentes de la base; la falla de apertura libera el intento para permitir reintentar. Dart format valida el archivo, y los seis contratos standalone Android siguen pasando.

- El primer inicio de sesión con correo inicializa createdAt en users/{uid} y conserva el valor existente en sesiones posteriores, igual que Google y React.


- Corrección de cierre de metas: historial desligado se conserva sin efecto en balance (`balanceAffecting=false`); la reasignación al fondo general es un movimiento positivo `savings_reallocation`, y el retorno al mes sigue siendo `savings_withdrawal`. Cobertura de regresión de modo local y cuenta; suite TypeScript 37/37 y siete pruebas Dart autónomas pasan.

- La escritura de migración Firestore también elimina `_cloudRevision` junto con `cloudDocumentId`; ambos son metadatos del cliente y no deben enviarse en documentos gobernados por `hasOnly` en Firestore Rules.


### Protección App Check en clientes (configuración local, 2026-10-31)

- React ahora puede activar App Check con reCAPTCHA v3 en una compilación de producción, únicamente cuando se habilita `VITE_FIREBASE_APPCHECK_ENABLED=true`, existe `VITE_FIREBASE_APPCHECK_SITE_KEY` y no se usan emuladores. La inicialización ocurre antes de Auth y Firestore.
- Android ahora integra `firebase_app_check` 0.5.1 y puede activar Play Integrity con `--dart-define=FIREBASE_APPCHECK_ENABLED=true`; un proveedor debug requiere un segundo flag explícito, solo funciona en `kDebugMode` y se omite en Emulator Suite. Ambos mecanismos están apagados por defecto porque aún no hay proyecto ni apps registradas.
- No se activó enforcement ni se cambió una consola externa. Antes de producción hay que registrar cada aplicación, probar builds reales y revisar métricas antes de exigir tokens; el código cliente por sí solo no obliga a Firestore a rechazarlos. La API vigente de FlutterFire 0.5 usa `providerAndroid`, `AndroidPlayIntegrityProvider` y `AndroidDebugProvider`.


### Ampliación del contrato de movimientos e importación (2026-10-31)

- El movimiento compartido ahora admite fecha/hora UTC opcional, notas, banco, hash SHA-256 de referencia, últimos cuatro dígitos del instrumento y enlace/hash de candidato. La fecha calendario sigue siendo el campo de agrupación financiera. React y Flutter conservan esos campos en el modelo y la serialización.
- El contrato de correo valida y solo persiste datos mínimos: nunca el cuerpo ni la referencia bancaria en texto plano; los últimos cuatro dígitos son el límite de información de tarjeta aceptado. El cotejo usa la referencia hasheada cuando existe y, en su defecto, dirección/fecha/importe/moneda. Las reglas enlazan el movimiento confirmado con su candidato y comparan sus campos financieros esenciales.
- La vista previa de migración ahora construye snapshots desde listas permitidas por entidad. Un campo inesperado como token, número completo de tarjeta o CVV se conserva en el origen local, pero no se copia al documento cloud.
- Evidencia nueva: diez pruebas del contrato mail y una de App Check pasaron con Node 24; quince pruebas de migración web pasaron con un resolver TypeScript temporal; siete comprobaciones standalone Dart y el vector financiero compartido pasan. Las reglas aún no se compilan con Emulator Suite porque no está Firebase CLI/Java disponible en el entorno.


### Gestión segura de cuentas (2026-10-31)

- Se agregó cambio de contraseña a las cuentas con proveedor correo/contraseña en React y Flutter. Ambos clientes reautentican con la contraseña actual antes de actualizarla; se exige un mínimo de ocho caracteres.
- Se agregó la callable `deleteMyAccount` en Cloud Functions: solo permite al UID autenticado, correo verificado y autenticación de los últimos cinco minutos; exige confirmación explícita y despliegues requieren App Check. El servidor borra los árboles Firestore bajo `users/{uid}` y `privateMailTokens/{uid}` y luego la identidad Auth. El borrado recursivo no es una transacción atómica; ante un fallo, conserva la identidad para permitir reintento.
- React y Flutter muestran un flujo con confirmación escrita. La copia de React del UID se borra tras el éxito; se conserva la copia demo/local y claves de otras aplicaciones. La caché persistente Firestore de Android requiere un diseño de limpieza comprobable antes de declarar completa la eliminación local del dispositivo; al publicar, la pantalla debe informar al usuario que puede quedar caché local tras borrar la cuenta.
- Se preparó Cloud Functions Node.js 22 y emulador local en el puerto 5001. No hay proyecto Firebase ni se desplegó ninguna función. Cuatro pruebas unitarias de política de eliminación pasan; falta ejecutar Functions Emulator/Firestore Emulator con dependencias instaladas.

- Verificación de esta revisión: 48/48 pruebas TypeScript de dominio, migración, sincronización, App Check y contratos backend; 8/8 pruebas Dart standalone. `git diff --check` pasa. Los repositorios npm y pub.dev devolvieron EACCES/socket error incluso tras habilitar red; por ello no fue posible instalar dependencias, generar locks, compilar el cliente completo ni ejecutar Emulator Suite.

- Modos en la web: las instalaciones nuevas pueden elegir demostración, uso local sin cuenta o cuenta sincronizada. La modalidad local usa su espacio existente en el navegador y se puede migrar luego con vista previa; los registros previos sin selección se muestran aparte para que el usuario pueda revisarlos. Android conserva su modo local cifrado.


### Selección segura de migración y verificación adicional (2026-10-31)

- React muestra los registros aptos individualmente en la vista previa; se pueden excluir movimientos concretos, omitir preferencias del perfil y, solo si se activa explícitamente, revisar y seleccionar muestras ficticias. El resumen y la confirmación cuentan los registros realmente elegidos. Los datos del navegador no se borran.
- Flutter presenta los registros Android elegibles en una lista seleccionable y entrega al repositorio únicamente la lista aprobada. La selección por clave estable se aisló en el mapeador compartido con una prueba standalone.
- Verificación actual: suite TypeScript 49/49, incluidas las pruebas de migración selectiva; pruebas Dart independientes 8/8, incluido el contrato financiero compartido; análisis del mapeador sin problemas; el formateador no detecta cambios pendientes en los archivos revisados; git diff --check pasa.
- El análisis completo de Flutter, el build web/Android y Firebase Emulator Suite siguen pendientes. dart pub get y la instalación del gestor Node fallaron con errores de conexión/EACCES a Pub.dev y npm registry, incluso tras habilitar red. El análisis global solo puede reportar imports Firebase/Flutter ausentes mientras esos paquetes no estén instalados. No hay proyecto Firebase real y no se desplegó ningún recurso.



### Persistencia backend de candidatos de correo (2026-10-31)

- `functions/src/firestore_mail_persistence.ts` implementa la persistencia Admin SDK bajo `users/{uid}/importedCandidates`, calcula IDs deterministas a partir del proveedor, conexión y mensaje, crea candidatos en una transacción para soportar entregas concurrentes y coteja posibles duplicados solo contra movimientos manuales/importados del mismo UID.
- La escritura aplica una lista permitida de campos; el cuerpo del correo y cualquier campo accidental de token, contraseña o tarjeta completa quedan fuera del documento. `firestore.indexes.json` define los índices necesarios y `firebase.json` los conecta para futuras pruebas/despliegues.
- El contrato ahora comparte la función de ID determinista con el adaptador. Se verificó 52/52 pruebas TypeScript ejecutadas con Node 24 en un clon temporal con imports ajustados, y 7/7 verificaciones Dart autónomas. Esto comprueba lógica, no sustituye la compilación contra los paquetes Firebase ni las pruebas del Emulator Suite.
- Hay una bóveda backend AES-GCM lista para almacenar tokens provisionados por servidor, pero todavía no está conectada a autorización OAuth, lectores Gmail/Graph ni endpoint de sincronización; por tanto, ningún buzón se conecta ni se lee. Esas piezas requieren configuración externa, consentimiento y pruebas de proveedor antes de activarlas.


### Confirmación revisada de movimientos importados (2026-10-31)

- Se añadió la callable `confirmImportedCandidate`, que exige cuenta autenticada y correo verificado, aplica App Check fuera del emulador y escribe el movimiento y el estado confirmado del candidato en una sola transacción. Los reintentos devuelven el mismo movimiento en lugar de duplicarlo.
- La categoría se debe elegir en la revisión; un posible duplicado exige confirmación explícita. La política valida propietario, fecha, monto, moneda y medio de pago, y construye solo los campos financieros permitidos. No intenta adivinar categoría ni fusionar registros.
- Nuevas pruebas de funciones validan el contrato de conversión e idempotencia; el conjunto TypeScript actual pasa 55/55 pruebas. Las siete comprobaciones Dart autónomas también pasan. Aún hace falta compilar contra Firebase Admin/Functions y probar el flujo en Emulator Suite; no hay configuración externa ni credenciales.


### Límites de compilación y pruebas en el monorepo (2026-10-31)

- La configuración TypeScript raíz comprueba la aplicación web y el contrato compartido sin mezclar el paquete de Cloud Functions ni sus pruebas Node. Functions mantiene su propio `tsconfig` y excluye pruebas del artefacto de producción.
- El comando `test` raíz ahora incluye las pruebas de persistencia y revisión de candidatos, además de los contratos existentes. La instalación de `tsx`/Firebase sigue pendiente en este entorno, por lo que la evidencia disponible es la suite equivalente ejecutada con Node 24 en una copia temporal.


### Revisión de importaciones desde los clientes (2026-10-31)

- El perfil web y el perfil Android muestran una bandeja de candidatos pendientes limitada al UID autenticado. El cliente solo lee los campos saneados permitidos por reglas; el permiso OAuth y los tokens no se comparten con la cuenta Mis Cheles.
- En ambas plataformas se puede elegir la categoría y el medio de pago, registrar o ignorar el candidato. Los posibles duplicados muestran advertencia y requieren la acción explícita de registrar como nuevo; la escritura final sigue pasando por la callable atómica.
- La bandeja solo permite revisar candidatos existentes. La conexión OAuth, la lectura de Gmail/Outlook y el ingreso de avisos al backend todavía no están habilitados; no se presentan correos de ejemplo como transacciones reales.

### Bóveda backend cifrada para credenciales de correo (2026-11-01)

- Se añadió `EncryptedMailTokenVault`: cifra access/refresh tokens con AES-256-GCM; la autenticación del sobre incluye UID, proveedor, conexión y versión de clave. Acepta rotación gradual de claves y valida claves de 256 bits en hex o base64url. No devuelve tokens a clientes.
- `FirestorePrivateMailTokenStore` persiste únicamente en `privateMailTokens/{uid}/connections/{connectionId}`, con compare-and-set transaccional por revisión. Las reglas de cliente mantienen el acceso denegado por la regla final de cierre; esta ruta solo debe usarse desde Admin SDK en Functions.
- Se añadió `FirestoreMailConnectionMetadataStore` bajo `users/{uid}/mailConnections/{connectionId}`: guarda únicamente correo enmascarado, scopes saneados y estado; las reglas permiten lectura del propietario verificado y deniegan toda escritura cliente. La bóveda ahora exige metadatos activos del mismo UID, conexión y proveedor antes de devolver un access token.
- `activateMailConnection` aplica una secuencia segura: primero registra estado de reautorización, luego guarda el sobre cifrado y solo al final marca la conexión activa. Los fallos parciales no dejan una conexión habilitada sin credenciales. `disconnectMailConnection` revoca en el proveedor antes de eliminar metadatos; si falla la revocación, deja el registro para reintentar.
- El refresh y revocado del proveedor se mantienen detrás de puertos backend. Si un refresh de un token de un solo uso pierde una carrera, el worker lee la versión más nueva ya persistida. La eliminación de cuenta también borra el árbol privado de tokens antes de eliminar la identidad Auth.
- Verificación actual: la batería TypeScript seleccionada pasa 63/63 pruebas en una copia temporal con Node 24; incluye cifrado/autenticación, rotación, revocación, carreras de refresh, persistencia privada y pruebas previas de dominio, migración y deduplicación. Esto no reemplaza el build TypeScript del paquete Firebase Functions ni Emulator Suite.
- Dart: pasaron 8/8 comprobaciones standalone; el formateador verificó 16 fuentes Flutter sin cambios. El contrato financiero compartido se ejecutó desde la raíz porque lee sus vectores JSON relativos al repositorio. `git diff --check` está limpio y los JSON de configuración parsean correctamente.
- Sigue pendiente implementar los adaptadores reales OAuth/refresh/revoke de Gmail y Microsoft, callbacks de autorización, sincronizador de mensajes y provisión de secretos en Google Cloud Secret Manager. No se ha configurado un proyecto Firebase ni se ha desplegado nada. La instalación offline de pnpm no pudo resolver metadatos faltantes; la validación Flutter completa también requiere completar sus dependencias y correr el build/emuladores.

### Verificación local después de resolver dependencias web (2026-11-01)

- En el checkout de la rama `feat/flutter-firebase-foundation`, `tsc --noEmit` de la raíz terminó correctamente y `vite build` compiló 1,930 módulos, generando el bundle PWA de producción. `git diff --check` también terminó limpio.
- La suite raíz se intentó con el `tsx` ya presente y no alcanzó a cargar pruebas: Node 24 falló en `uv_os_get_passwd` con `ENOMEM` al iniciar el directorio temporal de `tsx`. No se alteraron opciones del sistema ni se borraron archivos para evitar ese fallo.
- Las dependencias de Functions (`functions/node_modules`) y Flutter (`mobile/mischeles_flutter/.dart_tool/package_config.json` y `pubspec.lock`) no están presentes en este checkout. Sus fuentes no se modificaron en esta revisión y sus builds, análisis completos y pruebas de emulador siguen pendientes. No se creó proyecto Firebase ni se desplegaron recursos externos.

### Dependencias, paridad y límites de verificación (2026-11-01)

- La instalación de Flutter no se reintentó. Este checkout sigue sin pubspec.lock ni .dart_tool/package_config.json; no se pueden ejecutar flutter analyze, build Android ni tests integrales. Sí se corrigió el modelo de movimientos Flutter para mantener relatedSavingsMovementId y reconocer el espejo del aporte, y el vector financiero compartido pasa con Dart standalone.
- Functions sigue sin node_modules ni lockfile propio. No se cambió gestor ni se instalaron paquetes. Las nuevas pruebas de intercambio de proveedor se ejecutaron con Node nativo: 4/4 pasan. Las pruebas del flujo/Firestore y el build tipado de Functions quedan pendientes de tsx, Firebase Admin/Functions y Emulator Suite.
- En la web, TypeScript y Vite build ya habían pasado en esta rama antes de los cambios de Functions de esta continuación. No se modificaron componentes web financieros en este turno. La suite raíz sigue limitada por el error de Node 24 uv_os_get_passwd returned ENOMEM registrado previamente.
- Bun y Docker no están disponibles para validar la imagen local; no se cambiaron gestores ni se intentó desplegar. No existe aún proyecto Firebase, configuración OAuth de Google/Microsoft ni secretos.

### Revisión de aislamiento de modos web (2026-11-01)

- La inspección del código actual confirma que `WebModeGate` conserva elecciones `demo`/`local` en espacios distintos; `storage.ts` siembra registros solo cuando el ámbito activo es `demo`, y devuelve colecciones vacías/perfil vacío en modo `local` o `account:{uid}`. Los registros legados sin elección se detectan como `legacyLocal` para revisión.
- `resetAllData` elimina solo claves de Mis Cheles del ámbito actual y rechaza el borrado general desde un ámbito de cuenta; `clearAccountScope` limita la limpieza al UID indicado. La prueba `storageScope.test.ts` existe, pero sigue pendiente ejecutarla porque la suite raíz aborta al iniciar `tsx` con `ENOMEM`.

### Contrato de inicio OAuth y estado de backend (2026-11-01)

- Se añadió la callable `beginMailOAuth`. Requiere App Check en producción y una cuenta Mis Cheles verificada; solo acepta `gmail` o `outlook` y determina los scopes desde el servidor. Devuelve URL de autorización, ID de conexión y vencimiento, nunca tokens.
- El inicio usa PKCE S256, estado aleatorio de un solo uso y vencimiento de diez minutos. Firestore Admin guarda el hash del estado y el verificador en una colección privada; la eliminación de cuenta elimina los estados OAuth pendientes por UID y una tarea programada purga los vencidos cada 24 horas.
- Los ID de cliente y redirects de OAuth son configuración de Functions, documentada en `functions/.env.example`. No se guardan secretos ni se han configurado credenciales reales.
- Se añadió un callback HTTPS de servidor: intercambia códigos con Google/Microsoft, verifica la dirección de correo contra UserInfo/Graph, valida los scopes concedidos y activa la conexión solo después de guardar tokens cifrados. Los secretos de cliente y el keyring están declarados como Firebase Secret Manager secrets; no hay valores reales ni se han provisionado.
- La revocación de Google invalida el refresh token. Microsoft no ofrece revocación individual equivalente; la desconexión de Outlook debe mantener la conexión hasta que el propietario retire el consentimiento en Microsoft, sin invalidar todas sus sesiones.
- Persisten pendientes el worker/sincronizador incremental, la bandeja de revisión en vivo, el flujo de desconexión UI y las pruebas con Firebase Emulator Suite. La callable disconnectMail ya está creada; para Outlook informa el límite del proveedor y conserva credenciales/metadatos hasta la revocación del consentimiento. La primera publicación de la limpieza programada requiere Cloud Scheduler habilitado en el proyecto Firebase/GCP. No se ejecutaron builds de Functions por ausencia documentada de sus dependencias; no se reinstalaron.

### Verificación de esta continuación (2026-11-01)

- Paridad compartida de cálculos: dart --enable-asserts mobile/mischeles_flutter/test/financial_summary_contract_test.dart pasó; incluye movimientos espejo de ahorro enlazados, IDs iguales en colecciones distintas y enlaces huérfanos.
- Adaptadores OAuth de Google/Microsoft: 4/4 pruebas nativas con node --experimental-strip-types --test pasaron. También se validó sintácticamente el TypeScript de Functions modificado, y git diff --check terminó con código 0.
- Se añadieron pruebas de PKCE, callback, scopes, consumo único y limpieza de estados, pero no se pudieron ejecutar sin el runner/dependencias de Functions. No se han realizado llamadas de consentimiento reales ni intercambios OAuth.

### Sincronización incremental y adaptadores de mensajes (2026-11-01)

- Se añadió un cursor privado por UID/conexión, con revisión compare-and-set y limpieza automática por el borrado del árbol privado de tokens. El proceso limita páginas, guarda el cursor solo después de procesar todos los mensajes de la página y usa IDs deterministas para que un reintento no duplique candidatos.
- Gmail usa el perfil para capturar el historyId inicial y luego consulta solo cambios messageAdded con etiqueta INBOX. La API puede invalidar historyIds antiguos; en ese caso el adaptador falla explícitamente en vez de saltarse cambios. Microsoft Graph usa delta de Inbox, limita el inicio a los últimos 14 días y conserva nextLink/deltaLink únicamente en Firestore privado.
- Los cuerpos de mensajes se obtienen en memoria, se limitan y pasan a parsers inyectados. Solo la salida normalizada puede llegar al repositorio de candidatos; el cuerpo, el remitente y el asunto no se persisten. No hay todavía plantillas específicas de bancos ni una callable que dispare el sincronizador, por lo que no se importan mensajes hasta configurar parsers y política de ejecución.
- Referencias oficiales consultadas: [Gmail history.list y vigencia de historyId](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list), [Gmail sincronización](https://developers.google.com/workspace/gmail/api/guides/sync), [Microsoft Graph message delta](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0).
- Pruebas disponibles: 5 casos de API de proveedor, 4 del proceso reanudable y 2 del almacenamiento compare-and-set pasan con el runner nativo de Node y dobles locales; no contactan Gmail, Microsoft ni Firestore reales.


### Estado consolidado de la continuación móvil/correo (2026-11-01)

- Los controles de conexión y desconexión Gmail/Outlook están integrados en el perfil de cuenta de React y en la bandeja de importaciones Flutter. Ambos clientes usan la callable backend para autorizar; los tokens y el callback permanecen en Functions. Flutter abre solo URLs HTTPS de los proveedores mediante un MethodChannel Android validado.
- Flutter valida propietario verificado, ID de conexión, expiración y host/ruta del proveedor antes de abrir OAuth. La vista observa metadatos enmascarados y requiere confirmación antes de desconectar. La bandeja de revisión sigue sin leer directamente el correo y solo confirma movimientos mediante la callable atómica.
- Se reparó el bloque de métodos OAuth Flutter y se removió un fragmento duplicado/corrupto que había quedado de una edición anterior; se preservó una sola implementación completa de la bandeja. `dart format` completó sin cambios de parseo.
- Verificación de esta continuación: 69/69 pruebas de Functions y 34/34 pruebas web/compartidas ejecutadas con el runner nativo de Node; vector compartido React/Flutter aprobado con Dart standalone; `git diff --check` sale limpio. El runner nativo comprueba contratos y dobles locales, no integra Firebase real.
- Pendiente por dependencias: `mobile/mischeles_flutter/.dart_tool/package_config.json` y `functions/node_modules` no están disponibles en este checkout. Por eso Flutter analyze/build, compilación tipada de Functions y Emulator Suite no están ejecutados. La instalación no se reintentó.
- Pendiente externo: no existe proyecto Firebase, credenciales/consentimientos OAuth ni secretos aprovisionados. El OAuth no se puede activar con cuentas reales; la sincronización tiene adaptadores incrementales, pero no una función que la programe ni parsers bancarios. No se desplegó.


- Extensión posterior de esta continuación: se aisló la validación de la respuesta OAuth móvil en `mobile/mischeles_flutter/lib/domain/mail_oauth_contract.dart`, sin importaciones Firebase. El repositorio usa ese contrato antes de lanzar el navegador. La prueba standalone `mobile/mischeles_flutter/test/mail_oauth_contract_test.dart` verifica Google/Microsoft válidos y rechaza host, protocolo, userinfo, proveedor, PKCE, UUID y expiración inválidos; pasó con Dart standalone. Esto permite verificar la barrera de seguridad mientras pubspec sigue sin resolución local.


### Paridad de revisiones de sincronización React/Flutter (2026-11-01)

- Se corrigió el manejo de documentos Firestore heredados sin updatedAt: React y Flutter ahora generan el mismo token FNV-1a de contenido, incluyendo el ID canónico y timestamps anidados, y aplican la misma regla de conflicto al editar/eliminar. El codec web conserva la precisión del timestamp del servidor y asigna el fallback antes de normalizar fechas.
- La implementación TypeScript quedó en shared/syncRevision.ts; el archivo previo de React reexporta ese contrato. Flutter usa mobile/mischeles_flutter/lib/domain/cloud_revision.dart. Ambos consumen shared/revision_contract_vectors.json.
- Verificación: 35/35 pruebas web/compartidas pasaron con Node nativo; tres pruebas Dart standalone pasaron (revisión compartida, paridad financiera y contrato OAuth); git diff --check pasa. No se instalaron dependencias. Flutter analyze/build y el build Vite/TypeScript permanecen pendientes por falta de dependencias de este checkout.


### Privacidad de caché Firestore móvil (2026-11-01)

- Android desactiva ahora la persistencia de disco de Firestore para las cuentas. El modo local mantiene sus datos propios en SQLCipher; la caché en memoria de la sesión no sobrevive a un reinicio.
- En la primera ejecución tras esta versión se intenta borrar la caché persistida por versiones anteriores antes de abrir consultas o listeners. Después de eliminar una cuenta, se deja un marcador para volver a purgarla en el próximo inicio. Si la operación falla, se conserva el marcador y Perfil muestra pasos alternativos. La purga no toca la base SQLCipher local.
- La documentación de Firebase advierte que clearPersistence() debe ejecutarse antes de iniciar Firestore y no garantiza sobreescritura forense del almacenamiento; por eso las cuentas nuevas usan caché cloud solo en memoria. Referencias: https://firebase.google.com/docs/firestore/manage-data/enable-offline y https://firebase.google.com/docs/reference/android/com/google/firebase/firestore/FirebaseFirestore#clearPersistence().
- Flutter formateó los archivos afectados; las tres suites standalone (revisión, finanzas y OAuth) siguen pasando. El análisis/build Android y la comprobación del plugin Firebase están pendientes por las dependencias Flutter que faltan.

- Actualización de esta revisión: el contrato de purga ahora tiene prueba standalone para los estados sin trabajo, migración de caché antigua y reintento fallido; las cuatro pruebas Dart independientes pasan. La advertencia de versiones anteriores sobre borrar los datos manualmente queda sustituida por el flujo de limpieza al siguiente arranque y el aviso alternativo si falla.


### Protección del cursor de correo sin parsers bancarios (2026-11-01)

- MailApiSafeMessageReader rechaza una configuración vacía o inválida de parsers con un error explícito. Así, un futuro sincronizador no puede clasificar todos los mensajes como ignorados y guardar el cursor antes de que haya formatos bancarios implementados. Una lista válida sí puede producir null por mensaje cuando no coincide con un formato soportado, que es el caso normal una vez que exista el registro de parsers.
- Se añadieron pruebas para la configuración vacía/malformada. Las suites del adaptador y del contrato de checkpoint pasaron: 10/10 con el Node nativo disponible. La compilación tipada de Functions y Emulator Suite siguen pendientes porque el checkout no tiene las dependencias/configuración de ejecución necesarias.
- No se agregaron parsers bancarios ni una función de sincronización programada: falta definir formatos de notificación y reglas de detección para bancos reales, y habilitar OAuth requiere proyecto y configuración externa.
- Una ejecución amplia con el runner Node integrado (sin el resolver TypeScript usado por el script habitual) dejó 53 pruebas aprobadas y tres archivos sin cargar porque Node no resolvió imports internos sin extensión: mail_oauth_flow, firestore_mail_persistence y firestore_mail_oauth_state_store. La ejecución enfocada del adaptador y checkpoint sí pasó 10/10; esos errores de carga no se consideran fallos funcionales.


### Prueba de cierre de metas en Flutter (2026-11-01)

- La ejecución de los contratos Dart independientes encontró que savings_balance_standalone.dart solo separaba del goalId el aporte de ejemplo, aunque el cierre de una meta separa todos sus movimientos asociados. Se corrigió el fixture para separar tanto aportes como retiros; no se modificó el dominio financiero ni la regla de cierre.
- Verificación posterior: 11/11 contratos Dart standalone y 5/5 pruebas del resumen financiero React, incluidos los vectores compartidos React/Flutter. El formateador analizó el archivo sin cambios pendientes; avisó que flutter_lints no se resuelve porque falta el paquete Flutter.


### Paridad al descartar metas falsas con movimientos espejo (2026-11-01)

- El flujo móvil de descartar datos falsos ahora agrupa los movimientos de ahorro de la meta con las transacciones cuyo relatedSavingsMovementId apunta a esos movimientos. Tanto SQLCipher como el repositorio Firestore eliminan el grupo completo dentro de la operación existente; se rechazan referencias a otras metas o espejos no vinculados. El cierre normal de una meta sigue conservando su historial.
- Esto alinea Flutter con el comportamiento que ya tenía React y evita que quede una transacción espejo contabilizada como gasto después de borrar una meta falsa. Se agregó un contrato standalone con casos para aportes, retiros, espejo, otra meta y movimientos ajenos. No se cambiaron cálculos financieros.
- Verificación: 12/12 contratos Dart independientes pasan; dart format completó. No se pudo ejecutar el build Android ni probar repositorios Firebase con emulador porque las dependencias y herramientas externas continúan sin estar disponibles.


### Vectores compartidos para vínculos de borrado de ahorro (2026-11-01)

- La selección de movimientos y transacciones espejo quedó expresada en shared/savings_goal_deletion_vectors.json. El servicio de almacenamiento React usa shared/savingsGoalDeletion.ts; Flutter ejecuta los mismos vectores en su contrato Dart. La prueba React del helper pasó 1/1 y los contratos Flutter pasaron 12/12.
- Se añadió una prueba adicional del almacenamiento React que verifica el borrado a través del servicio completo y se registró en package.json. No pudo ejecutarse aquí: el runner tsx se detuvo antes de cargar pruebas con uv_os_get_passwd: ENOMEM. No se cambió su configuración ni se intentó instalar nada.


### Cobertura del stream de sincronización Flutter (2026-11-01)

- AccountRepository.watchMovements delega ahora la combinación de transacciones y movimientos de ahorro en un helper de dominio sin Firebase. La UI conserva sus listeners en vivo y el helper espera el primer snapshot de ambas colecciones, ordena el resultado por fecha, combina cada actualización con el último snapshot de la otra colección, propaga errores y cancela las dos suscripciones al salir.
- La prueba standalone de ese contrato pasó; el conjunto completo de pruebas Dart independientes pasó 13/13 y las pruebas React del resumen y vectores compartidos pasaron 6/6. El build Android y Emulator Suite siguen pendientes de dependencias/configuración.


### Build web verificado con binarios ya disponibles (2026-11-01)

- TypeScript ejecutado directamente desde node_modules con --noEmit terminó sin errores. Vite produjo el build de producción y los artefactos PWA (1932 módulos transformados). No se instalaron dependencias.
- Vite reportó la advertencia existente de __dirname en configLoader nativo y un bundle principal mayor a 500 kB; no impidieron el build. El build no valida Functions ni Android.
- Firebase Admin y firebase-functions no existen en functions/node_modules ni en el node_modules raíz, por lo que no hay compilación de Functions sin resolver primero ese estado externo de dependencias.


### Suite ampliada con Node nativo disponible (2026-11-01)

- Para evitar depender del runner `tsx` que falla con `uv_os_get_passwd: ENOMEM`, se ejecutaron pruebas TypeScript en copias temporales del código fuente usando Node 24 con strip de tipos; el harness añadió extensiones `.ts` a imports relativos solo en las copias, sin modificar los archivos de producción. Las carpetas temporales se eliminaron al finalizar.
- Pasaron 37/37 pruebas web y compartidas, incluidas migración local, aislamiento demo/local/cuenta, borrado por el servicio React, resúmenes financieros y codec Firestore. También pasaron 70/70 pruebas de Functions, incluidas bóveda cifrada, stores Firestore con dobles de prueba, OAuth Gmail/Outlook, cursores, persistencia de candidatos, idempotencia y revisión de movimientos importados.
- Esta ejecución verifica contratos y adaptadores con dobles, no compila el paquete Firebase Functions contra sus dependencias reales, no ejecuta Emulator Suite y no hace llamadas/deploy a proveedores externos. `firebase-admin`, `firebase-functions` y `.dart_tool/package_config.json` siguen ausentes; el runner oficial del proyecto aún no se ha podido ejecutar.


### Paridad de aportes de ahorro históricos en Estadísticas (2026-11-01)

- Se encontró una diferencia en React Analytics: las vistas por rango, comparación y evolución excluían aportes de ahorro antiguos guardados solo como gasto y no los restaban del disponible ni los mostraban como ahorro. El resumen financiero y Flutter ya los clasificaban como transferencia cuando no había un movimiento de depósito enlazado.
- Se extrajo `unmatchedSavingsContributionAmount` al dominio React y Analytics lo reutiliza tanto para el saldo de apertura parcial como para el ahorro del rango, comparación y evolución. Los espejos enlazados a depósitos siguen contando una sola vez; gastos ordinarios no cambian. Las fórmulas aprobadas no se alteraron.
- Se agregó regresión para aportes antiguos, espejos enlazados, referencias huérfanas, referencias a retiros y IDs repetidos. TypeScript pasó, Vite generó el build web y pasaron 38/38 pruebas React/compartidas en copia temporal; Flutter pasó los contratos compartidos de resumen y analítica (2 comandos Dart). `git diff --check` pasó.


### Vector cruzado para referencias de ahorro con tipo incorrecto (2026-11-01)

- El vector compartido de resumen financiero ahora cubre un gasto enlazado por error a un retiro de ahorro. Ambas plataformas lo clasifican como aporte sin duplicar el retiro; el efecto neto y el disponible quedan en 75 000 unidades menores en el caso verificado.
- React pasó 6/6 pruebas del dominio financiero y Flutter ejecutó el mismo archivo JSON compartido: `Financial summary contract vectors: PASS`.


### Seguridad y paridad del mapeo de migración Flutter/React (2026-11-01)

- La auditoría detectó que el mapeador Flutter copiaba el registro local completo dentro de `legacySnapshot`, a diferencia de la lista permitida que usa React. Ahora ambos conservan solo campos financieros permitidos; tokens, propietario, referencia bancaria sin hash, número completo de tarjeta y CVV se excluyen. Hash de referencia y últimos cuatro dígitos se conservan como metadatos minimizados.
- Los IDs deterministas de destino usaban prefijos y límites distintos (`local_`/80 en Flutter y `legacy_`/60 en React). Flutter ahora usa el mismo algoritmo que React. `shared/migration_document_id_vectors.json` verifica ambos para colecciones, colisiones sanitizadas, IDs largos y categoría con acento; las consultas por `localSourceId` siguen detectando migraciones previas.
- Pasaron 18/18 pruebas del servicio de migración React y el contrato Flutter independiente, incluyendo los vectores compartidos y exclusión de campos privados. TypeScript y el build web pasaron después de los cambios. `dart format` formateó el mapeador y su contrato; advierte que `flutter_lints` falta, pero la prueba Dart autónoma pasa. No se instaló nada ni se desplegó Firebase.


### Paridad de migración, espejos de ahorro y moneda local (2026-11-01)

- La migración web omitía correctamente un gasto espejo cuando también existe su movimiento de ahorro, pero clasificaba como savings_contribution cualquier gasto antiguo relacionado o con categoría “Aporte al Ahorro”. Eso podía llevar un registro del ledger de transacciones con el tipo reservado al movimiento de ahorro. Ahora todos los registros de la colección de transacciones migran como income o expense; la relación relatedSavingsMovementId se conserva cuando existe y las fórmulas los reconocen como aporte solo cuando no hay depósito enlazado.
- La regresión React verifica espejo enlazado omitido, vínculo huérfano conservado como gasto y aporte antiguo sin movimiento como gasto etiquetado; el movimiento del ahorro migra una sola vez. La prueba Flutter confirma el mismo esquema de movimiento espejo y el archivo compartido de resumen continúa verificando disponibilidad y aportes en ambos clientes.
- En Flutter, los presupuestos y metas nuevos respetan la moneda seleccionada en lugar de guardarse siempre como DOP. La vista previa de migración usa la moneda local solo como respaldo para registros sin campo de moneda; valores explícitos no se reinterpretan. No se tocaron fórmulas ni se convirtió ningún importe ya persistido.
- Verificación: 18/18 pruebas de migración React y 6/6 del resumen financiero React pasaron en copias temporales con Node 24; 13/13 contratos Dart standalone pasaron, incluidos el mapeador de migración, los vectores financieros compartidos y los demás contratos sin dependencias Flutter. tsc --noEmit, vite build, dart format --set-exit-if-changed y git diff --check terminaron correctamente.
- No se reintentó ninguna instalación. El análisis integral/build Android y Emulator Suite siguen bloqueados por dependencias de Flutter/Functions ausentes y falta de proyecto/configuración Firebase. No se conectó ningún proveedor de correo ni se desplegaron recursos.


### Normalización de documentos Firestore de versiones anteriores (2026-11-01)

- Además de evitar generar nuevos documentos inconsistentes, ambos repositorios normalizan al leer los registros antiguos donde un documento de transactions tiene kind=savings_contribution. En ese contexto se presenta como expense y su enlace/categoría conserva la clasificación contable. Los documentos originales no se reescriben al leerlos; revisiones remotas siguen calculándose sobre el payload original.
- React y Flutter consumen shared/savings_mirror_record_vectors.json con el mismo mapeo por colección; se cubren el documento legado, el movimiento canónico y un gasto ordinario. Se añadieron pruebas independientes en ambos lenguajes.
- Verificación actual tras este cambio: TypeScript pasa; Vite produce la web/PWA; cuatro pruebas del codec Firestore React pasaron en Node 24; 14/14 contratos Dart standalone pasan; formateo Dart y git diff --check pasan.
- No se compilaron los repositorios Flutter/Functions ni se ejecutaron emuladores porque faltan sus dependencias y configuración externa, según las entradas previas de este informe.

### Coordinador inyectable de sincronización de correo (2026-11-01)

- Se añadió mail_sync_worker.ts para conectar el cursor incremental, la bóveda de tokens, el lector seguro, la persistencia idempotente de candidatos y la revisión por usuario. El coordinador valida la cuenta verificada mediante el contrato de sincronización, limita el trabajo por páginas y solo avanza el cursor tras guardar o descartar cada mensaje de forma segura.
- Cuatro pruebas nativas cubren candidato pendiente, duplicado existente, mensaje no soportado y rechazo de cuenta no verificada antes de contactar al proveedor. El módulo y sus contratos pasan un typecheck aislado con TypeScript; el test se agregó al comando raíz.
- Este coordinador no exporta una callable ni inicia tareas. La activación sigue bloqueada hasta integrar parsers de avisos bancarios reales y configurar proyecto/secrets; evitar clasificación ficticia o silenciosa es requisito de seguridad. No hubo conexión externa.
- Después de sumar compatibilidad de documentos legados y el coordinador, TypeScript raíz y Vite build pasan; 14/14 pruebas Dart standalone y git diff --check pasan.

### Preferencias de moneda aisladas por modo (2026-11-01)

- Flutter ya no comparte la clave global de moneda entre el modo local y una cuenta. El modo local conserva su preferencia por dispositivo; la cuenta usa una clave local asociada al UID y sincroniza su valor con el documento de usuario. La clave antigua se lee como compatibilidad y se copia a la clave local si aún no existe.
- La vista previa de migración recarga y usa la moneda local separada aunque la cuenta tenga otra preferencia; no sustituye la configuración de la cuenta ni cambia los importes existentes.
- El contrato standalone de preferencias verifica claves aisladas, precedencia de valores por ámbito y compatibilidad de la clave antigua. Los 14 contratos Dart standalone pasan; no se pudo ejecutar el análisis/build Flutter completo sin pubspec.lock y .dart_tool.

### Separación de tipos por colección en Firestore (2026-11-01)

- Las reglas ya no permiten crear ni actualizar tipos savings_* dentro de users/{uid}/transactions; esos tipos solo se aceptan en savingsMovements. transactions queda limitado a income, expense y transfer. Los documentos antiguos aún pueden leerse y los repositorios los normalizan según su colección.
- Se añadió un contrato estático de reglas que protege esa separación, el bloqueo de escritura cliente en mailConnections y la denegación por defecto para rutas no declaradas. Pasó 3/3 con Node; cubre además la verificación de UID, correo verificado y ownerUid. TypeScript raíz y Vite build también pasan.
- Esta comprobación es un guard de fuente, no una evaluación de políticas por Firestore. El Emulator Suite continúa pendiente por falta de Firebase CLI/dependencias y de un proyecto de prueba; no se desplegaron reglas.

### Reutilización del token durante una página de sincronización (2026-11-01)

- El worker ahora pasa al lector seguro el token ya validado para la página actual. El token se obtiene de la bóveda una vez por página acotada, permanece en el backend y no se incluye en resultados ni documentos persistidos. Esto elimina consultas repetidas a la bóveda por cada mensaje de la misma página.
- 8/8 pruebas de sincronización y worker pasan en un harness temporal de Node 24; el typecheck aislado de los contratos Functions terminó sin errores. TypeScript raíz, build Vite/PWA y git diff --check también pasan.
- La suite completa de pruebas no llegó a iniciar: el runtime lanzó ENOMEM en uv_os_get_passwd desde tsx. No se alteró configuración ni se reintentó. El build muestra avisos existentes de chunk >500 kB y uso de __dirname en vite.config.ts.
- Sigue pendiente verificar Functions con dependencias y Flutter/Android con sus dependencias; los contratos sin dependencias permiten pruebas aisladas, pero esto no sustituye el build completo ni la Emulator Suite. No se instaló nada ni se desplegaron recursos.

- Verificación financiera adicional: 6/6 pruebas React con Node nativo, incluidos vectores compartidos React/Flutter; cuatro contratos Dart ejecutados desde la raíz pasan (resumen, enlaces espejo, migración y codec de cuenta). Los scripts Dart que consumen shared/ deben ejecutarse desde la raíz del repositorio.

### Aprobación de migración vinculada a cuenta (2026-11-01)

- MigrationPreview en Flutter conserva ownerUid y migrate rechaza una aprobación de otro UID antes de cualquier escritura. También se valida el UID antes de construir la vista previa. Evita reutilizar una aprobación después de cambiar de cuenta.
- Contrato Dart standalone de vinculación de cuenta: PASS; dart format y git diff --check correctos. La compilación completa Flutter sigue pendiente de dependencias; no se ejecutó migración real.

### Verificación de identidad de copias migradas (2026-11-01)

- Flutter verifica documento esperado, id interno, ownerUid, schemaVersion, origin y localSourceId al confirmar la copia remota. Una coincidencia de localSourceId en otro documento ya no basta para declarar la migración verificada.
- Contrato Dart standalone: PASS, incluidos rechazos por cada metadato incorrecto y por documento distinto. Formateo y diff check correctos. Build Flutter e integración Firestore pendientes de dependencias/configuración; no se ejecutó migración real.

### Integridad del contenido migrado (2026-11-01)

- La verificación Flutter compara todos los campos del payload aprobado salvo metadatos gestionados por el destino; comprueba también sourceEntity. La comparación recursiva cubre listas y mapas de presupuestos, importes y enlaces de ahorro. Campos ausentes o modificados impiden confirmar la copia.
- Contrato standalone PASS con importe alterado, enlace cambiado, presupuesto anidado distinto, lista incompleta y campo ausente. Formateo Dart y diff check correctos. Build Flutter e integración remota continúan pendientes de dependencias y configuración.

### Cuenta de destino de la revisión React (2026-11-01)

- La revisión remota de duplicados conserva remoteOwnerUid; ejecutar una vista previa revisada para otro UID se rechaza antes de contactar al repositorio. Se validan también UID vacíos o con separadores. Vistas previas locales conservan su contrato existente.
- Suite de migración React en harness temporal Node: 19/19 PASS tras copiar su fixture compartido. TypeScript raíz y build Vite correctos. No se instaló ni desplegó nada.

### Verificación de contenido de migración React (2026-11-01)

- FirestoreMigrationTarget recibe los registros esperados y confirma UID, documento, origen, colección y campos copiados; compara estructuras anidadas y excluye solo metadatos gestionados o exclusivos del cliente. El servicio exige esta verificación después de escribir.
- Prueba independiente de integridad PASS; regresión de migración 19/19 PASS; TypeScript y build Vite/PWA correctos. Persisten avisos del bundle y __dirname previamente documentados. Prueba remota Firestore pendiente de configuración/emuladores.

### Importación transaccional de preferencias React (2026-11-01)

- writeUserSettings comprueba y crea el perfil en una sola transacción; si otro dispositivo creó el documento, rechaza la importación sin sobrescribirlo. verifyUserSettings comprueba ownerUid y schemaVersion además de las preferencias.
- TypeScript y build web correctos. Concurrencia real de Firestore pendiente de pruebas con emuladores/configuración; no se afirma validación remota.

### Resultados asíncronos de una cuenta anterior (2026-11-01)

- accountSyncService descarta la continuación local de una operación cuyo UID ya no está activo: comprueba antes de escribir tras leer la revisión remota, antes de actualizar la revisión local y antes de publicar conflictos/errores desde el flush. Evita modificar la caché o la cola de la nueva sesión con el resultado de la anterior.
- TypeScript y build web pasan. La reproducción de cambio de cuenta con latencia remota sigue pendiente de integración Firebase; estos chequeos no cancelan una escritura ya enviada al servidor y las reglas siguen siendo la barrera de autorización.

### Generación de sesión para resultados pendientes (2026-11-01)

- El flush captura una generación que cambia al detener la sincronización. Las continuaciones de escritura, revisión y conflicto comprueban UID y generación, cubriendo también salir y volver a entrar con el mismo UID.
- TypeScript y build web correctos. La simulación de sesión con escrituras Firestore en vuelo sigue pendiente del entorno de integración. No se modificó Flutter ni se desplegaron recursos.

### Instantáneas tardías de sesiones anteriores (2026-11-01)

- Las suscripciones de colecciones y preferencias comprueban UID/generación antes de modificar almacenamiento o reportar errores. La observación del documento de usuario comprueba además la generación de autenticación y currentUser, evitando reactivar una cuenta desde un callback cancelado.
- TypeScript y build web pasan. Prueba de callbacks encolados con SDK/emulador pendiente. Flutter permanece sin modificaciones.

### Activación de sincronización vinculada a sesión (2026-11-01)

- enable comprueba UID autenticado y generación al iniciar, dentro de la transacción tras leer y antes de activar suscripciones. Inicializar preferencias y habilitar sincronización ocurre en una sola transacción; se conservan preferencias de un perfil que otro dispositivo haya creado concurrentemente. Se reutiliza el constructor de payload de preferencias.
- TypeScript y build web correctos; prueba remota de concurrencia/activación pendiente de Firebase configurado. No se desplegaron recursos ni se modificó Flutter.

### Suite completa de contratos con Node nativo (2026-11-01)

- Se ejecutaron todos los archivos del script test raíz mediante Node 24 --experimental-transform-types --test en una copia temporal de src/, shared/ y functions/src/. Se resolvieron extensiones relativas solo en la copia y se incluyeron las fixtures y firestore.rules; el proyecto y sus dependencias no se alteraron.
- Resultado: 116 pruebas, 116 correctas, 0 fallidas, 0 omitidas. Incluye dominio financiero React, migración, almacenamiento por modo, revisión de candidatos, OAuth/PKCE, bóveda, contratos de persistencia y sincronización de correo.
- Esto supera el bloqueo de ejecución de estos contratos en tsx sin cambiar el gestor ni configuración. El comando test original sigue expuesto a ENOMEM del entorno. Las comprobaciones de reglas son estáticas y las de persistencia usan puertos/dobles; no prueban políticas en Emulator Suite ni integración real Firebase. No se considera completada la fase React por este resultado.

### Primera comprobación de interfaz web local (2026-11-01)

- Vite preview iniciado en 127.0.0.1:4187, PID 24660, sobre el build actual. El navegador mostró la selección demo/local y la advertencia de cuentas sin configurar. Se observaron Estadísticas (cuatro pestañas, ocho indicadores, consejos y filtros) e Inicio sin pantalla en blanco; navegación a Inicio comprobada.
- El primer clic devolvió un error de observación de shadow root; se consultó el estado real posterior antes de continuar. No se da por probado el alta de movimientos ni persistencia/offline ni autenticación por esta observación. Se conserva la pestaña para continuar pruebas.

### Navegación Registro y Ahorro (2026-11-01)

- Se recuperó la conexión de automatización del navegador reiniciando únicamente su kernel; el proceso web y la pestaña existentes se conservaron. Registro y Ahorro renderizan al navegar. Registro muestra estado vacío del mes; Ahorro muestra tres metas existentes y total 35.500. No se crearon ni eliminaron registros.
- Esa sesión no permite inferir que sus datos sean nuevos o de demo: el código inspeccionado solo genera metas si activeStorageScope es demo y conserva las ya existentes en local. Falta comprobar el selector de modo y crear un entorno de prueba separado antes de afirmar aislamiento UI.

### Correcciones integrales React: inicio del flujo contextual (2026-11-01)

- Requisitos nuevos conservados en CORRECCIONES-REACT-SOLICITADAS.md; se priorizan antes de retomar la validación general. SavingsModal conserva initialGoalId como destino contextual y oculta el selector global de metas cuando se abre desde una meta, mostrando su nombre y título de operación. El flujo sin contexto mantiene la selección general/meta.
- TypeScript y build web pasan. Pendientes: entrada + contextual en SavingsView, integración categoría Ahorros desde Inicio, sistema reutilizable de modales, filtros/jerarquía Estadísticas, exportación única, consistencia visual Ahorro y los doce escenarios obligatorios. No se afirma cierre de estas correcciones.
- En navegador, origen localhost:4187 separado de 127.0.0.1:4187: elegir modo local muestra ceros y Ahorro sin metas de ejemplo; recargar conserva el modo local. No se añadieron registros ficticios.

### Aporte nuevo desde categoría Ahorros (2026-11-01)

- TransactionModal deriva nuevos movimientos expense de categorías Ahorro/Ahorros/Aporte al Ahorro a SavingsModal antes de persistir; App conserva importe, fecha y descripción del borrador. SavingsModal permite elegir destino general/meta y persiste mediante addSavingsMovement, que ya crea su espejo relacionado. No se escribe un gasto común adicional.
- TypeScript y build pasan; regresión de resumen financiero 6/6 PASS. Pendientes prueba UI del recorrido, edición de movimientos existentes, etiquetas y categorías del dashboard, contexto del botón + y demás requisitos del documento.

### Botón contextual de aporte en meta React (2026-11-01)

- El detalle de una meta presenta un + flotante 40×40 con nombre accesible que incluye la meta; llama onOpenSavingsModal con su ID. Sustituye el botón de texto Registrar aporte; el listado general no muestra este + y el retiro conserva su acción explícita. SavingsModal ya fija el destino recibido y oculta otras metas.
- TypeScript y build web pasan. Prueba de interacción y layout responsive todavía pendiente; no se declara cumplido el escenario 6 hasta ejecutarlo.

### Simplificación de acciones en Estadísticas (2026-11-01)

- App oculta su exportación global mientras Estadísticas está activa; conserva la acción del encabezado propio del módulo. Se eliminó el párrafo financiero redundante de Lectura rápida conservando indicadores y pistas.
- TypeScript/build correctos. Pendiente verificar que exportación corresponda a los filtros del módulo, añadir tipo de movimiento y completar jerarquía/filtros e interacción.

### Etiquetas de ahorro en reportes (2026-11-01)

- PDF y Excel usan transactionTypeLabel: los espejos enlazados o con categoría histórica Aporte al Ahorro se presentan como transferencia interna, no gasto. Importes y fórmulas permanecen intactos.
- Prueba de clasificación, TypeScript y build correctos. Exportación por rango/categoría aún pendiente: contrato actual del reporte es mensual y requiere ampliarse antes de conectar filtros; no se da por resuelto.

### Exportación del conjunto filtrado de Estadísticas (2026-11-01)

- AnalyticsView entrega un AnalyticsReport con período, categoría, indicadores formateados y movimientos visibles al modal compartido. PDF/Excel tienen una ruta de exportación de ese conjunto; los reportes mensuales existentes mantienen su ruta. No se recalculan los indicadores exportados.
- TypeScript y build pasan tras corregir un cierre JSX detectado durante comprobación. Pendiente prueba real de descarga y revisión de archivos PDF/Excel; los reportes de comparación y evolución aún requieren validar que su alcance esté claramente comunicado.

### Contenedor compartido de modales React (2026-11-01)

- ModalShell separa portal, role dialog/aria-modal, nombre accesible, Escape, ciclo de Tab, recuperación de foco y bloqueo del scroll del cuerpo. TransactionModal y SavingsModal lo reutilizan manteniendo validaciones y servicios específicos. Sus paneles desplazan contenido dentro de la altura disponible.
- TypeScript y build pasan. Pendientes pruebas reales de teclado/foco y móvil, extensión al resto de modales, errores/carga/confirmaciones reutilizables y escenarios financieros obligatorios. No se afirma auditoría completa de accesibilidad.

### Escenarios financieros de almacenamiento real (2026-11-01)

- Se añadió prueba en memoria del servicio real: ingreso inicial 1000, consumo 100, aporte general 200, aporte a meta 150, retiro 50 y gasto directo 25. Comprueba disponible 600, consumo 125, ahorro 275, meta 150, ingreso sin retiro duplicado y exactamente dos espejos enlazados. Datos exclusivos del test, sin persistencia en la aplicación.
- Suite storageScope 6/6 PASS en harness Node; TypeScript correcto. Esto prueba servicios y cálculos, no la interacción de formularios ni Firebase.

### Estructura modal compartida ampliada (2026-11-01)

- ExportModal, CategoryBudgetModal, MonthSetupModal y TransferModal reutilizan ModalShell, con tamaños md/lg para conservar sus anchos. Se evita role dialog duplicado en categorías. Se conservan formularios, validaciones y servicios específicos; Escape/foco/scroll dependen del contenedor común.
- TypeScript y build correctos. Pruebas de teclado, descargas, interacción y pantallas pequeñas pendientes. Los diálogos embebidos de eliminación de metas y otros flujos siguen pendientes de revisión/integración.

### Validación monetaria de formularios (2026-11-01)

- Movimientos, ahorro y transferencias comparten parseMovementAmount: entero menor positivo seguro y hasta dos decimales conforme al modelo de centavos. Se rechazan texto parcial, valores no finitos, exponentes y fracciones menores al centavo; no se redondean silenciosamente. TransactionModal muestra un error accesible en vez de ignorar la entrada inválida.
- Prueba de límites PASS; TypeScript y build correctos. Pendiente interacción real y extender validación a edición de metas/presupuestos sin alterar reglas financieras.

### Creación y estructura de metas React (2026-11-01)

- Crear meta reutiliza la validación de importes seguros, rechaza nombres vacíos tras trim y muestra error accesible; refresca los datos del contenedor después de guardar. El ancho coincide con Inicio/Registro; se homogeneiza padding inferior y el encabezado admite envoltura en pantallas estrechas.
- TypeScript/build correctos. Validación visual y flujo de crear/aportar/retirar en navegador pendientes; no se considera completada la revisión visual global de Ahorro.

### Ahorros como aportes en Inicio (2026-11-01)

- Las filas de presupuesto Ahorro/Ahorros/Aporte al Ahorro muestran summary.savingsTransfersTo y la etiqueta aportados; las demás conservan consumo. Se comparten los alias con el formulario y se adapta la etiqueta accesible del progreso. No se cambian fórmulas de disponible/consumo.
- Pruebas de presentación y resumen 7/7 PASS; TypeScript y build correctos. Pendiente adaptar detalle de categoría y verificar interfaz/ediciones.

### Detalle de categoría Ahorros (2026-11-01)

- El detalle recibe movimientos de ahorro del mes y presenta aportes y destino general/meta, sin listar sus espejos como gastos. El total utiliza aportes canónicos y el helper existente de aportes históricos sin vínculo; se avisa si hay un importe legado sin destino. Las categorías de consumo conservan edición y eliminación existentes.
- TypeScript/build correctos antes del texto aclaratorio; pendientes validación de interfaz, entrada contextual y edición de aportes.

### Acción contextual desde categorías (2026-11-01)

- FloatingActions admite una acción directa contextual sin abrir el menú genérico. App la conecta al detalle seleccionado: ahorro abre aporte; consumo abre gasto con initialCategory. TransactionModal conserva categorías personalizadas como borrador editable cuando no están en las opciones. Inicio/Registro sin contexto mantienen el menú existente.
- TypeScript y build correctos. Prueba UI del contexto y regreso de navegación pendiente; no se afirma ejecución del escenario interactivo.

### Edición de espejo de aporte React (2026-11-01)

- updateTransaction sincroniza aporte canónico, espejo y delta de meta local manteniendo IDs y tipo transferencia. Se impide reducir el aporte por debajo del saldo ya retirado de su meta local y el formulario comunica el error.
- Suite storageScope 7/7 PASS, TypeScript y build correctos antes del último guard/error. Pendientes revalidar ese guard y comportamiento en cuenta (incluida atomicidad remota), formulario contextual de edición de ahorro y escenarios UI. No se afirma sincronización Firebase verificada.

### Eliminación del espejo y prueba del guard de edición (2026-11-01)

- deleteTransaction delega al servicio de ahorro cuando elimina el espejo de un aporte existente; se conserva el flujo de reversión local de meta y eliminación de espejos, evitando dejar el aporte canónico oculto.
- storageScope 8/8 PASS: reducción inconsistente rechazada sin modificar datos; eliminación de aporte disponible elimina espejo/canónico y deja meta y fondo en cero. TypeScript/build correctos. Pendiente revisar eliminación de aportes cuyo dinero ya fue retirado/gastado, confirmación contextual y atomicidad remota antes de dar por cerrado este flujo.

### Eliminación de aporte con dinero ya utilizado (2026-11-01)

- Antes de eliminar un aporte activo se comprueba saldo global y saldo de su meta en centavos. Se rechaza la operación sin escrituras cuando sus fondos ya se usaron; App y SavingsView muestran el error. La prueba comprueba que se conservan espejo y canónico rechazados y permite eliminar después de corregir el retiro.
- storageScope 8/8 PASS; TypeScript y build correctos. Validación remota concurrente sigue pendiente de Firebase; la comprobación cliente no sustituye una transacción/reglas de servidor.

### Fechas y rangos inválidos en Estadísticas (2026-11-01)

- parseCalendarDay rechaza fechas inexistentes sin normalizarlas al siguiente mes. Un rango vacío/invertido oculta resultados y deshabilita exportación con error accesible, en vez de presentar silenciosamente el mes fallback. Los filtros permanecen disponibles para corregirlo.
- Prueba de fechas, TypeScript y build pasan. Pendientes pruebas UI de filtros y reporte, filtro de tipo de movimiento y presentación de exportación en comparación/evolución.

### Filtro de tipo de movimiento en Estadísticas (2026-11-01)

- Se añadió Todos/Ingresos/Gastos de consumo/Movimientos de ahorro. El conjunto filtrado alimenta resumen, categorías, comparación, evolución y reporte. El ingreso inicial solo se incluye en Todos/Ingresos; disponible se muestra no aplicable en vistas parciales. El reporte identifica el tipo seleccionado.
- TypeScript y build correctos. Pendientes pruebas automatizadas del filtrado y UI, categorías de ingresos/ahorros y asegurar que consejos/porcentajes no induzcan conclusiones sobre vistas parciales antes de considerar finalizado el filtro.

### Contrato de filtrado por tipo React (2026-11-01)

- filterAnalyticsMovements concentra la selección de tipos usada por AnalyticsView. Prueba verifica consumo ordinario y directo desde ahorro, espejos separados, aportes/retiros, ingreso inicial y conservación de originales. Ratios sobre ingresos y consejos generales no se muestran como conclusiones globales bajo un filtro parcial.
- Prueba de filtros, TypeScript y build pasan. Pendientes validación UI y opciones de categoría específicas de ingresos/ahorro.

### Opciones de categorías y cambio de período (2026-11-01)

- En vista de ingresos, el selector utiliza categorías de ingresos presentes en el período. Cambiar período/tipo reinicia categoría para evitar selecciones obsoletas. Movimientos de ahorro deshabilita el filtro de categorías de consumo y explica el alcance.
- TypeScript/build correctos. Pendientes pruebas de UI y revisión del ranking específico cuando se elige ingresos o ahorro, cuyos paneles aún están orientados a gasto.

### Ranking por tipo en Estadísticas (2026-11-01)

- Categorías presenta ranking de ingresos registrados o destinos de aportes cuando esos tipos están filtrados, con participaciones sobre su conjunto y títulos de alcance. El ingreso inicial no se inventa en una categoría; retiros no se restan del ranking de aportes. El panel consumo/presupuesto queda para Todos/Consumo.
- Prueba de breakdown, TypeScript y build correctos. Pendiente revisar metas homónimas y exportar el ranking específico además de indicadores/movimientos; pruebas UI pendientes.

### Identidad de destinos y ranking exportado (2026-11-01)

- Los destinos se agrupan por goalId, no por título; metas homónimas conservan filas independientes. El reporte estadístico incluye el ranking filtrado en hoja Excel y página PDF, reutilizando los valores calculados.
- Dos pruebas de breakdown PASS; TypeScript/build correctos. Descarga y render de archivos siguen pendientes; exportación de comparación/evolución aún pendiente de alcance específico.

### Alcance de reportes Comparar y Evolución (2026-11-01)

- makeReport toma aStats/bStats/compareCats o monthSeries según pestaña. Comparar exporta meses A/B, diferencias, variación y categorías; Evolución exporta meses e indicadores de su serie. No adjunta movimientos de un período global diferente. El reporte comparte tablas con el exportador PDF/Excel y bloquea comparar el mismo mes.
- TypeScript y build correctos. Falta probar descargas, contenido de archivos, apariencia y metadatos de filtros en cada pestaña; no se afirma exportación validada extremo a extremo.

### Generación real de archivos estadísticos (2026-11-01)

- buildAnalyticsExport separa generación y descarga; exportService delega sin duplicar tablas. Prueba Excel genera buffer, vuelve a abrirlo con XLSX y comprueba hojas/valores de comparación. Prueba PDF genera documento real y comprueba páginas y bytes. Se corrigió importación named de jsPDF/autoTable detectada por Node.
- Ambas pruebas PASS; TypeScript y build correctos. Pendientes render visual del PDF, descarga en navegador, datos extensos y reportes mensuales heredados.

### Errores y cierre de exportación (2026-11-01)

- ExportModal muestra fallo accesible y permite reintentar; ya no registra solo en consola ni programa un cierre tardío. El texto describe el alcance estadístico o mensual correspondiente. El estado de carga se libera en finally.
- Pruebas de archivos 2/2 PASS; TypeScript/build correctos. Pendientes prueba de error y descarga desde UI, render PDF y validación general de formularios.

### Regresión integral actualizada React/contratos (2026-11-01)

- Suite raíz completa: 127 pruebas, 127 correctas, 0 fallidas/omitidas. Se ejecutó Node 24 --experimental-transform-types --test sobre copia temporal actualizada, con extensiones relativas resueltas en la copia y un junction temporal a node_modules existente para las bibliotecas reales de exportación. No se instalaron paquetes ni se modificaron lockfiles.
- Incluye escenarios de almacenamiento real en memoria, edición/eliminación de espejos, validación monetaria/calendario, filtros/rankings, creación/relectura XLSX, estructura PDF, migración y contratos backend.
- Pendientes explícitos: 12 recorridos UI del documento de correcciones; teclado/foco y responsive; render visual PDF y descargas; reglas en Emulator Suite y cuenta/sync Firebase real. Flutter sigue detenido hasta revisión y autorización expresa del usuario.

### Caché detectada durante prueba de formularios (2026-11-01)

- En localhost:4187, tras recarga, configuración mensual no expone role dialog (count=0) aunque el build actual incorpora ModalShell. La sesión muestra assets anteriores; no se cuenta como prueba del formulario actualizado. No se ingresaron importes. Se inició preview separado en 127.0.0.1:4189 para aislar caché PWA y repetir.

### Configuración mensual verificada en navegador (2026-11-01)

- Origen de pruebas aislado 127.0.0.1:4189, pestaña 4: selección explícita de modo local vacío; formulario actualizado expone un dialog (count=1), con foco inicial en cerrar. Se introdujo ingreso inicial de prueba 1000 y se guardó; Inicio muestra dinero inicial 1000, disponible 1000 y gastado 0. Datos exclusivos de ese origen local sin Firebase, separados de 4187.
- No se afirma todavía persistencia de este importe tras recarga ni aporte/consumo por formulario. Pestaña conservada para continuar los escenarios.

### Filtro general y puerto único solicitados (2026-11-01)

- AnalyticsFilters reutiliza ModalShell y mantiene borrador hasta Aplicar; agrupa período, mes/año, rango, categoría, tipo y meses A/B en Comparar. Limpiar aplica valores iniciales. Se eliminaron controles de período/categoría/tipo del encabezado y selectores duplicados de comparación/evolución. Selecciones aplicadas sobreviven a cambios de pestaña.
- Vite server y script dev usan 5174 con strictPort y sin apertura automática. TypeScript/build correctos. Se cerraron solo previews propios PID 24660/34332 (4187/4189); no se inició servidor nuevo. localhost:5174 responde 200 con título MisCheles y cliente Vite.
- Listeners 5174: PID 9672 y 21324. Identificar ejecutable/comando está bloqueado por Acceso denegado en tasklist/CIM; se conservaron. Falta confirmar que la instancia existente sirve esta copia del proyecto y verificar interacción de filtros.

### Contrato del filtro general y duración de Evolución (2026-11-01)

- validateAnalyticsFilters comprueba mes/año, fechas reales e intervalo y meses de comparación antes de aplicar el borrador. Evolución de un filtro Mes ahora muestra un mes, no el valor histórico por defecto de seis. Año/6m/12m conservan duración y rango personalizado conserva recorte.
- Dos pruebas del contrato PASS; TypeScript/build correctos. Pendiente interacción real del panel y servir la copia actual en la instancia 5174: acceso a procesos/Docker continúa denegado; no se inició servidor alternativo.


## Avance React — Estadísticas y puerto 5174 (2026-11-01)

- Se reemplazaron los controles de consulta dispersos por un único botón «Filtros» y un panel con edición en borrador, Aplicar, Cancelar y Limpiar. Los criterios se conservan al cambiar entre Resumen, Categorías, Comparar y Evolución.
- El panel reúne mes/año, año, ventanas de 6/12 meses, rango personalizado, categoría contextual, tipo de movimiento y los dos meses independientes de comparación. Las opciones de categoría excluyen los espejos internos de ahorro y se limitan al tipo seleccionado.
- Los indicadores, desgloses, comparación y evolución consumen los criterios aplicados. Se conservan las definiciones financieras y se evita contar aportes espejo como gasto. El detalle de categorías también suma los gastos directos pagados desde ahorro.
- TypeScript: correcto. Build Vite: correcto; permanecen avisos de compatibilidad de __dirname y tamaño del chunk principal. Suite completa: 129/129 aprobadas. git diff --check: correcto.
- Vite quedó configurado en el proyecto de la rama con puerto 5174 estricto y open false; no se inició otra instancia local ni se abrió una pestaña.
- El contenedor visible en localhost:5174 corresponde a C:\Proyectos\MisCheles, no a este worktree. Se verificó HTTP 200 y que la fuente servida aún no incluye el filtro nuevo. Sus procesos de escucha son com.docker.backend y wslrelay, que reenvían el puerto; no se lanzó un segundo servidor Vite. El proyecto montado usa dependencias anteriores sin Firebase y no coincide con el árbol de la rama.
- No se sincronizó una copia parcial al contenedor porque el punto de entrada de la rama carga Firebase y el contenedor no tiene esa dependencia; hacerlo en caliente podría dejar la aplicación en blanco. El Docker Engine no aceptó conexión desde este entorno, así que no se reconstruyó ni reinició el contenedor. La corrección está lista y validada en la rama; actualizar ese contenedor requiere una reconstrucción controlada del proyecto montado o cambiar el volumen a este worktree.


### Actualización de Docker — preparación (2026-11-01)

- El Dockerfile ahora expone 5174 y Compose mapea el mismo puerto 5174:5174; se eliminó el override que permitía cambiar el puerto. La configuración de Vite usa 5174 con strictPort.
- Se preparó scripts/update-docker.ps1 para superponer el worktree sobre C:\Proyectos\MisCheles sin tocar .git, node_modules, .env ni borrar archivos del destino; después reconstruye solo el servicio web y comprueba localhost:5174 y la presencia de AnalyticsFilters. Su sintaxis PowerShell ya fue validada.
- No se ejecutó la sincronización porque el Docker Engine rechazó el acceso al named pipe npipe:////./pipe/docker_engine desde este entorno. Por esa razón C:\Proyectos\MisCheles y el contenedor no cambiaron; localhost:5174 sigue sirviendo la versión anterior hasta ejecutar el actualizador desde una PowerShell de usuario con Docker Desktop disponible.


### Confirmación posterior del usuario — Docker 5174 (2026-11-01)

El usuario ejecutó el actualizador con ExecutionPolicy Bypass. Robocopy finalizó sin errores y Docker construyó la imagen mischeles-web; Compose inició mischeles-web-1. La comprobación del script encontró la advertencia de seguridad interactiva de Invoke-WebRequest de Windows PowerShell y agotó el timeout. La verificación HTTP independiente confirmó 200 en la página y en AnalyticsView.tsx y AnalyticsFilters.tsx; ambos módulos servidos contienen el filtro nuevo. Se corrigió el actualizador añadiendo UseBasicParsing para evitar esa confirmación en futuras ejecuciones.


# Actualización de refactorización React Web — 2026-11-03

Esta sección refleja el estado de la refactorización por fases sobre el checkout actual. Conserva la línea base histórica anterior; las observaciones anteriores no describen necesariamente el estado vigente.

## Cambios aplicados

- Se añadió un contrato de repositorio de aplicación para operaciones financieras web y un adaptador de almacenamiento local. Las vistas y modales React utilizan ahora la fachada de aplicación; el detalle de localStorage queda en el adaptador y los servicios de sincronización siguen usando la infraestructura que ya tenían.
- Se extrajo la lectura de datos del período y su refresco por cambios locales/remotos a useFinanceWorkspace.
- Se trasladó la visibilidad y los borradores de modales a useAppModals; App.tsx conserva la composición del layout y conecta las acciones de cada funcionalidad.
- Se conservó la navegación History API y se aisló su coordinación en useAppNavigation; las rutas existentes no cambiaron.
- Se centralizaron en dominio los gastos por categoría, la proyección de avisos presupuestarios, las consultas de rango/mes usadas por Estadísticas y las reglas de generación de Consejos.
- La fórmula de dinero disponible quedó en una función común consumida tanto por el resumen financiero mensual como por el análisis de rangos. No se cambió el tratamiento aprobado: saldo de apertura y arrastre + ingresos + retiros de ahorro − gastos del mes − aportes; los gastos directos desde ahorro cuentan como consumo, pero no descuentan efectivo mensual.
- La lectura y persistencia de saldos base de metas usan una función de dominio compartida. Los movimientos marcados balanceAffecting: false se excluyen tanto al calcular el saldo visible como al volver a guardar el saldo de apertura.
- Se añadieron pruebas aisladas para consultas de categorías, proyecciones de presupuesto, cálculos de Estadísticas, consejos y reconciliación del saldo base de metas.
- El script de pruebas usa el runner nativo de Bun, que es el runtime ya empleado por este proyecto. La suite anterior con tsx --test fallaba antes de iniciar tests por uv_os_get_passwd returned ENOMEM en Node 24; Bun ejecutó la suite completa sin cambiar dependencias ni sus versiones.

## Verificación en este checkout

- bun run lint: correcto.
- bun run test: correcto; 151 pruebas en 42 archivos.
- bun run build: correcto. Vite advierte que el bundle principal supera 500 kB y que __dirname en la configuración emitirá una advertencia de compatibilidad con el futuro config loader nativo; son avisos, no fallos del build.
- No se ejecutaron compilaciones ni se modificaron fuentes Flutter.
- No se desplegaron reglas, Functions ni se conectó un proyecto Firebase real.
- No se hizo una verificación visual en navegador ni una prueba de Firestore Emulator.

## Pendientes y límites de seguridad de datos

- El saldo legacy currentAmount se conserva como saldo de apertura para los ámbitos existentes; no se realizó una conversión destructiva de registros locales ni una reconstrucción supuesta de historiales.
- La integración de correo y sincronización requiere proyecto, credenciales y verificación de backend; el código de contratos no equivale a despliegue operativo.
- Docker está configurado para enlazar src, public, index.html, vite.config.ts y tsconfig.json desde el checkout desde el que se inició Compose. En esta sesión, la API de Docker rechazó el acceso al daemon con “permission denied” y la lectura de C:\Users\Mateo\.docker\config.json fue denegada; por eso no se inspeccionó el contenedor activo ni se lo reinició. La aplicación compilada en este checkout no debe considerarse ya instalada en el contenedor de localhost:5174.
- El árbol Git tenía cambios y archivos sin commit antes de esta refactorización. No se creó un commit global para no incorporar en él cambios anteriores que no pertenecen a esta fase.
