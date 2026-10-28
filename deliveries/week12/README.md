# Semana 12 — Borrador refinado y crítica por pares

**DS5343 Data Visualization · UTEC · 2026-2** · entrega del 28 de octubre de 2026
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

**Fractal · Atlas de ritmos.** La aplicación refinada vive en [`/atlas`](../../atlas/) (raíz del repositorio) y se publica en <https://stewartmb.github.io/data-visualization-2026-2/atlas/>. Esta carpeta contiene la copia de la entrega.

| Archivo | Qué es |
|---|---|
| [`atlas/`](atlas/) | copia del código fuente de la aplicación (HTML, CSS, JS, D3 v7 y d3-tile vendorizados, `atlas.json`, `boroughs.geojson`) |
| [`data/`](data/) | datos candidatos a finales: insumo del atlas (`jan_feb_hourly_2020_2024.csv`, 350 951 filas), catálogo de complejos, contexto del servicio, manifiesto de fuentes con SHA-256, y los artefactos del cliente |
| [`scripts/`](scripts/) | reproducción de punta a punta: `download_full.py` (descarga completa del dataset), `build_from_full.py` (agregación con DuckDB), `acquire_context.py` (vía API, histórica), `build_atlas.py` (perfiles y medidas), `validate_atlas.py` (recalculo independiente), `smoke.cjs` (prueba de interfaz en Chromium) |
| [`RefinedDraftReport.md`](RefinedDraftReport.md) · [`.pdf`](RefinedDraftReport.pdf) | narrativa, datos y método, hallazgos, diseño, feedback, limitaciones, tareas restantes con responsables |
| [`PeerCritiqueResponse.md`](PeerCritiqueResponse.md) · [`.pdf`](PeerCritiqueResponse.pdf) | feedback del design review y la decisión sobre cada sugerencia |
| [`PresentationWeek12.pptx`](PresentationWeek12.pptx) | presentación de la entrega |
| [`paper/paper.tex`](paper/paper.tex) · [`paper.pdf`](paper/paper.pdf) | el paper en dos columnas: compila con IEEEtran si está instalado (Overleaf) y con `article` si no |
| [`code/datos_nuevos.ipynb`](code/datos_nuevos.ipynb) | notebook histórico del prototipo de la Semana 10 |

## Correr la aplicación

Desde la raíz del repositorio (la aplicación enlaza documentos de `redesign/`):

```bash
python3 -m http.server 8765
```

Abrir <http://localhost:8765/atlas/>. El plano de calles del mapa se carga de OpenStreetMap; sin conexión, el mapa muestra los contornos de boroughs.

## Reproducir los datos

```bash
export SOCRATA_APP_TOKEN=...                                  # token gratuito de Open NY (o en un .env)
python3 scripts/acquisition/download_full.py --workers 4     # 120 855 567 registros, ~90 min, reanudable
pip install duckdb
python3 scripts/preprocessing/build_from_full.py             # tablas en data/processed/full, ~1 min
cp data/processed/full/jan_feb_hourly_2020_2024.csv data/redesign/   # insumo del atlas (idéntico al versionado)
python3 scripts/redesign/build_atlas.py                      # atlas/data/atlas.json + auditoría
python3 scripts/redesign/validate_atlas.py                   # recalcula 2 120 perfiles y 356 160 celdas
```

## Compilar el paper

```bash
cd paper
latexmk -pdf paper.tex
```

En Overleaf basta subir la carpeta `paper/`; detecta `IEEEtran` y usa el formato de conferencia.
