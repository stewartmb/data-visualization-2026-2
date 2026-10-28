# Compartir y reproducir la versión actual

Clonar `https://github.com/stewartmb/data-visualization-2026-2.git` y usar `main` después de la publicación. La app funciona con los JSON y los 672 frames OD preparados: no necesita descargar los originales para verla. Hay datos de entradas **2019–2024** para la columna derecha y OD **2021–2024** para el mapa. El grafo GTFS de referencia es **2026**.

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

## Reconstrucción completa opcional

```bash
python3 deliveries/week12/scripts/acquire_full_period.py --help
python3 deliveries/week12/scripts/acquire_od.py --help
python3 deliveries/week12/scripts/acquire_network.py --help
```

Consultar `FullPeriodData.md`, `HistoricalContrast.md`, `ODData.md` y `RAEBImplementation.md` para orden, rutas y dependencia de snapshots exactos. Se incluyen manifiestos y validaciones. Los CSV.gz originales (~26 GB entre fuentes, según formato) se comparten aparte o se vuelven a adquirir: no están incluidos en el clone. No se promete una Release/Drive inexistente.

`prepare_analytical_tasks.py` trabaja directamente con los artefactos versionados y verifica sus SHA antes de preparar los resultados. Para los PDF de los papers nuevos ejecutar la adquisición de Semana 6; no se redistribuyen automáticamente copias con licencia no comprobada.
