# Acceso compartido a OD y red de referencia

Las rutas de esta guía son relativas a la raíz del repositorio: no requieren
la carpeta `/Users/stewart/` ni que ambos integrantes usen la misma computadora.

```bash
git clone https://github.com/stewartmb/data-visualization-2026-2.git
cd data-visualization-2026-2
git switch main
```

Si ya tienes una copia, actualiza `main` con `git pull --ff-only` después de
guardar tus cambios locales.

## Qué está en Git y qué no

| Recurso | Ubicación | Distribución |
|---|---|---|
| Scripts y dependencias | `deliveries/week12/scripts/`, `requirements-data.txt` | Git |
| OD: procedencia, campos, SHA y tamaño de los 48 meses | `deliveries/week12/data/od_2021_2024/` | Git |
| OD original: 48 CSV comprimidos, 16.21 GB | `deliveries/week12/data/raw/od_2021_2024/` | Fuera de Git; transferencia de archivos separada |
| Red: grafo inicial de complejos/conexiones | `deliveries/week12/atlas/data/network_current.json` | Git |
| Red: fuente, SHA y versión del GTFS | `deliveries/week12/data/network_reference/source.json` | Git |
| Red: ZIP GTFS con geometrías y horarios, 5.62 MB | `deliveries/week12/data/raw/enrichments/gtfs_subway.zip` | Descarga con `acquire_network.py` o copia compartida |
| Especificación del nuevo panel | `deliveries/week12/ODVisualizationBrief.md` | Git; diseño todavía no implementado |

**Clonar el repositorio no descarga los 16.21 GB de OD.** No hay todavía un
enlace publicado a una Release con esos originales. El equipo debe compartirlos
aparte por transferencia local, Drive o una Release; no asumir que ya existen allí.

## Obtener exactamente la misma copia OD

Recibe del equipo los 48 archivos `2021-01.csv.gz` a `2024-12.csv.gz` y
colócalos directamente en `deliveries/week12/data/raw/od_2021_2024/`.
No descomprimas los archivos ni cambies sus nombres. Los SHA-256 y tamaños de
la copia original están en `data/od_2021_2024/acquisition.json` de esta entrega.

Los originales se descargaron completos, pero siguen pendientes de los controles
independientes de contenido. Consulta `data/od_2021_2024/validation.json` local:
solo `status: PASS` significa que finalizaron los controles de los 48 meses.
Que el manifiesto de adquisición diga `DOWNLOADED_UNVERIFIED` no es un PASS.

Si no recibes la copia, puedes repetir la extracción desde MTA, conservando los
16 campos originales y todos los pares publicados:

```bash
python3 deliveries/week12/scripts/acquire_od.py --workers 4
```

La adquisición utiliza librería estándar de Python y bloqueo POSIX; en Windows
utiliza WSL. Al reejecutar, reutiliza meses locales que coincidan con el manifiesto
y reinicia meses parciales. El token Socrata es opcional y se obtiene únicamente
de una variable de entorno; no se publica ninguna credencial.

Para validar y preparar Parquet, después de recibir los 48 originales:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r deliveries/week12/requirements-data.txt
.venv/bin/python deliveries/week12/scripts/prepare_validate_od.py
```

Este paso conserva todos los campos en Parquet y compara registros y sumas de
control con consultas oficiales por mes. Requiere espacio adicional en disco.
Las sumas de promedios son controles, no totales mensuales de viajes.

## Obtener la red sin descargar la base anterior de afluencia

```bash
python3 deliveries/week12/scripts/acquire_network.py
```

El script descarga solo el GTFS oficial y exige el SHA del snapshot documentado.
La URL MTA cambia con las versiones: si ya no sirve ese mismo archivo, el script
se detiene y debes pedir al equipo su ZIP de referencia. No sustituye silenciosamente
la red por una versión distinta. `--offline` comprueba una copia recibida sin red.

`acquire_enrichments.py` y `build_enrichments.py` conservan la reproducción del
pipeline anterior de transbordos, tarifas, territorio y grafo; el primero requiere
la tabla diaria anterior de afluencia. Para trabajar solo en OD y geometrías,
utiliza `acquire_od.py` y `acquire_network.py`.

La red es un snapshot **2026**, no una reconstrucción histórica 2021–2024.
El grafo publicado contiene adyacencias de servicios y transferencias declaradas;
no es todavía el grafo completo para asignar rutas OD ni el algoritmo de bundling.
Para este nuevo panel, deben prepararse las geometrías de `shapes.txt`, los sentidos,
las conexiones permitidas y el modelo de asignación conforme al brief.
