# Semana 12 — Borrador refinado y crítica

Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino · Revisión del 28 de octubre de 2026. Requisito: §4.6 de [la guía](../../Proyecto_Final_Guia.md).

| Entregable | Archivo |
|---|---|
| Aplicación D3 y recursos | [atlas/](atlas/), espejo de [la raíz](../../atlas/) |
| Datos candidatos, muestras y scripts | [data/](data/), [scripts/](scripts/), [DataSharing](DataSharing.md) |
| Narrativa, diseño, hallazgos, límites y pendientes | [RefinedDraftReport.md](RefinedDraftReport.md) y [PDF](RefinedDraftReport.pdf) |
| Presentación vigente | [PresentationWeek12.pptx](PresentationWeek12.pptx) |
| Respuesta a crítica | [PeerCritiqueResponse.pdf](PeerCritiqueResponse.pdf) y [fuente](PeerCritiqueResponse.md) |
| Fuente del artículo y borrador | [paper.tex](paper/paper.tex), [paper.pdf](paper/paper.pdf) |
| Página y README | [Página inicial](../../index.html), este documento y [README raíz](../../README.md) |
| Seis tareas y plan | [AnalyticalTasks](AnalyticalTasks.md), [ImplementationPlan](ImplementationPlan.md) |

## Datos y ejecución

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

```bash
python3 -m http.server 8775
# Abrir /atlas/; no requiere descargar 26 GB para ver la app.
python3 -m pip install -r deliveries/week12/requirements-data.txt
node deliveries/week12/tests/contrast-model.test.mjs
node deliveries/week12/tests/raeb-core.test.mjs
node deliveries/week12/tests/scatter-domain.test.mjs
node deliveries/week12/tests/validate-raeb-data.mjs
python3 deliveries/week12/scripts/prepare_analytical_tasks.py
```

Las adquisiciones completas opcionales usan `acquire_full_period.py`, `acquire_od.py` y `acquire_network.py`. La preparación histórica y la del RAEB se documentan en `HistoricalContrast.md`, `ODData.md` y `RAEBImplementation.md`. Los originales grandes quedan fuera de Git; se incluyen los artefactos preparados para ejecutar la app y sus manifiestos.

Histórico 2019/2020 visible en **Base histórica**, a la derecha. Red y OD no se reconstruyen para esos años. Capturas y validaciones de la versión actual acompañan la entrega. Las copias anteriores de reporte, crítica y presentación están en `history/`. La publicación usa `main` y la raíz como fuente de GitHub Pages.

| Tarea | Evidencia preparada | Estado de interacción |
|---|---|---|
| T1 | CSV por borough/NTA, seis años | Contraste por complejo disponible; síntesis territorial por integrar al panel |
| T2 | Matrices territoriales y participaciones, cuatro años | Selección de origen disponible; detalle territorial por integrar |
| T3 | Ventanas de 3 h, 7 días y seis años | Reloj y selección horaria disponibles; detector automático por integrar |
| T4 | Cargas de los 549 enlaces para 2021/2024 | Geometría y haces disponibles; inspección exacta por tramo pendiente |
| T5 | Balance externo por borough/cohorte, cuatro años | CSV preparado; codificación interactiva pendiente |
| T6 | Seis escenarios reproducibles | Cálculo preparado; escenario interactivo pendiente |
