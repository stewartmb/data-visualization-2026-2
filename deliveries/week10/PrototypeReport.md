# Semana 10 — Prototipo y revisión de diseño actualizados

**Revisión del 28 de octubre de 2026** · Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

El prototipo original del 14 de octubre y sus materiales se conservan en `history/` y `prototype/`. Esta revisión documenta el estado actual; no atribuye nuevos comentarios a aquella sesión. La aplicación vigente está en `../week12/atlas/` y `/atlas/` en la raíz; no se mantienen seis copias divergentes del motor.

## Problema, audiencia y tareas

Identificar territorios, ventanas y corredores para estudios de demanda y conectividad, con analistas de transporte e investigadores urbanos como audiencia principal.

1. **Redistribución territorial.** ¿Qué zonas recuperaron demanda y cuáles perdieron peso entre 2019 y 2024?
2. **Dependencia e intercambios.** ¿Ganaron peso los viajes locales y entre boroughs o aumentó la dependencia de Manhattan entre 2021 y 2024?
3. **Ventanas de demanda.** ¿Dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte.** ¿Qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo.** ¿Qué territorios generan o atraen más viajes externos y en qué franjas cambia el balance?
6. **Exposición a interrupciones.** ¿Qué viajes perderían conexión o requerirían mayor distancia al retirar un enlace de referencia?

## Datos e interacciones existentes

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Un panel integrado: **mapa central** de conexiones con abstracción guiada por la red; **dispersión volumen × forma** arriba a la derecha; **reloj radial 7 × 24** debajo; **minimapa** para orientación. El área del nodo indica viajes iniciados; las posiciones de la dispersión separan índice de volumen y TV; el color del reloj indica cambio de participación semanal. Las barras de agrupación y fidelidad modifican la geometría, nunca los OD. No hay reproducción automática. Overview → zoom/selección → detalles bajo demanda.

Implementado: mapa con selección de origen, fidelidad y agrupación, navegación y minimapa, dispersión enlazada, reloj seleccionable, contraste 2019/2020 y retorno a vista general. Se conserva hora manual y no se incorpora reproducción. Todos los cálculos y CSV nuevos están preparados; las lecturas interactivas se distinguen a continuación.

| Tarea | Evidencia preparada | Estado de interacción |
|---|---|---|
| T1 | CSV por borough/NTA, seis años | Contraste por complejo disponible; síntesis territorial por integrar al panel |
| T2 | Matrices territoriales y participaciones, cuatro años | Selección de origen disponible; detalle territorial por integrar |
| T3 | Ventanas de 3 h, 7 días y seis años | Reloj y selección horaria disponibles; detector automático por integrar |
| T4 | Cargas de los 549 enlaces para 2021/2024 | Geometría y haces disponibles; inspección exacta por tramo pendiente |
| T5 | Balance externo por borough/cohorte, cuatro años | CSV preparado; codificación interactiva pendiente |
| T6 | Seis escenarios reproducibles | Cálculo preparado; escenario interactivo pendiente |


## Preguntas específicas para la crítica

- ¿Se entiende que el mapa usa OD 2021–2024 mientras el contraste histórico usa entradas equivalentes en ambos extremos?
- ¿El grosor del haz se confunde con carga exacta, capacidad o congestión?
- ¿Se puede seleccionar una franja y volver a la vista general sin perder orientación?
- ¿La diferencia de peso semanal se distingue de una caída de cantidad absoluta?
- ¿Qué detalle territorial aporta más valor sin añadir controles innecesarios?

Usar «Me gusta / Desearía / ¿Y si?» para solicitar comentarios; no se fabrica una respuesta recibida. Registro de críticas históricas y decisiones actuales en `../week12/PeerCritiqueResponse.md` y `.pdf`.

## Limitaciones y ejecución

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

La presentación sigue un guion de hasta cinco minutos. Acceso público previsto: https://stewartmb.github.io/data-visualization-2026-2/atlas/; el estado de publicación se verifica al cerrar esta revisión.
