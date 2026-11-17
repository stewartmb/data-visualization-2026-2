# Semana 6 · Análisis y diseño del Atlas Fractal

Revisión del 16 de noviembre de 2026. Renzo Acervo Correa, Stewart Maquera Bobadilla y José Condori Palomino · DS5343 Data Visualization, UTEC.

## Datos y transformaciones

**Años** utiliza los OD estimados de la MTA, de enero de 2021 a diciembre de 2025. La MTA publica viajes promedio por par de complejos, mes, día de semana y hora de entrada. Para combinar los doce meses se ponderan los promedios por el número de ocurrencias del día de semana de cada mes. El día promedio anual incorpora las proporciones reales de lunes a domingo. El perfil de una semana representativa se obtiene normalizando las 168 cantidades de día y hora por su suma. [Fuentes y cobertura OD](../week12/ODData.md).

El mapa asigna OD por costo mínimo a una red GTFS fija de 2026. Los 424 complejos son las unidades de demanda y selección. El ruteo usa 475 paradas padre, 556 enlaces ferroviarios y 75 transbordos declarados. Se suman ambos sentidos para la carga de un tramo. Un mismo viaje puede contribuir a varios tramos. Diez filas OD con extremos fuera del universo del mapa se conservan en la adquisición y quedan fuera del enrutamiento. Un mes incompleto bloquea la preparación. En un mes validado completo, una combinación OD ausente aporta cero al agregado. [Método RAEB](../week12/RAEBImplementation.md) · [Auditoría de fuentes](../week04/README.md).

**Eventos** usa entradas horarias de subway del mismo período, con fechas y horas locales. Se suman los conteos por complejo y hora, filtrando el modo subway. Para cada complejo se estima la referencia habitual con observaciones equivalentes de semanas cercanas. El residuo transformado alimenta las wavelets sobre un grafo que conecta complejos vecinos y horas consecutivas. El detector aplica umbrales de señal y magnitud, y agrupa cambios conectados que persisten. Horas sin observación o referencia válida quedan fuera de la detección. [Reglas y fuentes de Eventos](../week12/SpectralEvents.md).

## Preguntas y evidencia procesada

| Pregunta | Transformación y archivo | Lectura e interacción |
|---|---|---|
| ¿Qué tramos llevan más demanda en la red de referencia? | Promedio diario estimado de viajes asignados por enlace. [556 tramos y cambios A/B](data/processed/atlas_rail_annual.csv). | El grosor y el color secuencial priorizan las cargas altas. El cursor recupera el valor de cada tramo. Habilitar el agrupamiento permite explorar relaciones a otra escala de abstracción. |
| ¿Con qué destinos se vincula más un origen o qué demanda cruza entre dos áreas? | Matriz OD anual. [423 destinos con demanda desde Times Sq-42 St](data/processed/atlas_origin_destinations.csv). El par puede agregarse por grupos de complejos. | Seleccionar un origen muestra sus salidas. Dibujar dos zonas selecciona los pares que las cruzan. La ruta asignada y el destino conservan significados distintos. |
| ¿En qué día y hora se concentra la actividad de un complejo o del sistema? | Distribución en 168 celdas. [Reloj del sistema y de Times Sq-42 St](data/processed/atlas_weekly_clock.csv). | El reloj localiza franjas por anillo y ángulo. Al pulsar se actualiza el mapa y al repetir se limpia la franja. La dispersión anual sitúa cada complejo por volumen diario y participación de su hora pico. |
| ¿Dónde cambió el volumen entre años y dónde se reorganizó el ritmo semanal? | Diferencia de carga por tramo, índice de volumen y TV de la forma semanal. [Comparación de 424 complejos](data/processed/atlas_complex_annual.csv). | Los minimapas comparten franja, referencia y escala. El mapa comparado muestra B − A. Posición en la dispersión separa dos dimensiones y el reloj localiza las diferencias horarias. |
| ¿Cuándo se apartaron de lo habitual varios complejos conectados y cómo evolucionó la desviación? | Wavelets de entradas y episodios. [Matriz de 60 meses](data/processed/atlas_events_monthly.csv), [32 horas de contexto](data/processed/atlas_event_series.csv) y [desglose por complejo y hora](data/processed/atlas_event_complexes.csv). | Elegir mes y episodio ubica la evidencia. Mapa y serie comparten la hora. El color del complejo indica cambio relativo con signo y su tamaño refleja el cambio absoluto en entradas. |

El eje de volumen en A/B calcula `100 × promedio_diario_B / promedio_diario_A`. El eje de cambio de forma calcula `TV (pp) = 50 × suma de |p_B(i) − p_A(i)|`, con `p` como proporción de la semana. En el reloj la diferencia por celda es `100 × (p_B(i) − p_A(i))`. Los resultados son comparaciones descriptivas entre años seleccionables.

## Hallazgos exploratorios

- **Un tramo con aumento destacado.** Entre Bryant Pk / 5 Av y 34 St–Herald Sq, la carga diaria asignada pasó de **172.071** en 2021 a **294.385** en 2025. Fue el mayor cambio absoluto de los 556 enlaces ferroviarios del ejemplo. La cifra corresponde a viajes OD asignados al tramo y agrupa ambos sentidos. [CSV de tramos](data/processed/atlas_rail_annual.csv).
- **Magnitud y forma en Times Sq–42 St.** Sus salidas diarias estimadas pasaron de **64.133** a **131.748**. El índice de volumen fue **205,43 %** de 2021 y la variación total fue **5,56 pp**. La mayor ganancia de peso de una celda fue el martes a las 09:00 **(+0,30 pp)**. En el promedio diario de 2025, Grand Central–42 St fue su destino estimado más frecuente, con unos **3.752 viajes**. [Dispersión](data/processed/atlas_complex_annual.csv) · [Reloj](data/processed/atlas_weekly_clock.csv) · [Destinos](data/processed/atlas_origin_destinations.csv).
- **Una caída horaria localizada.** El episodio del **29 de septiembre de 2023** abarca 16 horas y 43 complejos. A las **17:00** registra **66.945 entradas observadas** frente a **131.210,5 habituales** en los complejos del episodio. El detector publicó 338 candidatos en 59 meses. Marzo de 2021 tiene cobertura de entradas y cero candidatos seleccionados. [Serie del episodio](data/processed/atlas_event_series.csv) · [Matriz mensual](data/processed/atlas_events_monthly.csv).

## Diseño, alternativas y límites

El [boceto anotado de Años](sketches/panel-anos.png) inicia con todo el sistema y un día promedio de 2025. Los años ocupan el panel izquierdo, el mapa va al centro y el reloj y la dispersión a la derecha. El [boceto de comparación](sketches/panel-comparacion.png) añade la escala divergente y reutiliza los mismos idioms. Se puede recorrer primero la geografía, acotar por selección y consultar una marca. Un mapa con 424 relojes fue descartado por oclusión. Un reloj separado del mapa habría obligado a repetir la selección temporal.

El [boceto de Eventos](sketches/panel-eventos.png) sustituye los años por meses, episodios y serie dentro del mismo panel izquierdo. El mapa conserva el contexto de la red. Una cuadrícula separada de 4 × 3 por año dificultaba alinear el mismo mes entre años. La matriz compacta mantiene esa alineación. Mostrar el residuo directo fue una alternativa al filtrado en el grafo. El contraste de Semana 12 muestra diferencias de extensión de los episodios y requiere referencias por complejo para evaluar cuál delimita mejor la afectación. [Comparación de métodos](../week12/SpectralEvents.md#comprobación-exploratoria).

La abstracción permite inspeccionar demanda, patrones y desviaciones. El GTFS fijo representa la red de referencia, los recorridos se modelan y los OD describen cohortes típicas. La ocupación, las causas de episodios y los itinerarios individuales quedan fuera de la cobertura. Las razones para cada decisión y sus fuentes están en la [revisión de cinco artículos](referencias.md).

## Reproducción

Desde la raíz del repositorio, con la versión 2021–2025 de los artefactos de Semana 12:

```bash
python3 deliveries/week06/code/build_atlas_evidence.py
python3 deliveries/week06/code/build_atlas_evidence.py --check
node deliveries/week12/tests/validate-raeb-data.mjs
node --test deliveries/week12/tests/spectral-data.test.mjs
```

Los CSV de esta revisión se identifican con el prefijo `atlas_`. Los archivos del EDA anterior siguen disponibles para rastrear la evolución del proyecto. [Adquisición y preparación completa](../week12/DataAcquisition.md).
