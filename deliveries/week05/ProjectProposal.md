# Fractal — Demanda, conexiones y ritmos del subway

**Semana 5, propuesta revisada el 28 de octubre de 2026** · Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

Repositorio: https://github.com/stewartmb/data-visualization-2026-2

## Problema, audiencia y propósito

El volumen agregado oculta la redistribución territorial y temporal de la demanda y las relaciones entre zonas. Analistas de transporte e investigadores urbanos necesitan identificar dónde y cuándo estudiar la demanda, qué conexiones examinar y qué corredores contrastar con oferta real. Periodistas de datos son audiencia secundaria. El producto orienta investigación y contingencia; no decide frecuencias ni atribuye causas sin oferta y contexto adicionales.

## Datos y factibilidad

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. 2020 completo es un año pandémico; 2019 es la referencia anual anterior. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.

## Seis preguntas de dominio

1. **Redistribución territorial.** ¿Qué zonas recuperaron demanda y cuáles perdieron peso entre 2019 y 2024?
2. **Dependencia e intercambios.** ¿Ganaron peso los viajes locales y entre boroughs o aumentó la dependencia de Manhattan entre 2021 y 2024?
3. **Ventanas de demanda.** ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte.** ¿Qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo.** ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia el balance?
6. **Exposición a interrupciones.** ¿Qué viajes perderían conexión o requerirían mayor distancia al retirar un enlace de referencia?

Cada pregunta tiene beneficio, datos, fórmula y salida verificable en `../week12/AnalyticalTasks.md`. La sexta es un escenario con demanda fija. El cálculo de las seis tiene evidencia CSV; todavía no todas tienen interacción completa en la app.

## Dirección y riesgos

Un panel integrado: **mapa central** de conexiones con abstracción guiada por la red; **dispersión volumen × forma** arriba a la derecha; **reloj radial 7 × 24** debajo; **minimapa** para orientación. El área del nodo indica viajes iniciados; las posiciones de la dispersión separan índice de volumen y TV; el color del reloj indica cambio de participación semanal. Las barras de agrupación y fidelidad modifican la geometría, nunca los OD. No hay reproducción automática. Overview → zoom/selección → detalles bajo demanda.

El procesamiento se realiza fuera del navegador; D3 coordina vistas y WebGPU acelera el bundling cuando está disponible, con respaldo CPU/WebGL2. Riesgos: diferenciar entradas/OD, red actual/histórica y abstracción/ruta; legibilidad de haces y radial; rendimiento inicial y accesibilidad. Se mantienen escalas y unidades explícitas y no se equipara grosor aparente con carga exacta de tramo.

## Organización

Renzo: pipeline y validación; Stewart: D3 e interacción; José: comunicación y artículo. La actualización detallada de responsabilidades es una propuesta a ratificar. Se prioriza el panel publicado y sus comparaciones; las extensiones territoriales y escenarios deben entrar con evidencia y sin recargar controles. Historial de la propuesta conservado en `history/`.
