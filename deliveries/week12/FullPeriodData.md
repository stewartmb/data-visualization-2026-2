# Entradas horarias de la MTA, 2021–2025

El Atlas estudia los 60 meses de enero de 2021 a diciembre de 2025.
La descarga conserva **130.987.497 registros y los 12 campos originales**,
incluidos los distintos modos de la fuente. Eventos usa las filas de subway,
agregadas por complejo y hora local de Nueva York. El año 2025 contiene
30.471.781 registros originales, de los cuales 30.240.198 son de subway.
En ese modo hay registros en los 365 días de 2025.

- Para 2021–2024 se consulta la [fuente oficial de entradas horarias](https://data.ny.gov/d/wujg-7c2s) restringiendo las fechas.
- Para 2025 se consulta la [fuente oficial desde 2025](https://data.ny.gov/d/5wq4-mkjj) y se corta en el 31 de diciembre.

Los campos son `transit_timestamp`, `transit_mode`, `station_complex_id`,
`station_complex`, `borough`, `payment_method`, `fare_class_category`,
`ridership`, `transfers`, `latitude`, `longitude` y `georeference`.
La conversión a Parquet añade `source_dataset` para mantener la procedencia.
El [diccionario](data/full_period/data_dictionary.csv) documenta los campos
y sus unidades. La [metodología de Eventos](SpectralEvents.md) documenta el
tratamiento de faltantes y la referencia horaria habitual.

## Ejecutar y reanudar

Desde la raíz del repositorio, en el entorno Python del proyecto:

```bash
python -m pip install -r deliveries/week12/requirements-data.txt
python -u deliveries/week12/scripts/acquire_full_period.py --workers 3
for year in 2021 2022 2023 2024 2025; do
  python -u deliveries/week12/scripts/build_full_period.py --year "$year" || break
done
```

`acquire_full_period.py --year 2025` descarga solo ese año. Ejecutar el mismo
comando reutiliza los archivos completos cuyos SHA-256 y controles oficiales
coinciden. La validación comprueba fechas, encabezado, número de filas y sumas
de entradas y transbordos por mes. El [manifiesto del período](data/full_period/acquisition_atlas.json)
registra consultas, fechas, SHA-256 y conteos. El manifiesto de conversión de
cada año guarda los SHA-256 de origen y Parquet y verifica que se conserve el
número de filas.

Los CSV.gz originales y los Parquet derivados se guardan en `deliveries/week12/data/raw/full_period/`.
El [catálogo de episodios](data/spectral/index.json) registra las huellas de los
60 Parquet que alimentan el detector. Para reconstruirlo, seguir los pasos
descritos en [Eventos](SpectralEvents.md).
