# Semana 6 · Análisis, bocetos e investigación

**DS5343 Data Visualization · UTEC · 2026-2**

Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

Revisión del 16 de noviembre de 2026, según el §4.3 de la [guía del profesor](../../Proyecto_Final_Guia.md#43-semana-6--análisis-de-datos-y-bocetosinspiración-16-de-septiembre-de-2026). La entrega usa el alcance actual del Atlas. **Años** compara OD estimado 2021–2025 sobre la red GTFS de referencia. **Eventos** explora cambios en entradas horarias del mismo período.

| Requisito | Archivo |
|---|---|
| Entendimiento, transformaciones, preguntas y hallazgos | [DataAnalysis.md](DataAnalysis.md) · [PDF](DataAnalysis.pdf) |
| Presentación | [PresentationWeek06.pptx](PresentationWeek06.pptx) |
| Datos procesados detrás de los gráficos | [CSV vigentes con prefijo atlas_](data/processed/) |
| Reproducción desde los agregados del Atlas | [code/build_atlas_evidence.py](code/build_atlas_evidence.py) |
| Composición, jerarquía de señales y alternativas | [Bocetos anotados](sketches/README.md) |
| Artículos y decisiones de diseño | [Revisión bibliográfica](referencias.md) · [PDF consultados](papers/README.md) |

La selección de esta entrega es **RAEB, KDEEB, ManyWaves, Dhont et al., y Fredriksson y Karlström**. Los antecedentes y las alternativas de la [revisión previa](history/before-20261116-current-atlas/referencias.md) conservan sus fuentes y contexto.

## Reproducir el paquete

Desde la raíz, con Python 3 y los artefactos de [Semana 12](../week12/DataAcquisition.md) de 2021–2025:

```bash
python3 deliveries/week06/code/build_atlas_evidence.py
python3 deliveries/week06/code/build_atlas_evidence.py --check
```

El script lee los perfiles, cargas, matrices anuales e índice de Eventos preparados para el Atlas. Verifica la procedencia de los agregados OD y del grafo de Eventos antes de exportar. El modo `--check` compara el resultado byte por byte con los CSV entregados. Los CSV están listos para abrir. Regenerar el catálogo espectral desde Parquet requiere seguir los pasos de Semana 12.

Para obtener y verificar los cinco PDF seleccionados, instalar `pdfinfo` de Poppler y ejecutar:

```bash
python3 deliveries/week06/code/acquire_review_papers.py
python3 deliveries/week06/code/acquire_review_papers.py --offline
```

La [entrega anterior](README-entrega-original.md) documenta los scripts y archivos exploratorios históricos. Los nuevos CSV se distinguen por `atlas_`.
