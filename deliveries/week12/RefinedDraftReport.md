# Semana 12 — Fractal: demanda, conexiones y ritmos

**Borrador refinado, revisión del 28 de octubre de 2026** · Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

## 1. Motivación, audiencia y secuencia analítica

Un total de entradas no revela dónde se redistribuye la demanda ni qué territorios conectan sus viajes. Analistas de transporte e investigadores urbanos necesitan explorar demanda, vínculos y dependencia modelada de la red para priorizar aforos y estudios; periodistas son audiencia secundaria. La secuencia va del territorio a las conexiones, horarios, corredores, balance y perturbación. El producto no determina frecuencias óptimas.

1. **Redistribución territorial.** ¿Qué zonas recuperaron demanda y cuáles perdieron peso entre 2019 y 2024?
2. **Dependencia e intercambios.** ¿Ganaron peso los viajes locales y entre boroughs o aumentó la dependencia de Manhattan entre 2021 y 2024?
3. **Ventanas de demanda.** ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte.** ¿Qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo.** ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia el balance?
6. **Exposición a interrupciones.** ¿Qué viajes perderían conexión o requerirían mayor distancia al retirar un enlace de referencia?

## 2. Datos, métodos y procedencia

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Para OD, combinar promedios mensuales ponderando las ocurrencias de cada día de semana. Para entradas, dividir la suma de cada combinación día–hora por sus ocurrencias anuales. V es la suma de las 168 cantidades de una semana representativa, p=u/V, índice=100 V_obj/V_base y TV_pp=50 Σ|p_obj−p_base|. El reloj usa 100(p_obj−p_base) en pp. TV no considera distancia entre horas ni prueba significancia o causalidad. La carga L_e suma q_OD para los caminos que recorren e; un viaje puede contribuir a varios enlaces. El balance externo es (destinos externos−orígenes externos)/(suma de ambos), indefinido sin viajes externos.

El mapa usa OD 2021–2024. La columna derecha incorpora 2019 y 2020: al elegirlos, ambos extremos se calculan con entradas 2019–2024; no se mezcla una fuente por año. Se abre con contraste histórico 2019→2024, mientras la comparación del mapa conserva 2021→2024. Los 672 frames OD del cliente tienen manifiesto SHA; los originales grandes no son necesarios para ejecutar el panel.

## 3. Diseño y justificación

Un panel integrado: **mapa central** de conexiones con abstracción guiada por la red; **dispersión volumen × forma** arriba a la derecha; **reloj radial 7 × 24** debajo; **minimapa** para orientación. El área del nodo indica viajes iniciados; las posiciones de la dispersión separan índice de volumen y TV; el color del reloj indica cambio de participación semanal. Las barras de agrupación y fidelidad modifican la geometría, nunca los OD. No hay reproducción automática. Overview → zoom/selección → detalles bajo demanda.

RAEB guía la abstracción con jerarquía de rutas; KDEEB informa densidad, advección y suavizado; WebGPU es una adaptación de ingeniería. La referencia usa GTFS 2026 y sus transferencias explícitas. Fidelidad 0 permite abstracciones que cruzan agua; fidelidad 1 recupera la geometría de referencia. Nada de ello altera conexiones topológicas ni cantidades OD. La fusión visual de trazos usa ancho local saturado, no una escala exacta de carga de corredor; T4 necesita valores por enlace.

La dispersión usa posición para índice y TV; el reloj usa ángulo para hora, anillo para día y color para diferencia en pp. El área exterior del reloj es distinta: no se usa como magnitud ni se afirma superioridad frente a una matriz. Las barras se apilan, el estado muestra Procesando/Completado/Completado (parcial) y la selección puede limpiarse sin quedar atrapado en naranja.

## 4. Hallazgos preliminares del alcance actual

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


Resultados completos y controles en `data/analytical_tasks/`; preparación en `scripts/prepare_analytical_tasks.py`. Las seis tablas tienen muestras en Semana 6. Ninguna cifra implica una causa o recomendación operativa.

## 5. Funciones existentes y pendientes

| Tarea | Evidencia preparada | Estado de interacción |
|---|---|---|
| T1 | CSV por borough/NTA, seis años | Contraste por complejo disponible; síntesis territorial por integrar al panel |
| T2 | Matrices territoriales y participaciones, cuatro años | Selección de origen disponible; detalle territorial por integrar |
| T3 | Ventanas de 3 h, 7 días y seis años | Reloj y selección horaria disponibles; detector automático por integrar |
| T4 | Cargas de los 549 enlaces para 2021/2024 | Geometría y haces disponibles; inspección exacta por tramo pendiente |
| T5 | Balance externo por borough/cohorte, cuatro años | CSV preparado; codificación interactiva pendiente |
| T6 | Seis escenarios reproducibles | Cálculo preparado; escenario interactivo pendiente |


No se presenta la preparación de una tabla como una interacción implementada. La auditoría de accesibilidad y la evaluación con personas de la audiencia siguen pendientes; las pruebas técnicas no demuestran efectividad perceptual.

## 6. Crítica e iteración

Se conserva el registro original de críticas en `history/before-20261028-alignment/PeerCritiqueResponse.md`. Los comentarios del profesor sobre protagonismo visual y orientación geográfica se responden con mapa central y minimapa. La decisión de volver al reloj principal y retirar reproducción proviene de instrucciones posteriores del usuario, no se atribuye al profesor. El registro actualizado diferencia comentarios recibidos, decisiones del equipo y desarrollo pendiente.

## 7. Limitaciones

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. 2020 completo es un año pandémico; 2019 es la referencia anual anterior. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.

Los escenarios de T6 mantienen demanda fija, distancias y red estática; no modelan horarios, capacidad, cambio de modo o reacción del viajero. Las NTA sin complejos cubiertos no son zonas sin demanda. Los períodos anuales no eliminan estacionalidad ni controlan clima, feriados u obras.

## 8. Trabajo restante y responsables

| Pendiente | Responsable propuesto, por ratificar con el equipo | Fecha objetivo |
|---|---|---|
| Integrar síntesis territorial T1/T2/T5 y detalle por tramo T4 | Stewart | 6 noviembre |
| Revisar agregaciones, denominadores, escenarios y contraste con oferta | Renzo | 6 noviembre |
| Evaluación formativa con tareas de dominio; registrar errores, aciertos y comentarios | Los tres | 10 noviembre |
| Figuras, narrativa y paper final con resultados de evaluación | José | 13 noviembre |
| Teaser, video de presentación y póster según §5 de la guía | Los tres; repartir producción | 16 noviembre |
| Revisión cruzada de accesibilidad, publicación y presentación final | Los tres | 17 noviembre |

Las responsabilidades son una propuesta de actualización, no acuerdos nuevos atribuidos al equipo. Semana 12 distingue lo implementado de las extensiones. No se inventa feedback ni resultados de evaluación.

## 9. Reproducir, ejecutar y publicar

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

La fuente inicial del artículo y su PDF están en `paper/`. La página inicial está en `/index.html`; referencias y artículos se localizan en Semana 6. La publicación usa GitHub Pages desde `main`; debe comprobarse el enlace HTTP y las interacciones antes de declararla completa.

## Referencias principales

- Zeng et al. (2019), **RAEB**, jerarquía y abstracción guiada por rutas: https://doi.org/10.1111/cgf.13712
- Hurter et al. (2012), **KDEEB**, densidad, advección y suavizado: https://doi.org/10.1111/j.1467-8659.2012.03079.x
- Dhont et al. (2020), reloj semanal y resta de mapas: https://doi.org/10.1007/978-3-030-65742-0_9
- Fredriksson y Karlström (2025), TV, ecuación 11; adaptación a 168 celdas propia: https://doi.org/10.1007/s42421-025-00141-5
- Brehmer y Munzner (2013), propósito, medios y entradas/salidas: https://doi.org/10.1109/TVCG.2013.124
- Gleicher et al. (2011), comparación explícita: https://doi.org/10.1177/1473871611416549
- Shneiderman (1996), recorrido de exploración: https://doi.org/10.1109/VL.1996.545307
