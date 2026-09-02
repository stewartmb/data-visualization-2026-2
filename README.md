# MTA Subway Hourly Ridership: 2020-2024

**Curso:** Data Visualization 2026-2  
**Entregable:** Seleccion y presentacion del dataset  
**Fecha de acceso:** 2026-09-02

## Integrantes

- Acervo Correa, Renzo Alfonso
- Maquera Bobadilla, Diva Stewart
- Condori Palomino, Jose Eduardo

## Dataset seleccionado

Esta entrega utiliza **MTA Subway Hourly Ridership: 2020-2024**, identificador `wujg-7c2s`, publicado por la Metropolitan Transportation Authority en el portal oficial Open NY.

- **Universo publicado:** 120,855,568 registros (aproximadamente 121 millones).
- **Cobertura:** ciudad de Nueva York, 2020-2024.
- **Granularidad:** hora, modo, complejo de estacion, metodo y clase de pago.
- **Unidad de observacion:** cantidad estimada de entradas para una combinacion horaria, geografica y tarifaria.
- **Campos analiticos:** 12; la plataforma puede agregar 3 campos regionales calculados.
- **Frecuencia declarada:** estatica, sin nuevas actualizaciones para este periodo historico.

Fuente oficial: <https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-2020-2024/wujg-7c2s/about_data>

## Relevancia y riqueza

El dataset integra tiempo, ubicacion, modo de transporte, medio de pago, clase tarifaria, pasajeros, transferencias y coordenadas. Su volumen y variedad permiten estudiar demanda, recuperacion pospandemia, adopcion de OMNY, diferencias territoriales y patrones horarios.

Preguntas posibles:

1. ¿Como cambio el ridership entre 2020 y 2024?
2. ¿Que complejos concentran mas entradas por hora?
3. ¿Como varia la demanda entre dias laborables y fines de semana?
4. ¿Como evoluciono la participacion de OMNY frente a MetroCard?
5. ¿Que diferencias existen entre subway, Staten Island Railway y tram?
6. ¿Que boroughs y franjas horarias concentran mas transferencias?
7. ¿Que clases tarifarias predominan por periodo y ubicacion?
8. ¿Donde aparecen valores extremos o problemas de calidad?

## Estructura

```text
data-visualization-2026-2/
├── README.md
├── requirements.txt
├── data/
│   ├── raw/
│   │   ├── README.md
│   │   └── source_manifest.json
│   ├── processed/
│   │   ├── mta_subway_hourly_2020_2024_processed_sample.csv
│   │   └── ridership_summary.csv
│   └── sample/
│       └── mta_subway_hourly_2020_2024_sample.csv
├── docs/
│   ├── data_dictionary.csv
│   ├── data_dictionary.xlsx
│   ├── acquisition.md
│   ├── data_quality.md
│   ├── data_quality_metrics.csv
│   └── references.md
├── scripts/
│   ├── acquisition/download_mta.py
│   └── preprocessing/
│       ├── preprocess.py
│       └── quality_check.py
├── src/
├── public/
└── .gitignore
```

## Reproduccion

Requiere Python 3.10 o superior. No utiliza paquetes externos.

### Modo muestra

Genera 10,000 filas mediante 20 estratos de ano-trimestre con representacion controlada de los tres modos:

```bash
python scripts/acquisition/download_mta.py --mode sample
python scripts/preprocessing/preprocess.py
python scripts/preprocessing/quality_check.py
```

La muestra asigna 2,000 registros a cada ano, 500 a cada combinacion ano-trimestre y contiene subway, Staten Island Railway y tram. Su objetivo es probar el flujo; sus proporciones no deben interpretarse como estimaciones poblacionales.

La reproduccion se ejecuto dos veces de forma independiente y produjo archivos identicos:

| Archivo | SHA-256 |
|---|---|
| Muestra raw | `3c19393d16f049988f6e8d3c8ec2915305f92ac6f0b02e9828afd3ebbf0a0029` |
| Muestra procesada | `ddddd875d29355dbeedc764949aab526f06c6cb75d42d85af2f6c8bf829c1641` |
| Resumen | `cf77a52ebbda553077ed319580c93672cc0203734c4d64acb59c278615013ac3` |

### Modo completo

```bash
python scripts/acquisition/download_mta.py --mode full
```

La descarga completa se realiza por streaming desde la API y puede ocupar varios gigabytes. No se incluye en GitHub.

Para validar el endpoint con solo 1 MiB:

```bash
python scripts/acquisition/download_mta.py \
  --mode full \
  --max-bytes 1048576 \
  --output work/full_test.csv
```

Si se dispone de un token Socrata:

```bash
export SOCRATA_APP_TOKEN="TU_TOKEN"
```

El token es opcional y nunca debe guardarse en el repositorio.

El modo completo fue validado descargando de forma controlada el primer MiB del endpoint oficial y comprobando su encabezado CSV. La descarga masiva no se conserva en el proyecto.

## Archivos procesados

- La muestra procesada conserva las 12 variables originales y agrega ano, trimestre, mes, fecha, hora, dia de semana, fin de semana, tasa de transferencias y banderas de calidad.
- `ridership_summary.csv` agrega registros, estaciones, ridership y transfers por tiempo, modo, borough y metodo de pago.
- No se eliminan silenciosamente valores sospechosos; se marcan mediante campos `quality_*`.

## Calidad y limitaciones

La muestra verificada contiene 10,000 filas, los cinco anos y los tres modos. No se detectaron nulos, claves compuestas duplicadas, tipos invalidos, valores negativos, transferencias mayores que ridership, timestamps fuera del periodo ni coordenadas fuera del rango definido. Estos resultados describen la muestra, no prueban que los 120.9 millones de registros carezcan de problemas.

MTA indica que los datos se limpian y deduplican antes de publicarse, que pueden recibir ajustes por transacciones tardias y que las metricas se encuentran dentro de 1% de las cifras presentadas en reuniones publicas de la entidad.

## Correspondencia con la rubrica

| Criterio | Evidencia |
|---|---|
| Relevancia y riqueza | 120.9 millones de registros, 12 atributos centrales y ocho preguntas analiticas |
| Fuente y condiciones | `docs/acquisition.md` y `docs/references.md` |
| Organizacion | carpetas raw, sample y processed; CSV y manifiesto |
| Diccionario | CSV y XLSX con tipos, unidades, dominios, nulos y fuentes |
| Reproducibilidad | modos `sample` y `full` mediante la API oficial |
| Calidad inicial | reporte y metricas ejecutadas sobre 10,000 registros |
