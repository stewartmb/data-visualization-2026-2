# Datos completos · enero de 2019 a diciembre de 2024

La ampliación solicitada es **temporal**: todos los meses de 2019–2024. El número
424 corresponde a complejos de subway y no limita las filas, fechas u horas de
la adquisición. La fuente oficial de 2019 también contiene 424 complejos de
subway. Los registros de SIR y tranvía se conservan en la base completa y pueden
distinguirse por `transit_mode`; no se mezclan silenciosamente con el Atlas.

## Fuentes y comprobación de completitud

- [MTA Subway Hourly Ridership 2017–2019](https://data.ny.gov/d/t69i-h2me): se extrae **todo 2019**.
- [MTA Subway Hourly Ridership 2020–2024](https://data.ny.gov/d/wujg-7c2s): se extrae **todo 2020–2024**.

Los controles oficiales por mes suman **141.836.156 registros**: 20.980.589 de
2019 y 120.855.567 de 2020–2024, incluyendo los modos presentes en las fuentes.
No son personas únicas ni viajes OD. No se usa una muestra ni un catálogo fijo
de estaciones para filtrar la descarga. No se usa el espejo de otro proveedor.

El estado efectivo se consulta en [`data/full_period/acquisition.json`](data/full_period/acquisition.json).
Solo `status: COMPLETE`, con **72/72 meses** verificados, significa descarga
completa. `PARTIAL` no significa que se disponga de todo el período. Cada mes
se compara con una consulta independiente de la fuente: número de filas, suma
de entradas y suma de transbordos. Se verifica también el encabezado completo
y el intervalo de fechas. Se guardan URL, fecha UTC, SHA-256 y resultados.

Se conservan los **12 campos originales**: `transit_timestamp`, `transit_mode`,
`station_complex_id`, `station_complex`, `borough`, `payment_method`,
`fare_class_category`, `ridership`, `transfers`, `latitude`, `longitude` y
`georeference`. El Parquet incorpora además `source_dataset` para distinguir
la procedencia a ambos lados de 2020. No se redondean coordenadas ni se imputa OD.

## Ubicaciones

```text
deliveries/week12/
  scripts/acquire_full_period.py       descarga oficial mensual y reanudable
  scripts/build_full_period.py         Parquet completo y tablas analíticas
  scripts/validate_full_period.py      comprobación independiente
  requirements-data.txt               dependencia fijada
  data/raw/full_period/               CSV.gz originales: fuera de Git
    parquet/                         todos los registros, tipados: fuera de Git
  data/full_period/
    acquisition.json                 estado y controles por mes
    metadata_*.json                   esquemas oficiales
    expected_months_*.json            totales oficiales por mes
    parquet-conversion.json          huellas y filas de cada conversión
    processed/                       tablas completas por día, mes, tarifa y hora
    build-audit.json                  cobertura y procedencia de resultados
    validation.json                   PASS solo después de verificar todo
  atlas/data/full_period.json         series mensuales del cliente: 72 meses
```

Las descargas crudas no se suben a Git por su volumen. Eso no las convierte en
muestras: cada archivo local contiene todos los registros del mes y su número
de filas se verifica contra la fuente. Para compartir o reconstruir la base
se entregan scripts, controles, huellas y tablas derivadas. El archivo llamado
`sample_original_12_fields.csv` es solo una muestra de lectura para revisar el
esquema; se identifica explícitamente y no sustituye la base completa.

## Ejecutar y reanudar

Desde la raíz del repositorio:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r deliveries/week12/requirements-data.txt
.venv/bin/python deliveries/week12/scripts/acquire_full_period.py --workers 3
.venv/bin/python deliveries/week12/scripts/build_full_period.py
.venv/bin/python deliveries/week12/scripts/validate_full_period.py
```

La descarga se reanuda con el mismo comando: los meses cuyo SHA-256 y controles
coinciden se reutilizan. `--month 2019-01` permite probar un solo mes; el estado
global continúa siendo parcial. `--refresh` solicita controles y datos nuevos,
por lo que debe considerarse una actualización de versión y volver a validarse.
Un token Socrata puede leerse desde `SOCRATA_APP_TOKEN`; no se escribe en URLs,
archivos de procedencia ni Git.

Opcionalmente, durante la descarga:

```bash
.venv/bin/python deliveries/week12/scripts/build_full_period.py --cache-only
```

Este paso convierte únicamente los meses ya verificados para adelantar trabajo.
No produce una auditoría final ni declara completa una serie parcial.

El [diccionario de campos y derivaciones](data/full_period/data_dictionary.csv)
especifica unidades, granularidad y tratamiento de ausencias.

## Tablas preparadas

| Archivo en `data/full_period/processed/` | Granularidad |
|---|---|
| `coverage_month_mode.csv` | Mes × modo: filas fuente, fechas observadas, complejos, entradas y transbordos |
| `ridership_by_station_day.csv` | Complejo × fecha: conteos registrados y filas fuente; mantiene compatibilidad con la tabla diaria previa |
| `ridership_by_station_month.csv` | Complejo × mes × modo, sin restringirse a enero–febrero |
| `ridership_month_borough_payment_fare.csv` | Mes × modo × borough × medio de pago × categoría tarifaria |
| `station_month_hourofweek.parquet` | Complejo × mes × modo × día de semana × hora, con fechas observadas y filas fuente |
| `complex_catalog.csv` | Unión de complejos observados, primeras/últimas fechas y valores recientes de identidad/ubicación |

Las tablas se construyen sin limitar los IDs a 424. Se preserva la etiqueta de
modo reportada, incluida cualquier inconsistencia de la fuente, como las dos
entradas SIR de 2023 detectadas previamente. La validación también exige que la nueva base reproduzca exactamente las
350.951 filas del insumo publicado de enero–febrero 2020–2024. De ellas,
350.950 corresponden a los 424 complejos del Atlas; una agrupación adicional
(502, 2023, viernes a la 01 h, dos entradas) proviene de la anomalía SIR
etiquetada como subway. Se conserva en la base y se excluye del universo
del Atlas, igual que antes.
Cada tabla agregada debe conservar
la suma de entradas, transbordos y número de registros de la base completa.
No se interpreta un día sin registros de una estación como disponibilidad del
servicio con demanda cero.

## Datos disponibles y comparación visual

La base completa cubre los **72 meses**. Las curvas mensuales del cliente usan
los 72 meses. La huella semanal del Atlas conserva la comparación metodológica
previa de **enero–febrero de 2020 frente a 2021–2024**, con ajuste de calendario.
Son dos alcances explícitos: ampliar los datos no cambia automáticamente la
definición de una medida ya publicada. La línea mensual muestra promedios
diarios observados por mes, sin ajuste por composición de días de la semana.

Los scripts antiguos y el reporte de la entrega describen también ese análisis
previo. Este documento y los manifiestos de `data/full_period/` identifican la
ampliación temporal, sus controles y las tablas disponibles para nuevas tareas.
