# Semana 7 — Consolidación revisada

**Actualización del 28 de octubre de 2026** · Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

## Alcance, audiencia y preguntas

Analistas de transporte e investigadores urbanos buscan territorios, horarios y conexiones que justifiquen estudios adicionales. Se reemplazan tipologías de estaciones y preguntas repetidas por seis resultados distintos:

1. **Redistribución territorial.** ¿Qué zonas recuperaron demanda y cuáles perdieron peso entre 2019 y 2024?
2. **Dependencia e intercambios.** ¿Ganaron peso los viajes locales y entre boroughs o aumentó la dependencia de Manhattan entre 2021 y 2024?
3. **Ventanas de demanda.** ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte.** ¿Qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo.** ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia el balance?
6. **Exposición a interrupciones.** ¿Qué viajes perderían conexión o requerirían mayor distancia al retirar un enlace de referencia?

## Datos, análisis y dirección visual

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Un panel integrado: **mapa central** de conexiones con abstracción guiada por la red; **dispersión volumen × forma** arriba a la derecha; **reloj radial 7 × 24** debajo; **minimapa** para orientación. El área del nodo indica viajes iniciados; las posiciones de la dispersión separan índice de volumen y TV; el color del reloj indica cambio de participación semanal. Las barras de agrupación y fidelidad modifican la geometría, nunca los OD. No hay reproducción automática. Overview → zoom/selección → detalles bajo demanda.

Para OD, combinar promedios mensuales ponderando las ocurrencias de cada día de semana. Para entradas, dividir la suma de cada combinación día–hora por sus ocurrencias anuales. V es la suma de las 168 cantidades de una semana representativa, p=u/V, índice=100 V_obj/V_base y TV_pp=50 Σ|p_obj−p_base|. El reloj usa 100(p_obj−p_base) en pp. TV no considera distancia entre horas ni prueba significancia o causalidad. La carga L_e suma q_OD para los caminos que recorren e; un viaje puede contribuir a varios enlaces. El balance externo es (destinos externos−orígenes externos)/(suma de ambos), indefinido sin viajes externos.

## Evidencia y arquitectura

### Demanda territorial: entradas 2024 frente a 2019

| Borough | Índice de volumen (2019=100) | Cambio de participación del sistema | TV del perfil territorial |
|---|---|---|---|
| Bronx | 58.4 % | -1.44 pp | 1.88 pp |
| Brooklyn | 72.1 % | +0.37 pp | 4.60 pp |
| Manhattan | 71.3 % | +0.27 pp | 4.71 pp |
| Queens | 75.0 % | +0.81 pp | 3.32 pp |

Brooklyn tiene menos volumen que en 2019 y a la vez gana participación relativa. El Bronx conserva 58,4 % del volumen semanal representativo de 2019 y pierde 1,44 pp de participación. Son lecturas descriptivas; el borough de la estación no identifica residencia.

### Conexiones: OD 2021 frente a 2024

La cuota de viajes originados en Brooklyn con destino Manhattan pasa de **42,07 % a 46,71 %**; desde Queens, de **47,09 % a 50,30 %**; desde Bronx, de **53,53 % a 57,22 %**. En esos agregados aumenta la participación hacia Manhattan; no confirma que disminuya la cantidad de viajes locales. Fuente: `T2_territorial_od.csv`, semanas representativas y todos los meses.

### Escenarios y límites

Se calcularon seis retiradas ilustrativas de enlaces sobre la misma red, con OD 2024 fijo. Se informa por separado demanda desconectada y distancia adicional para la aún conectada. Son ejemplos, no un ranking exhaustivo de vulnerabilidad ni predicciones operativas. El CSV conserva los IDs de los enlaces y denominadores. No se extraen distancias de las curvas del bundling.


D3 controla estado, cámara, marcas SVG, selección, dispersión y reloj. Los artefactos preprocesados contienen OD y caminos; el solver GPU refina la geometría y un respaldo CPU/WebGL2 mantiene compatibilidad. Zoom y parámetros visuales no recalculan la demanda. Base histórica independiente 2019/2020 con entradas en ambos extremos; mapa OD 2021–2024.

`data/` contiene muestras vigentes y diccionario; `sketches/panel-actual.png` documenta la composición elegida. El contrato completo está en `../week12/AnalyticalTasks.md`; la revisión bibliográfica en Semana 6.

## Plan priorizado y responsabilidades

| Pendiente | Responsable propuesto, por ratificar con el equipo | Fecha objetivo |
|---|---|---|
| Integrar síntesis territorial T1/T2/T5 y detalle por tramo T4 | Stewart | 6 noviembre |
| Revisar agregaciones, denominadores, escenarios y contraste con oferta | Renzo | 6 noviembre |
| Evaluación formativa con tareas de dominio; registrar errores, aciertos y comentarios | Los tres | 10 noviembre |
| Figuras, narrativa y paper final con resultados de evaluación | José | 13 noviembre |
| Teaser, video de presentación y póster según §5 de la guía | Los tres; repartir producción | 16 noviembre |
| Revisión cruzada de accesibilidad, publicación y presentación final | Los tres | 17 noviembre |

Las responsabilidades son una propuesta de actualización, no acuerdos nuevos atribuidos al equipo. Semana 12 distingue lo implementado de las extensiones. No se inventa feedback ni resultados de evaluación.

## Reflexión

El examen de datos cambió la unidad de interés: además del complejo importan territorios, conexiones y corredores. Se amplió la adquisición y se separó el diseño de la promesa analítica: tener OD no significa observar el camino ni disponer de capacidad. Los seis cálculos ya tienen evidencia, pero el panel aún requiere integrar algunas lecturas territoriales y escenarios.

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. 2020 completo es un año pandémico; 2019 es la referencia anual anterior. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.
