# Evaluación del rediseño

## Qué se verificó técnicamente

Los resultados concretos quedan en [`data-checks.json`](data-checks.json) y [`ui-checks.json`](ui-checks.json). Las capturas de `capturas/` se obtienen de la aplicación real con los datos publicados en esta rama.

### Datos

La validación independiente vuelve a leer el CSV agregado y cuenta los días a partir de fechas. Comprueba 2 120 perfiles y 356 160 celdas: normalización, ajuste de exposición, peso AM, fin de semana, promedios diarios, distancias, índices y composición del sistema. También comprueba 45 ventanas de consulta, hashes, IDs únicos, cobertura de los 424 complejos y unión con catálogo. No depende de red ni paquetes externos.

```bash
python3 scripts/redesign/validate_atlas.py
```

### Aplicación

La comprobación con Playwright usa Chromium y acciones reales sobre el navegador: cambio de vista/año, filtros, selección de estación, comparación fijada, huella de 168 sectores y equivalente matricial, mapa y trayectoria, brush, zoom, vecinos, contexto de servicio por estación, exportación, guardado, búsqueda vacía y restauración por URL. Comprueba ausencia de errores de JavaScript y solicitudes fallidas, recursos de ejecución locales y disposición de 390 px sin desbordamiento horizontal.

Con el servidor HTTP de la raíz activo:

```bash
# Playwright es una dependencia de QA, no de la aplicación.
# Si no está instalado, usar un entorno local de herramientas:
npm install --prefix work/qa playwright
npx --prefix work/qa playwright install chromium
NODE_PATH="$PWD/work/qa/node_modules" node scripts/redesign/smoke.cjs
```

El script puede usar `ATLAS_URL` para la URL de ejecución, aunque presupone que la aplicación se sirve en `/atlas/`. El registro incluye versión de navegador, fecha y lista de comprobaciones. No se afirma verificación en Safari/Firefox ni conformidad integral de accesibilidad.

## Evaluación con personas: pendiente

El código funcional no demuestra que el diseño resuelva mejor las tareas. Se propone una crítica formativa con 3–5 compañeros y al menos una persona familiarizada con análisis de transporte, si está disponible. No es un estudio estadístico ni representa a todos los planificadores MTA.

| Ejercicio | Criterio de logro | Qué observar |
|---|---|---|
| Explicar una celda del atlas y una del reloj | Distingue porcentaje de una semana y diferencia en pp, e identifica día/hora | Confusión entre volumen y forma; dificultad radial |
| Encontrar una estación con pérdida de peso AM y verificarla | Usa una entrada al análisis, consulta perfil y obtiene valores correctos | Tiempo, errores, si necesita ayuda y qué interpretación produce |
| Comparar un complejo con un vecino de forma y con otro borough | Fija casos o busca similares y consulta geografía sin perder selección | Comprensión de similitud; si la interpreta erróneamente como misma función o causa |
| Identificar volumen cercano a base pero forma distinta | Explica índice de volumen y distancia TV de un caso del preset | Si confunde “recuperación” con vuelta de los horarios |
| Seguir la trayectoria del sistema | Ordena correctamente los años y describe las dos medidas | Si interpreta líneas como rutas, flechas como causalidad o ejes con dominios cambiantes |
| Documentar y cuestionar un hallazgo | Guarda o exporta grupo y menciona al menos un límite pertinente | Trazabilidad, uso de fuentes, cautela con 2021 y datos actuales |

Registrar respuesta exacta, aciertos, errores, ayuda recibida, tiempo aproximado y comentario del participante. Alternar el orden reloj/matriz entre personas para reducir sesgo de aprendizaje. Comparar cómo resuelven una tarea en el prototipo anterior y en el atlas sin asumir superioridad por apariencia.

## Decisiones que debe resolver la crítica

1. ¿El reloj semanal aporta comprensión del ciclo o añade esfuerzo frente a la matriz?
2. ¿Se entiende la distancia TV? Si no, mejorar explicación o sustituir su papel principal por una medida más directa.
3. ¿El overview de 424 filas permite reconocer franjas antes de ampliar?
4. ¿Los años y la dirección de las trayectorias se leen sin errores? ¿Se necesita una secuencia animada opcional o anotaciones adicionales?
5. ¿La saturación de color se reconoce? Evaluar sensibilidad de escalas y ofrecer dominios alternativos si altera lecturas.
6. ¿Los filtros ±2 pp y el preset volumen 80–120 % / TV ≥10 pp parecen umbrales naturales? Deben entenderse como ejemplos analíticos, no significancia estadística.

## Riesgos de representación pendientes de revisar

- Los anillos externos tienen mayor área; el color, no el área, codifica valor. El equivalente matricial mitiga este problema pero requiere evaluación.
- Los puntos del mapa pueden solaparse a escala general; el zoom y la lista accesible ayudan, pero no garantizan descubrimiento de todos los casos.
- Las etiquetas de años cercanos pueden competir en trayectorias de varias estaciones. Se limitan las destacadas y existe tooltip; revisar casos densos.
- Las consultas espaciales por brush requieren puntero. Filtros y selector ofrecen alternativas de selección, pero falta una auditoría completa por teclado/lector de pantalla.
- No se realizó simulación completa de deficiencias de visión del color ni estudio con usuarios de dispositivos pequeños.
- Hay incertidumbre de servicio, cobertura y revisiones del histórico. La interfaz declara límites; futuras afirmaciones causales requerirían datos y análisis adicionales.

## Registro de iteraciones

| Hallazgo de la revisión técnica/visual | Cambio realizado |
|---|---|
| La comparación de base estacional contra año completo podía mezclar fenómenos | Consulta de temporadas equivalentes y normalización del calendario |
| Las vistas anteriores no permitían inspección integral de las 428 mini curvas | Atlas de alta densidad con ampliación y desplazamiento virtual |
| El detalle tapaba zonas esenciales del gráfico en pantalla amplia | El área principal deja espacio al inspector en escritorio |
| La trayectoria del sistema era demasiado pequeña a escala de todas las estaciones | Enfoque/contexto explícito con dominios y ejes visibles |
| Etiquetas de años cercanos competían | Colocación que evita colisiones simples y tooltip con fecha |
| Los ceros de 2021 podían leerse solo como preferencias | Contexto oficial del servicio nocturno y cobertura visible |
| Las búsquedas podían perder texto ante redibujados | Captura del texto al escribir y redibujado limitado a cambios de ancho |

Los comentarios humanos futuros deben agregarse con decisión (implementar/aplazar/rechazar) y justificación, siguiendo la guía del curso.
