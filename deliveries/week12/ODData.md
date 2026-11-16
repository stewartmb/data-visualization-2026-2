# Adquisición y preparación OD 2021–2025

La base de 2021–2024 cubre 48 meses. La ampliación de 2025 añade 12 meses. Se conservan los 16 campos originales y todos los pares publicados en la adquisición.

Para otra computadora, consulta [DataSharing.md](DataSharing.md): explica qué
archivos incluye Git, dónde colocar los originales compartidos y cómo obtener
el GTFS sin depender de las rutas locales del autor.

| Año | Dataset oficial |
|---|---|
| 2021 | https://data.ny.gov/d/rapa-97zv |
| 2022 | https://data.ny.gov/d/nqnz-e9z9 |
| 2023 | https://data.ny.gov/d/uhf3-t34z |
| 2024 | https://data.ny.gov/d/jsu2-fbtj |
| 2025 | https://data.ny.gov/d/y2qv-fytt |

Es OD **estimado por MTA**, agregado por mes, día de semana y hora. El timestamp
es representativo de una semana del mes, no la fecha de un viaje individual.
`estimated_average_ridership` es un promedio: no sumar los promedios mensuales y llamar
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
con `status: PASS` confirma los controles posteriores. La validación completa está en este repositorio con `status: PASS`: 48 meses y 446.399.011 registros. Ese período aporta 672 cohortes al mapa. Las otras 168 provienen de 2025. El estado del manifiesto de adquisición conserva la fase de descarga; el informe de validación posterior es el que acredita los controles.

## Completar OD de 2025

La [fuente OD de 2025](https://data.ny.gov/d/y2qv-fytt) cubre enero–diciembre.

Desde la raíz del repositorio:

```bash
.venv/bin/python -u deliveries/week12/scripts/acquire_od.py --2025 --workers 3 &&
  .venv/bin/python -u deliveries/week12/scripts/prepare_validate_od.py --2025
```

La opción `--2025` (también `--extension`) usa el recuento mensual de Open NY.
Añade `--plan` al script de adquisición para ver la cobertura sin descargar
archivos. Los meses completos se reutilizan tras verificar su SHA-256.
Los meses pendientes se descargan en bloques que abarcan dos horas del día
cada uno, para los siete días de la semana. Cada bloque completo tiene su
consulta, fecha y SHA-256. Si una conexión se corta, se reintenta ese bloque.
Antes de consolidar el mes, el script comprueba que la suma de filas de sus
bloques coincida con el recuento oficial.

Los originales y Parquet se guardan en `data/raw/od_2025_2026/`. Los
diccionarios, metadatos y manifiestos quedan en `data/od_2025_2026/`. Para
este período, el recuento por mes publicado en los metadatos oficiales es
el control externo de cobertura. La preparación también comprueba el esquema, el
período y los valores de afluencia; la suma de promedios se registra como
control local. El informe de 2025 registró 121.209.974 filas y los doce meses completos.

Para preparar y sincronizar 2025 en el Atlas después de generar la base
2021–2024 con `prepare_raeb.py`, ejecutar desde la raíz:

```bash
.venv/bin/python deliveries/week12/scripts/prepare_od_2025.py
node deliveries/week12/tests/validate-raeb-data.mjs
```

El script verifica los SHA-256 de los doce Parquet y de la red preparada, conserva
el orden de los 424 complejos y calcula 168 matrices y el promedio diario anual
de 2025. Se registran aparte cuatro filas con un extremo fuera de la red
(Tompkinsville y St George, de Staten Island Railway). Los meses sin pares
publicados para parte de Rockaways coinciden con [las obras de la línea A](https://www.mta.info/document/150141).
Los recorridos se modelan sobre el GTFS de referencia de 2026.

## Comparaciones mensuales en Fractal

El prototipo **Cambios mensuales** compara los viajes iniciados en cada complejo con los del mes anterior, para el mismo día de la semana y hora. Cada valor es el promedio publicado por la MTA para esa franja mensual, sumado sobre los destinos de subway incluidos en el catálogo del Atlas. La vista compara solo los orígenes presentes en ambos meses. Dentro de un mes publicado, una franja de un origen presente sin filas OD suma cero. Enero de 2021 carece de mes anterior.

Cada celda del calendario muestra la franja con el mayor cambio absoluto en el total de viajes iniciados de la red comparable. El color indica cuánto bajó o subió ese total, con una escala constante para el calendario. Al elegir un mes, la lista muestra las seis franjas con el mayor cambio absoluto del total de la red comparable. En el mapa, el área del círculo por encima del mínimo visible representa el cambio absoluto del complejo. La escala de área es constante para las 168 franjas del par de meses. La serie compara dos días típicos, expresados en viajes iniciados por hora.

`python deliveries/week12/scripts/prepare_monthly_od.py` usa DuckDB y NumPy para agregar las 60 particiones Parquet validadas por los procesos de adquisición OD originales. Comprueba los SHA-256 de origen. El [índice de la vista](atlas/data/monthly-od/index.json) declara el orden de complejos y franjas, la codificación, el linaje de cada mes y el SHA-256 de cada archivo generado. El navegador carga el par elegido bajo demanda.
