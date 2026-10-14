# Problema, audiencia y tareas del atlas

## Problema concreto

Una cifra de recuperación de entradas puede esconder un cambio del ritmo de una estación. Además, comparar un período prepandemia con un año completo introduce diferencias de temporada y de composición del calendario. Se necesita explorar en conjunto la **distribución temporal**, la **intensidad** y la **ubicación** de los cambios, pudiendo consultar de dónde sale cada medida.

## Objetivo general

Diseñar e implementar una herramienta D3 que permita descubrir, comparar y documentar cambios en los perfiles horarios semanales de los complejos de subway de Nueva York entre enero–febrero de 2020 y los mismos meses de 2021–2024, conservando el contexto geográfico, el volumen y las limitaciones de los datos.

## Audiencia y uso

- **Principal:** analistas de transporte e investigadores urbanos que buscan estaciones o conjuntos para estudiar con mayor detalle.
- **Secundaria:** periodistas de datos que necesitan comunicar diferencias temporales y espaciales sin confundirlas con motivos demostrados.
- **Situación de uso:** encontrar estaciones con pérdida de peso de la mañana; verificar su huella; compararlas con estaciones similares; observar su distribución espacial; guardar o exportar las medidas y advertencias.

La aplicación apoya selección de casos y generación de hipótesis. Para recomendar frecuencias de tren serían necesarios oferta histórica, capacidad, saturación, transferencias operativas y criterios de decisión que esta fuente no contiene.

## Preguntas y tareas verificables

Cada tarea tiene una salida que puede evaluarse. Los códigos T1–T6 no representan seis gráficos independientes.

| ID | Pregunta de dominio | Por qué / tarea abstracta | Entrada → salida verificable | Vistas e interacciones |
|---|---|---|---|---|
| T1 | ¿En qué días y horas cambió el peso relativo de las entradas, y cómo difiere entre complejos? | Descubrir distribución y comparar períodos | Dos perfiles comparables de 168 valores → horas con aumento/disminución, con su diferencia en pp | Atlas con diferencia explícita; enfoque por día; reloj o matriz de detalle; tooltip exacto |
| T2 | ¿Qué complejos cambiaron más y cuáles conservan perfiles parecidos a un ejemplo seleccionado? | Localizar extremos y explorar similitud | Perfiles y distancias definidas → ranking por cambio y 12 vecinos por Hellinger | Orden del atlas; búsqueda por ejemplo; comparación de complejos fijados; detalle de cada candidato |
| T3 | ¿Dónde aparecen esos cambios y semejanzas? ¿Se distribuyen de igual manera entre boroughs? | Explorar atributos en el espacio y comparar conjuntos | Grupo de estaciones con ID y coordenadas → conjunto geográfico y medidas del grupo | Mapa con medida de color explícita, selección rectangular, filtro de borough; mismo grupo en atlas y evidencia |
| T4 | ¿Recuperar volumen implica recuperar la forma de la semana? ¿Qué casos separan ambas dimensiones? | Comparar dos propiedades y detectar excepciones | Índice de volumen y distancia TV → casos con volumen cercano a la base pero forma distinta, o viceversa | Mapa alternando medida; orden del atlas; tabla de evidencia; lectura de detalle y contexto mensual |
| T5 | ¿El cambio del peso AM y de fin de semana fue continuo o tuvo retrocesos entre años? | Seguir evolución conjunta de dos atributos | Cinco períodos de enero–febrero → trayectoria fechada, con dirección y puntos intermedios | Trayectorias con enfoque/contexto; referencia del sistema y del grupo; estación seleccionada y hasta tres fijadas |
| T6 | ¿Qué datos y supuestos sostienen una lectura, y qué casos requieren cautela? | Verificar, documentar y comunicar | Medidas + cobertura de celdas + fuentes → evidencia exportable y límites declarados | Tabla, fuentes de estación, guardado de exploración, CSV; advertencia del servicio nocturno y catálogo actual |

## Relación entre vistas y tareas

| Herramienta | Tareas principales | Lo que aporta |
|---|---|---|
| Atlas semanal | T1, T2, T3, T4 | Distribución de 168 horas para todo el grupo y reordenamiento por una tarea |
| Geografía | T2, T3, T4 | Contexto espacial y definición de conjuntos |
| Trayectorias | T1, T4, T5 | Evolución conjunta con fechas explícitas y conservación de la selección |
| Detalle de estación | T1, T2, T4, T5, T6 | Paso de overview a inspección exacta; comparación por ejemplo |
| Evidencia | T3, T4, T6 | Reproducción de medidas, alcance de afirmaciones y trazabilidad |

## Qué se reformuló respecto de la propuesta inicial

- La comparación principal pasa de enero–febrero 2020 frente a todo 2024 a los mismos meses de cinco años.
- La pregunta de “cuántos tipos de estaciones existen” se convierte en explorar semejanzas y diferencias continuas. No se fuerza una clasificación discreta sin validarla.
- La evolución conjunta de dos medidas deja de ser solo una comparación estática antes/después.
- La composición tarifaria se aplaza: es otra línea de análisis, afectada por la adopción de OMNY, que no es necesaria para resolver el problema principal.
- Las decisiones de frecuencia se reemplazan por identificación de casos para investigar. El nuevo alcance puede defenderse con los datos disponibles.

## Recorrido de demostración

1. Mostrar el atlas completo en modo diferencia. Explicar una fila, una columna y la normalización.
2. Abrir “La mañana cambia”: el filtro es Δ AM < −2 pp y su umbral aparece en el grupo activo.
3. Seleccionar un complejo y contrastar reloj con matriz. Fijarlo y buscar perfiles similares.
4. Cambiar a Geografía; comprobar que se conservó el grupo. Seleccionar otra zona.
5. Abrir Trayectorias; seguir los años y distinguir referencia del sistema frente a estación y grupo.
6. Terminar en Evidencia, consultar cobertura y exportar las medidas. Explicar por qué no se atribuyen causas.
