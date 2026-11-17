# PDF de la revisión de Semana 6

La [revisión](../referencias.md) reúne cinco artículos. Cada fila enlaza la edición pública consultada. [sources.json](sources.json) registra URL, páginas y SHA-256, con fecha de descarga cuando fue registrada. También conserva la procedencia de la revisión anterior.

| Artículo | PDF de autores o editor | Copia verificada localmente |
|---|---|---|
| Zeng et al. · RAEB | [PDF](https://zeng-wei.com/publication/papers/2019_RAEB.pdf) | `zeng_2019_raeb.pdf` |
| Hurter et al. · KDEEB | [PDF](https://webspace.science.uu.nl/~telea001/uploads/PAPERS/EuroVis12/kdeeb.pdf) | `hurter_2012_kdeeb.pdf` |
| Valdrighi et al. · ManyWaves | [PDF](https://files.visualdslab.com/files/papers/2026-ManyWaves-CGF.pdf) | `valdrighi_2026_manywaves.pdf` |
| Dhont et al. · reloj semanal | [PDF](https://project.inria.fr/aaltd20/files/2020/08/AALTD_20_paper_DhontVisual.pdf) | `dhont_2020_circular_heatmaps.pdf` |
| Fredriksson y Karlström · TV | [PDF](https://link.springer.com/content/pdf/10.1007/s42421-025-00141-5.pdf) | `fredriksson_2025_travel_demand_tv.pdf` |

Desde la raíz, con Python y `pdfinfo` de Poppler instalados:

```bash
python3 deliveries/week06/code/acquire_review_papers.py
python3 deliveries/week06/code/acquire_review_papers.py --offline
```

La segunda orden verifica los cinco PDF locales contra sus huellas. Los manuscritos de consulta ignorados por Git se obtienen mediante el script o sus enlaces de autor. Revisar la licencia de la edición específica antes de redistribuirla. Los [antecedentes](antecedentes/README.md) y el [catálogo previo](README-20261014.md) siguen disponibles como historial.
