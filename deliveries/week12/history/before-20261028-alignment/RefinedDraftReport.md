# Refined Draft Report — Fractal · Atlas de ritmos

**DS5343 Data Visualization · UTEC · 2026-2 · Semana 12 · 28 de octubre de 2026**
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

Aplicación: [`/atlas`](../../atlas/) (`python3 -m http.server 8765` desde la raíz, abrir `/atlas/`) · en línea: <https://stewartmb.github.io/data-visualization-2026-2/atlas/> · copia de esta entrega: [`atlas/`](atlas/)

---

## 1 · De dónde venimos y qué cambia en esta entrega

En la Semana 10 presentamos un prototipo de tres vistas (matriz · recorrido · mapa) que comparaba enero–febrero de 2020 con todo 2024 y contaba el cambio en siete capítulos. El rediseño que entregamos ahora, **Fractal · Atlas de ritmos**, reformula el problema: en lugar de narrar un hallazgo fijo, da al lector una herramienta para descubrir, comparar, situar y documentar cambios en los ritmos semanales de los 424 complejos de subway, comparando siempre la misma temporada (enero–febrero) de cinco años.

| | Semana 10 (prototipo) | Semana 12 (atlas) |
|---|---|---|
| Comparación | ene–feb 2020 frente a todo 2024 | ene–feb de 2020, 2021, 2022, 2023 y 2024: misma temporada, calendario estandarizado |
| Universo | 428 complejos (incluía SIR y tranvía) | 424 complejos de subway, unión exacta con el catálogo oficial de la MTA |
| Datos | agregados pedidos a la API en ventanas de 7 días | base ampliada 2019–2024 (141 836 156 registros originales, 72 meses); las medidas de huella conservan ene–feb 2020–2024 |
| Estructura | narrativa de capítulos + explorador | cuatro lentes enlazadas (atlas semanal · geografía · trayectorias · evidencia) con una selección compartida, más detalle bajo demanda y una página del proyecto |
| Medidas | razón pico/valle, asimetría mañana/tarde, tipología | distancia TV entre perfiles, peso AM, peso de fin de semana, índice de volumen, Hellinger para búsqueda por ejemplo |
| Mapa | contornos de boroughs | el mapa como pieza principal de la vista, a todo el alto de la ventana, sobre el plano de calles de la ciudad (OpenStreetMap) con zoom; contornos como respaldo sin red |
| Trazabilidad | panel de evidencia por estación | fórmulas en la interfaz, cobertura por celda, fuentes por estación, exportación CSV, exploraciones guardadas y estado en la URL |

## 2 · El problema y la audiencia

Una cifra de recuperación de entradas puede esconder un cambio del ritmo de una estación: un complejo puede volver a su volumen y, aun así, repartir sus entradas en horarios distintos. Además, comparar un período prepandemia con un año completo mezcla temporada y composición del calendario. El atlas separa tres cosas que suelen confundirse —la **distribución temporal** de las entradas, su **intensidad** y su **ubicación**— y deja consultar de dónde sale cada medida.

**Audiencia principal.** Analistas de transporte e investigadores urbanos que buscan estaciones o conjuntos para estudiar con más detalle. **Secundaria.** Periodistas de datos que necesitan comunicar diferencias temporales y espaciales sin confundirlas con causas demostradas. La herramienta apoya la selección de casos y la generación de hipótesis; no recomienda frecuencias de trenes, porque la fuente no contiene oferta, capacidad ni saturación.

**Preguntas y tareas (T1–T6).** ¿En qué días y horas cambió el peso relativo de las entradas y cómo difiere entre complejos? ¿Qué complejos cambiaron más y cuáles se parecen a un ejemplo? ¿Dónde aparecen esos cambios y cómo se distribuyen entre boroughs? ¿Recuperar volumen implica recuperar la forma de la semana? ¿La evolución del peso AM y de fin de semana fue continua o tuvo retrocesos? ¿Qué datos y supuestos sostienen una lectura? Cada tarea tiene una entrada y una salida verificable en [`redesign/01-problema-y-tareas.md`](redesign/01-problema-y-tareas.md).

---

## 3 · Datos y método

**Fuente.** MTA Subway Hourly Ridership 2017–2019 (`t69i-h2me`, solo 2019) y 2020–2024 (`wujg-7c2s`, Open NY): entradas estimadas por hora, complejo de estación, modo, método de pago y clase tarifaria. Se suman el catálogo oficial de complejos de la MTA (`5f5g-n3cz`, unión exacta en 424/424) y los contornos de boroughs de NYC DCP. Tres contextos oficiales curados (servicio nocturno 2021, L Project, obras de 63 St) se muestran como advertencias por estación, no como atribución causal.

**Adquisición.** La ampliación completa comprende enero de 2019 a diciembre de
2024: 72 meses, 2.192 fechas calendario y 141.836.156 registros originales. Se
conservan los 12 campos publicados y todos los modos presentes. El script
`scripts/acquire_full_period.py` descarga una respuesta CSV comprimida por mes,
verifica su número de filas y sumas de entradas y transbordos contra consultas
oficiales independientes, y conserva URL, fecha y SHA-256. La descarga es
reanudable y no se filtra a una lista fija de estaciones. Los originales y los
Parquet con todos los registros quedan fuera de Git por su volumen.
`scripts/build_full_period.py` genera tablas por día, mes, tarifa y hora de la
semana; `scripts/validate_full_period.py` recalcula cobertura, huellas y
conservación de totales. Los comandos y el diccionario están en
[FullPeriodData.md](FullPeriodData.md).

El insumo de la huella publicada conserva su definición: enero–febrero de cada
año 2020–2024, por complejo de subway × día de semana × hora
(`data/jan_feb_hourly_2020_2024.csv`, 350.951 filas). El contexto mensual nuevo
usa los 72 meses para el complejo o grupo seleccionado. Ampliar la adquisición
no cambia automáticamente la línea base de la huella ni atribuye causalidad a
la pandemia.

**Universo y cobertura.** 424 complejos de subway (Brooklyn 156, Manhattan 121, Queens 79, Bronx 68). 168 × 424 × 5 = 356 160 celdas posibles; 350 950 con entradas positivas. El insumo contiene además una agrupación del complejo SIR 502, excluido del universo, que reúne las dos entradas mal etiquetadas por la fuente. Celdas sin registro por año: 2020 = 11, 2021 = 4 986 (cierre nocturno), 2022 = 186, 2023 = 3, 2024 = 24. Una celda sin registro se representa como cero entradas registradas y se declara con un conteo visible; no equivale a demanda cero.

**Exposición del calendario.** Para cada complejo *s*, año *y*, día de la semana *d* y hora *h*: A es la suma de entradas en enero–febrero; N[y,d] la cantidad de veces que ese día de la semana aparece en el período (8 o 9); W = A / N es una semana promedio construida con un lunes promedio, un martes promedio, etc.; P = W / ΣW es la distribución de 168 valores que suma 1. Así, que un calendario tenga nueve lunes y otro ocho no altera la forma normalizada.

**Medidas.**

| medida | fórmula y unidad | qué mide y qué no |
|---|---|---|
| peso de celda | 100 × P[d,h] (%) | participación de una hora-día en una semana comparable |
| diferencia de celda | 100 × (P_y − P_2020) (pp) | cambio de proporción, no de volumen |
| distancia de forma TV | 50 × Σ \|P_y − P_2020\| (pp, 0–100) | cuánto del ritmo semanal se redistribuyó; no cuántas personas cambiaron de horario |
| peso AM | 100 × Σ P[lun–vie, 06–09 h] / Σ P[lun–vie] (%) | fracción de las entradas laborables en la mañana; la franja es una elección analítica |
| peso de fin de semana | 100 × Σ P[sáb–dom] (%) | fracción de la semana en esos dos días |
| índice de volumen | 100 × diario_y / diario_2020 (%) | 100 es el nivel base; no es capacidad ni calidad de servicio |
| Hellinger | √(½ Σ (√P_a − √P_b)²) (0–1) | semejanza de forma en el mismo año; vecinos no implican misma función ni causa |

Las estadísticas bajo las vistas son medianas de complejos; la trayectoria del sistema o del grupo se pondera por entradas. Las fórmulas se muestran en la propia interfaz (botón de información de cada medida), con ejemplo numérico y unidad.

---

## 4 · Hallazgos preliminares (enero–febrero 2024 frente a 2020)

Las cifras se calculan desde `atlas.json` en **Acerca · Proyecto** y en la auditoría `redesign/data-audit.json`; no se escriben a mano.

1. **El sistema recuperó el 67.7 % de sus entradas diarias, pero no su ritmo.** El peso de la mañana laboral (06–09 h, lunes a viernes) bajó de 28.9 % a 27.2 %, y el del fin de semana subió de 16.2 % a 18.4 %.
2. **El cambio es general.** 316 de 424 complejos tienen menos peso AM que en 2020 y 283 tienen más peso de fin de semana. Con el umbral de −2 pp, 204 complejos entran en "La mañana cambia".
3. **La mediana del cambio de forma es 6.6 pp** (distancia TV): en el complejo típico, cerca del 7 % del ritmo semanal se redistribuyó entre horas. Los mayores cambios: 57 St (F) 26.4 pp (obras de 63 St), Hunters Point Av (7) 20.3 pp, 3 Av (L) 18.0 pp.
4. **Volumen y ritmo son dos cosas distintas.** 21 complejos están entre el 80 y el 120 % de su volumen de 2020 y, aun así, cambiaron de forma 10 pp o más ("Volumen ≠ ritmo").
5. **El cambio tiene geografía, pero más dentro de cada borough que entre boroughs.** Medianas por borough: Brooklyn TV 6.3 pp, Δ AM −3.3 pp, volumen 68.7 %; Manhattan 7.4 pp, −0.9 pp, 68.0 %; Queens 7.6 pp, −2.6 pp, 68.5 %; Bronx 6.1 pp, −0.2 pp, 56.3 %. El Bronx perdió más volumen que nadie y es donde menos cambió el peso de la mañana.
6. **La trayectoria no fue una línea recta.** En el espacio peso AM × peso de fin de semana, el sistema cae en 2021, vuelve parcialmente en 2022–2023 y en 2024 queda con menos mañana y más fin de semana que en 2020; muchos complejos muestran retrocesos entre años.

**Lectura.** Recuperar pasajeros y recuperar la forma de la semana son procesos separados; por eso el atlas los muestra como medidas separadas y deja que el lector forme grupos para investigarlos. Lo que los datos no sostienen: una causa. Las entradas no distinguen menos demanda de menos servicio, y la asociación con el trabajo híbrido es una hipótesis que se contrastará con datos externos (capa ACS del Census, Semana 15).

---

## 5 · Diseño

**Estado de la interfaz actual.** La entrada es un mapa con inspector persistente:
perfil del grupo o estación, reloj/matriz, trayectoria y contexto bajo demanda.
Los módulos de las cuatro lentes del diseño anterior se conservan en el código;
la tabla siguiente documenta ese diseño y sus funciones, no un menú de cinco
pestañas actualmente visible. «Proyecto» se consulta desde «Acerca».


### 5.1 Estructura: una exploración, cuatro lentes

| vista | tareas | qué aporta |
|---|---|---|
| **01 Atlas semanal** | T1–T4 | matriz complejo × 168 horas; modo diferencia (azul perdió peso, naranja ganó), 2024 o 2020; orden por cambio, geografía, volumen, mañana, noche, fin de semana o semejanza; vista global y lectura ampliada con desplazamiento virtual |
| **02 Geografía** | T2–T4 | los complejos sobre el plano de calles, coloreados por TV, Δ AM, Δ fin de semana o volumen; filtros de rango con doble tirador; selección rectangular que forma un grupo compartido |
| **03 Trayectorias** | T1, T4, T5 | cada complejo recorre cinco temporadas en el espacio peso AM × fin de semana, con el sistema y el grupo como referencia y enfoque/contexto |
| **04 Evidencia** | T3, T4, T6 | afirmaciones calculadas sobre el grupo, tabla de medidas con cobertura, fuentes, exportación CSV, exploraciones guardadas |
| **05 Proyecto** | — | página del proyecto: pregunta, datos, cómo se lee, hallazgos en vivo, conclusión preliminar, límites, equipo |
| **Detalle** | T1, T2, T4–T6 | huella rectilínea del complejo: perfil de 24 h de la semana (2020 en gris, año elegido en tinta), matriz día × hora y peso de cada día; el reloj de 168 sectores queda como alternativa; comparación con hasta tres fijados, 12 vecinos por Hellinger, serie mensual y fuentes |

La selección, el año, los filtros y el grupo se conservan al cambiar de vista y en la URL; una exploración se puede guardar y restaurar.

### 5.2 Codificación

| canal | qué lleva | por qué |
|---|---|---|
| posición en la matriz | complejo × hora de la semana | ver 424 perfiles a la vez, alineados en la hora, es lo que permite reconocer franjas |
| color divergente (azul–crudo–naranja) | diferencia de peso en pp, ±0.65 pp con saturación declarada | polaridad real: perdió ↔ igual ↔ ganó; el tooltip conserva el valor exacto |
| color secuencial (viridis) | distancia TV en el mapa | una magnitud, escala fija por año: filtrar no cambia los colores |
| posición en el mapa | lugar | el canal más preciso para la variable espacial; plano de calles recesivo debajo |
| posición en las trayectorias | peso AM × peso de fin de semana | dos medidas en un espacio; la línea sigue años, no viajes |
| matriz día × hora + perfil de 24 h | huella de un complejo | posición en escala común para la forma del día (la curva) y para el peso de cada día (las barras); el color queda solo para la matriz. El reloj radial se conserva como alternativa, no como vista principal: el área de los anillos externos engaña |
| igual tamaño de los puntos | — | en el mapa solo el color codifica el cambio, para no confundir volumen con forma |

### 5.3 Alternativas descartadas

| elegido | descartado | por qué |
|---|---|---|
| misma temporada de cinco años | ene–feb 2020 frente a todo 2024 | comparar invierno contra año completo mezcla estaciones del año y composición del calendario |
| distancia TV | Procrustes, correlación | TV es acotada (0–100 pp), simétrica, se explica en una frase y aparece en la literatura sobre distribuciones de transporte |
| semejanza continua (Hellinger, 12 vecinos) | tipología discreta residencial/mixta/laboral | una clasificación promete más de lo que mide; la búsqueda por ejemplo no impone tipos sin validarlos |
| una matriz con varios órdenes | varios gráficos por pregunta | la misma representación responde T1–T4 cambiando el orden; el lector no reaprende |
| plano de calles bajo los complejos | solo contornos de boroughs | feedback del review: sin calles no se ubica una estación; teselas sin etiquetas para no competir con el color |
| marcar cobertura y contexto | excluir 2021 o las estaciones con obras | excluir esconde; marcar informa |

### 5.4 Interacción y accesibilidad

Una sola selección compartida; clic para investigar, Mayús + clic para fijar; brush en geografía y trayectorias; filtros de rango con doble tirador y chips para quitarlos; `Esc` cierra el detalle; estado en la URL. Fórmulas en la interfaz con ejemplo y unidad. Disposición verificada a 390 px sin desbordamiento. Atribución de OpenStreetMap en el mapa. Pendiente: auditoría completa por teclado y lector de pantalla, simulación de deficiencias de visión del color.

---

## 6 · Feedback del design review

Recibido el 14 de octubre de 2026. El registro sugerencia por sugerencia está en [`PeerCritiqueResponse.md`](PeerCritiqueResponse.md). Resumen:

- **Ojalá** la visualización tuviera más protagonismo frente al texto. → **Implementada**: el atlas semanal (424 × 168) es la primera pantalla; los textos quedan en el carril izquierdo, en la guía y en la página del proyecto.
- **¿Y si** el mapa de Nueva York se viera como un plano de la ciudad, con calles, para ubicar mejor cada estación? → **Implementada**: plano de calles de OpenStreetMap (calles, parques, agua y nombres) bajo los complejos, con zoom continuo; el mapa pasa a ocupar todo el alto de la ventana y el encabezado y los controles se compactan. Los contornos de boroughs quedan como respaldo sin conexión.
- **Ojalá** la leyenda del reloj semanal se entendiera sin ayuda. → **Implementada**: leyenda reescrita (qué codifica el color, con sus dos extremos y el punto medio; cómo leer anillos y sectores) y letras L–D sobre los anillos para identificar el día.

---

## 7 · Limitaciones

1. **Son entradas, no viajes.** Faltan salidas, destinos, personas únicas, frecuencia y capacidad históricas.
2. **La huella conserva dos meses de invierno de 2020 como base.** La nueva base y la curva mensual sí incluyen todo 2019. Las medidas publicadas no cambian de referencia automáticamente. Comparar la misma temporada reduce el desajuste; no controla feriados, clima, eventos ni obras.
3. **Las celdas sin registro son ceros declarados.** 2021 tiene 4 986 por el cierre nocturno; la interfaz lo advierte por estación.
4. **El catálogo y los contornos son actuales.** No reconstruyen la oferta histórica.
5. **No hay inferencia estadística ni causal.** Los umbrales de las entradas al análisis (±2 pp, 80–120 %, ≥10 pp) son ejemplos analíticos.
6. **El plano de calles depende de un servicio externo.** Sin red, el mapa vuelve a los contornos de boroughs; todo lo demás funciona sin conexión.
7. **La evaluación con personas está pendiente.** El código funcional no demuestra que el diseño resuelva mejor las tareas.

---

## 8 · Lo que falta y quién lo hace

| | tarea | responsable | para |
|---|---|---|---|
| 1 | Evaluación con personas: 3–5 compañeros y una persona de transporte resuelven los seis ejercicios de `redesign/04-evaluacion.md`; registrar aciertos, errores, tiempo y comentarios | los tres | 6 nov |
| 2 | Capa ACS del Census (trabajo desde casa por área de influencia) para contrastar la hipótesis del trabajo híbrido | Renzo · José | 8 nov |
| 3 | Decidir, con la evaluación, reloj frente a matriz y la explicación de la distancia TV; ajustar escalas y umbrales | Stewart | 10 nov |
| 4 | Paper final: resultados de la evaluación, figuras definitivas, formato IEEE | José | 13 nov |
| 5 | Video teaser (30 s) y video de presentación (3 min) | Renzo | 14 nov |
| 6 | Poster para la exhibición | Stewart | 16 nov |
| 7 | Presentación final de 10 minutos y revisión cruzada | los tres | 17 nov |

---

## Referencias

- Liu, L., Miller, H. J. y Scheff, J. (2020). *The impacts of COVID-19 pandemic on public transit demand in the United States*. PLOS ONE 15(11). https://doi.org/10.1371/journal.pone.0242476 — separar caída de volumen y cambio del perfil horario.
- Fredriksson, J. y Karlström, A. (2025). *A Fully Neural Network-Based Travel Demand and Scheduling Model*. Data Science for Transportation 7, 28. https://doi.org/10.1007/s42421-025-00141-5 — distancia de variación total entre distribuciones.
- Van der Knaap, R. J. H. et al. (2024). *Clustering railway passenger demand patterns from large-scale origin–destination data*. J. Rail Transport Planning & Management 31. https://doi.org/10.1016/j.jrtpm.2024.100452 — normalización por el total, volumen separado de estructura, Hellinger.
- Dhont, M. et al. (2020). *Visual Analytics for Extracting Trends from Spatio-temporal Data*. LNCS 12588. https://doi.org/10.1007/978-3-030-65742-0_9 — reloj semanal día × hora y comparación por resta contra una base.
- Bostock, M. (2019). *d3-tile*. https://github.com/d3/d3-tile — teselas de mapa sobre una proyección D3.


## 9 · Actualización de datos y reproducibilidad de esta versión

El paquete se desarrolla en `deliveries/week12/` conforme a la sección 4.6 de
la guía del profesor. Los scripts incluidos se corrigieron para funcionar desde
esta carpeta y reproducir los 2.120 perfiles y 356.160 celdas sin depender de
copias de otras semanas. El contexto mensual se entrega como totales por mes,
con procedencia documentada.

El inspector incorpora un apartado desplegable de afluencia 2019–2024, transbordos gratuitos, tarifas
por borough y NTA2020, conservando las escalas de cada fuente. Se entregan 2.120
observaciones complejo × año de transbordos de enero–febrero, 368 registros
borough × mes × medio/clase tarifaria, la unión de 424 complejos a 130 NTA y un
grafo GTFS actual de 424 nodos y 2.040 enlaces dirigidos de servicio. Este grafo
está preparado y disponible para descarga: todavía no reemplaza el trazado del
mapa y no representa flujos OD. El feed corresponde a una programación de 2026,
no a la red histórica de los años comparados.

La validación detectó dos entradas de Tompkinsville (SIR, Staten Island) con modo
`subway` en febrero de 2023. Se preservan como exclusión auditable del universo;
tras excluirlas, los totales tarifarios coinciden exactamente con las entradas
de nuestros 424 complejos en los cinco períodos. No se imputan tarifas a estaciones.

La especificación completa, comandos, fuentes oficiales, límites y diccionario
están en [DataAcquisition.md](DataAcquisition.md). Las consultas y SHA-256 se
versionan en `data/context/sources.json`; `validate_enrichments.py` verifica
reconciliación, denominadores, conservación de volumen y extremos del grafo.

El mapa agrupa marcadores próximos al alejarse (cantidad y color de mediana),
los separa al acercarse y controla las colisiones de etiquetas. La selección
individual y los fijados permanecen visibles. Estas agrupaciones son espaciales,
no clases funcionales ni semejanza de perfiles.


\newpage

## 10 · Ampliación temporal: todos los meses de 2019–2024

La solicitud de ampliar la cobertura se interpreta como temporal. Los 424
complejos del Atlas son la unidad geográfica del subway; no son una muestra de
424 registros. La nueva adquisición no restringe IDs ni modos y conserva los
registros de SIR y tranvía para análisis posteriores, sin mezclarlos con los
424 complejos del mapa. Se preservan también las inconsistencias de etiquetas
de la fuente y se documentan las exclusiones de cada análisis.

**Valor analítico habilitado.** La tabla diaria permite distinguir días laborales,
fines de semana, feriados y episodios breves; la tabla mensual permite revisar
estacionalidad y comparar el mismo mes entre años; el cubo mes × día × hora
permite estudiar desplazamientos de horarios sin imponer que enero–febrero
represente todo el año. Las categorías tarifarias y el medio de pago quedan
disponibles para los seis años, manteniendo sus etiquetas y límites de
interpretación. Esto prepara nuevas tareas: no demuestra todavía una causa ni
constituye un modelo predictivo validado.

**Uso implementado.** El inspector añade una curva de promedio diario por mes,
enero de 2019 a diciembre de 2024, enlazada a la estación o grupo seleccionado.
Divide las entradas mensuales por días calendario y declara que no corrige la
composición semanal. Un mes sin registros para todo el sujeto deja un hueco;
los tooltips muestran cuántos complejos contribuyen. La huella semanal y las
medidas comparables de transbordos y tarifas conservan enero–febrero de
2020–2024, con su alcance indicado.

**Evidencia reproducible.** `data/full_period/acquisition.json` contiene los 72
controles mensuales; `build-audit.json` registra los resultados y sus huellas;
`validation.json` solo declara PASS si se verifican los meses, campos y
conservación de entradas, transbordos y filas en las tablas derivadas. El
JSON del cliente se reconcilia con los totales mensuales completos. Los scripts,
datos preparados y diccionario forman parte de la entrega de Semana 12.
