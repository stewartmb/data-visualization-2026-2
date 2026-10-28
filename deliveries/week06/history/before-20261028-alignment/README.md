# Semana 6 — Investigación de papers y análisis de datos

**DS5343 Data Visualization · UTEC · 2026-2**
Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

## Actualización del 28 de octubre de 2026

El proyecto pasó de perfiles de entradas a demanda y conexiones del subway: entradas 2019–2024, OD estimado 2021–2024 y caminos asignados a una red GTFS de referencia 2026. Se actualiza aquí la investigación que solicita el profesor en §4.3: **al menos cuatro artículos relevantes, sus PDF y su relación con el diseño**. La selección actual contiene doce artículos organizados por función, no una lista de enlaces sin decisión.

| Material | Contenido y alcance |
|---|---|
| [referencias.md](referencias.md) | Seis fundamentos de visualización/tareas, tres antecedentes o métodos de transporte, tres alternativas; dos demos separadas. Método original, adaptación, decisión y límite |
| [papers/README.md](papers/README.md) | Catálogo de los doce PDF y forma de obtener las ocho copias nuevas |
| [papers/sources.json](papers/sources.json) | URL, fecha de descarga, tamaño, páginas y SHA-256 de los PDF consultados |
| [code/acquire_review_papers.py](code/acquire_review_papers.py) | Adquisición reproducible desde fuentes de autores/instituciones; comprueba PDF y registra procedencia |
| [Seis tareas vigentes](../week12/AnalyticalTasks.md) | Propósitos distintos, valor para analistas, métricas, salidas comprobables y estado de implementación |
| [DataAnalysis.md](DataAnalysis.md) | EDA de la entrega original, identificado como histórico; no contiene resultados calculados para las tareas nuevas |
| [README-entrega-original.md](README-entrega-original.md) | Estructura, notebooks, cifras y decisiones de la entrega anterior conservadas para trazabilidad |
| [referencias-20261014.md](referencias-20261014.md) | Revisión bibliográfica anterior de cuatro artículos |

## Reproducir las nuevas copias de consulta

Desde la raíz del repositorio, con Python 3 y `pdfinfo` (Poppler) disponibles:

```bash
python3 deliveries/week06/code/acquire_review_papers.py
```

Las cuatro copias de la selección anterior se conservan. Las ocho nuevas se descargan en `papers/`, se verifican con `pdfinfo` y se registran en el manifiesto. El script requiere conexión; las copias nuevas quedan fuera de Git por defecto para no asumir derechos de redistribución. Un clone debe ejecutar el script para tenerlas localmente. La accesibilidad pública del enlace no declara licencia abierta.

## Qué cambió y qué se conserva

Las seis preguntas anteriores se sustituyen por redistribución territorial, dependencia entre zonas, ventanas temporales, corredores de soporte, balance externo y exposición ante interrupciones. No se declara que todas estén implementadas; especialmente el escenario de interrupción requiere cálculo y validación nuevos.

Se mantiene el panel integrado con mapa, dispersión y reloj. RAEB/KDEEB informan las curvas y el refinamiento; Dhont el reloj; Gleicher la comparación; Brehmer–Munzner las tareas; Shneiderman el recorrido. Las demos MBTA/Tube Heartbeat aportan referencias de interacción, sin copiar datos operativos ausentes.

`PresentationWeek06.pptx`, los bocetos y el EDA original se conservan como entregas históricas; **no se regeneraron** con esta revisión. Sus cifras no se presentan como resultados del alcance nuevo. La aplicación, sus adquisiciones de datos y sus avances pertenecen a [Semana 12](../week12/README.md).
