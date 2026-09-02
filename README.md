# MTA Subway Hourly Ridership: 2020–2024

Primera entrega de Data Visualization 2026-2: selección y documentación del dataset.

## Integrantes

- Acervo Correa, Renzo Alfonso
- Maquera Bobadilla, Diva Stewart
- Condori Palomino, José Eduardo

## Dataset y relevancia

Utilizamos [MTA Subway Hourly Ridership: 2020–2024](https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-2020-2024/wujg-7c2s/about_data), publicado por la Metropolitan Transportation Authority (MTA) en Open NY. Fecha de acceso: **2 de septiembre de 2026**.

El universo publicado comprende 120,855,568 registros sobre entradas estimadas por hora, modo de transporte, complejo de estación, método de pago y clase tarifaria en Nueva York. Combina variables temporales, geográficas y numéricas que permiten plantear, para etapas posteriores:

1. ¿Cómo cambiaron las entradas entre 2020 y 2024?
2. ¿Cómo varía la demanda según la hora y el día de la semana?
3. ¿Cómo evolucionó el uso de OMNY frente a MetroCard?
4. ¿Qué diferencias existen entre estaciones y boroughs?

## Datos entregados y alcance

Se entrega una **muestra de 10,000 filas con 12 campos originales**, sin enriquecimientos: 2,000 filas por año y 500 por combinación de año y trimestre. Incluye subway, Staten Island Railway y tram, con una asignación controlada por modo.

La muestra permite inspeccionar los datos y reproducir la evaluación inicial. **No es proporcional al universo y no debe usarse para estimar totales o participaciones poblacionales.** Las preguntas anteriores requerirán datos adecuados al análisis posterior.

El dataset completo no se almacena en GitHub por su tamaño; se proporcionan el enlace oficial y un script de descarga. Esta entrega no incluye un dashboard.

## Archivos

```text
data-visualization-2026-2/
├── README.md
├── .gitignore
├── data/sample/
│   └── mta_subway_hourly_2020_2024_sample.csv
├── docs/
│   ├── acquisition.md
│   ├── data_dictionary.csv
│   ├── data_quality.md
│   ├── data_quality_metrics.csv
│   └── references.md
└── scripts/
    ├── acquisition/download_mta.py
    └── preprocessing/quality_check.py
```

El diccionario explica los 12 campos originales y los 3 campos regionales adicionales que puede generar Open NY. La procedencia, metodología y condiciones de uso están en [adquisición](docs/acquisition.md) y [referencias](docs/references.md). El [informe de calidad](docs/data_quality.md) interpreta las métricas de la muestra y sus limitaciones.

## Cómo reproducir la entrega

Desde la raíz del proyecto, con **Python 3.10 o superior** y conexión a Internet. No se necesitan paquetes externos.

```bash
python3 scripts/acquisition/download_mta.py --mode sample
python3 scripts/preprocessing/quality_check.py
```

Para obtener el dataset completo, que puede ocupar varios gigabytes:

```bash
python3 scripts/acquisition/download_mta.py --mode full
```

La descarga completa se guarda en `data/raw/`, creada automáticamente y excluida de Git. Las instrucciones adicionales y las validaciones realizadas se describen en [adquisición](docs/acquisition.md).
