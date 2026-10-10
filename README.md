# SUPER AMIGO INVISIBLE

PWA mobile-first en Next.js 15, React 19, TypeScript, Tailwind CSS 4 y Supabase PostgreSQL. Interfaz en español, sin cuentas personales y sin servicios de pago obligatorios.

## Estado de entrega

Código local en `/workspace/Super-Amigo-Invisible`, rama `feat/super-amigo-invisible`, subido mediante el conector de GitHub. [PR #1 en borrador](https://github.com/i12gafej/Super-Amigo-Invisible/pull/1).

- Los commits separan primero interfaz/demo y después backend, validaciones y pruebas.
- Trece pruebas de lógica, criptografía, entradas y ciclo completo de demo pasan localmente y en CI.
- TypeScript, ESLint y build de producción pasan en [GitHub Actions](https://github.com/i12gafej/Super-Amigo-Invisible/actions/runs/38036260170). La ejecución posterior también aprobó lint sin avisos, build y auditoría de producción: [resultado](https://github.com/i12gafej/Super-Amigo-Invisible/actions/runs/38036554997).
- La migración se aplicó y las pruebas de aislamiento, permisos, revocación e historial pasaron en PostgreSQL 16 desechable en CI.
- No se ha conectado a un proyecto Supabase real, ni probado visualmente en navegador, ni desplegado.
- La auditoría de producción informa de cero vulnerabilidades tras actualizar PostCSS. Queda abierto el aviso sin parche publicado de braces, en la cadena de desarrollo de ESLint. Alcance y seguimiento: [docs/dependency-security.md](docs/dependency-security.md).
- El CLI del entorno sigue sin acceso a npm/Git por el proxy; la subida y las comprobaciones se realizan mediante el conector y GitHub Actions.

Fuentes oficiales y diagnóstico: [docs/references.md](docs/references.md). Las pruebas SQL están en `supabase/tests/integration.sql`.

La demo persiste exclusivamente datos simulados en `localStorage` bajo `sai-demo-v2`; sus botones no usan los endpoints reales. La aplicación real nunca cambia silenciosamente a datos de demo. Los portales y las respuestas privadas no se almacenan en la caché del service worker.

## Arranque local

Requiere Node.js 24 y acceso a npm:

```sh
npm install
npm run dev
```

Abre `http://localhost:3000/demo`. La contraseña de demo puede ser cualquiera. Desde su franja superior se prueban registro, portal y administración, o se reinician los datos simulados. El enlace demo se conserva al recargar el mismo navegador; solo simula acceso, no ofrece protección. No introducir información privada en la demo.

Para modo real, copia `.env.example` a `.env.local` y sustituye los valores ficticios. No subas este archivo al repositorio. Configura:

| Variable de servidor | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de backend; nunca `NEXT_PUBLIC_*` |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes aleatorios expresados como 64 caracteres hexadecimales |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres para firmar cookies |
| `APP_ORIGIN` | Origen exacto, por ejemplo `https://regalos.example.org` |

Genera cada secreto por separado en tu equipo y guárdalo exclusivamente en el gestor de secretos del alojamiento o `.env.local` ignorado. Cambiar la clave de cifrado sin migrar los datos impide recuperar enlaces existentes. Cambiar `SESSION_SECRET` invalida todas las sesiones.

Aplica `supabase/migrations/001_secure_rooms.sql` al proyecto desde el editor SQL de Supabase. Si ya hay tablas de Navidad existentes, adapta la migración al esquema real antes de ejecutarla: no está autorizado destruir ni sustituir datos existentes. `supabase/seed.example.sql` muestra cómo crear una sala con dos contraseñas distintas, compartida y administrativa. Sustituye sus valores ficticios en el editor, no en un archivo versionado. Las contraseñas se almacenan con bcrypt; límite de 72 bytes UTF-8.

Rutas: `/` registro, `/portal#TOKEN` acceso personal, `/admin` administración y `/demo` simulación. Al abrir un enlace real, el navegador elimina el fragmento visible antes de intercambiarlo por una cookie HttpOnly; conserva tu copia original. La cookie expira a los 30 días y el enlace es reutilizable hasta revocarlo o regenerarlo. El administrador puede copiarlo y abrir `wa.me` para reenviarlo: el usuario decide y envía en WhatsApp, la aplicación no envía mensajes automáticamente.

## Seguridad y persistencia

Todas las operaciones reales son POST JSON, validan el origen y rechazan cuerpos mayores de 32 KiB. Los endpoints verifican la sesión en servidor y vuelven a consultar la identidad y la validez del token. Las cookies son HttpOnly, SameSite Strict y Secure en producción. El acceso administrativo requiere una contraseña distinta de la compartida y se invalida al cambiar su hash. La RPC también rechaza usar la contraseña compartida para administración aunque ambas contraseñas hayan sido configuradas iguales por error.

Cada enlace contiene 32 bytes aleatorios. PostgreSQL guarda SHA-256 para validación y una copia AES-256-GCM recuperable por el backend únicamente tras autorización administrativa. Revocar o regenerar invalida las sesiones de ese participante. Editar una lista comprueba también el hash dentro de la transacción para evitar carreras con la revocación.

La contraseña de sala solo permite registrar un participante nuevo y consultar nombres parecidos; no devuelve IDs, tokens, listas ni asignaciones de participantes existentes. Los nombres parecidos son visibles porque el flujo solicitado requiere comprobar duplicados. El participante solo recibe sus propios datos y el nombre y lista actual del destinatario vigente.

Todas las tablas tienen RLS activado y ninguna política para `anon` o `authenticated`. Se revocan los permisos públicos de tablas y funciones RPC. Solo el backend usa `service_role`. Las funciones RPC con argumentos administrativos no son endpoints autorizados por sí mismos: su ejecución está restringida a ese rol privado. No crees políticas públicas para solucionar errores de permisos.

Los límites de intentos se persisten en PostgreSQL. En el alojamiento, el proxy debe sobrescribir `X-Real-IP` / `X-Forwarded-For` con la IP real; no debe aceptar cabeceras arbitrarias del cliente. Sin estas cabeceras, se usa un límite compartido conservador. Publica bajo HTTPS y define `APP_ORIGIN` con el dominio final.

El guardado de un sorteo bloquea la sala, compara su revisión y valida otra vez la biyección, pertenencia, ausencia de autoasignaciones y restricciones en SQL. Registro, cambios de reglas y nuevos sorteos incrementan esa revisión. El sorteo y sus parejas se insertan en una sola transacción. Cierra registro y listas; las excepciones de edición pueden otorgarse o retirarse individualmente. Los triggers rechazan modificar o borrar sorteos y asignaciones. Un nuevo sorteo exige confirmación expresa y deja intacto el historial.

## Restricciones

El editor administrativo admite árboles JSON con participantes identificados por UUID:

```json
{
  "op": "AND",
  "rules": [
    {"op": "NOT", "rule": {"op": "pair", "giver": "UUID-ANA", "recipient": "UUID-PABLO"}},
    {"op": "OR", "rules": [
      {"op": "pair", "giver": "UUID-LUCIA", "recipient": "UUID-ANA"},
      {"op": "pair", "giver": "UUID-LUCIA", "recipient": "UUID-PABLO"}
    ]}
  ]
}
```

`pair` afirma una correspondencia; AND, OR y NOT se evalúan sobre el conjunto completo. Siempre se evita regalarse a uno mismo. AND vacío permite cualquier sorteo válido. OR vacío se rechaza. El motor admite entre 2 y 80 participantes, profundidad máxima 8, hasta 30 hijos por nodo y 250.000 pasos de búsqueda. Si alcanza el límite, informa de complejidad sin guardar un resultado parcial. No garantiza distribución uniforme entre todos los sorteos válidos; utiliza aleatoriedad criptográfica en producción.

## Verificación e integración

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

CI incluye estas cuatro comprobaciones y un job independiente que aplica la migración y comprueba aislamiento, permisos, revocación y persistencia en PostgreSQL 16 desechable. Se sube el lockfile generado como artefacto para revisarlo. Se conserva `package-lock.json`, generado en el runner y revisado para que solo use el registro público de npm. CI utiliza `npm ci` para reproducir esa instalación. La auditoría completa conserva el aviso abierto de braces en desarrollo; la auditoría de producción debe pasar obligatoriamente.

Antes de publicar, verifica en una base de pruebas: dos salas separadas; registro duplicado concurrente; tokens manipulados, revocados y regenerados; bloqueo de listas; permisos excepcionales; acceso anónimo a tablas y RPC denegado; sorteo imposible; dos sorteos simultáneos; historial inmutable y ausencia de datos ajenos en la respuesta del portal. El script SQL de CI cubre aislamiento, permisos de tablas y RPC, cierre de listas, excepciones, revocación y regeneración, validación de sorteos e historial. CI también incluye pruebas de registro duplicado simultáneo y dos sorteos sobre la misma revisión. Las pruebas completas de endpoints y la revisión en Supabase real siguen pendientes.

Next.js requiere un alojamiento con servidor Node, no un export estático. Para una prueba personal puede utilizarse un plan gratuito compatible y Supabase Free; revisa los límites vigentes del proveedor antes de publicar. No se ha contratado ni desplegado ningún servicio.
