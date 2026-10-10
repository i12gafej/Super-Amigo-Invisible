# Fuentes oficiales consultadas — 10 de octubre de 2026

Esta revisión no sustituye las comprobaciones de compilación ni de integración.

| Fuente | Aplicación al proyecto |
| --- | --- |
| [Next.js: PWA](https://nextjs.org/docs/app/guides/progressive-web-apps) | Manifest, iconos PNG de 192 y 512, HTTPS y cabeceras específicas de `/sw.js` sin caché HTTP. El caché del service worker solo guarda recursos públicos. |
| [Next.js: release de seguridad de septiembre de 2026](https://nextjs.org/blog/september-2026-security-release) | Subir el mínimo de Next.js y eslint-config-next a 15.5.27; no afirmar que la instalación está auditada sin resolver dependencias. |
| [React: vulnerabilidades RSC y actualización de enero de 2026](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components) | Subir mínimo de React/React DOM a 19.2.4 y verificar los paquetes RSC transitivos resueltos antes de publicar. |
| [Supabase: funciones de base de datos](https://supabase.com/docs/guides/database/functions) | Preferir invoker, usar search_path vacío y revocar EXECUTE de PUBLIC, anon y authenticated. Las RPC administrativas solo las llama el backend autorizado con service_role. |
| [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | RLS en todas las tablas, sin políticas públicas, clave service_role exclusivamente en servidor. Añadir pruebas allow/deny y comprobar privilegios. |
| [GitHub: crear/actualizar contenido](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents) | La lectura y los permisos del usuario no prueban que la instalación de la app tenga permiso para escribir contenido. La subida del archivo inicial fue rechazada con 403 y no se creó ningún commit remoto. |

## Acceso remoto observado

El conector permite leer metadatos de `i12gafej/Super-Amigo-Invisible`; se confirmó que no tiene ramas. El intento de crear `.gitignore` devolvió `Resource not accessible by integration`. La instalación accesible enumerada pertenece a `javiyalicia2023`, no al propietario del repositorio solicitado. No se usó otra cuenta para intentar escribir.

El CLI sigue sin conectar al proxy configurado y npm devuelve `EPERM` al intentar usarlo. No se han eludido las restricciones del proxy ni reutilizado credenciales de otras cuentas.

## Actualización del acceso y verificación

La cuenta `i12gafej` ya tiene una instalación del conector y permite escribir en el repositorio. Se inicializó `main` con `.gitignore` y se publicaron los commits en `feat/super-amigo-invisible`, con el [PR #1](https://github.com/i12gafej/Super-Amigo-Invisible/pull/1). La primera ejecución de GitHub Actions aprobó las trece pruebas, TypeScript, lint, build y la integración SQL en PostgreSQL 16. La conexión a Supabase real, las pruebas visuales y el despliegue siguen pendientes. El acceso de red del CLI local no cambió.
