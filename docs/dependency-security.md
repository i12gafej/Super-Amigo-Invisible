# Auditoría de dependencias

Revisión del 10 de octubre de 2026, basada en los informes reales de npm de GitHub Actions.

## PostCSS

La primera instalación de Next.js 15.5.27 incluía una copia transitiva de PostCSS con avisos de lectura de mapas y escape de CSS. Se añadió un override de PostCSS 8.5.23, que mantiene la API de la misma versión mayor. La compatibilidad se verifica con TypeScript, lint y build en CI. Fuente: [aviso de PostCSS y versión corregida](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).

CI exige `npm audit --omit=dev --audit-level=low` para impedir aprobar una instalación de producción que npm marque como vulnerable.

## Herramientas de desarrollo: braces

El informe completo también incluye la cadena eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces. El aviso [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) afecta a patrones de llaves anidados y no tiene versión corregida publicada en la fecha de revisión.

Esta cadena pertenece al lint de desarrollo, no a las dependencias de producción. La aplicación no ofrece un endpoint que procese patrones de glob recibidos de usuarios. El informe completo se conserva y este aviso permanece abierto: no se declara el árbol de desarrollo libre de vulnerabilidades ni se suprime el aviso. No se aplica la bajada automática a eslint-config-next 14 sugerida por npm, porque cambiaría la versión mayor de configuración respecto al framework y no constituye una actualización del paquete afectado.

Al publicarse una corrección, actualizar la cadena, generar el lockfile y repetir lint, build y auditoría completa. Evitar ejecutar lint sobre configuraciones de repositorios no confiables.
