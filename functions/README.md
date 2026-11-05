# Firebase Functions

Backend de operaciones sensibles de Mis Cheles. La fuente está separada de los clientes para que el navegador y Android nunca administren credenciales de servidor.

## Eliminación de cuenta

`deleteMyAccount` requiere una sesión Firebase reciente (5 minutos), correo verificado, App Check en despliegues y confirmación literal `DELETE`. Solo toma el UID del token autenticado. Borra recursivamente `users/{uid}` y sus subcolecciones antes de borrar la identidad Firebase Auth. Un fallo de limpieza no elimina la identidad y permite volver a intentar; la operación no es atómica y puede incurrir en lecturas/borrados Firestore.

La función no recibe UID ni rutas de datos del cliente. OAuth de Gmail/Outlook no está implementado y no existen tokens externos que limpiar en esta etapa. Cuando se añadan conexiones, la revocación/borrado de secretos en backend debe añadirse al flujo antes de producción.

## Desarrollo local

Desde la raíz del repositorio: `firebase emulators:start --only auth,firestore,functions --project demo-mischeles`. Las reglas Firestore y políticas callable deben verificarse con Emulator Suite antes de activar un proyecto.

Dependencias y compilación: en esta carpeta ejecutar `npm install` y `npm run build`. En producción hay que elegir región y configurar App Check; no se creó proyecto ni se desplegó nada.


El lector del proveedor falla de forma cerrada si se crea sin parsers bancarios válidos. Hasta registrar formatos soportados, no se debe conectar un disparador de sincronización que haga avanzar los checkpoints.
