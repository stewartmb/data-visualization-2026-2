<div align="center">

# La forma del día

**Cómo cambió el ritmo horario del metro de Nueva York, 2020–2024**

Semana 6 · Análisis de datos y bocetos
DS5343 Data Visualization · UTEC · 2026-2

`428 estaciones` · `1 827 días` · `120 855 568 registros` · `6 tablas agregadas`

Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

</div>

---

<a id="indice"></a>

## Índice

| | |
|---|---|
| **1** | [Estructura del entregable](#contenido) |
| **2** | [Reproducción de los datos procesados](#reproducir) |
| **3** | [Trazabilidad de las preguntas de dominio](#evidencia) |
| **4** | [Hallazgos exploratorios](#hallazgos) |
| **5** | [Decisiones metodológicas](#decisiones) |
| **6** | [Limitaciones identificadas](#limitaciones) |
| **7** | [Documentación del proyecto](#documentos) |

---

<a id="contenido"></a>

## 1 · Estructura del entregable

```
deliveries/week06/
│
├── DataAnalysis.md
├── PresentationWeek06.pptx
├── especificacion-vistas.md
├── referencias.md
├── README.md
│
├── code/
├── data/processed/
├── figuras/
├── papers/
└── sketches/
```

[↑](#indice)

---

<a id="reproducir"></a>

## 2 · Reproducción de los datos procesados

**Requisito único:** un app token de Socrata, gratuito → [obtenerlo](https://data.ny.gov/profile/edit/developer_settings)

Se pega en la primera celda de cada notebook, en `SOCRATA_APP_TOKEN`. **No está en el repositorio.**

Los notebooks corren en Google Colab sin instalar nada. En este orden:

| | Notebook | Tiempo | Produce |
|---|---|---|---|
| **1** | `verify_station_ids_colab.ipynb` | ~1 min | verificación de identificadores |
| **2** | `build_aggregates_colab.ipynb` | ~25 min | las 4 tablas agregadas |
| **3** | `baseline_prepandemia_colab.ipynb` | ~2 min | línea base y coordenadas |

<details>
<summary><b>Detalle de cada paso</b></summary>

<br>

**1 · Verificación de identificadores**

Comprueba que `station_complex_id` sea estable en los cinco años. Es el supuesto del que depende toda la comparación temporal: si los identificadores cambiaran, comparar una estación entre 2020 y 2024 no tendría sentido.

> Salidas → `station_ids_by_year.csv` · `station_id_stability.md` · `station_ids_by_year.png`

**2 · Tablas agregadas**

Recorre los cinco años en ventanas de siete días y agrega del lado del servidor. El dataset completo nunca se descarga.

Es resumible: si una ventana falla se marca y el proceso continúa; al volver a correr la celda retoma solo las pendientes.

> **Correr la celda 3 antes de lanzar las pasadas.** Cronometra las tres formas de consulta y estima la duración total. Si una ventana tarda más de ~20 s, bajar `WINDOW_DAYS` a 4 en la celda 1.

> Salidas → `ridership_by_station_day.csv` · `ridership_by_station_hourofweek_year.csv` · `ridership_by_month_borough_payment_fare.csv` · `station_profiles_normalized.csv`

**3 · Línea base y coordenadas**

Extrae el perfil de enero y febrero de 2020 —la línea base prepandemia real— y la tabla de estaciones con coordenadas.

> Salidas → `prepandemia_station_hourofweek.csv` · `prepandemia_profiles_normalized.csv` · `stations_coords.csv`

</details>

[↑](#indice)

---

<a id="evidencia"></a>

## 3 · Trazabilidad de las preguntas de dominio

Cada pregunta de dominio con la tabla que la sustenta y la figura que la documenta.

| # | Pregunta | Tabla | Figura |
|:---:|---|---|---|
| 1 | Evolución del volumen | `ridership_by_station_day` | `f1_serie_mensual` |
| 2 | Forma del día laborable | `prepandemia_station_hourofweek`<br>`ridership_by_station_hourofweek_year` | `f3_forma_dia`<br>`f4_delta_hora` |
| 3 | Tipología de estaciones | `station_profiles_normalized` | `f7_pico_valle` |
| 4 | Cambio de tipo | `prepandemia_profiles_normalized` | `f7_pico_valle` |
| 5 | Distribución geográfica | `stations_coords` | `f8_mapa` |
| 6 | Recuperación desigual | `ridership_by_month_borough_payment_fare` | `f2_boroughs` |
| 7 | Composición tarifaria | `ridership_by_month_borough_payment_fare` | `f6_tarifas` |

[↑](#indice)

---

<a id="hallazgos"></a>

## 4 · Hallazgos exploratorios

**La recuperación se estancó cerca del 70 %.**
De 139.0 M de entradas en enero de 2020 al fondo de 12.1 M en abril. Diciembre de 2024 llega a 105.4 M, un 75.8 %.

**El Bronx quedó 17 puntos debajo de Manhattan.**

| Manhattan | Queens | Brooklyn | Bronx | Staten Island |
|:---:|:---:|:---:|:---:|:---:|
| 78.3 % | 77.8 % | 73.8 % | **60.9 %** | 58.7 % |

**El día laborable se corrió hacia la tarde.**
La razón entre el pico de la mañana y el de la tarde pasó de 1.014 a 0.916. Las 8 h pierden 1.31 puntos porcentuales; las franjas de 13 a 16 h y de 21 a 22 h ganan.

**El pico se aplanó en 372 de 414 estaciones.**
La razón pico/valle del sistema cayó de 2.90 a 2.35.

**OMNY pasó de 1.5 % a 65.2 % del ridership.**
Superó a MetroCard en enero de 2024.

[↑](#indice)

---

<a id="decisiones"></a>

## 5 · Decisiones metodológicas

<details>
<summary><b>Segmentación de las consultas en ventanas de siete días</b></summary>

<br>

La primera versión del pipeline agregaba por mes y expiraba. Medimos el comportamiento real de la API con `date_trunc_ymd` en el `$group`:

| Rango | Resultado |
|---|---|
| 1 día | 0.9 s |
| 7 días | 2.0 s |
| 1 mes | **expira a los 600 s** |

No es una degradación gradual: hay un precipicio entre una semana y un mes. Socrata cambia de plan de ejecución y cae a una ruta lenta.

Por eso las pasadas que usan expresiones de fecha recorren el período en ventanas de siete días. Solo la que agrupa por columnas crudas puede ir mensual.

</details>

<details>
<summary><b>Selección de la línea base prepandemia</b></summary>

<br>

La tabla agregada por año mezcla enero y febrero prepandemia con el confinamiento posterior. Usar el año 2020 completo como referencia enmascara el fenómeno que el proyecto quiere medir.

Contra el año 2020 completo, la razón pico/valle del sistema pasaba de 2.34 a 2.35: la conclusión habría sido que no hubo cambio.

Contra la línea base prepandemia, cae de **2.90 a 2.35**.

</details>

<details>
<summary><b>Verificación de la numeración del día de la semana</b></summary>

<br>

Socrata devuelve `date_extract_dow` como entero sin documentar el origen. Se verificó por los datos en lugar de asumirlo:

| dow | ridership |
|:---:|---|
| **0** | **402 M** |
| 1 | 711 M |
| 2 | 799 M |
| 3 | 813 M |
| 4 | 805 M |
| 5 | 765 M |
| **6** | **508 M** |

Los dos valores más bajos son 0 y 6 → domingo y sábado. Asumirlo al revés habría invertido todo el análisis de día laborable.

</details>

<details>
<summary><b>Variables derivadas</b></summary>

<br>

**Perfil normalizado.** Cada estación y año es un vector de 168 valores (24 h × 7 días) dividido por su propio total. Las estaciones se comparan por forma, no por tamaño.

**Razón pico/valle.** Máximo del perfil laborable entre 5 y 11 h dividido por el mínimo entre 10 y 14 h. Se descartan 14 estaciones cuyo máximo cae en el borde de la ventana.

**Tasa de recuperación.** Ridership diario promedio de 2024 sobre el de enero–febrero de 2020.

</details>

[↑](#indice)

---

<a id="limitaciones"></a>

## 6 · Limitaciones identificadas

| | |
|---|---|
| **Entradas, no salidas** | No hay pares origen–destino. Ningún análisis de flujo de viajes es posible con esta fuente. |
| **`transfers` ⊂ `ridership`** | Es un subconjunto, no una medida independiente. Sumarlas duplica el conteo. |
| **Complejo, no estación** | Un complejo agrupa varias estaciones conectadas. |
| **Son estimaciones** | Publicadas por la MTA, dentro del 1 % de sus cifras oficiales. No es un censo. |
| **MetroCard → OMNY** | Es adopción tecnológica. Una caída en MetroCard no es una caída de demanda. |
| **Línea base acotada** | Es enero–febrero de 2020, no un promedio de 2019. Las tasas se leen respecto de ese período. |
| **Exclusión en pico/valle** | 14 estaciones descartadas por el criterio de borde de ventana. |
| **Ventanas de verificación** | Un complejo que hubiera abierto y cerrado entre ventanas no sería detectado. |

[↑](#indice)

---

<a id="documentos"></a>

## 7 · Documentación del proyecto

| Documento | Contiene |
|---|---|
| [`DataAnalysis.md`](DataAnalysis.md) | Informe completo: datos, transformaciones, hallazgos, limitaciones, diseño |
| [`especificacion-vistas.md`](especificacion-vistas.md) | Las cinco vistas: encodings, interacciones, justificación |
| [`referencias.md`](referencias.md) | Los cuatro papers y qué decisión sostiene cada uno |

[↑](#indice)

---

<div align="center">

<sub>

Datos: Metropolitan Transportation Authority (MTA) vía Open NY · Acceso: Socrata (API SODA)

Parte del código y la documentación se elaboró con asistencia de IA, revisada y validada por el equipo.

</sub>

</div>
