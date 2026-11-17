# Adquisición y verificación de Semana 4

Ejecutar los comandos desde la raíz del repositorio. Los CSV de esta entrega se pueden abrir directamente. Regenerarlos requiere los Parquet identificados en el [manifiesto del paquete](data/manifest.json) y los scripts e índices de Semana 12 que cubren 2021–2025. Los archivos completos se guardan fuera de Git bajo `deliveries/week12/data/raw/`.

## Obtener las fuentes completas

Crear un entorno Python si aún no existe e instalar las dependencias del proyecto. Los comandos están separados por fuente para que se pueda descargar o reanudar una sola.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r deliveries/week12/requirements-data.txt
```

**Entradas.** El descargador contrasta filas y sumas de entradas y transbordos con los controles mensuales de Open NY. La conversión comprueba SHA-256 y conteo de filas.

```bash
.venv/bin/python -u deliveries/week12/scripts/acquire_full_period.py --workers 2
for year in 2021 2022 2023 2024 2025; do
  .venv/bin/python deliveries/week12/scripts/build_full_period.py --year "$year" || break
done
```

**OD.** Las descargas de 2021–2024 y 2025 usan comandos separados. El script de validación comprueba los controles oficiales y escribe los Parquet mensuales.

```bash
.venv/bin/python -u deliveries/week12/scripts/acquire_od.py --workers 3 &&
  .venv/bin/python deliveries/week12/scripts/prepare_validate_od.py
.venv/bin/python -u deliveries/week12/scripts/acquire_od.py --2025 --workers 3 &&
  .venv/bin/python deliveries/week12/scripts/prepare_validate_od.py --2025
```

**GTFS.** El repositorio incluye los dos grafos procesados. Para reconstruirlos se necesita el ZIP exacto que registra [el manifiesto GTFS](../week12/data/network_reference/source.json). El feed oficial cambia con el tiempo. Si ya se tiene una copia de ese ZIP, colocarla en `deliveries/week12/data/raw/enrichments/gtfs_subway.zip` y usar `--offline` para verificarla.

```bash
.venv/bin/python deliveries/week12/scripts/acquire_network.py
```

Las consultas OD de 2025 que se descargaron por bloques están en `months → blocks` del [manifiesto de adquisición](../week12/data/od_2025_2026/acquisition.json). El manifiesto de Semana 4 registra cada consulta y la huella del archivo mensual consolidado. Los controles completos de OD están en los informes [2021–2024](../week12/data/od_2021_2024/validation.json) y [2025](../week12/data/od_2025_2026/validation.json). Los pasos para reconstruir los artefactos de Años y Eventos están en la [documentación de Semana 12](../week12/DataAcquisition.md).

## Reproducir las muestras y verificar su procedencia

```bash
.venv/bin/python deliveries/week04/prepare_samples.py --check
```

Se comprueban el conteo, el esquema y el SHA-256 de los 120 Parquet contra los insumos declarados por Años y Eventos. El script selecciona el punto medio de 24 intervalos de igual tamaño por archivo, con el índice de fila física como criterio. El resultado depende de la versión y orden de los Parquet. Open NY puede revisar sus datos o alterar el orden al responder una consulta, por lo que una descarga actual puede producir huellas diferentes. Para reproducir los mismos bytes, usar las copias identificadas por SHA-256 en el manifiesto. En modo `--check` el script compara los resultados con los archivos entregados. Sin esa opción, vuelve a escribir los CSV y el manifiesto después de validar los insumos.

La verificación de la red comprueba que las dos versiones del grafo declaran el mismo ZIP de referencia, usan los mismos complejos y coinciden con las huellas empleadas por el Atlas. Los originales se obtienen siguiendo las rutas y condiciones de cada fuente. [Guía para compartir los datos del equipo](../week12/DataSharing.md).
