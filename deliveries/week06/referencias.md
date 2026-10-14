# Referencias principales — revisión para el atlas

**DS5343 · Proyecto «La forma del día»**

**Selección bibliográfica actualizada: 14 de octubre de 2026.**

Esta revisión reemplaza la selección inicial de cuatro referencias por fuentes vinculadas con los procedimientos que implementa el atlas de la rama `codex/atlas-ritmos-urbanos`. El historial Git conserva la revisión original de Semana 6. La aplicación independiente de `main` requiere su propia revisión de correspondencia entre métodos y fuentes.

| Referencia | Procedimiento que informa | Dónde comprobarlo |
|---|---|---|
| Liu, Miller y Scheff (2020), *The impacts of COVID-19 pandemic on public transit demand in the United States* | Comparación de perfiles horarios separada de volumen; antecedente mediante Procrustes, no TV | [Texto abierto](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0242476), sección de cambios diarios, Figura 3 y ecuaciones 9–10 |
| Fredriksson y Karlström (2025), *A Fully Neural Network-Based Travel Demand and Scheduling Model, Covering Activities, Destinations, and Modes of Transportation* | TV entre distribuciones normalizadas; adaptamos modos a categorías día–hora | [Texto abierto](https://link.springer.com/article/10.1007/s42421-025-00141-5), ecuación 11 |
| Van der Knaap et al. (2024), *Clustering railway passenger demand patterns from large-scale origin–destination data* | Normalización por suma, distinción volumen/estructura y Hellinger | [PDF abierto](https://pure.tudelft.nl/ws/portalfiles/portal/206768699/1-s2.0-S2210970624000222-main.pdf), sección 2.1, ecuaciones 1–3 |
| Dhont et al. (2020), *Visual Analytics for Extracting Trends from Spatio-temporal Data* | Mapa de calor circular de siete días × 24 horas y resta contra una referencia | [PDF público del taller](https://project.inria.fr/aaltd20/files/2020/08/AALTD_20_paper_DhontVisual.pdf), secciones 3.2–3.3 y Figuras 2–3 |

La [revisión completa de las cuatro fuentes](../../redesign/05-referencias-finales.md) incluye citas bibliográficas, métodos, fórmulas, adaptaciones y límites. Los archivos de `papers/` corresponden a la selección histórica: no se presentan como los PDF de esta revisión. Los cuatro textos finales se consultan desde los enlaces públicos anteriores.

Esta selección no implica que todos los parámetros y transformaciones hayan sido validados por esos papers. Las franjas horarias, el ajuste por calendario, la elección de temporadas y los umbrales propios deben justificarse explícitamente y evaluarse.
