# Reglas del sorteo

En Administración → Restricciones se puede elegir **Modo UI** o **Modo texto**. Ambos generan el mismo árbol lógico que valida el backend y se conserva con cada sorteo. No requieren servicios de IA ni claves adicionales.

- **Solo puede regalar a:** su destinatario debe ser una de las personas seleccionadas.
- **No puede regalar a:** excluye a todas las personas seleccionadas como destinatarios.
- **Solo puede recibir de:** quien le regala debe ser una de las personas seleccionadas.
- **No puede recibir de:** excluye a todas las personas seleccionadas como donantes.

Cada participante sigue dando y recibiendo exactamente un regalo. Una lista de varias personas es un conjunto de opciones, no varios regalos. La autoasignación siempre está prohibida. Elegir una única persona con «solo puede» fija la pareja.

TODAS combina condiciones con AND. ALGUNA combina con OR. NO niega una sola condición o grupo; para negar varias, introduce un grupo TODAS o ALGUNA dentro. La UI admite grupos anidados y conserva los árboles existentes. El formato JSON sigue disponible para casos avanzados.

## Texto

Escribe una condición por línea usando los nombres completos de la sala:

```text
TODAS {
  "Ana García" no puede regalar a "Luis Pérez", "Marta Ruiz"
  "Luis Pérez" solo puede recibir de "Carlos"
  ALGUNA {
    "Carlos" debe regalar a "Marta Ruiz"
    "Carlos" debe recibir de "Ana García"
  }
}
```

Las comillas son necesarias cuando un nombre contiene comas. Sin grupos, todas las líneas se combinan con AND. «Debe» es equivalente a «solo puede». No se interpreta prosa libre: las frases desconocidas, nombres inexistentes o ambiguos y grupos mal cerrados se rechazan indicando la línea. Si hay nombres duplicados, el editor muestra un identificador para distinguirlos.

Puedes pedir en el chat que se conviertan condiciones coloquiales a este formato y pegarlas en Modo texto. La app convierte el formato mediante un parser local, sin enviar participantes a un servicio externo de IA.

**Comprobar reglas** valida el borrador en el servidor sin guardarlo ni modificar las reglas vigentes. **Guardar reglas** valida y persiste el árbol solo si existe un sorteo posible. Los cambios no alteran sorteos ya realizados: solo se aplican cuando el administrador ejecuta expresamente uno nuevo.
