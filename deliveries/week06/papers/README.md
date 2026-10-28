# Semana 6 — PDFs y procedencia de la revisión vigente

Revisión del **28 de octubre de 2026**. Doce artículos completos consultados: P1–P6 fundamentos de visualización/tareas; P7–P9 métodos o antecedentes de transporte; P10–P12 alternativas. Las demos MBTA y Tube Heartbeat no son papers y no cuentan en este catálogo.

| ID | Artículo | Copia y procedencia | Páginas del archivo |
|---|---|---|---|
| P1 | RAEB — Zeng et al. (2019) | [PDF local](zeng_2019_raeb.pdf) · [fuente](https://zeng-wei.com/publication/papers/2019_RAEB.pdf) | 13 |
| P2 | KDEEB — Hurter et al. (2012) | [PDF local](hurter_2012_kdeeb.pdf) · [fuente](https://webspace.science.uu.nl/~telea001/uploads/PAPERS/EuroVis12/kdeeb.pdf) | 10 |
| P3 | Reloj semanal — Dhont et al. (2020) | [PDF local](dhont_2020_circular_heatmaps.pdf) · [fuente](https://project.inria.fr/aaltd20/files/2020/08/AALTD_20_paper_DhontVisual.pdf) | 16 |
| P4 | Comparación — Gleicher et al. (2011) | [PDF local](gleicher_2011_visual_comparison.pdf) · [fuente](https://graphics.cs.wisc.edu/Papers/2011/GAWJHR11/paper.pdf) | 29 |
| P5 | Tareas — Brehmer y Munzner (2013) | [PDF local](brehmer_munzner_2013_tasks.pdf) · [fuente](https://www.cs.ubc.ca/labs/imager/tr/2013/MultiLevelTaskTypology/brehmer_infovis13-corrections.pdf) | 10 |
| P6 | Mantra — Shneiderman (1996) | [PDF local](shneiderman_1996_eyes.pdf) · [fuente](https://www.cs.umd.edu/users/ben/papers/Shneiderman1996eyes.pdf) | 8 |
| P7 | Demanda — Liu et al. (2020) | [PDF local](liu_2020_transit_demand.pdf) · [fuente](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0242476&type=printable) | 22 |
| P8 | TV — Fredriksson y Karlström (2025) | [PDF local](fredriksson_2025_travel_demand_tv.pdf) · [fuente](https://link.springer.com/content/pdf/10.1007/s42421-025-00141-5.pdf) | 35 |
| P9 | OD y normalización — van der Knaap et al. (2024) | [PDF local](van_der_knaap_2024_normalization_hellinger.pdf) · [fuente](https://pure.tudelft.nl/ws/portalfiles/portal/206768699/1-s2.0-S2210970624000222-main.pdf) | 18 |
| P10 | Calendarios — van Wijk y van Selow (1999) | [PDF local](van_wijk_1999_calendar.pdf) · [fuente](https://vanwijk.win.tue.nl/clv.pdf) | 6 |
| P11 | TimeSearcher — Hochheiser y Shneiderman (2004) | [PDF local](hochheiser_2004_timesearcher.pdf) · [fuente](https://www.cs.umd.edu/users/ben/papers/Hochheiser2004Dynamic.pdf) | 18 |
| P12 | Connected scatterplot — Haroz et al. (2016) | [PDF local](haroz_2016_connected_scatterplot.pdf) · [fuente](https://media.eagereyes.org/papers/2016/Haroz-TVCG-2016.pdf) | 11 |

[Revisión de métodos, adaptaciones y límites](../referencias.md). [sources.json](sources.json) registra URL, fecha, tamaño y SHA-256 de cada PDF. Las versiones pueden incluir portadas o diferir de la paginación editorial; se cita el DOI del artículo y se identifica la copia usada. Gleicher es preprint, Brehmer–Munzner es author copy con correcciones, Dhont es la versión del taller y van der Knaap es la proof de TU Delft.

## Disponibilidad en otro equipo

Las cuatro copias previas ya estaban versionadas. Las ocho nuevas son copias locales de consulta y no se publican automáticamente en GitHub: disponibilidad pública no acredita una licencia abierta. Para obtenerlas desde sus fuentes, con Python 3 y Poppler (`pdfinfo`):

```bash
python3 deliveries/week06/code/acquire_review_papers.py
```

Ejecutar desde la raíz del repositorio. El script valida cada PDF antes de instalarlo y registra cada descarga exitosa aunque falle otra. Conserva los avisos originales; no modifica el contenido.

La selección anterior se conserva en [README-20261014.md](README-20261014.md) y los cuatro primeros antecedentes históricos en [antecedentes/](antecedentes/README.md). Esta revisión bibliográfica no actualiza por sí sola presentaciones, resultados del EDA o funcionalidades de la app.
