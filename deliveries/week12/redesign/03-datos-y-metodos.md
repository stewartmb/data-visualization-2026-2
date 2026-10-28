# Datos, fórmulas y métodos vigentes

Revisión del 28 de octubre de 2026. Datos detallados en `../deliveries/week12/ODData.md`, `FullPeriodData.md` y `HistoricalContrast.md` de Semana 12. El diseño de tareas completo está en [AnalyticalTasks](../AnalyticalTasks.md).

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

Para OD, combinar promedios mensuales ponderando las ocurrencias de cada día de semana. Para entradas, dividir la suma de cada combinación día–hora por sus ocurrencias anuales. V es la suma de las 168 cantidades de una semana representativa, p=u/V, índice=100 V_obj/V_base y TV_pp=50 Σ|p_obj−p_base|. El reloj usa 100(p_obj−p_base) en pp. TV no considera distancia entre horas ni prueba significancia o causalidad. La carga L_e suma q_OD para los caminos que recorren e; un viaje puede contribuir a varios enlaces. El balance externo es (destinos externos−orígenes externos)/(suma de ambos), indefinido sin viajes externos.

El OD es una estimación por hora de inicio, no salidas observadas en esa hora ni trayectorias. Los caminos se asignan por distancia sobre una red de referencia actual: no reconstruyen operación histórica, esperas o elección real de ruta. La abstracción visual no añade infraestructura. No se dispone de capacidad ni motivos de viaje para afirmar congestión, turismo, residencia o causas. 2020 completo es un año pandémico; 2019 es la referencia anual anterior. Las comparaciones usan la misma fuente en ambos extremos y suman cantidades antes de normalizar.

Cargas de corredor y balance externo se calculan con cantidades, no densidad de píxeles. T6 retira un enlace con ambos sentidos si existen; divide demanda que pierde conexión y distancia adicional de la conectada. Se conservan seis ejemplos, no una evaluación exhaustiva de toda infraestructura.

La preparación `prepare_analytical_tasks.py` produce seis CSV y controles. Las referencias metodológicas están en [Semana 6](../../week06/referencias.md). El uso de TV adapta las categorías de la ecuación 11 de Fredriksson y Karlström; el artículo no valida automáticamente su efectividad para semanas.
