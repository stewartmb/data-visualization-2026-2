# Fractal — Demanda, conexiones y ritmos del subway

Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino · DS5343 Data Visualization · UTEC · 2026-2

[Aplicación](https://stewartmb.github.io/data-visualization-2026-2/atlas/) · [Página del proyecto](https://stewartmb.github.io/data-visualization-2026-2/) · [Guía del profesor](Proyecto_Final_Guia.md)

**OD estimado 2021–2025** · 60 meses, 567.608.985 registros y 16 campos. Fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z`, `jsu2-fbtj` y `y2qv-fytt`. **Red:** GTFS de referencia 2026, 424 complejos OD, 475 paradas padre GTFS, 556 enlaces ferroviarios y 75 transbordos declarados. **Territorio:** borough y NTA 2020 según ubicación del complejo.

El mapa central muestra conexiones sobre la red y permite agruparlas con RAEB. La barra superior indica la selección y el período. Los cinco minimapas de la izquierda permiten cambiar de año y comparar dos años. Los controles, el reloj semanal y la dispersión están a la derecha.

## Ejecutar

```bash
python3 -m http.server 8775
# Abrir /atlas/; no requiere descargar 26 GB para ver la app.
python3 -m pip install -r deliveries/week12/requirements-data.txt
node deliveries/week12/tests/contrast-model.test.mjs
node deliveries/week12/tests/raeb-core.test.mjs
node deliveries/week12/tests/scatter-domain.test.mjs
node deliveries/week12/tests/validate-raeb-data.mjs
python3 deliveries/week12/scripts/prepare_analytical_tasks.py --skip-week06-samples
```

Las adquisiciones completas opcionales usan `acquire_full_period.py`, `acquire_od.py` y `acquire_network.py`. La preparación se documenta en `FullPeriodData.md`, `ODData.md` y `RAEBImplementation.md`. Los originales grandes quedan fuera de Git; se incluyen los artefactos preparados para ejecutar la app y sus manifiestos.

El mapa abre en **Todo el año de 2025**. Se puede elegir otro año o comparar dos de **2021–2025**. **Eventos** usa las [entradas horarias de 2021–2025](deliveries/week12/SpectralEvents.md) para mostrar cuándo y dónde la afluencia se apartó de lo habitual.

## Cinco preguntas de la investigación

1. **Redistribución territorial.** ¿Qué zonas ganaron viajes y cuáles perdieron peso entre 2021 y 2025?
2. **Dependencia e intercambios.** ¿Ganaron peso los viajes locales y entre boroughs o aumentó la dependencia de Manhattan entre 2021 y 2025?
3. **Ventanas de demanda.** ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte.** ¿Qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo.** ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia el balance?

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

Las semanas 4 y 6 se revisaron el 16 de noviembre de 2026 para reflejar el Atlas actual. Las versiones anteriores de las entregas están en `deliveries/weekXX/history/`. Semana 8 no tiene entrega de proyecto. Los videos, póster y artículo final pertenecen a Semana 15; su estado está en el [plan de cierre](deliveries/week12/ImplementationPlan.md).

## Investigación y límites

La revisión conserva cinco referencias. RAEB y KDEEB fundamentan los haces, ManyWaves inspira el detector de Eventos, Dhont et al. aporta el reloj semanal y Fredriksson y Karlström respaldan la variación total. [Referencias de Semana 6](deliveries/week06/referencias.md). PDFs nuevos de consulta se obtienen con `python3 deliveries/week06/code/acquire_review_papers.py`; URL y SHA incluidos. Las copias sin licencia abierta comprobada no se republican automáticamente. Se conserva atribución de librerías, fuentes y asistencia de IA.

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.

D3 es la herramienta principal de composición/interacción; WebGPU acelera bundling y raster. Un navegador sin WebGPU usa el respaldo. Para publicación debe usarse HTTPS; los originales grandes y credenciales no se suben a Git.
