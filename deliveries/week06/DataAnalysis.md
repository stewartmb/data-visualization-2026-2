# Semana 6 — Análisis, transformaciones y diseño revisados

**Revisión del 28 de octubre de 2026** · Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

## Datos y métodos

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Para OD, combinar promedios mensuales ponderando las ocurrencias de cada día de semana. Para entradas, dividir la suma de cada combinación día–hora por sus ocurrencias anuales. V es la suma de las 168 cantidades de una semana representativa, p=u/V, índice=100 V_obj/V_base y TV_pp=50 Σ|p_obj−p_base|. El reloj usa 100(p_obj−p_base) en pp. TV no considera distancia entre horas ni prueba significancia o causalidad. La carga L_e suma q_OD para los caminos que recorren e; un viaje puede contribuir a varios enlaces. El balance externo es (destinos externos−orígenes externos)/(suma de ambos), indefinido sin viajes externos.

## Preguntas y evidencia

1. **Redistribución territorial.** ¿Qué zonas recuperaron demanda y cuáles perdieron peso entre 2019 y 2024?
2. **Dependencia e intercambios.** ¿Ganaron peso los viajes locales y entre boroughs o aumentó la dependencia de Manhattan entre 2021 y 2024?
3. **Ventanas de demanda.** ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte.** ¿Qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo.** ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia el balance?
6. **Exposición a interrupciones.** ¿Qué viajes perderían conexión o requerirían mayor distancia al retirar un enlace de referencia?

Las seis tablas de `data/processed/T1_*.csv` a `T6_*.csv` son muestras de hasta 24 filas de resultados reales. Las tablas completas están en `../week12/data/analytical_tasks/`. `../week12/scripts/prepare_analytical_tasks.py` verifica 672 matrices OD contra sus SHA y produce todos los resultados, con controles de conservación y de distancia en los escenarios. No se presenta el escenario como interfaz terminada.

| Tarea | Evidencia preparada | Estado de interacción |
|---|---|---|
| T1 | CSV por borough/NTA, seis años | Contraste por complejo disponible; síntesis territorial por integrar al panel |
| T2 | Matrices territoriales y participaciones, cuatro años | Selección de origen disponible; detalle territorial por integrar |
| T3 | Ventanas de 3 h, 7 días y seis años | Reloj y selección horaria disponibles; detector automático por integrar |
| T4 | Cargas de los 549 enlaces para 2021/2024 | Geometría y haces disponibles; inspección exacta por tramo pendiente |
| T5 | Balance externo por borough/cohorte, cuatro años | CSV preparado; codificación interactiva pendiente |
| T6 | Seis escenarios reproducibles | Cálculo preparado; escenario interactivo pendiente |


## Hallazgos exploratorios

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


## Bocetos, alternativas y literatura

Un panel integrado: **mapa central** de conexiones con abstracción guiada por la red; **dispersión volumen × forma** arriba a la derecha; **reloj radial 7 × 24** debajo; **minimapa** para orientación. El área del nodo indica viajes iniciados; las posiciones de la dispersión separan índice de volumen y TV; el color del reloj indica cambio de participación semanal. Las barras de agrupación y fidelidad modifican la geometría, nunca los OD. No hay reproducción automática. Overview → zoom/selección → detalles bajo demanda.

Boceto vigente exportado en `sketches/panel-actual.png`, como boceto estático basado en datos reales, con leyendas; no es captura ni resultado del solver; los bocetos anteriores se mantienen en `sketches/history/`. Se descarta dibujar 424 relojes pequeños sobre el mapa por oclusión, categorías rígidas de estación sin validación y animación como único comparador. La dispersión no es un connected scatterplot y la geometría del haz no equivale a infraestructura ni saturación.

La revisión en `referencias.md` organiza 12 artículos. RAEB informa jerarquía de rutas; KDEEB, refinamiento; Dhont, reloj; Fredriksson, TV; Brehmer–Munzner, tareas; Gleicher, comparación y Shneiderman, exploración. Se indican adaptación y límites de cada fuente.

## Limitaciones y reproducción

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. 2020 completo es un año pandémico; 2019 es la referencia anual anterior. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.

```bash
python3 -m http.server 8775
# Abrir /atlas/; no requiere descargar 26 GB para ver la app.
python3 -m pip install -r deliveries/week12/requirements-data.txt
node deliveries/week12/tests/contrast-model.test.mjs
node deliveries/week12/tests/raeb-core.test.mjs
node deliveries/week12/tests/scatter-domain.test.mjs
node deliveries/week12/tests/validate-raeb-data.mjs
python3 deliveries/week12/scripts/prepare_analytical_tasks.py
```

Las adquisiciones completas opcionales usan `acquire_full_period.py`, `acquire_od.py` y `acquire_network.py`. La preparación histórica y la del RAEB se documentan en `HistoricalContrast.md`, `ODData.md` y `RAEBImplementation.md`. Los originales grandes quedan fuera de Git; se incluyen los artefactos preparados para ejecutar la app y sus manifiestos.

Los hallazgos históricos del corte enero–febrero se conservan en `history/` y no se trasladan al nuevo período.
