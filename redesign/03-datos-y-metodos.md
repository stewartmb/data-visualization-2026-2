# Datos, transformaciones y límites

## Decisión sobre la fuente

Se conserva la fuente MTA: su granularidad horaria y espacial permite estudiar ritmos. El enriquecimiento se dirige a mejorar comparabilidad y contexto, no a aumentar arbitrariamente las columnas.

| Fuente | Artefacto versionado | Papel y unión |
|---|---|---|
| [MTA Subway Hourly Ridership 2020–2024](https://data.ny.gov/d/wujg-7c2s) | `data/redesign/jan_feb_hourly_2020_2024.csv` | 350 951 agregados estación × año × día semanal × hora para enero–febrero; filtro `transit_mode='subway'` |
| [MTA Subway Stations and Complexes](https://data.ny.gov/d/5f5g-n3cz) | `data/redesign/station_catalog.json` | Catálogo actual: rutas y contexto de identidad; unión exacta `station_complex_id = complex_id`, 424/424 |
| [Borough Boundaries, NYC DCP](https://data.cityofnewyork.us/d/gthc-hcne) | `data/redesign/boroughs_raw.json` y `atlas/data/boroughs.geojson` | Contexto cartográfico, sin unión espacial analítica; se mantiene el borough publicado por MTA |
| CSV procesados de Semana 6 | `deliveries/week06/data/processed/` | Serie mensual contextual histórica y coordenadas de los complejos; no se usan para mezclar perfiles de temporadas distintas |
| [Comunicado oficial MTA, mayo 2021](https://www.mta.info/press-release/mta-partners-dining-dignitaries-welcome-back-247-subway-service-and-100-percent) | Enlace y nota contextual | Documenta cierre nocturno y reanudación de 24 h; contexto interpretativo, no atribución causal por estación |
| [Plan del L Project](https://www.mta.info/document/8106) y [comunicado de obras 63 St de marzo 2024](https://new.mta.info/press-release/mta-announces-regular-service-being-restored-f-and-m-lines-following-critical-track) | `data/redesign/context_events.json` | Tres contextos oficiales curados manualmente; sus reglas de relevancia se publican con cada registro |

Los endpoints, intervalos y SHA-256 están en [`../data/redesign/sources.json`](../data/redesign/sources.json). La fecha de consulta real queda registrada allí. Se atribuyen fuentes públicas; las fichas de Socrata no declaran una licencia específica. Aplican los términos de Open NY / NYC Open Data, conservados por enlace; el proyecto no afirma haber otorgado una licencia nueva a los datos externos.

Cada consulta guarda la fecha del snapshot de caché; `assembled_at_utc` identifica la reconstrucción del manifiesto. Reutilizar caché no se presenta como una consulta nueva. El contexto operativo es un conjunto de ejemplos revisados, no un catálogo exhaustivo de interrupciones. La ausencia de una marca no demuestra operación normal.

El L Project se vincula a complejos cuyo nombre histórico incluye L; un complejo puede compartir otras líneas y sus entradas no se separan por ruta. El comunicado de 63 St se vincula por IDs curados (221–224) y fecha de publicación. Documenta obras, shuttle y retorno del servicio en abril, pero no sustituye un registro diario de oferta en enero–febrero. Estas marcas invitan a verificar un caso y no cuantifican efectos causales.

## Registro original y registros derivados

Una fila original es hora local × complejo × modo × método de pago × clase tarifaria, con entradas estimadas. No es una persona, ni un viaje completo. Las consultas suman métodos y categorías dentro de `subway`.

El nuevo CSV tiene una fila por complejo × año × día semanal × hora. `ridership` suma todas las entradas registradas para esa combinación en enero–febrero. `dow` sigue la convención API: 0 domingo, 1 lunes, …, 6 sábado. El cliente reordena las posiciones a lunes–domingo.

## Universo y cobertura

- 424 complejos `subway`: Brooklyn 156, Manhattan 121, Queens 79, Bronx 68.
- El prototipo anterior tenía 428 al incluir SIR y tram. Esta revisión excluye esos cuatro complejos. El contorno de Staten Island sigue siendo contexto cartográfico, pero no contiene complejos de este universo.
- Todos los 424 tienen perfiles positivos en ambos extremos y unión exacta con el catálogo. No se utilizaron emparejamientos difusos por nombre.
- 168 × 424 × 5 = 356 160 celdas posibles. Se registraron entradas positivas en 350 951. Celdas sin entradas por año: 2020 = 11; 2021 = 4 986; 2022 = 186; 2023 = 3; 2024 = 24.
- Una celda sin registros se representa como cero entradas registradas, con conteo visible de celdas. No equivale a una medición de demanda cero bajo servicio normal. Las interrupciones de servicio, cobertura y cambios operativos pueden intervenir.

La auditoría completa y los hashes del cliente están en [`data-audit.json`](data-audit.json).

## Comparación y exposición del calendario

La comparación anterior usaba enero–febrero 2020 frente al año 2024 completo. Puede incorporar diferencias estacionales. Aquí se comparan enero–febrero de los cinco años. Esto reduce ese desajuste, pero no controla feriados, clima, eventos ni obras.

Para cada estación `s`, año `y`, día semanal `d` y hora `h`:

```text
A[s,y,d,h] = suma de entradas observadas en enero–febrero
N[y,d]     = cantidad de veces que aparece ese día semanal en el período
W[s,y,d,h] = A[s,y,d,h] / N[y,d]
P[s,y,d,h] = W[s,y,d,h] / suma de las 168 celdas W[s,y]
```

`W` es una semana promedio construida con un lunes promedio, un martes promedio, etc. `P` es la proporción de entradas de esa semana comparable. La suma de `P` es 1. Así una mayor cantidad de lunes en un calendario no altera por sí sola la forma normalizada.

| Año | Lun | Mar | Mié | Jue | Vie | Sáb | Dom | Días |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2020 | 8 | 8 | 9 | 9 | 9 | 9 | 8 | 60 |
| 2021 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 59 |
| 2022 | 9 | 8 | 8 | 8 | 8 | 9 | 9 | 59 |
| 2023 | 9 | 9 | 8 | 8 | 8 | 8 | 9 | 59 |
| 2024 | 9 | 9 | 9 | 9 | 8 | 8 | 8 | 60 |

## Medidas y sus denominadores

| Medida | Fórmula y unidad | Interpretación y límite |
|---|---|---|
| Peso de celda | `100 × P[d,h]` (%) | Participación de una hora-día en una semana comparable |
| Diferencia de celda | `100 × (P_y − P_2020)` (pp) | Cambio de proporción, no cambio de volumen absoluto |
| Distancia de forma TV | `50 × Σ |P_y − P_2020|` (pp; 0–100) | Diferencia total entre distribuciones; no mide cuántas personas cambiaron de horario |
| Peso AM | `100 × Σ P[lun–vie,06:00–09:59] / Σ P[lun–vie,00:00–23:59]` (%) | Fracción de entradas laborables en AM; la franja es una elección analítica, no una constante oficial MTA |
| Peso fin de semana | `100 × Σ P[sáb–dom]` (%) | Fracción de una semana estandarizada correspondiente a esos dos días |
| Promedio diario comparable | `Σ W / 7` (entradas/día) | Da igual peso a cada día de semana; distinto del promedio diario bruto del período |
| Índice de volumen | `100 × diario_y / diario_2020` (%) | 100 es el nivel base; no es utilización de capacidad ni calidad de servicio |
| Hellinger | `sqrt(½Σ(√P_a − √P_b)²)` (0–1) | Similitud de forma en el mismo año; vecinos no implican mismo tipo funcional ni causa |
| Perfil del sistema/grupo | Suma de `W` por estación, luego normalización | Ponderación por entradas de la semana comparable; no es la mediana de estaciones |

Las estadísticas bajo las vistas son **medianas de estaciones** y se etiquetan así. La trayectoria del sistema/grupo es ponderada por entradas; ambas agregaciones contestan preguntas distintas.

El mapa de volumen usa 100 como referencia y no satura valores extremos. El atlas/huella usa escalas fijas compartidas: ±0,65 pp para diferencia y 0–1,5 % para peso. La saturación se cuenta y declara; el tooltip conserva valores exactos. Los valores almacenados de P se redondean a ocho decimales.

## Serie mensual contextual

La serie mensual divide el total de entradas por los días reales del mes, evitando comparar febrero con un mes de 31 días por suma bruta. Proviene del snapshot de Semana 6. Los perfiles nuevos se consultaron en otra fecha y el histórico puede revisarse; no se combinan ambas versiones en el cálculo de diferencias de forma.

## Enriquecimientos evaluados

| Candidato | Decisión |
|---|---|
| Más registros de la misma fuente con temporadas equivalentes | Incorporado: beneficia directamente comparabilidad y trayectorias T1/T5 |
| Catálogo oficial de complejos y contornos geográficos | Incorporados: unión y contexto claros, bajo costo, uso específico |
| GTFS actual | Aplazado: no reconstruye por sí solo frecuencias históricas 2020–2024; puede confundirse oferta actual con la observada entonces |
| Torniquetes 2019 | Aplazado: granularidad de cuatro horas y otra metodología; exige armonización antes de llamarlo base comparable |
| Clima / censo | Aplazados: requieren emparejamiento temporal/espacial y control de confusores; un join por proximidad no demuestra una causa |
| Supuestos viajes o enlaces entre estaciones | Descartados: no son observaciones de esta fuente |

## Reproducir sin red

El CSV agregado, catálogo y geometría originales están versionados. Desde la raíz:

```bash
python3 scripts/redesign/build_atlas.py
python3 scripts/redesign/validate_atlas.py
```

El primer comando reconstruye `atlas/data/atlas.json`, el GeoJSON simplificado y la auditoría. Solo usa la biblioteca estándar. La simplificación Ramer–Douglas–Peucker conserva una representación cartográfica; no se utiliza para métricas ni joins espaciales.

## Volver a consultar las fuentes

```bash
python3 scripts/redesign/acquire_context.py
python3 scripts/redesign/build_atlas.py
```

Se usan 45 ventanas de hasta siete días, tres solicitudes simultáneas, reintentos y caché en `work/redesign-cache/`. No requiere token y no descarga el universo de 120 millones de filas. Si se quiere forzar una adquisición nueva, retirar la caché y los snapshots de contexto después de conservar la versión que se desea comparar. Una consulta futura puede producir otra versión del histórico; revisar hashes y auditoría antes de sustituir resultados.

## Límites que deben acompañar los hallazgos

Son estimaciones agregadas de entradas a complejos. Faltan salidas, destinos, personas únicas, frecuencia y capacidad históricas. Los perfiles observados reflejan uso y condiciones de operación. El catálogo y los contornos son actuales. La comparación de la misma temporada y la exposición por día no eliminan todos los sesgos; no hay inferencia estadística ni causal. El cierre nocturno documentado en 2021 es contexto conocido, no una explicación exhaustiva por estación.
