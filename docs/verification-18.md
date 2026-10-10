# Verificación con 18 participantes

Pruebas reproducibles en `tests/draw-18.test.ts`, con nombres e identificadores ficticios y semillas fijas. No acceden a Supabase ni modifican salas reales. Ejecutar `npm test`.

## Casos comprobados

- 200 sorteos sin restricciones.
- 100 sorteos que excluyen a seis familias de tres personas.
- 100 sorteos que excluyen a nueve parejas en ambos sentidos.
- 100 sorteos con las 18 parejas obligatorias y una única solución.
- 200 sorteos con dos donantes obligatorios situados al final de la lista.
- 200 instancias generadas con solución conocida, las cuatro reglas de dar/recibir, listas múltiples y AND/OR/NOT.
- 100 instancias mixtas pasando por UI → texto → UI → motor.
- 35 instancias imposibles: receptores compartidos por donantes obligatorios, personas sin donante posible, cuatro donantes para tres receptores, contradicciones directas, autoasignación forzada, negación de todos los destinatarios y OR con todas las alternativas imposibles.
- 300 árboles lógicos anidados con 18 personas, catorce parejas fijadas y un subgrupo de cuatro. Un oráculo enumera las nueve permutaciones sin autoasignación del subgrupo y verifica de forma independiente la existencia de solución. Esto no es una enumeración exhaustiva de los sorteos de 18 personas.

Cada sorteo válido se comprueba con un evaluador independiente: 18 donantes, 18 destinatarios distintos, pertenencia a la sala, ausencia de autoasignación y cumplimiento de toda la fórmula. Las instancias imposibles deben producir un error de imposibilidad, no un resultado parcial ni agotamiento del límite de búsqueda.

## Corrección encontrada

La búsqueda anterior podía agotar 250.000 pasos en restricciones válidas cuando los donantes obligatorios figuraban al final. La evaluación parcial ahora reconoce que un destinatario ya ocupado no puede satisfacer otra pareja pendiente. Se calculan candidatos restantes, se elige primero la persona con menos opciones y se comprueba que los candidatos admitan un emparejamiento completo antes de seguir explorando. Esta comprobación es necesaria, pero no suficiente para fórmulas arbitrarias: AND/OR/NOT se siguen evaluando y el resultado completo se valida.

Se mantienen la validación SQL al persistir, la aleatoriedad criptográfica del backend, la inmutabilidad de los sorteos existentes y el límite de 250.000 nodos. No se garantiza distribución uniforme ni que cualquier fórmula admitida termine antes del límite.

## Medición local, 10 de octubre de 2026

Para los 1.000 sorteos válidos: mediana 1,90 ms, percentil 95 6,39 ms y máximo 10,75 ms. La medición incluye el motor y su validación inicial; excluye red, Supabase, renderizado y conversión de texto. Son resultados de este entorno, no una garantía de latencia de Vercel. La suite completa contiene 33 pruebas y todas pasan.
