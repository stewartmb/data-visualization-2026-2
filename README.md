<div align="center">

# La forma del día

**Cómo cambió el ritmo horario del metro de Nueva York, 2020–2024**

Proyecto final · DS5343 Data Visualization · UTEC · 2026-2

`428 estaciones` · `1 827 días` · `120 855 568 registros`

Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

</div>

---

<a id="indice"></a>

## Índice

| | |
|---|---|
| **1** | [El proyecto](#proyecto) |
| **2** | [Entregas](#entregas) |
| **3** | [Estructura del repositorio](#estructura) |
| **4** | [Responsabilidades](#responsabilidades) |
| **5** | [Cronograma](#cronograma) |
| **6** | [Reproducción de los datos](#reproduccion) |
| **7** | [El dataset](#dataset) |
| **8** | [Limitaciones](#limitaciones) |

---

<a id="proyecto"></a>

## 1 · El proyecto

El metro de Nueva York programa su servicio alrededor del doble pico del día laborable. Entre 2020 y 2024 esa forma cambió, pero la recuperación se reporta casi siempre con un solo número: dice cuánta demanda volvió, no a qué hora vuelve ni en qué estaciones.

La unidad de análisis de este proyecto no es el volumen total sino el **perfil horario semanal de cada estación**: 24 horas × 7 días = 168 valores, normalizados por el total de la estación. Ese vector describe su ritmo, no su tamaño.

**Audiencia principal:** planificadores de servicio de la MTA y analistas de transporte urbano.
**Decisión que apoya:** dónde reasignar frecuencia de servicio.

La entrega final es una visualización interactiva en D3.js con cinco vistas enlazadas por brushing.

[↑](#indice)

---

<a id="entregas"></a>

## 2 · Entregas

| Semana | Fecha | Entrega | Carpeta |
|---|---|---|---|
| 4 | 2 sep | Selección y documentación del dataset | [`deliveries/week04/`](deliveries/week04/) |
| 5 | 9 sep | Propuesta de proyecto | [`deliveries/week05/`](deliveries/week05/) |
| 6 | 16 sep | Análisis de datos y bocetos | [`deliveries/week06/`](deliveries/week06/) |
| 7 | 23 sep | Delivery 1 — consolidación de la primera fase | [`deliveries/week07/`](deliveries/week07/) |
| 10 | 14 oct | Prototipo funcional y design review | `deliveries/week10/` |
| 12 | 28 oct | Borrador refinado y crítica por pares | `deliveries/week12/` |
| 15 | 18 nov | Entrega final y exhibición | `deliveries/week15/` |

[↑](#indice)

---

<a id="estructura"></a>

## 3 · Estructura del repositorio

```
data-visualization-2026-2/
│
├── README.md
├── .gitignore
│
├── data/sample/              muestra de 10 000 filas del dataset original
├── docs/                     diccionario · adquisición · calidad · referencias
├── scripts/                  adquisición · verificación
│
└── deliveries/
    ├── week04/               dataset seleccionado y documentado
    ├── week05/               propuesta de proyecto
    ├── week06/               análisis de datos y bocetos
    └── week07/               Delivery 1
```

[↑](#indice)

---

<a id="responsabilidades"></a>

## 4 · Responsabilidades

| Integrante | Responsabilidad |
|---|---|
| **Renzo Acervo Correa** | Pipeline de datos, agregaciones y preparación de los JSON para el cliente |
| **Stewart Maquera Bobadilla** | Implementación en D3.js y vistas enlazadas |
| **José Condori Palomino** | Narrativa, diseño visual y paper |

Los tres participan en la formulación de preguntas, la crítica de diseño y la presentación final.

[↑](#indice)

---

<a id="cronograma"></a>

## 5 · Cronograma restante

| Semana | Fecha | Objetivo |
|---|---|---|
| 10 | 14 oct | Prototipo funcional en D3 con las vistas A, B y C enlazadas |
| 12 | 28 oct | Narrativa integrada, vistas D y E, respuesta a la crítica por pares |
| 15 | 18 nov | Aplicación publicada, paper, teaser, video, poster y presentación final |

[↑](#indice)

---

<a id="reproduccion"></a>

## 6 · Reproducción de los datos

**Requisito único:** un app token de Socrata, gratuito → [obtenerlo](https://data.ny.gov/profile/edit/developer_settings)

Se pega en la primera celda de cada notebook, en `SOCRATA_APP_TOKEN`. **No está en el repositorio.**

Los notebooks corren en Google Colab sin instalar nada. En este orden:

| | Script | Tiempo | Produce |
|---|---|---|---|
| **1** | `deliveries/week06/code/verify_station_ids.py` | ~1 min | verificación de identificadores |
| **2** | `deliveries/week06/code/build_aggregates.py` | ~25 min | las 4 tablas agregadas |
| **3** | `deliveries/week06/code/baseline_prepandemia.py` | ~2 min | línea base y coordenadas |

<details>
<summary><b>Detalle de cada paso</b></summary>

<br>

**1 · Verificación de identificadores.** Comprueba que `station_complex_id` sea estable en los cinco años. Es el supuesto del que depende toda la comparación temporal.

**2 · Tablas agregadas.** Recorre los cinco años en ventanas de siete días y agrega del lado del servidor. El dataset completo nunca se descarga. Es resumible: si una ventana falla se marca y el proceso continúa.

> Correr la celda de cronometraje antes de lanzar las pasadas. Si una ventana tarda más de ~20 s, bajar `WINDOW_DAYS` a 4.

**3 · Línea base y coordenadas.** Extrae el perfil de enero–febrero de 2020 y la tabla de estaciones con coordenadas.

</details>

Las salidas quedan en `deliveries/week06/data/processed/`.

[↑](#indice)

---

<a id="dataset"></a>

## 7 · El dataset

| | |
|---|---|
| **Dataset** | MTA Subway Hourly Ridership: 2020–2024 |
| **ID** | `wujg-7c2s` (Open NY / Socrata) |
| **Fuente** | [data.ny.gov](https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-2020-2024/wujg-7c2s/about_data) |
| **Publicador** | Metropolitan Transportation Authority (MTA) |
| **Cobertura** | Nueva York · 2020–2024 · granularidad horaria |
| **Volumen** | 120 855 568 registros · varios GB |
| **Licencia** | Sin licencia específica declarada; sin limitaciones de uso según MTA + [Términos OPEN-NY](https://data.ny.gov/api/views/77gx-ii52/files/ef0c1840-ad54-4240-92fd-6397c49fde46?filename=OPEN-NY_20Terms_20of_20Use.pdf) |

Cada fila = hora × complejo de estación × modo × método de pago × clase tarifaria.

Los datos provienen de torniquetes: *swipes* de MetroCard y *taps* de OMNY. Documentación completa en [`docs/`](docs/).

[↑](#indice)

---

<a id="limitaciones"></a>

## 8 · Limitaciones

| | |
|---|---|
| **Entradas, no salidas** | No hay pares origen–destino. Ningún análisis de flujo de viajes es posible con esta fuente. |
| **`transfers` ⊂ `ridership`** | Es un subconjunto, no una medida independiente. Sumarlas duplica el conteo. |
| **Complejo, no estación** | Un complejo agrupa varias estaciones conectadas. |
| **Son estimaciones** | Publicadas por la MTA, dentro del 1 % de sus cifras oficiales. |
| **MetroCard → OMNY** | Es adopción tecnológica. Una caída en MetroCard no es una caída de demanda. |
| **Línea base acotada** | Es enero–febrero de 2020, no un promedio de 2019. |

[↑](#indice)

---

<div align="center">

<sub>

Datos: Metropolitan Transportation Authority (MTA) vía Open NY · Acceso: Socrata (API SODA)

Parte del código y la documentación se elaboró con asistencia de IA, revisada y validada por el equipo.

</sub>

</div>
