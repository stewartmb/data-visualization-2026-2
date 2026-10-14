# MTA Subway Hourly Ridership: 2020–2024

**Entrega Semana 4 — Selección y documentación del dataset**
DS5343 Data Visualization · UTEC · 2026-2

Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

---

## 1. Qué es

| | |
|---|---|
| **Dataset** | MTA Subway Hourly Ridership: 2020–2024 |
| **ID** | `wujg-7c2s` (Open NY / Socrata) |
| **Fuente** | [data.ny.gov](https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-2020-2024/wujg-7c2s/about_data) |
| **Publicador** | Metropolitan Transportation Authority (MTA) |
| **Cobertura** | Nueva York · 2020–2024 · granularidad horaria |
| **Volumen** | 120,855,568 registros · varios GB |
| **Acceso** | 2 de septiembre de 2026 |
| **Licencia** | Sin licencia específica declarada; sin limitaciones de uso según MTA + [Términos OPEN-NY](https://data.ny.gov/api/views/77gx-ii52/files/ef0c1840-ad54-4240-92fd-6397c49fde46?filename=OPEN-NY_20Terms_20of_20Use.pdf) |

Cada fila = hora × complejo de estación × modo × método de pago × clase tarifaria.

---

## 2. Qué datos tenemos

**12 campos originales**

| Tipo | Campos |
|---|---|
| Temporal (1) | `transit_timestamp` |
| Identificador (1) | `station_complex_id` |
| Categórico (5) | `transit_mode` · `station_complex` · `borough` · `payment_method` · `fare_class_category` |
| Numérico (2) | `ridership` · `transfers` |
| Geográfico (2) | `latitude` · `longitude` |
| Geometría (1) | `georeference` |

**+3 campos** `computed_region` generados por la plataforma (condado, municipio, ZIP) — no solicitados en la muestra.

📄 [`docs/data_dictionary.csv`](docs/data_dictionary.csv)

---

## 3. De dónde salen

Torniquetes: *swipes* de MetroCard y *taps* de OMNY (provistos por Cubic).
La MTA limpia, deduplica y retira transacciones de agencias asociadas antes de publicar.

> **No es data sintética. Es observacional.**

---

## 4. Cómo la obtenemos

El archivo completo no se sube al repositorio por su tamaño.

```bash
# Muestra de 10,000 filas
python3 scripts/acquisition/download_mta.py --mode sample

# Universo completo (streaming a data/raw/, excluido de Git)
python3 scripts/acquisition/download_mta.py --mode full
```

**Diseño muestral** — 2,000 filas/año · 500 por año-trimestre · cuota modal 88% subway / 6% SIR / 6% tram

✅ Determinista: dos ejecuciones producen archivos idénticos.

📄 [`scripts/acquisition/download_mta.py`](scripts/acquisition/download_mta.py) · [`docs/acquisition.md`](docs/acquisition.md)

---

## 5. Cómo está organizado

```text
├── data/sample/     → muestra de 10,000 filas
├── docs/            → diccionario · adquisición · calidad · referencias
└── scripts/         → adquisición · verificación
```

---

## 6. Documentación

| Archivo | Contenido |
|---|---|
| [`data_dictionary.csv`](docs/data_dictionary.csv) | Una fila por campo: tipo, unidad, valores posibles, faltantes |
| [`acquisition.md`](docs/acquisition.md) | Procedencia, método, acceso por API, condiciones de uso |
| [`data_quality.md`](docs/data_quality.md) | Informe de la evaluación inicial |
| [`data_quality_metrics.csv`](docs/data_quality_metrics.csv) | 33 indicadores auditables |
| [`references.md`](docs/references.md) | Enlaces oficiales MTA y Open NY |

---

## 7. Qué encontramos

**33 controles de calidad** → [`docs/data_quality_metrics.csv`](docs/data_quality_metrics.csv)

| Control | Resultado |
|---|---|
| Valores faltantes | 0 |
| Duplicados en clave compuesta | 0 |
| Ridership / transfers negativos | 0 |
| `transfers` > `ridership` | 0 |
| Coordenadas fuera de rango NY | 0 |

**Alcance real de la muestra**

| | |
|---|---|
| Filas | 10,000 · 12 campos |
| Años | 2,000 por año (2020–2024) |
| Días distintos | **28** |
| Complejos | **92** de más de 400 |
| Boroughs | Manhattan · Brooklyn · Queens · Staten Island — **sin Bronx** |
| Modos | subway 8,800 · SIR 600 · tram 600 |
| Pago | metrocard 8,539 · omny 1,461 |

> ⚠️ Muestra **estratificada, no aleatoria**. Sirve para validar estructura y tipos. **No** para estimar totales ni comparar boroughs. La ausencia del Bronx es consecuencia del diseño muestral, no del dataset.

---

## 8. Limitaciones

1. **Entradas, no salidas** — no hay pares origen–destino
2. **Complejo, no estación individual**
3. **`transfers` ⊂ `ridership`** — sumarlas duplica el conteo
4. Son estimaciones de la MTA, no un censo
5. El histórico puede ajustarse por transacciones tardías

---

## Acknowledgments

Datos: MTA vía Open NY · Plataforma: Socrata (API SODA)
Parte del código y la documentación se elaboró con asistencia de IA, revisada y validada por el equipo.
