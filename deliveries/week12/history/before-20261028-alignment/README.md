# Semana 12 — Borrador refinado y crítica por pares

**DS5343 Data Visualization · UTEC · 2026-2** · entrega del 28 de octubre de 2026
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

**Fractal · Atlas de ritmos.** La aplicación refinada vive en [`/atlas`](../../atlas/) (raíz del repositorio) y se publica en <https://stewartmb.github.io/data-visualization-2026-2/atlas/>. Esta carpeta contiene la copia de la entrega.

## Contrato analítico e investigación vigentes — 28 de octubre

Las [seis tareas nuevas](AnalyticalTasks.md) sustituyen las del primer Atlas: territorio, dependencia, ventanas de demanda, corredores, balance externo y exposición a interrupciones. Cada una declara su beneficio, datos, fórmula y estado; no se presentan las seis como funciones terminadas. La [investigación de papers de Semana 6](../week06/referencias.md) se actualiza para el panel integrado OD, con catálogo de PDF y adquisición reproducible.

Las secciones de reproducción y artefactos de la entrega original que siguen se conservan como historia. Para la versión OD consultar [ODData](ODData.md), [DataSharing](DataSharing.md), [HistoricalContrast](HistoricalContrast.md) y [el brief vigente](ODVisualizationBrief.md). Los reportes, paper y presentación existentes no se regeneraron con esta revisión de tareas.

| Archivo | Qué es |
|---|---|
| [`atlas/`](atlas/) | copia del código fuente de la aplicación (HTML, CSS, JS, D3 v7 y d3-tile vendorizados, `atlas.json`, `boroughs.geojson`) |
| [`data/`](data/) | datos candidatos a finales: insumo del atlas (`jan_feb_hourly_2020_2024.csv`, 350 951 filas), catálogo de complejos, contexto del servicio, manifiesto de fuentes con SHA-256, y los artefactos del cliente |
| [`FullPeriodData.md`](FullPeriodData.md) | ampliación a todos los meses de 2019–2024: fuentes, cobertura, 12 campos y reproducción |
| [`DataAcquisition.md`](DataAcquisition.md) | fuentes nuevas, transformaciones, exclusiones, diccionario y comandos reproducibles |
| [`scripts/`](scripts/) | reproducción de punta a punta: `acquire_full_period.py` (todos los registros de 2019–2024), `build_full_period.py` y `validate_full_period.py`; `download_full.py` (ruta anterior de 2020–2024), `build_from_full.py` (agregación con DuckDB), `acquire_context.py` (vía API, histórica), `build_atlas.py` (perfiles y medidas), `validate_atlas.py` (recalculo independiente), `smoke.cjs` (prueba de interfaz en Chromium) |
| [`RefinedDraftReport.md`](RefinedDraftReport.md) · [`.pdf`](RefinedDraftReport.pdf) | narrativa, datos y método, hallazgos, diseño, feedback, limitaciones, tareas restantes con responsables |
| [`PeerCritiqueResponse.md`](PeerCritiqueResponse.md) · [`.pdf`](PeerCritiqueResponse.pdf) | feedback del design review y la decisión sobre cada sugerencia |
| [`PresentationWeek12.pptx`](PresentationWeek12.pptx) | presentación de la entrega |
| [`paper/paper.tex`](paper/paper.tex) · [`paper.pdf`](paper/paper.pdf) | el paper en dos columnas: compila con IEEEtran si está instalado (Overleaf) y con `article` si no |
| [`code/datos_nuevos.ipynb`](code/datos_nuevos.ipynb) | notebook histórico del prototipo de la Semana 10 |

## Versión de trabajo de esta entrega

El trabajo actual de Semana 12 se realiza en esta carpeta siguiendo la sección 4.6 de `Proyecto_Final_Guia.md`. El panel reúne mapa OD con agrupación de aristas, minimapa, dispersión volumen × forma y reloj semanal. Usa los doce meses de 2021–2024 y una red GTFS de referencia actual; los caminos son asignados por el modelo, no observados. La base 2019/2020 solo afecta la columna derecha y compara entradas estimadas de ambos años. Los datos, scripts y módulos anteriores de transbordos, tarifas y contexto territorial se conservan, sin incorporarlos al overview actual.

- [Agrupación de aristas: método, reproducción y límites](RAEBImplementation.md).
- [Contraste histórico de la derecha, sin alterar el mapa](HistoricalContrast.md).
- [Adquisición OD 2021–2024: descarga en segundo plano y verificación posterior](ODData.md).
- [Período completo 2019–2024, estado de adquisición y reproducción](FullPeriodData.md).
- [Diccionario de la base completa](data/full_period/data_dictionary.csv).
- [Adquisición, manejo, fuentes y reproducción](DataAcquisition.md).
- [Diccionario de los datos nuevos](data/context/data_dictionary.csv).
- [Consultas, fechas y SHA-256](data/context/sources.json).
- [Auditoría de construcción](data/context/build-audit.json) y [validación independiente](data/context/validation.json).
- [Grafo programado actual](data/context/processed/network_current.json).

## Correr la aplicación de Semana 12

Desde la raíz del repositorio:

```bash
python3 -m http.server 8773 --bind 127.0.0.1
```

Abrir <http://127.0.0.1:8773/deliveries/week12/atlas/>. Los datos y D3 están
incluidos. El fondo de calles de OpenStreetMap requiere conexión; sin él quedan
los contornos de boroughs. La carpeta `redesign/` incluida permite abrir la
documentación desde esta copia de la aplicación.

## Verificar y reproducir el panel actual

Los agregados de la aplicación están incluidos. Para comprobarlos:

```bash
node deliveries/week12/tests/raeb-core.test.mjs
node deliveries/week12/tests/scatter-domain.test.mjs
node deliveries/week12/tests/contrast-model.test.mjs
node deliveries/week12/tests/validate-raeb-data.mjs
```

Para regenerarlos se requieren las adquisiciones completas y validadas descritas en [ODData.md](ODData.md) y [FullPeriodData.md](FullPeriodData.md):

```bash
.venv/bin/python deliveries/week12/scripts/prepare_raeb.py
.venv/bin/python deliveries/week12/scripts/prepare_historical_contrast.py
```

Los scripts `build_atlas.py` y `validate_atlas.py` corresponden a la preparación anterior de entradas; no deben ejecutarse sobre los artefactos del panel OD actual. Los scripts y datos de contexto siguen documentados en [DataAcquisition.md](DataAcquisition.md).

Después de validar cambios, para mantener coherente el despliegue de la raíz:

```bash
python3 deliveries/week12/scripts/sync_live_atlas.py
```

Esto actualiza archivos locales y registra sus huellas en
`live-atlas-sync.json`; no publica en GitHub. El enlace público conserva la
versión publicada hasta que el equipo realice un despliegue.

## Compilar el paper

```bash
cd paper
latexmk -pdf paper.tex
```

En Overleaf basta subir la carpeta `paper/`; detecta `IEEEtran` y usa el formato de conferencia.

## Regenerar el reporte PDF

Con Pandoc, XeLaTeX y las fuentes Arial y Menlo disponibles:

```bash
python3 deliveries/week12/scripts/render_report.py
```

El PDF se genera desde `RefinedDraftReport.md`. La presentación y el borrador
del artículo mantienen sus archivos editables para la siguiente revisión del
equipo; el detalle técnico de los enriquecimientos se encuentra en el reporte
y en `DataAcquisition.md`.
