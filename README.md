# Fractal — Demanda, conexiones y ritmos del subway

Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino · DS5343 Data Visualization · UTEC · 2026-2

[Aplicación](https://stewartmb.github.io/data-visualization-2026-2/atlas/) · [Página del proyecto](https://stewartmb.github.io/data-visualization-2026-2/) · [Guía del profesor](Proyecto_Final_Guia.md)

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Un panel integrado: **mapa central** de conexiones con abstracción guiada por la red; **dispersión volumen × forma** arriba a la derecha; **reloj radial 7 × 24** debajo; **minimapa** para orientación. El área del nodo indica viajes iniciados; las posiciones de la dispersión separan índice de volumen y TV; el color del reloj indica cambio de participación semanal. Las barras de agrupación y fidelidad modifican la geometría, nunca los OD. No hay reproducción automática. Overview → zoom/selección → detalles bajo demanda.

## Ejecutar

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

Al abrir, la derecha compara **2019→2024** mediante entradas; el mapa mantiene OD 2024 y su base 2021. El selector **Base histórica** incluye 2020, 2021, 2022 y 2023. 2019/2020 no inventan destinos ni cambian los caminos del mapa.

## Seis preguntas actuales

1. **Redistribución territorial.** ¿Qué zonas recuperaron demanda y cuáles perdieron peso entre 2019 y 2024?
2. **Dependencia e intercambios.** ¿Ganaron peso los viajes locales y entre boroughs o aumentó la dependencia de Manhattan entre 2021 y 2024?
3. **Ventanas de demanda.** ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte.** ¿Qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo.** ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia el balance?
6. **Exposición a interrupciones.** ¿Qué viajes perderían conexión o requerirían mayor distancia al retirar un enlace de referencia?

[Contrato con métricas, beneficio y estado](deliveries/week12/AnalyticalTasks.md). [Resultados reproducibles](deliveries/week12/data/analytical_tasks/). Tener los CSV no significa que todas las tareas tengan ya detalle interactivo.

## Entregas según la guía

| Semana | Entrada actual y alcance |
|---|---|
| 4 | [Paquete de datos, muestras y diccionario](deliveries/week04/README.md) |
| 5 | [Propuesta, audiencia y seis preguntas](deliveries/week05/README.md) |
| 6 | [Análisis, bocetos y papers](deliveries/week06/README.md) |
| 7 | [Primera fase y arquitectura](deliveries/week07/README.md) |
| 10 | [Prototipo y preguntas de revisión](deliveries/week10/README.md) |
| 12 | [Borrador refinado, crítica, presentación y paper](deliveries/week12/README.md) |

Las revisiones son del 28 de octubre y no se atribuyen retroactivamente a las entregas iniciales. Versiones anteriores en `deliveries/weekXX/history/`. Semana 8 no tiene entrega de proyecto. Los videos, póster y artículo final pertenecen a Semana 15; su estado está en el [plan de cierre](deliveries/week12/ImplementationPlan.md).

## Investigación y límites

[Revisión de 12 artículos](deliveries/week06/referencias.md): RAEB, KDEEB, reloj circular, comparación, tareas/mantra y métodos como TV. PDFs nuevos de consulta se obtienen con `python3 deliveries/week06/code/acquire_review_papers.py`; URL y SHA incluidos. Las copias sin licencia abierta comprobada no se republican automáticamente. Se conserva atribución de librerías, fuentes y asistencia de IA.

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. 2020 completo es un año pandémico; 2019 es la referencia anual anterior. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.

D3 es la herramienta principal de composición/interacción; WebGPU acelera bundling y raster. Un navegador sin WebGPU usa el respaldo. Para publicación debe usarse HTTPS; los originales grandes y credenciales no se suben a Git.
