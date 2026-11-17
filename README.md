# Fractal · Atlas de ritmos del metro de Nueva York

Proyecto final de DS5343 Data Visualization · UTEC · 2026-2 · Prof. Germain Garcia-Zanabria

**Equipo:** Renzo Acervo Correa · Stewart Maquera Bobadilla

[Aplicación publicada](https://stewartmb.github.io/data-visualization-2026-2/atlas/) · [Página del proyecto](https://stewartmb.github.io/data-visualization-2026-2/) · [Guía del curso](Proyecto_Final_Guia.md)

## De qué trata

Fractal es una visualización interactiva hecha con D3.js sobre los viajes del metro de Nueva York entre 2021 y 2025. Usamos dos fuentes públicas de la MTA: los viajes origen–destino estimados entre 424 complejos de estaciones y las entradas por hora de cada complejo.

Con la app se puede ver:

- **Por dónde se mueve la gente.** El mapa muestra cuántos viajes pasan por cada tramo de vía, de estación a estación, y cuántos empiezan o terminan en cada complejo.
- **Cuándo.** Un reloj semanal de 7 días por 24 horas resume el ritmo, y al elegir una celda el mapa cambia a ese día y hora.
- **Qué cambió entre años.** Hay un minimapa por año y un modo para comparar cualquier par de años.
- **Qué corredores sostienen los flujos.** Los flujos se pueden agrupar en haces (RAEB), inspeccionar un haz y probar un enlace hipotético entre dos paradas.
- **Cuándo pasó algo raro.** La pestaña Eventos marca las horas en que varios complejos conectados se apartaron de su afluencia habitual.

Las preguntas que guían el proyecto son cinco:

1. ¿Qué zonas ganaron viajes y cuáles perdieron peso entre 2021 y 2025?
2. ¿Ganaron peso los viajes locales y entre boroughs, o aumentó la dependencia de Manhattan?
3. ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. ¿Qué tramos de la red sostienen los principales intercambios?
5. ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia ese balance?

El detalle de cada pregunta, con su métrica y su estado, está en [AnalyticalTasks.md](deliveries/week12/AnalyticalTasks.md).

## Entregables finales

| Entregable | Estado | Dónde está |
|---|---|---|
| Aplicación D3.js publicada | Listo | <https://stewartmb.github.io/data-visualization-2026-2/atlas/> |
| Página del proyecto | Publicada, falta actualizarla con los enlaces finales | <https://stewartmb.github.io/data-visualization-2026-2/> |
| Artículo final y su fuente editable | Listo | [FinalPaper.pdf](deliveries/week15/FinalPaper.pdf). La fuente en LaTeX y las figuras están en [deliveries/week15/paper/](deliveries/week15/paper/) |
| Póster en PDF | Pendiente | Irá en `deliveries/week15/` |
| Video teaser (1 minuto) | Pendiente | El enlace irá aquí y en la página del proyecto |
| Video de presentación (5 minutos) | Pendiente | El enlace irá aquí y en la página del proyecto |
| Presentación final | Pendiente | Irá en `deliveries/week15/PresentationFinal.pptx` |

Las entregas de las semanas anteriores están en la sección [Entregas por semana](#entregas-por-semana).

## Cómo ejecutarlo

No hay que instalar ni compilar nada para ver la app. Solo se necesita Python 3 para levantar un servidor local y un navegador.

```bash
git clone https://github.com/stewartmb/data-visualization-2026-2.git
cd data-visualization-2026-2
python3 -m http.server 8775
```

Luego abrir <http://localhost:8775/atlas/>. En Windows el comando puede ser `python` en lugar de `python3`.

Tres cosas a tener en cuenta:

- **El servidor se levanta desde la raíz del repositorio**, no desde `atlas/`. La pestaña Eventos lee sus datos de `deliveries/week12/data/spectral/` y con otra raíz no los encuentra.
- **No funciona abriendo el `index.html` con doble clic.** La app usa módulos de JavaScript y `fetch`, y el navegador los bloquea sin un servidor HTTP.
- **El clon pesa.** Son unos 550 MB de descarga y cerca de 1,7 GB en disco, porque los datos ya preparados vienen dentro del repositorio.

Un recorrido rápido para comprobar que todo responde:

1. El mapa abre en todo el año 2025 con el flujo por tramo. Arriba debe decir `424 / 424 complejos`.
2. Hacer clic en un complejo para ver sus salidas. El botón **Vista general** vuelve al inicio.
3. Hacer clic en una celda del reloj semanal para cambiar de día y hora.
4. Elegir otro año en los minimapas de la izquierda, o usar **Comparar** para ver la diferencia entre dos años.
5. Subir **Radio inicial**, bajar **Fidelidad a la red** y pulsar **Calcular** para agrupar los flujos en haces.
6. Abrir la pestaña **Eventos**, elegir un mes y luego un episodio.

## Dependencias

**Para la app**

- D3.js 7.9.0. Viene incluida en [atlas/lib/](atlas/lib/) con su licencia, así que la app no descarga nada de internet.
- Un navegador actual. Para el agrupamiento en haces conviene Chrome o Edge con WebGPU. Si no hay WebGPU la app usa un modo de respaldo (WebGL2 o CPU) que hace lo mismo pero más lento.
- Python 3, solo para `http.server`. Sirve cualquier otro servidor de archivos estáticos.

**Para las pruebas** (opcional)

- Node.js. Las probamos con Node 22. No hay `package.json` ni paquetes que instalar.

**Para regenerar datos** (opcional)

- Python 3.10 a 3.13 con los paquetes de [requirements-data.txt](deliveries/week12/requirements-data.txt): `duckdb`, `numpy` y `scipy`.
- Para los bocetos se usa además `matplotlib` ([requirements-design.txt](deliveries/week12/requirements-design.txt)), y para volver a generar los PDF de los informes, Pandoc con XeLaTeX. Los PDF ya vienen compilados.

## Pruebas

Desde la raíz del repositorio:

```bash
for t in deliveries/week12/tests/*.test.mjs; do node "$t" || break; done
node deliveries/week12/tests/validate-raeb-data.mjs
```

Las seis pruebas `.test.mjs` terminan con una línea `PASS`. La segunda orden valida los datos del agrupamiento (huellas SHA-256, matrices y red) y demora unos segundos.

## Datos

Todas las fuentes son públicas y agregadas. No hay datos personales.

| Fuente | Qué contiene | Cobertura | Enlace |
|---|---|---|---|
| MTA Subway Origin–Destination Ridership Estimate | Viajes estimados por mes, día de la semana, hora de inicio y par de complejos | 2021–2025, 60 meses, 567.608.985 filas | Open NY: [2021](https://data.ny.gov/d/rapa-97zv) · [2022](https://data.ny.gov/d/nqnz-e9z9) · [2023](https://data.ny.gov/d/uhf3-t34z) · [2024](https://data.ny.gov/d/jsu2-fbtj) · [2025](https://data.ny.gov/d/y2qv-fytt) |
| MTA Subway Hourly Ridership | Entradas por hora y complejo | 2021–2025, 60 meses, 130.987.497 filas | Open NY: [2021–2024](https://data.ny.gov/d/wujg-7c2s) · [2025](https://data.ny.gov/d/5wq4-mkjj) |
| GTFS estático del metro | Red de referencia: 475 paradas padre, 556 enlaces ferroviarios y 75 transbordos declarados | Versión de 2026 | [MTA Developers](https://www.mta.info/developers#static-gtfs-data) |
| Catálogo de estaciones y complejos | Nombre, líneas, borough y ubicación de los 424 complejos | Vigente | [Open NY](https://data.ny.gov/d/5f5g-n3cz) |
| Borough Boundaries (NYC DCP) | Contornos que se usan de fondo en el mapa | Vigente | [NYC Open Data](https://data.cityofnewyork.us/d/gthc-hcne) |

El uso de los datos sigue los términos de [Open NY](https://data.ny.gov/d/77gx-ii52), de la [MTA](https://www.mta.info/developers) y de [NYC Open Data](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje).

**Qué viene en el repositorio y qué no**

- Sí vienen los datos ya preparados que usa la app: [atlas/data/](atlas/data/) (matrices de viajes por hora y por año, red y geometrías) y [deliveries/week12/data/](deliveries/week12/data/) (catálogo de eventos, tablas de las cinco preguntas, manifiestos y validaciones).
- No vienen los archivos originales. Pesan unos 26 GB y se guardan fuera de Git, en `deliveries/week12/data/raw/`. Los manifiestos registran la URL, la fecha de descarga y la huella SHA-256 de cada mes.
- El diccionario de datos y las muestras en CSV están en [deliveries/week04/](deliveries/week04/README.md).

## Cómo reproducir los datos

Hay tres niveles, del más simple al más pesado.

**1. Usar lo que ya viene.** Es lo que hace la app. No requiere ningún paso.

**2. Regenerar las tablas de las cinco preguntas** a partir de los datos preparados. Toma unos segundos:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r deliveries/week12/requirements-data.txt
.venv/bin/python deliveries/week12/scripts/prepare_analytical_tasks.py --skip-week06-samples
```

El script comprueba las huellas de las matrices, vuelve a escribir los CSV de [analytical_tasks/](deliveries/week12/data/analytical_tasks/) y termina con `PASS`. Según la máquina, algunos valores pueden cambiar en el último decimal y Git los mostrará como modificados.

**3. Descargar los originales y reconstruir todo.** Son unos 26 GB y varias horas. Los comandos por fuente están en [acquisition.md](deliveries/week04/acquisition.md), y el orden completo con las rutas, en [DataAcquisition.md](deliveries/week12/DataAcquisition.md). Cada parte tiene su propio documento:

- Viajes origen–destino: [ODData.md](deliveries/week12/ODData.md)
- Entradas por hora: [FullPeriodData.md](deliveries/week12/FullPeriodData.md)
- Eventos: [SpectralEvents.md](deliveries/week12/SpectralEvents.md)
- Red y agrupamiento: [RAEBImplementation.md](deliveries/week12/RAEBImplementation.md)

La API de Open NY funciona sin cuenta. Un token de aplicación es opcional y solo acelera la descarga. Si se usa, va en la variable de entorno `SOCRATA_APP_TOKEN` o en un archivo `.env`, que está en `.gitignore`. En el repositorio no hay credenciales ni claves.

## Estructura del repositorio

| Carpeta o archivo | Contenido |
|---|---|
| [atlas/](atlas/) | La aplicación final: `index.html`, código en `src/`, D3 en `lib/` y datos en `data/` |
| [index.html](index.html) | Página del proyecto, que se publica en la raíz de GitHub Pages |
| [deliveries/](deliveries/) | Una carpeta por entrega del curso (`week04` a `week12`) |
| [deliveries/week12/scripts/](deliveries/week12/scripts/) | Scripts de descarga, validación y preparación de datos |
| [deliveries/week12/tests/](deliveries/week12/tests/) | Pruebas del modelo, del ruteo, del agrupamiento y de los datos |
| [deliveries/week12/atlas/](deliveries/week12/atlas/) | Copia idéntica de `atlas/`, tal como se entregó en la Semana 12 |
| [app/](app/), [redesign/](redesign/), [docs/](docs/), [data/](data/), [scripts/](scripts/) | Versiones anteriores del proyecto (el prototipo de la Semana 10 y su rediseño). Se conservan como historial y no hacen falta para ejecutar la app |
| [Proyecto_Final_Guia.md](Proyecto_Final_Guia.md) | La guía del curso en Markdown |

## Entregas por semana

| Semana | Entrega |
|---|---|
| 4 | [Paquete de datos, muestras y diccionario](deliveries/week04/README.md) |
| 5 | [Propuesta](deliveries/week05/README.md) |
| 6 | [Análisis de datos, bocetos y papers](deliveries/week06/README.md) |
| 7 | [Entrega 1](deliveries/week07/README.md) |
| 10 | [Prototipo funcional](deliveries/week10/README.md) |
| 12 | [Borrador refinado y respuesta a la crítica](deliveries/week12/README.md) |

Cuando una entrega se actualizó después de su fecha, la versión anterior quedó en la carpeta `history/` de esa semana.

## Limitaciones conocidas

**De los datos**

- Los viajes origen–destino son una estimación de la MTA, no un conteo. Están agrupados por la hora en que empieza el viaje y son promedios por mes y día de la semana.
- El camino de cada viaje lo asignamos nosotros por la ruta más corta sobre la red. No sabemos qué ruta tomó cada persona ni cuánto esperó.
- Usamos la red de 2026 para los cinco años, así que los cambios de servicio entre 2021 y 2025 no se ven.
- No tenemos capacidad de los trenes ni motivo de viaje. Por eso la app no habla de congestión ni explica las causas de un cambio.
- Diez filas del origen–destino tienen un extremo fuera de los 424 complejos y quedan fuera del ruteo.

**De la visualización**

- Los haces son una abstracción visual. Una curva fuera de las vías no representa infraestructura.
- En Eventos, un episodio es una señal para investigar. El detector dice cuándo y dónde la afluencia se apartó de lo habitual, no por qué.
- Las tablas por borough y por barrio (NTA) de las preguntas 1, 2 y 5 están calculadas en CSV, pero todavía no tienen una vista propia en la app.

**Técnicas**

- El agrupamiento en haces tarda alrededor de un segundo con WebGPU. En el modo de respaldo es bastante más lento: en una prueba sin GPU pasó de 20 segundos.
- **Guardar exploración** guarda la vista en el navegador (`localStorage`). No se comparte entre equipos ni navegadores.
- La interfaz está solo en español.

## Contribuciones

La entrega final es de dos personas. El historial de commits muestra el detalle de cada cambio.

**Renzo Acervo Correa**

- Propuesta, análisis de datos y Entrega 1 (semanas 5 a 7).
- Prototipo en D3 de la Semana 10, con cuatro vistas enlazadas, y el guion de la revisión de diseño.
- Descarga del dataset completo y tablas procesadas con DuckDB.
- Entrega de la Semana 12: informe, respuesta a la crítica, borrador del artículo y presentación.
- Primera versión del atlas origen–destino: flujos por hora, dispersión, reloj semanal y red de referencia.
- Mejoras al agrupamiento en haces y una capa experimental por tramos (rama `mejoras-bundling-tramos`).
- README final y comprobación de que el proyecto corre desde un clon limpio.

**Stewart Maquera Bobadilla**

- Paquete de datos inicial (Semana 4) y revisión de papers.
- Atlas de ritmos de la Semana 10: filtros del mapa, comparación entre días y orden de la matriz.
- Descarga reproducible del origen–destino y de la red GTFS, con sus manifiestos y validaciones.
- Agrupamiento RAEB en WebGPU y su modo de respaldo.
- Versión final de la app: flujo por tramo, comparación entre años, datos de 2025, exploración de haces, enlace hipotético y pestaña Eventos.
- Publicación en GitHub Pages y actualización de las entregas.

Las decisiones de diseño, las presentaciones y los entregables finales los trabajamos entre los dos.

Las entregas anteriores nombran a un tercer integrante, José Condori Palomino, que ya no forma parte del equipo.

## Reflexión sobre el proceso

Empezamos con las entradas por hora y la idea de mostrar cómo cambió la forma del día en cada estación. El prototipo de la Semana 10 tenía cuatro vistas enlazadas y funcionaba, pero nos pareció que seguía siendo más un dashboard que una visualización con una pregunta clara.

El cambio más grande fue pasar de entradas a viajes origen–destino. Con las entradas solo podíamos decir cuánta gente entra a cada estación. Con el origen–destino pudimos mostrar por dónde se mueve. Eso nos obligó a rehacer los datos: dejamos de usar 2020 como base porque la estimación existe desde 2021, pasamos de una muestra de enero y febrero a años completos y al final agregamos 2025.

Lo que más costó en la parte técnica fue el agrupamiento de flujos. La primera versión recalculaba con cada movimiento del deslizador y se sentía lenta. Lo resolvimos llevando el cálculo a WebGPU y agregando el botón Calcular. Ahí también aprendimos que no todos los navegadores tienen WebGPU, y por eso quedó un modo de respaldo.

Los comentarios del profesor en noviembre cambiaron la vista principal. Nos pidió partir las rutas en tramos de estación a estación, revisar ManyWaves y poder seleccionar puntos en la dispersión para verlos en el mapa. De ahí salieron el flujo por tramo como vista inicial, la pestaña Eventos y la selección con lazo.

Si lo hiciéramos de nuevo, cambiaríamos tres cosas:

- Cerrar antes el alcance de los datos. Lo cambiamos varias veces y cada cambio nos hizo rehacer documentos y entregas.
- Integrar más seguido en `main`. Trabajamos en ramas largas y algunas funciones se hicieron dos veces.
- Probar antes en equipos sin WebGPU.

## Créditos

- **D3.js** de Mike Bostock, licencia ISC. La copia de la licencia está en [atlas/lib/LICENSE.d3](atlas/lib/LICENSE.d3).
- **Datos:** Metropolitan Transportation Authority (MTA) a través de Open NY, y NYC Department of City Planning.
- **Métodos en los que nos basamos:**
  - Zeng et al. (2019), *Route-Aware Edge Bundling*, para agrupar los flujos siguiendo la red.
  - Hurter et al. (2012), *Graph Bundling by Kernel Density Estimation*, para el cálculo de los haces.
  - Valdrighi, Garcia-Zanabria et al. (2026), *ManyWaves*, para la detección de eventos con wavelets sobre grafos.
  - Dhont et al. (2020), para el reloj semanal.
  - Fredriksson y Karlström (2025), para medir el cambio del reparto horario con variación total.

  El resumen de cada artículo y cómo lo usamos está en [referencias.md](deliveries/week06/referencias.md).
