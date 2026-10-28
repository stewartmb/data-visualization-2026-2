# Investigación y contrato de diseño vigente

Actualización del 28 de octubre de 2026. La [investigación bibliográfica canónica](../../week06/referencias.md) pertenece a Semana 6. Las [seis tareas vigentes](../AnalyticalTasks.md) y el [brief de implementación](../ODVisualizationBrief.md) pertenecen al desarrollo refinado de Semana 12. El [diseño anterior](../../../redesign/02-investigacion-y-diseno-historico-20261014.md) conserva las decisiones de la etapa sin OD; no es el contrato actual.

## Composición y decisiones

Un panel con mapa dominante, dispersión volumen × forma a la derecha arriba, reloj semanal a la derecha abajo y minimapa en una esquina. La selección y los años se explican en común; el mapa usa OD 2021–2024, mientras el contraste de la derecha admite entradas 2019–2024 con la misma fuente en ambos extremos. Elegir una base histórica no genera nuevos flujos en el mapa.

| Idiom o interacción | Decisión | Razón y límite |
|---|---|---|
| Mapa de relaciones con abstracción guiada por rutas | Mantener y documentar como adaptación de RAEB | Espacio + conexiones; no equivale a rutas observadas. Fidelidad 0 permite abstracción libre; 1 recupera GTFS de referencia |
| Dispersión volumen × forma | Mantener como comparación bivariada y selección de casos | Separa magnitud de distribución semanal; no es una SPLOM ni resuelve sola dependencia/vulnerabilidad |
| Matriz radial 7 días × 24 horas | Mantener a tamaño legible | Patrones cíclicos y diferencia explícita; anillos de distinta área, lectura exacta en detalle; no afirmar superioridad perceptual |
| Minimap | Mantener como contexto real de cámara | Orientación al ampliar y mover; no representa otra métrica ni añade una tarea de dominio |
| Selección enlazada y detalle local | Mantener | Una observación abre sus cantidades, origen y límites sin cambiar de pantalla |
| 424 relojes sobre el mapa | Descartar del overview | Oclusión e insuficiente tamaño para leer 168 celdas por nodo |
| Pestañas Atlas/Geografía/Trayectorias/Evidencia como navegación principal | Sustituir por panel integrado | Contexto persistente y menor coste de cambio de vista; conservar entregas históricas |
| Hellinger, 12 vecinos y tres estaciones fijadas | No exigir en esta versión | Fueron decisiones del diseño anterior, no son tareas vigentes ni funciones que se prometan ahora |
| Connected scatterplot anual | Alternativa estudiada, no idiom actual | Necesita puntos ordenados por tiempo; la dispersión actual tiene un punto por complejo |
| Animación temporal automática | Excluir por petición del usuario | Selección manual en reloj/barra; no se deducen posiciones ni velocidades de trenes |
| Medidas territoriales y escenario de interrupción | Propuestas analíticas por desarrollar | Calcular y validar antes de fijar su codificación en el panel; no etiquetarlas como implementadas |

## Marks, canales y semántica

Mapa: posición = coordenada del complejo; área del nodo = viajes iniciados por cohorte; halo/contorno = selección; acento cálido = conexiones del origen seleccionado; curvas = representación de caminos asignados. El fondo es gris. La fusión visual de haces no convierte su ancho en una carga exacta de corredor. Para T4 se necesita consulta cuantitativa por enlace.

Dispersión: posición X = índice de volumen con base 100; posición Y = cambio de reparto semanal (TV pp). El reloj usa ángulo = hora, anillo = día y color divergente = diferencia de peso semanal. No añadir canales arbitrarios para “usarlos todos”: cada canal debe distinguir una propiedad útil, con leyenda y sin codificaciones en conflicto.

Mantra: overview primero, después zoom/selección, y detalles bajo demanda. El panel debe ofrecer orientación sin configurar una batería de filtros. La percepción ayuda a encontrar patrones; las conclusiones aún requieren leer unidades, comprobar denominadores y considerar supuestos.

## Fuentes y límites de la adaptación

RAEB y KDEEB informan el bundling y su refinamiento numérico; Dhont informa el reloj; Gleicher informa comparación explícita; Brehmer–Munzner informa la separación entre propósito y medios; Shneiderman informa el recorrido. MBTAViz y Tube Heartbeat son demos de referencia, no artículos ni prueba de que tengamos sus datos operativos.

La red 2026 no reconstruye servicio histórico. Destinos agrupados por hora de inicio no son salidas observadas a esa hora. No se interpreta capacidad, turismo, empleo, residencia o causalidad sin incorporar y validar sus datos. Detalles, PDFs, DOI, adaptaciones y alternativas en [Semana 6](../../week06/referencias.md).
