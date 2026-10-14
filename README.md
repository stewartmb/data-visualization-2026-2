# La forma del día · Atlas de ritmos

**Cómo cambió el ritmo horario de las entradas al metro de Nueva York**
DS5343 Data Visualization · UTEC · 2026-2

Renzo Alfonso Acervo Correa · Diva Stewart Maquera Bobadilla

> Esta rama propone un rediseño del proyecto: `codex/atlas-ritmos-urbanos`. La aplicación nueva está en `atlas/`. El prototipo y entregas anteriores se conservan como historia del desarrollo.

## Problema y objetivo

La recuperación del volumen de entradas puede esconder cambios en sus horarios. Buscamos descubrir, comparar y documentar cómo cambiaron los ritmos semanales entre estaciones y entre años, distinguiendo forma, volumen y ubicación.

La comparación usa **enero–febrero de cada año 2020–2024**, con corrección por número de lunes, martes, etc. El universo es **424 complejos de subway**, con perfiles de 168 horas. Son entradas agregadas, no personas identificadas ni viajes origen–destino.

**Audiencia principal:** analistas de transporte e investigadores urbanos. **Uso:** identificar estaciones y grupos para investigar con mayor detalle. **Audiencia secundaria:** periodistas de datos. Los datos disponibles no bastan para recomendar frecuencias óptimas de trenes ni demostrar motivos de los cambios.

## Abrir la aplicación

Desde la raíz del repositorio:

```bash
python3 -m http.server 8765
```

Abrir **http://localhost:8765/atlas/**. No necesita compilación, token ni conexión externa: D3 y los datos están incluidos. Requiere HTTP porque usa módulos ES y `fetch`.

![Atlas semanal implementado](redesign/capturas/atlas.png)

## Qué puede hacer el usuario

| Herramienta | Tareas que apoya |
|---|---|
| Atlas semanal de estación × 168 horas | Encontrar franjas de cambio, comparar perfiles, ordenar por magnitud, volumen o semejanza |
| Mapa con boroughs | Localizar cambios y formar grupos geográficos que persisten en las demás vistas |
| Trayectorias fechadas AM × fin de semana | Seguir evolución conjunta en cinco temporadas; comparar sistema, grupo y estaciones |
| Inspector de estaciones | Leer huella cíclica o matricial, comparar perfiles, consultar evolución mensual y fuentes |
| Evidencia | Ver medidas del grupo, revisar supuestos, guardar exploraciones y exportar CSV |

El año, filtros, selección, grupos y estaciones fijadas se conservan entre vistas y en la URL. La búsqueda por ejemplo recupera doce vecinos por distancia de Hellinger; no impone tipos de estaciones sin validarlos. Se pueden fijar hasta tres complejos para comparar.

## Preguntas del rediseño

1. ¿Qué días y horas cambiaron su peso relativo y cómo difiere el cambio entre complejos?
2. ¿Qué complejos cambiaron más y cuáles tienen perfiles parecidos a una estación de referencia?
3. ¿Dónde aparecen esos cambios y semejanzas, y cómo se distribuyen entre boroughs?
4. ¿Recuperar volumen implica recuperar la forma de la semana?
5. ¿La evolución del peso AM y de fin de semana fue continua o tuvo retrocesos entre años?
6. ¿Qué datos y supuestos sostienen una lectura y qué casos requieren cautela?

La [matriz de tareas](redesign/01-problema-y-tareas.md) define propósito, entradas, salida verificable y relación entre vistas. No hay una vista obligatoria por pregunta.

## Investigación y decisiones

Las [cuatro referencias principales](deliveries/week06/referencias.md) documentan antecedentes de comparación de perfiles, TV, normalización/Hellinger y reloj semanal con resta de períodos. Cada una distingue el método original de nuestra adaptación.

El [contrato de diseño](redesign/02-investigacion-y-diseno.md) documenta la revisión de FINO y literatura sobre comparación visual, tareas, calendarios, consulta por ejemplo y trayectorias. La originalidad se busca en una experiencia coherente para este dominio: selección persistente, foco/contexto, varias lecturas del mismo dato y trazabilidad.

La [metodología](redesign/03-datos-y-metodos.md) explica las fuentes públicas, las fórmulas, el ajuste del calendario, los joins y las alternativas de enriquecimiento evaluadas. El [plan de evaluación](redesign/04-evaluacion.md) distingue pruebas técnicas realizadas y evaluación pendiente con personas.

## Datos y reproducción

La fuente principal es [MTA Subway Hourly Ridership: 2020–2024](https://data.ny.gov/d/wujg-7c2s), vía Open NY / Socrata. El dataset original abarca varios modos; el atlas restringe la consulta a subway y temporadas comparables.

Se incorporan el [catálogo oficial de complejos MTA](https://data.ny.gov/d/5f5g-n3cz) —unión exacta en 424/424— y los [contornos de boroughs de NYC DCP](https://data.cityofnewyork.us/d/gthc-hcne). Los catálogos actuales dan contexto y no reconstruyen oferta histórica.

Para reconstruir los artefactos desde los snapshots versionados, sin red ni paquetes externos:

```bash
python3 scripts/redesign/build_atlas.py
python3 scripts/redesign/validate_atlas.py
```

Para volver a consultar las APIs oficiales:

```bash
python3 scripts/redesign/acquire_context.py
python3 scripts/redesign/build_atlas.py
```

La adquisición usa 45 ventanas semanales y caché resumible. Las consultas y SHA-256 quedan en [`data/redesign/sources.json`](data/redesign/sources.json); la auditoría está en [`redesign/data-audit.json`](redesign/data-audit.json).

## Estructura

```text
atlas/                     aplicación nueva D3 + Canvas + SVG
  src/                     vistas, estado, inspector e interacciones
  lib/                     D3 local y licencia
  data/                    JSON del cliente y contornos simplificados
redesign/                  objetivos, tareas, investigación, métodos y evaluación
  capturas/                capturas reales del navegador
data/redesign/             agregados comparables y snapshots públicos
scripts/redesign/          adquisición, transformación y verificaciones
  acquire_context.py
  build_atlas.py
  validate_atlas.py
  smoke.cjs
deliveries/                entregas históricas de semanas 4–10
```

## Entregas históricas

| Semana | Contenido |
|---|---|
| [4](deliveries/week04/) | Dataset, diccionario y adquisición |
| [5](deliveries/week05/) | Propuesta inicial y presentación |
| [6](deliveries/week06/) | Análisis, figuras, bocetos y papers |
| [7](deliveries/week07/) | Consolidación de la primera fase |
| [10](deliveries/week10/) | Prototipo funcional y design review: aplicación de tres vistas (Matriz · Recorrido · Mapa), reporte, guion y presentación |
| [12](deliveries/week12/) | Borrador refinado, respuesta a la crítica y paper |

La aplicación de la Semana 10 también vive en [`app/`](app/), con `python3 -m http.server 8000` desde esa carpeta.

Los objetivos de esas entregas reflejan el estado de cada fase. El rediseño actual está explicado en [`redesign/README.md`](redesign/README.md). Paper, póster, videos y evaluación con personas siguen pendientes como entregables finales del curso.

## Límites de interpretación

Los registros son estimaciones de entradas a complejos. No contienen destinos, personas únicas ni capacidad/frecuencia histórica. El ajuste de calendario y temporada no controla obras, feriados o cambios de servicio. Las horas sin registros se representan como cero entradas registradas y se declaran; no prueban demanda nula bajo servicio normal. La MTA documenta cierres nocturnos en enero–febrero de 2021. Las afirmaciones y medidas se acompañan de fuentes en la aplicación.

Datos: MTA / Open NY; contornos: NYC Department of City Planning. D3 v7.9.0: Mike Bostock, licencia ISC. Referente de diseño: [FINO](https://github.com/Josroyal/VAST_2026_RJJJ), sin reutilizar su código. Desarrollo y documentación de esta propuesta asistidos por IA; la revisión del equipo y las pruebas de uso deben documentarse antes de presentarla como versión final.
