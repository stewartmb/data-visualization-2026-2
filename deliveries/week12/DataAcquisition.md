# Adquisición, manejo y reproducción · Semana 12

Este documento complementa la sección 4.6 de `Proyecto_Final_Guia.md`. La entrega
se trabaja en `deliveries/week12/`; sus scripts resuelven rutas desde su propia
ubicación. Las descargas voluminosas se excluyen de Git. Los snapshots pequeños,
consultas, huellas y resultados preparados sí forman parte del paquete.

## Ampliación temporal 2019–2024

La adquisición completa usa dos fuentes oficiales y **todos los meses**:
2019 de `t69i-h2me` y 2020–2024 de `wujg-7c2s`. Se conservan los 12 campos y
todos los modos reportados, sin filtrar a 424 IDs. Los 72 controles mensuales
suman 141.836.156 registros. El estado real, las tablas preparadas, el diccionario
y los comandos están en [FullPeriodData.md](FullPeriodData.md) y
`data/full_period/`. La interfaz incorpora una curva de los 72 meses; sus medidas
de huella, transbordos y tarifas comparables siguen usando enero–febrero de
2020–2024. Preparar la base completa no redefine esas medidas.

## Fuentes y alcance del análisis comparable

| Fuente | Qué extraemos | Escala y límite |
|---|---|---|
| [MTA Subway Hourly Ridership 2020–2024](https://data.ny.gov/d/wujg-7c2s) | Entradas y transbordos gratuitos; categorías tarifarias y medio de pago | Enero–febrero de 2020–2024. Entradas agregadas; no personas ni OD. |
| [Catálogo de complejos MTA](https://data.ny.gov/d/5f5g-n3cz) | Identificadores GTFS de las estaciones que componen cada complejo | Catálogo actual; puente entre los 424 complejos del Atlas y los andenes del GTFS. |
| [NYC DCP, NTA2020](https://data.cityofnewyork.us/d/9nt8-h7nd) | Polígonos y nombres de territorios | Definición territorial 2020, versión descargada actualmente; no series de turismo ni residencia de viajeros. |
| [GTFS regular oficial MTA](https://www.mta.info/developers) | Paradas, servicios, secuencias, calendarios y reglas de transferencia | Snapshot actual. El feed descargado declara versión `20260826-X-long-term-supplement-trip-ids` y vigencia 26/05–31/10/2026. No reconstruye la red 2020–2024. |

Las URL exactas, consultas, fechas UTC, tamaños y SHA-256 están en
[`data/context/sources.json`](data/context/sources.json). Las respuestas originales
pequeñas y metadatos se conservan en `data/context/sources/`. El ZIP GTFS queda
en `data/raw/enrichments/`, fuera de Git. Se versiona una extracción compacta de
sus secuencias únicas y reglas para permitir reconstruir el mismo grafo sin red.
Los términos de cada proveedor se consultan en las fichas enlazadas; no se
atribuye una licencia nueva a sus datos ni se distribuyen logotipos MTA.

## Qué hace cada script

| Script en `scripts/` | Responsabilidad |
|---|---|
| `acquire_full_period.py` | Adquisición oficial 2019–2024, 72 meses, 12 campos, todos los modos y controles independientes. |
| `build_full_period.py` / `validate_full_period.py` | Conserva registros en Parquet; produce y verifica tablas diarias, mensuales, tarifarias y horarias, más las series del cliente de 72 meses. |
| `download_full.py` | Ruta anterior MTA de 2020–2024, paginada y reanudable. No descarga 2019. |
| `build_from_full.py` | Convierte a Parquet y agrega con DuckDB. Produce también totales mensuales por complejo. |
| `prepare_full_inputs.py` | Adapta las tablas completas al insumo de la aplicación y documenta sus huellas. |
| `acquire_context.py` | Ruta alternativa existente: consultas semanales del perfil horario y catálogo/boroughs. |
| `build_atlas.py` / `validate_atlas.py` | Construcción y recalculo independiente de perfiles de 168 horas, calendario y medidas. |
| `acquire_enrichments.py` | Extrae transbordos de la tabla diaria completa; consulta tarifas por mes/borough/producto, NTA2020 y GTFS oficial. Conserva caché y procedencia; `--refresh` obtiene nuevas versiones. |
| `build_enrichments.py` | Filtra el universo, estandariza transbordos, asigna territorios, agrega afluencia por NTA y construye el grafo dirigido. Sin red ni paquetes externos. |
| `validate_enrichments.py` | Verifica huellas, unicidad, denominadores, reconciliación con el Atlas, exclusiones y extremos de las aristas. |
| `test_map_layout.mjs` / `test_enrichment_metrics.mjs` | Pruebas de conservación/separación de marcadores y agregación ponderada, incluyendo límites de granularidad tarifaria. |
| `sync_live_atlas.py` | Copia la aplicación validada de Semana 12 al `atlas/` raíz y verifica igualdad por SHA-256. Solo archivos locales; no publica ni hace push. |

## Reproducción sin red desde esta entrega

Desde la raíz del repositorio, con Python >=3.9 y Node.js:

```bash
python3 deliveries/week12/scripts/build_atlas.py
python3 deliveries/week12/scripts/validate_atlas.py
python3 deliveries/week12/scripts/build_enrichments.py
python3 deliveries/week12/scripts/validate_enrichments.py
node deliveries/week12/scripts/test_map_layout.mjs
node deliveries/week12/scripts/test_enrichment_metrics.mjs
python3 -m http.server 8773 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:8773/deliveries/week12/atlas/`. Los archivos preparados
permiten usar la aplicación sin consultar APIs. El fondo de OpenStreetMap sí
requiere conexión; sin él se mantienen los contornos. La reproducción de datos
es independiente de las teselas del mapa.

El contexto mensual preexistente se entrega como totales por complejo × mes,
derivados de la tabla diaria utilizada por el Atlas original. Su procedencia
está en `data/processed/provenance.json`. No se reconstruye mediante una inversión
de valores redondeados del cliente.

## Adquisición nueva desde las fuentes

Para la base nueva de **2019–2024**, usar los tres scripts y dependencias de
[FullPeriodData.md](FullPeriodData.md). Los siguientes comandos reproducen la
ruta anterior de **2020–2024** y sus enriquecimientos de enero–febrero:

```bash
python3 deliveries/week12/scripts/download_full.py --workers 4
python3 -m pip install duckdb
python3 deliveries/week12/scripts/build_from_full.py
python3 deliveries/week12/scripts/prepare_full_inputs.py
python3 deliveries/week12/scripts/build_atlas.py
python3 deliveries/week12/scripts/validate_atlas.py
python3 deliveries/week12/scripts/acquire_enrichments.py --refresh
python3 deliveries/week12/scripts/build_enrichments.py
python3 deliveries/week12/scripts/validate_enrichments.py
```

Si ya existe una tabla diaria completa, se puede evitar repetir esa descarga:

```bash
python3 deliveries/week12/scripts/acquire_enrichments.py --daily-csv data/processed/full/ridership_by_station_day.csv
```

El token Socrata es opcional para el descargador completo y se lee desde el
entorno; no se guarda en el repositorio. La adquisición de enriquecimientos
usa endpoints públicos sin token. El GTFS regular cambia con el tiempo: conservar
el snapshot y sus huellas permite distinguir reproducción de una actualización.

## Transformaciones y decisiones

**Transbordos gratuitos.** El campo `transfers` ya estaba en la fuente original;
ahora se extrae y utiliza. Se restringe al mismo universo de 424 complejos. Para
cada año y día de semana se divide tanto entradas como transbordos por la cantidad
de fechas de ese día en enero–febrero. La participación es
`100 × suma(transbordos estandarizados) / suma(entradas estandarizadas)`.
Para grupos se suman numeradores y denominadores antes de dividir. Nunca se
promedian porcentajes de estaciones. Los transbordos están incluidos en las
entradas: no se suman otra vez ni se interpretan como todos los cambios entre
líneas. Se cuentan las fechas con registro de la tabla diaria; una fecha ausente
no prueba demanda nula bajo servicio normal.

**Tarifas.** La nueva consulta filtra `transit_mode='subway'`; la tabla anterior
de borough × mes mezclaba modos. Se conservan categorías originales y medio de
pago. La participación usa totales observados de enero–febrero, sin ajuste de
calendario porque la extracción mensual no conserva el día de semana. No se
asignan categorías a complejos ni NTA. La interfaz muestra el borough completo
o los cuatro boroughs, con el denominador explícito. Ausencia de una categoría
se muestra como `—`; no demuestra ausencia de estudiantes u otro grupo social.

**Excepción de calidad encontrada.** En febrero de 2023 la API devuelve dos
entradas de Tompkinsville (SIR, complejo 502, Staten Island) etiquetadas como
`subway`. La consulta diagnóstica se conserva en `scope_exclusions_2023.json`.
No pertenecen al universo de cuatro boroughs del Atlas: se conservan en
`fare_scope_exclusions.csv`, se excluyen de los denominadores y se verifica que
`total utilizado + total excluido = total descargado`. Tras esa exclusión las
tarifas reconcilian exactamente con las entradas de los 424 complejos en los
cinco períodos. No se corrige silenciosamente la respuesta de la API.

**Territorio.** Unión punto-en-polígono entre la coordenada del complejo y los
polígonos NTA2020, respetando huecos. Las coincidencias múltiples, puntos de borde
y no coincidencias se reportan; no se asigna el vecino más cercano. Resultado:
424 coincidencias únicas y 130 NTA ocupadas. Los volúmenes territoriales suman las
semanas estandarizadas de sus complejos y conservan el total del sistema.

**Grafo.** Se ordenan paradas por `stop_sequence` dentro de cada viaje GTFS y se
deduplican patrones. Los andenes se convierten a complejos mediante el catálogo.
Las aristas unen paradas consecutivas de un servicio, con dirección, ruta y
calendarios asociados. Un expreso puede saltarse estaciones: son enlaces de
servicio, no todos los tramos físicos de vía. Una parada sin correspondencia
rompe la secuencia; no se inventa un atajo. Se conservan restricciones de
`transfers.txt`, se excluyen prohibiciones (`transfer_type=3`) y autoenlaces al
agrupar complejos. Se obtuvieron 424 nodos, 2.040 enlaces dirigidos de servicio
y cuatro relaciones de transferencia declaradas entre complejos; estas últimas
no son cuatro intercambiadores ni un inventario de todos los transbordos del
metro. Muchos intercambios ocurren dentro de un mismo complejo. No se utilizan
las entradas como peso de pasajeros en las aristas.

## Uso en la aplicación

El apartado desplegable **Afluencia 2019–2024, transbordos y territorio** del inspector
muestra la participación de transbordos para estación/grupo, las cinco temporadas,
el NTA de una estación con selección directa de su territorio y las categorías
tarifarias de su borough. La exportación de estaciones incorpora NTA y conteos
estandarizados de transbordos; las tarifas conservan su CSV separado a escala
borough. El grafo está preparado y descargable como JSON; aún no sustituye el
trazado simplificado del mapa ni representa viajes de usuarios.

Auditorías: `data/context/build-audit.json` y `data/context/validation.json`.
No se incorporan como si estuvieran completas las muestras OD ni los contextos
turísticos explorados anteriormente.
