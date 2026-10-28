# Semana 4 — Paquete de datos actualizado

Revisión del 28 de octubre de 2026; selección y entrega de datos según §4.1. Las versiones previas están en `history/`. Este documento registra el alcance actual sin afirmar que fuera el disponible en septiembre.

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Organización: Metropolitan Transportation Authority (MTA), distribuida por Open NY; territorio NYC DCP. Las fuentes son agregadas y públicas; aplicar los términos de Open NY y de cada catálogo. No se publica información de pasajeros identificables. La red deriva de un snapshot GTFS oficial, no de conexiones añadidas por proximidad. Fechas y SHA por archivo en los manifiestos de Semana 12.

## Acceso, muestra y diccionario

`data/sample.csv` es una muestra procesada de demanda territorial; `data/od_sample.csv` contiene relaciones agregadas reales; `data/network_sample.csv` contiene enlaces de referencia. No son registros individuales. `data_dictionary.csv` identifica sus campos y unidades. Los 12/16 campos originales se describen en los diccionarios oficiales y metadatos de `../week12/data/full_period/` y `../week12/data/od_2021_2024/`.

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. 2020 completo es un año pandémico; 2019 es la referencia anual anterior. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.

Adquisición y reproducción: [acquisition.md](acquisition.md). Utilidad potencial: estudiar intensidad, distribución temporal, relaciones territoriales y dependencia modelada de la red; no deducir frecuencias óptimas.
