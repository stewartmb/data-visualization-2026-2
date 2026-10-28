# Semana 6 — Investigación para el Atlas de demanda y conexiones

**Revisión del 28 de octubre de 2026.** Sustituye la selección exclusiva de cuatro artículos de la [revisión anterior](referencias-20261014.md). La investigación responde ahora a OD 2021–2024, entradas 2019–2024, caminos sobre una red de referencia y un panel integrado. No se reescriben retrospectivamente los resultados del EDA ni las presentaciones anteriores.

La guía del profesor (§4.3) pide al menos cuatro artículos relevantes, sus PDF y explicar cómo informan el diseño. Se organizan **12 artículos: seis fundamentos de visualización/tareas, tres métodos o antecedentes de transporte y tres alternativas visuales**. Las demos se documentan aparte y no cuentan como papers. Copias completas consultadas, fuentes y SHA-256: [catálogo](papers/README.md), [manifiesto](papers/sources.json) y [script de adquisición](code/acquire_review_papers.py).

El texto distingue: **qué propone la fuente, qué adoptamos, qué adaptamos y qué no permite concluir**. La valoración de utilidad es nuestra síntesis de diseño; no una conclusión experimental de los autores sobre el Atlas. Se revisaron textos y figuras de los artículos; en especial RAEB §4–6/Fig. 4, KDEEB §3–4, Dhont §3.2–3.3/Fig. 2, Brehmer–Munzner §3/Fig. 1 y Gleicher §2/Fig. 1. No se ejecutaron sus experimentos ni se realizó una revisión sistemática exhaustiva.

## A. Seis fundamentos principales de visualización y tareas

### P1. RAEB — relaciones con contexto de la red

**Zeng, W., Shen, Q., Jiang, Y., & Telea, A. (2019).** *Route-Aware Edge Bundling for Visualizing Origin-Destination Trails in Urban Traffic*. Computer Graphics Forum, 38(3), 581–593. [DOI](https://doi.org/10.1111/cgf.13712) · [PDF del autor](https://zeng-wei.com/publication/papers/2019_RAEB.pdf) · [copia local](papers/zeng_2019_raeb.pdf).

**Método:** construye una jerarquía de rutas según longitud, clase y flujo; el parámetro de conciencia de ruta controla qué geometría se conserva. Adapta KDEEB, selección de kernel y criterio de parada. §4.4 y Fig. 4 muestran la transición desde cuerdas abstractas hasta rutas detalladas; §5 refuerza la densidad de la guía.

**Decisión del Atlas:** mapa de conexiones como overview, con abstracción graduable y retorno a la red de referencia. Informa principalmente la representación de T2/T4, no sus métricas territoriales.

**Adaptación y límite:** subway con clase constante, OD ponderados y caminos por distancia sobre GTFS 2026; no trayectorias observadas. Interpolación continua, anclajes, raster acotado, WebGPU y fusión visual son decisiones propias. Es una adaptación de RAEB, no una réplica validada. Con fidelidad 0 pueden cruzarse curvas sobre agua: no se crean enlaces topológicos. NMI no demuestra exactitud del recorrido ni del modelo de transporte.

### P2. KDEEB — formación de haces y procesamiento paralelo

**Hurter, C., Ersoy, O., & Telea, A. (2012).** *Graph Bundling by Kernel Density Estimation*. Computer Graphics Forum, 31(3pt1), 865–874. [DOI](https://doi.org/10.1111/j.1467-8659.2012.03079.x) · [página del autor](https://recherche.enac.fr/~hurter/KDEEB.html) · [PDF del autor](https://webspace.science.uu.nl/~telea001/uploads/PAPERS/EuroVis12/kdeeb.pdf) · [copia local](papers/hurter_2012_kdeeb.pdf).

**Método:** estima densidad espacial de curvas, desplaza muestras mediante el gradiente y aplica suavizado laplaciano; reduce progresivamente el radio. §4 describe una implementación GPU y extremos fijos.

**Decisión del Atlas:** separar preparación, refinamiento y dibujo; emplear GPU para las operaciones repetidas sobre muestras/campos, conservando interacción y cámara. Complementa P1 como fundamento numérico.

**Adaptación y límite:** nuestra implementación usa WebGPU y datos OD agregados; requiere pruebas de paridad y mediciones propias. Los tiempos del paper no predicen los de este navegador ni justifican prometer una latencia. KDEEB libre por sí solo no preserva ferrocarriles ni convierte un haz en un corredor medido. Su densidad visual no equivale a carga operacional ni capacidad.

### P3. Reloj semanal — ciclos y diferencias visibles

**Dhont, M., Tsiporkova, E., Tourwé, T., & González-Deleito, N. (2020).** *Visual Analytics for Extracting Trends from Spatio-temporal Data*. AALTD, LNCS 12588, 122–137. [DOI](https://doi.org/10.1007/978-3-030-65742-0_9) · [PDF del taller](https://project.inria.fr/aaltd20/files/2020/08/AALTD_20_paper_DhontVisual.pdf) · [copia local](papers/dhont_2020_circular_heatmaps.pdf).

**Método:** §3.2 dispone lunes en el anillo interior y domingo en el exterior, con 24 sectores desde medianoche en sentido horario. §3.3 compara mediante resta y color divergente, contra un período anterior o una referencia.

**Decisión del Atlas:** conservar el reloj radial para T3 y para elegir la cohorte de inicio del mapa; explicitar diferencias sin pedir recordar dos estados.

**Adaptación y límite:** nuestras celdas contienen peso semanal y diferencias en pp; los valores exactos y cantidades se consultan en detalle. No fundamenta TV, elección de años ni ajuste por calendario. Anillos exteriores tienen mayor área; no se codifica magnitud mediante esa área ni se afirma que lo radial supere perceptualmente a una matriz. Su efectividad con nuestra audiencia sigue pendiente de evaluación.

### P4. Comparación visual — reducir la comparación mental

**Gleicher, M., Albers, D., Walker, R., Jusufi, I., Hansen, C. D., & Roberts, J. C. (2011).** *Visual Comparison for Information Visualization*. Information Visualization, 10(4), 289–309. [DOI](https://doi.org/10.1177/1473871611416549) · [página de autores](https://graphics.cs.wisc.edu/Papers/2011/GAWJHR11/) · [PDF preprint](https://graphics.cs.wisc.edu/Papers/2011/GAWJHR11/paper.pdf) · [copia local](papers/gleicher_2011_visual_comparison.pdf).

**Marco:** §2 distingue yuxtaposición, superposición y codificación explícita de relaciones; Fig. 1 contrasta estrategias con las mismas series.

**Decisión del Atlas:** mapas y detalles enlazados para contexto, índice base=100 y diferencia cromática explícita para comparar. T1/T2/T3 necesitan cantidades y cambios visibles; el futuro escenario T6 debería mostrar su diferencia de forma explícita.

**Límite:** la taxonomía no declara una estrategia universalmente superior ni demuestra que nuestro panel reduzca errores. Tener varias vistas juntas no asegura coordinación; hace falta mantener selección, unidades y denominadores. La dispersión volumen × forma es nuestra elección bivariada, no un gráfico prescrito por este artículo. Esta revisión amplía la consulta anterior del resumen al texto del preprint.

### P5. Brehmer–Munzner — separar propósito de medios

**Brehmer, M., & Munzner, T. (2013).** *A Multi-Level Typology of Abstract Visualization Tasks*. IEEE TVCG, 19(12), 2376–2385. [DOI](https://doi.org/10.1109/TVCG.2013.124) · [página de autores](https://www.cs.ubc.ca/labs/imager/tr/2013/MultiLevelTaskTypology/) · [PDF, author copy con correcciones](https://www.cs.ubc.ca/labs/imager/tr/2013/MultiLevelTaskTypology/brehmer_infovis13-corrections.pdf) · [copia local](papers/brehmer_munzner_2013_tasks.pdf).

**Marco:** §3/Fig. 1 separa por qué se analiza, cómo se ejecuta y cuáles son las entradas/salidas; una actividad compleja puede ser una secuencia de tareas.

**Decisión del Atlas:** cada nueva pregunta tiene propósito, búsqueda, consulta y resultado verificable. Zoom, selección, bundling y exportación quedan como medios; no se cuentan como tareas de transporte.

**Límite:** la tipología ayuda a diseñar y evaluar, pero no prueba utilidad ni novedad de las seis tareas. Por eso cada una debe producir una respuesta contrastable y un beneficio concreto para analistas. La atribución de etiquetas y su traducción al dominio son trabajo nuestro.

### P6. Shneiderman — recorrido de exploración

**Shneiderman, B. (1996).** *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations*. IEEE Symposium on Visual Languages, 336–343. [DOI](https://doi.org/10.1109/VL.1996.545307) · [PDF del autor](https://www.cs.umd.edu/users/ben/papers/Shneiderman1996eyes.pdf) · [copia local](papers/shneiderman_1996_eyes.pdf).

**Marco:** propone overview primero, zoom y filtrado después, detalles bajo demanda; también relacionar, conservar historia y extraer.

**Decisión del Atlas:** mapa legible al abrir, navegación con minimapa y selección directa, luego cantidades y evidencia del elemento elegido. La búsqueda complementa ese recorrido; no lo habilita. Regresar a vista general debe ser explícito.

**Límite:** el mantra no exige formularios de filtros, reproducción automática ni una pantalla por tarea. Tampoco asegura comprensión sin razonamiento. El panel debe probarse con tareas reales y accesibilidad; “usar todos los canales” no es un criterio de calidad si compiten por significado.

## B. Métodos y antecedentes de transporte

### P7. Magnitud y forma son aspectos distintos

**Liu, L., Miller, H. J., & Scheff, J. (2020).** *The impacts of COVID-19 pandemic on public transit demand in the United States*. PLOS ONE, 15(11), e0242476. [DOI y texto](https://doi.org/10.1371/journal.pone.0242476) · [copia local](papers/liu_2020_transit_demand.pdf).

La sección *Change in daily transit demand dynamics*, Fig. 3 y ecuaciones 9–10 compara perfiles con Procrustes limitado a escala. Es antecedente del problema de separar volumen y ritmo, útil para T1/T3. Su fuente horaria es actividad en Transit, no entradas MTA por complejo. Nosotros usamos perfiles normalizados y TV; no atribuimos TV, el calendario ni una inferencia causal a este estudio. **Es investigación de transporte, no el paper que valida el idiom de dispersión.**

### P8. Variación total: una medida, no una prueba causal

**Fredriksson, J., & Karlström, A. (2025).** *A Fully Neural Network-Based Travel Demand and Scheduling Model, Covering Activities, Destinations, and Modes of Transportation*. Data Science for Transportation, 7, 28. [DOI y texto](https://doi.org/10.1007/s42421-025-00141-5) · [copia local](papers/fredriksson_2025_travel_demand_tv.pdf).

La ecuación 11 compara reparto modal observado/simulado con `TV(p,q)=½Σ|p−q|`. Adaptamos las categorías a 168 celdas semanales y mostramos `100TV` en pp, como apoyo a T3 y la comparación volumen × forma. No implementamos su modelo neuronal. TV resume redistribución, no localiza franjas, no considera la distancia entre horas y no mide personas individuales que cambiaron de horario. **No demuestra superioridad de TV para nuestro caso ni convierte el Atlas en predictor.**

### P9. OD normalizado y composición

**Van der Knaap, R. J. H., de Bruyn, M., van Oort, N., Huisman, D., & Goverde, R. M. P. (2024).** *Clustering railway passenger demand patterns from large-scale origin–destination data*. Journal of Rail Transport Planning & Management, 31, 100452. [DOI](https://doi.org/10.1016/j.jrtpm.2024.100452) · [PDF TU Delft, proof](https://pure.tudelft.nl/ws/portalfiles/portal/206768699/1-s2.0-S2210970624000222-main.pdf) · [copia local](papers/van_der_knaap_2024_normalization_hellinger.pdf).

§2.1, ecuaciones 1–3, normaliza matrices OD por su suma y compara composición mediante Hellinger cuadrática, distinguiéndola del análisis sin normalizar. Informa mantener cantidad y composición separadas en T2 y en perfiles temporales. El ajuste por calendario y la agregación territorial son decisiones propias. La búsqueda de 12 vecinos fue parte del diseño anterior: **no es una exigencia del panel actual**. No implementamos su clustering ni obtenemos destinos a partir de entradas usando esta distancia.

## C. Alternativas revisadas y su decisión actual

### P10. Calendarios y patrones de varios ciclos

**Van Wijk, J. J., & Van Selow, E. R. (1999).** *Cluster and Calendar Based Visualization of Time Series Data*. IEEE InfoVis, 4–9. [DOI](https://doi.org/10.1109/INFVIS.1999.801851) · [PDF del autor](https://vanwijk.win.tue.nl/clv.pdf) · [copia local](papers/van_wijk_1999_calendar.pdf).

Agrupa perfiles diarios y muestra su pertenencia sobre un calendario para estudiar ciclos diarios, semanales y estacionales. Es una alternativa útil si T3 necesita ver cuándo un patrón se repite. **No añadimos ahora un calendario ni su clustering**. Usar años completos no elimina estacionalidad; para afirmaciones mensuales siguen haciendo falta meses comparables y controles propios.

### P11. Consultas temporales directas

**Hochheiser, H., & Shneiderman, B. (2004).** *Dynamic Query Tools for Time Series Data Sets: Timebox Widgets for Interactive Exploration*. Information Visualization, 3, 1–18. [DOI](https://doi.org/10.1057/palgrave.ivs.9500061) · [PDF del autor](https://www.cs.umd.edu/users/ben/papers/Hochheiser2004Dynamic.pdf) · [copia local](papers/hochheiser_2004_timesearcher.pdf).

TimeSearcher utiliza cajas que imponen restricciones conjuntas de intervalo temporal y valores. Informa explorar consultas gráficas si hicieran falta, en lugar de sumar menús. **No lo implementamos:** seleccionar una celda del reloj o un área del mapa no reproduce la semántica de una timebox. Sus resultados de uso no se transfieren automáticamente a nuestro panel.

### P12. Trayectorias bivariadas

**Haroz, S., Kosara, R., & Franconeri, S. L. (2016).** *The Connected Scatterplot for Presenting Paired Time Series*. IEEE TVCG, 22(9), 2174–2186. [DOI](https://doi.org/10.1109/TVCG.2015.2502587) · [página de autores](https://eagereyes.org/publications/Haroz-TVCG-2016) · [PDF del autor](https://media.eagereyes.org/papers/2016/Haroz-TVCG-2016.pdf) · [copia local](papers/haroz_2016_connected_scatterplot.pdf).

Estudia pares de series representados en una dispersión con puntos unidos en orden temporal y sus problemas de interpretación. Fue pertinente para trayectorias anuales del diseño anterior. **El volumen × forma actual no es un connected scatterplot:** cada punto representa un complejo y no se conectan estaciones en secuencia. Queda como alternativa si se pide evolución interanual explícita; no se usa para justificar líneas OD ni para afirmar causalidad.

## D. Demos desplegadas: qué tomamos y qué no

| Referente | Qué aporta a la exploración | Límite de la transferencia |
|---|---|---|
| [Visualizing MBTA Data — Barry y Card, 2014](https://mbtaviz.github.io/) | Coordinación de mapa, horarios y demanda; detalles en contexto | Tiene datos de trenes y entradas/salidas que no equivalen a nuestro OD estimado. No simulamos posiciones, puntualidad ni velocidades |
| [Tube Heartbeat — O’Brien / HERE / TfL](https://misc.oomap.co.uk/tubeheartbeat.com/london/) | Mapa como overview, tamaño de nodos y patrón horario | Tomamos el pulso horario mediante selección manual. No copiamos reproducción automática ni suponemos la misma fuente o convención de flujo |

Son referencias de producto, no evidencia experimental de que nuestro diseño funcione. FINO y los cuatro PDF de [antecedentes](papers/antecedentes/README.md) se conservan como historia de la investigación; no se presentan como revisiones nuevas del texto completo en esta actualización.

## E. De evidencia a decisiones y tareas

| Decisión o pregunta | Fuente que informa el método | Aplicación y condición propia |
|---|---|---|
| Mapa central y abstracción con red de referencia | P1, P2 | Informa T2/T4; caminos GTFS asignados, no recorridos observados |
| Comparar territorio y composición sin confundir cantidades | P4, P9 | T1/T2; cocientes, participaciones y particiones requieren validación propia |
| Contrastar magnitud y forma temporal | P4, P7–P9 | Apoyo a T1/T3; el scatter bivariado es una decisión de diseño |
| Reloj con diferencia explícita | P3, P4 | T3; conserva denominadores y cantidades en detalle |
| Balance externo de una zona | P4 informa comparación, no la fórmula | T5 es una derivación descriptiva propuesta; no una métrica atribuida a esos papers |
| Interrupción de un enlace y desvíos | P4 informa presentar diferencias | T6 es una extensión contrafactual propia; RAEB no valida vulnerabilidad operacional |
| Un panel, selección y detalles | P5, P6 y demos | No requiere una pestaña por tarea; evaluar legibilidad y resultados con usuarios |
| Evitar ventanas/curvas/categorías que no resuelven preguntas | P5; alternativas P10–P12 | No implementar por variedad visual; justificar utilidad y coste |

Contrato completo con las seis preguntas, métricas y pendientes: [AnalyticalTasks](../week12/AnalyticalTasks.md). Las decisiones anteriores permanecen en la [revisión histórica](referencias-20261014.md). **Fuentes públicas no equivalen a una licencia de redistribución:** las ocho copias nuevas se consultan localmente y se reproducen con el script; no se publican automáticamente en GitHub.

## F. Qué falta evaluar

No hemos demostrado reducción de tiempo/error ni utilidad operacional con una audiencia real. Corresponde contrastar las respuestas de T1–T6 con cálculos reproducibles y evaluar después si se obtienen con la interfaz, cuánto tardan y qué errores de interpretación aparecen. También faltan sensibilidad de parámetros, comparación radial/matricial y validación del modelo de caminos con información operativa. No sustituir esas pruebas por citar papers o mostrar una GPU rápida.
