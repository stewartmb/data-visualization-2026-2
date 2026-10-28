# Problema, audiencia y tareas vigentes

**Revisión: 28 de octubre de 2026.** El proyecto ahora aborda demanda, conexiones territoriales y dependencia de la red. Las seis tareas del diseño anterior quedan sustituidas. Su versión histórica se conserva en [el documento anterior](../../../redesign/01-problema-y-tareas-historico-20261014.md).

La especificación vigente, con **seis preguntas distintas, valor para la audiencia, abstracción de Munzner, datos, fórmulas, salidas verificables, límites y estado de implementación**, está en [Semana 12 — AnalyticalTasks](../AnalyticalTasks.md).

Audiencia principal: analistas de transporte e investigadores urbanos. Objetivo: priorizar territorios, horarios y conexiones para estudios de demanda y contingencia con evidencia reproducible.

1. **Redistribución territorial:** ¿qué zonas recuperaron demanda y cuáles perdieron peso entre 2019 y 2024?
2. **Dependencia territorial:** ¿cambió la dependencia de Manhattan o ganaron peso viajes locales y entre otros boroughs, entre 2021 y 2024?
3. **Ventanas de demanda:** ¿dónde y cuándo se desplazaron las franjas de mayor demanda?
4. **Corredores de soporte:** ¿qué tramos de la red de referencia sostienen los principales intercambios?
5. **Balance externo:** ¿qué zonas generan o atraen más viajes externos y cuándo cambia ese balance?
6. **Exposición a interrupciones:** ¿qué viajes y territorios perderían conexión o necesitarían más distancia al retirar un tramo de referencia?

La sexta es una extensión contrafactual pendiente, no una predicción ni una función ya implementada. Las demás también tienen avances y pendientes diferenciados en el contrato. Los datos de entradas cubren 2019–2024; OD solo 2021–2024; la red disponible es de 2026. No mezclar esas temporalidades ni presentar 2020 completo como referencia prepandemia.

Se conserva el panel integrado con mapa, dispersión y reloj. Zoom, agrupación, búsqueda, selección, minimapa y trazabilidad son medios transversales, no tareas de dominio adicionales. La investigación que informa el diseño vive en [Semana 6](../../week06/referencias.md).
