# Semana 4 · Datos del subway de Nueva York

Revisión del 16 de noviembre de 2026 según el §4.1 de la [guía del proyecto](../../Proyecto_Final_Guia.md#41-semana-4--selección-y-entrega-del-dataset-2-de-septiembre-de-2026). El paquete documenta el alcance vigente del Atlas Fractal. La entrega anterior se conserva en el historial del repositorio.

## Fuentes y cobertura

**Entradas horarias · enero de 2021 a diciembre de 2025.** La Metropolitan Transportation Authority (MTA) publica entradas agregadas a partir de transacciones OMNY y MetroCard. Cada fila corresponde a una hora local, complejo, modo, medio de pago y clase tarifaria. La adquisición validó **130.987.497 filas** en **60 meses**, con 12 campos de origen y todos los modos publicados. La vista **Eventos** usa únicamente `subway`, agrega `ridership` por complejo y hora, y compara la afluencia con la de horas equivalentes de semanas cercanas. `transfers` es una parte de `ridership`. [Open NY, 2021–2024](https://data.ny.gov/d/wujg-7c2s) · [Open NY, 2025](https://data.ny.gov/d/5wq4-mkjj).

**Origen–destino estimado · enero de 2021 a diciembre de 2025.** La MTA estima el destino a partir de patrones de uso de OMNY y MetroCard y publica promedios por mes, día de semana, hora de inicio y par ordenado de complejos. La adquisición validó **567.608.985 filas** en **60 meses**, con 16 campos. La vista **Años** pondera los promedios mensuales por el número real de ocurrencias de cada día de semana. El campo `timestamp` identifica la fecha representativa de la cohorte. [2021](https://data.ny.gov/d/rapa-97zv) · [2022](https://data.ny.gov/d/nqnz-e9z9) · [2023](https://data.ny.gov/d/uhf3-t34z) · [2024](https://data.ny.gov/d/jsu2-fbtj) · [2025](https://data.ny.gov/d/y2qv-fytt).

**Red y geografía.** El universo analítico cubre **424 complejos** en Brooklyn (156), Manhattan (121), Queens (79) y Bronx (68). Años asigna rutas sobre 475 paradas padre GTFS, 556 enlaces ferroviarios y 75 transbordos declarados. Eventos usa 549 adyacencias no dirigidas entre complejos. Ambos se derivan del mismo GTFS de referencia de 2026, descargado el 28 de octubre de 2026 en UTC. Los contornos de NYC DCP incluyen los cinco boroughs y se usan como fondo del mapa. La cobertura de contornos es mayor que la cobertura del subway analizado. [Catálogo MTA de estaciones y complejos](https://data.ny.gov/d/5f5g-n3cz) · [GTFS oficial](https://www.mta.info/developers#static-gtfs-data) · [Borough Boundaries](https://data.cityofnewyork.us/d/gthc-hcne).

Los datos de demanda son públicos y agregados. Su reutilización se rige por [los términos de Open NY](https://data.ny.gov/d/77gx-ii52). Para la red y los contornos se aplican las condiciones de la [MTA](https://www.mta.info/developers) y de [NYC Open Data](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje). El [manifiesto](data/manifest.json) registra las fechas de descarga en UTC, las URL y las huellas SHA-256 por mes. El catálogo de complejos y los contornos se descargaron el 14 de octubre de 2026 en UTC, según el [registro de fuentes](../week12/data/sources.json).

## Archivos y reproducción

- [sample.csv](data/sample.csv) · 1.440 filas reales de entradas. Conserva los 12 campos de la fuente y un campo con el ID de Open NY.
- [od_sample.csv](data/od_sample.csv) · 1.440 filas reales de OD. Conserva los 16 campos de la fuente.
- [network_sample.csv](data/network_sample.csv) y [complexes.csv](data/complexes.csv) · los 631 enlaces del grafo de Años y los 424 complejos. Los campos `a` y `b` enlazan con `complex_id`. Los nodos físicos de cada enlace están en `stop_a` y `stop_b`.
- [Diccionario](data_dictionary.csv) · tipo, unidad o formato, descripción, dominio y tratamiento de faltantes para cada columna.
- [Adquisición y verificación](acquisition.md) · comandos para obtener los originales y regenerar el paquete.

Las muestras de demanda seleccionan 24 filas de cada partición mensual, a lo largo de su orden físico. Permiten inspeccionar el esquema y los cinco años. Los totales de demanda provienen de los archivos completos y sus validaciones.

## Lectura de los datos

Entradas y OD tienen unidades y escalas distintas. Las entradas se registran para fechas y horas concretas. El OD resume una franja típica del mes y permite comparar conexiones entre complejos y años. Los tramos muestran rutas asignadas por costo mínimo sobre una red común de referencia. La información disponible permite explorar afluencia y cambios de patrón. Capacidad, tiempos reales y motivos de viaje están fuera de la cobertura de las fuentes.

En Eventos, la detección exige observación y referencia válidas. Marzo de 2021 tiene entradas registradas y cero episodios que superen los criterios del detector. En OD, una combinación ausente en un mes completo aporta cero al procesamiento. Un mes incompleto bloquea la preparación. Diez filas OD tienen un extremo fuera del universo del mapa (seis en 2023 y cuatro en 2025). Se conservan en la adquisición y se excluyen del enrutamiento. [Reglas de Eventos](../week12/SpectralEvents.md) · [Validación y cobertura OD](../week12/ODData.md) · [Detalle de las diez filas](data/manifest.json).
