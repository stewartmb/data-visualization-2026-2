# Adquisición y reproducción vigentes — Semana 12

La guía del profesor exige datos procesados candidatos y scripts que permitan reproducirlos. Se separan los originales grandes, los artefactos del navegador y las tablas analíticas.

## Entradas horarias 2021–2025

Fuentes oficiales `wujg-7c2s` y `5wq4-mkjj`. La descarga abarca 60 meses, 130.987.497 registros fuente y 12 campos originales. `acquire_full_period.py` descarga y valida por mes, y `build_full_period.py --year` convierte los originales a Parquet. [Cobertura y diccionario](FullPeriodData.md).

`prepare_spectral_events.py` agrega las entradas de subway por complejo y hora local y genera el calendario, los episodios y sus series. [Método de Eventos](SpectralEvents.md).

## OD estimado 2021–2025 y red

Fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z`, `jsu2-fbtj`, `y2qv-fytt`. 60 meses, 567.608.985 registros, 16 campos originales. `acquire_od.py` descarga; `prepare_validate_od.py` convierte y contrasta controles oficiales; el informe entregado tiene `status: PASS`. Ver [ODData](ODData.md).

`acquire_network.py` obtiene el snapshot GTFS documentado; `prepare_raeb.py` prepara red y caminos. La aplicación utiliza 840 matrices horarias y cinco anuales. La referencia es 2026: no servicio histórico, tiempos reales ni elección observada de ruta. Adyacencias y transferencias explícitas, sin enlaces por proximidad. Ver [RAEBImplementation](RAEBImplementation.md).

## Ejecutar con artefactos incluidos

```bash
python3 -m http.server 8775
node deliveries/week12/tests/contrast-model.test.mjs
node deliveries/week12/tests/validate-raeb-data.mjs
python3 -m pip install -r deliveries/week12/requirements-data.txt
python3 deliveries/week12/scripts/prepare_analytical_tasks.py --skip-week06-samples
```

Abrir `/atlas/`. Los originales completos no son necesarios para ver la app ni reproducir las seis tablas actuales desde los artefactos. El script de tareas verifica las matrices y produce cantidades territoriales, participaciones, ventanas, cargas, balances y seis escenarios de demanda fija, con controles reproducibles. WebGPU o WebGL2 son necesarios para dibujar todas las curvas OD; los navegadores sin ambos muestran una limitación explícita.

## Rutas anteriores y contexto adicional

`download_full.py`, `build_from_full.py`, `build_atlas.py` y `acquire_context.py` conservan la ruta anterior de entradas/enero–febrero; no redefinen el panel OD actual. `acquire_enrichments.py` y `build_enrichments.py` preservan transbordos gratuitos, tarifas y NTA. Esos contextos se entregan como datos preparados, sin afirmar que todas sus vistas estén activas. El NTA de un complejo no identifica residencia, turismo ni motivo del viaje.

## Documentos, bocetos y sincronización

`prepare_design_sketch.py` requiere `requirements-design.txt` y reproduce el boceto estático basado en datos. `render_delivery_reports.py` regenera los PDF desde Markdown con Pandoc/XeLaTeX; se suministran ya compilados. Las presentaciones PPTX son editables. `sync_live_atlas.py` sincroniza Semana 12 y la raíz y verifica SHA; no hace push. Copias de consulta de los papers nuevos se reproducen con la adquisición de Semana 6, sin asumir licencia de redistribución.

Las fechas, URL, consultas, diccionarios, controles y SHA están en los manifiestos de cada fuente. No se suben credenciales ni originales voluminosos. Para compartir la app y su preparación consultar [DataSharing](DataSharing.md).
