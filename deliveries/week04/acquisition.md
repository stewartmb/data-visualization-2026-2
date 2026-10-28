# Adquisición y preparación vigentes

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Desde la raíz del repositorio:

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

Fuente 2019: https://data.ny.gov/d/t69i-h2me; 2020–2024: https://data.ny.gov/d/wujg-7c2s. OD: https://data.ny.gov/d/rapa-97zv, https://data.ny.gov/d/nqnz-e9z9, https://data.ny.gov/d/uhf3-t34z, https://data.ny.gov/d/jsu2-fbtj. Snapshot GTFS y términos en `../week12/data/network_reference/source.json`.

La muestra se reproduce ejecutando `prepare_analytical_tasks.py` y tomando 24 filas con encabezado de las tablas T1/T2, sin fabricar valores. La red de muestra procede de `flows.json → links`. Una ausencia dentro de meses completos se maneja según el supuesto documentado; un mes ausente es error, no cero.
