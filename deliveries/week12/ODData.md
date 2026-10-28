# Adquisición OD 2021–2024

Descarga completa de los 48 meses y todos los pares publicados, sin muestras,
sin filtrar estaciones y conservando los 16 campos originales. Fuentes MTA:

Para otra computadora, consulta [DataSharing.md](DataSharing.md): explica qué
archivos incluye Git, dónde colocar los originales compartidos y cómo obtener
el GTFS sin depender de las rutas locales del autor.

| Año | Dataset oficial |
|---|---|
| 2021 | https://data.ny.gov/d/rapa-97zv |
| 2022 | https://data.ny.gov/d/nqnz-e9z9 |
| 2023 | https://data.ny.gov/d/uhf3-t34z |
| 2024 | https://data.ny.gov/d/jsu2-fbtj |

Es OD **estimado por MTA**, agregado por mes, día de semana y hora. El timestamp
es representativo de una semana del mes, no la fecha de un viaje individual.
`estimated_average_ridership` es un promedio: no sumar los 48 meses y llamar
al resultado viajes. Para totales mensuales se necesitan exposiciones de calendario.

## Ejecutar y reanudar

Desde la raíz del repositorio:

```bash
.venv/bin/python -u deliveries/week12/scripts/acquire_od.py --workers 4
```

El trabajo iniciado en segundo plano registra su PID y salida en:

- `data/raw/od_2021_2024/download.pid`
- `data/raw/od_2021_2024/download.log`

Rutas relativas a `deliveries/week12/`. El progreso, URL, fechas y SHA-256 de
cada mes están en `data/od_2021_2024/acquisition.json`. Los originales comprimidos
quedan en `data/raw/od_2021_2024/`, fuera de Git. Hay un bloqueo para evitar
lanzar dos descargadores al mismo tiempo. Se reutilizan meses cuyo archivo y
SHA-256 coinciden; una interrupción dentro de un mes reinicia ese mes. Los
archivos `.partial` no se cuentan como descargados. Los errores tienen reintentos
y quedan registrados. El token opcional `SOCRATA_APP_TOKEN` se lee del entorno,
no se almacena. No se evita el reposo ni se configura ninguna tarea recurrente.

## Después de terminar, verificar y preparar

```bash
.venv/bin/python deliveries/week12/scripts/prepare_validate_od.py
```

Este segundo script se ejecuta **por separado, después de la descarga**. Requiere los
48 meses recibidos, convierte todos los registros a Parquet conservando campos,
verifica SHA-256 y compara filas y suma de promedios con controles independientes
de la API para cada mes. La suma de promedios solo se usa como control numérico.
Conserva las consultas y publica cobertura mensual y un informe de validación.
Requiere DuckDB de `requirements-data.txt`.

El diccionario de cada fuente se extrae automáticamente de los metadatos oficiales
a `data/od_2021_2024/dictionary_AAAA.json`, incluyendo definición y tipo de cada
campo. Los metadatos originales y sus huellas se conservan en la misma carpeta.

`DOWNLOADING` significa en curso. `DOWNLOADED_UNVERIFIED` significa que llegaron
los 48 archivos; **no equivale a validación completa**. Solo `validation.json`
con `status: PASS` confirma los controles posteriores. Estos datos todavía no
se incorporan a las visualizaciones existentes del Atlas.
