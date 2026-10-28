# Contraste histórico independiente del overview

Cambio solicitado el 28 de octubre de 2026: incorporar **2019 y 2020 únicamente a los gráficos de la derecha**. El mapa conserva su OD de 2021–2024, sus caminos, parámetros, año, cámara y magnitudes.

## Comportamiento

- La columna derecha incluye «Contrastar con» (base entre 2019 y el año anterior al objetivo). La dispersión y el reloj usan esa misma base; el objetivo sigue siendo el año activo del mapa.
- Base 2021–2023: ambos años de la derecha proceden de OD MTA, como antes.
- Base 2019/2020: ambos años de la derecha proceden de la serie **MTA Subway Hourly Ridership** (entradas estimadas). También se recalcula el objetivo con entradas; nunca se resta un perfil de entradas a otro OD.
- El encabezado indica la fuente y el período. La leyenda y los tooltips del reloj cambian de «viajes OD» a «entradas». El CSV incluye `measure_source` y ambos años en su nombre.
- 2020 significa el año completo, incluyendo las alteraciones de la pandemia. No se etiqueta como período prepandemia. 2019 permite el contraste anual anterior a la pandemia.
- Cambiar la base de contraste llama solo a `renderInspector`: no modifica el estado del mapa ni reenvía un trabajo de bundling. `contrastBase` se conserva en URL y exploraciones guardadas, separado de `base` del mapa.
- La selección espacial, el complejo y los grupos siguen enlazados. El clic del reloj sigue seleccionando día y hora del OD del año activo; no crea rutas históricas de 2019/2020.

## Datos y adquisición reproducible

Fuentes oficiales: [2019, t69i-h2me](https://data.ny.gov/d/t69i-h2me) y [2020–2024, wujg-7c2s](https://data.ny.gov/d/wujg-7c2s). Son estimaciones de afluencia horaria por complejo y clase de pago; no son matrices OD.

La adquisición previamente completada conserva **72 meses, 141.836.156 registros y los 12 campos originales**. `data/full_period/acquisition.json` registra URL, consultas, fechas y SHA-256; los metadatos oficiales y el diccionario están en la misma carpeta. Los originales voluminosos permanecen fuera de Git.

Desde la raíz, con Python y las dependencias de `requirements-data.txt`:

```sh
python deliveries/week12/scripts/acquire_full_period.py
python deliveries/week12/scripts/build_full_period.py
python deliveries/week12/scripts/validate_full_period.py
python deliveries/week12/scripts/prepare_historical_contrast.py
```

Para reutilizar una adquisición local validada:

```sh
python deliveries/week12/scripts/prepare_historical_contrast.py --source-package /ruta/al/paquete/week12
```

La preparación se ejecutó contra la copia local completa. Verificó el SHA-256 del cubo horario frente al `build-audit.json` y el resultado PASS de 72 meses. Cubo fuente: `631cfc26f8e7210879cc1b008c98483403ee485a0abb5dbe04f88221dd38ffaa`. La salida `atlas/data/historical_contrast.json` registra también hashes del reporte y auditoría, fecha, exposiciones y balance de demanda dentro/fuera del universo. La copia de raíz se genera al mismo tiempo.

## Método y diccionario

Se usa únicamente `transit_mode='subway'`. Se suman los doce meses por complejo/año/día/hora, incluyendo todas las clases de pago. El domingo=0 de la fuente se convierte a lunes=0. Cada celda se divide por la cantidad anual de ocurrencias de ese día de semana. Las 168 celdas forman una semana representativa.

- `profiles[complex_id][year]`: perfil anual o `null` si el volumen es cero.
- `p`: 168 participaciones semanales, lunes 00:00 hasta domingo 23:00; suman 1.
- `weekly`: suma de las 168 cantidades ajustadas; `daily = weekly / 7`.
- `am` y `pm`: porcentaje en lunes–viernes 06:00–09:59 y 16:00–19:59, respectivamente, con denominador laboral.
- `weekend`: porcentaje del total semanal en sábado y domingo.
- `observedCells`: celdas con volumen positivo; no es disponibilidad de servicio.
- `meta.totals`: demanda subway de la fuente, mapeada al universo de la app y no mapeada, por año.

La dispersión conserva sus fórmulas: índice `100 × daily_objetivo / daily_base`; TV en pp `50 × Σ |p_objetivo − p_base|`. El reloj muestra `100 × (p_objetivo − p_base)` por celda. Los grupos suman cantidades antes de normalizar.

La ausencia de una celda dentro de la adquisición completa aporta cero, como supuesto explícito; un año o mes ausente impide la preparación. No se infieren OD, destinos ni rutas para 2019/2020. Los 424 complejos de la app tienen perfiles comparables en los dos años históricos; otros complejos de la fuente se contabilizan aparte, no se agregan al mapa.

## Verificación

```sh
node deliveries/week12/tests/contrast-model.test.mjs
node deliveries/week12/tests/scatter-domain.test.mjs
```

Las pruebas comprueban las seis temporadas completas, normalización, denominadores, procedencia equivalente para ambos años, conservación de perfiles OD/estado del mapa, rechazo de datos históricos ausentes y tratamiento contextual del cierre de 181 St en 2021. La inspección de navegador verificó que cambiar 2019 → 2020 modifica la dispersión y el reloj mientras las posiciones, radios y colores de los 424 nodos del mapa permanecen iguales.
