# Eliminación de participantes

Administración → Participantes → Gestionar → Eliminar participante abre una confirmación. El borrado definitivo elimina el registro, su lista y los datos del enlace; el enlace y las sesiones personales dejan de funcionar. El administrador puede volver a registrar ese nombre con un enlace nuevo.

## Activación en Supabase existente

Ejecuta únicamente `supabase/migrations/002_delete_participants.sql` en el editor SQL del proyecto. No vuelvas a ejecutar `001_secure_rooms.sql` en una instalación existente. La migración nueva es aditiva: crea una RPC privada y concede al rol de servidor el permiso de borrado. No elimina datos por sí misma. Para una instalación nueva, aplica 001 y después 002.

## Límites

- Si el participante aparece en una restricción, hay que quitar las referencias primero. La aplicación nunca elimina o cambia reglas automáticamente.
- Si aparece como donante o destinatario en cualquier sorteo histórico, no se puede eliminar. Se puede revocar el enlace, conservando el registro y el historial.
- No se eliminan participantes de otra sala aunque se envíe su UUID.
- Se necesita una sesión administrativa válida y `confirm: true`. El backend obtiene la sala de esa sesión, no del cuerpo de la solicitud.

La transacción bloquea la sala y el participante, comprueba referencias, borra y aumenta la revisión de la sala. Esto invalida los cálculos de sorteos hechos con una lista anterior. Los bloqueos se comparten con registro, reglas y sorteo para evitar carreras. Las claves foráneas e inmutabilidad de los sorteos se mantienen.

La RPC no es ejecutable por PUBLIC, anon ni authenticated. La clave service_role permanece solo en el backend. Si falta la migración, la aplicación muestra qué archivo hay que ejecutar, sin revelar errores internos.

## Comprobaciones

`tests/participant-removal.test.ts` prueba confirmación, referencias anidadas, invalidación del enlace y del portal, nuevo registro e historial en la demo. `supabase/tests/participant-removal.sql` comprueba borrado real en PostgreSQL 16 desechable, aislamiento entre salas, rollback de operaciones bloqueadas, revisión, snapshots obsoletos y permisos de los roles. `scripts/test-simulation-boundary.mjs` también verifica el endpoint real de eliminación con una API PostgreSQL simulada: roles rechazados, confirmación, UUID y sala fijada por la sesión.
