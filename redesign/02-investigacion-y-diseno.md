# Investigación y contrato de diseño

## Referente FINO

Se revisaron el [repositorio FINO](https://github.com/Josroyal/VAST_2026_RJJJ), su README y los módulos de matriz, grafo de hilo, drawer y estado/navegación. Su aporte como referente es una experiencia de investigación: selección persistente, niveles de detalle, cambio de lente y acceso desde una observación a su evidencia. Su matriz semántica, reconstrucción y registro de evidencia se apoyan en un transcript y relaciones revisadas que nuestro dataset no tiene.

Aplicación de esos principios: una selección compartida, vistas principales navegables, inspección bajo demanda, comparación por ejemplo y una superficie de evidencia. No se reutilizan código, textos ni activos de FINO. No se fabrican grafos de pasajeros, conexiones de viaje ni cadenas causales para imitar su apariencia.

## Cuatro referencias principales

La selección definitiva para fundamentar comparación de perfiles, TV, normalización/Hellinger y reloj semanal está en [05-referencias-finales.md](05-referencias-finales.md): Liu et al. (2020), Fredriksson y Karlström (2025), van der Knaap et al. (2024) y Dhont et al. (2020). La revisión identifica el procedimiento original y la adaptación del atlas; no atribuye TV a Procrustes ni matrices origen–destino a nuestros datos de entradas.

En particular, Dhont et al. documentan la misma disposición de siete anillos diarios y 24 sectores horarios, además de comparación mediante resta de mapas contra una referencia. Esta referencia se incorporó durante la revisión del diseño, después de implementar el reloj; no se presenta como una fuente consultada en la primera versión.

## Literatura complementaria y decisiones concretas

### Brehmer y Munzner (2013): A Multi-Level Typology of Abstract Visualization Tasks

[Página y paper de las autoras](https://www.cs.ubc.ca/labs/imager/tr/2013/MultiLevelTaskTypology/). DOI: 10.1109/TVCG.2013.124.

El marco distingue propósito, operaciones y entradas/salidas; permite describir secuencias de tareas. Lo aplicamos a T1–T6 y al recorrido overview → selección → comparación → evidencia. El marco estructura el diseño y la evaluación; no demuestra por sí solo que nuestra interfaz sea efectiva. Se consultó el paper, especialmente la formulación de why/how/what y las secuencias de tareas.

### Gleicher et al. (2011): Visual Comparison for Information Visualization

[Fuente de los autores y resumen](https://graphics.cs.wisc.edu/Papers/2011/GAWJHR11/). DOI: 10.1177/1473871611416549.

Su taxonomía distingue yuxtaposición, superposición y codificación explícita de diferencias. Adoptamos diferencia en el atlas y huella, y superposición de pocas curvas en el comparador. No se exige recordar dos estados de una animación. La consulta de esta referencia se limita al resumen y la taxonomía publicada en la página de los autores; no se atribuyen resultados experimentales que no se revisaron.

### Van Wijk y Van Selow (1999): Cluster and Calendar Based Visualization of Time Series Data

[Paper de los autores](https://vanwijk.win.tue.nl/clv.pdf) · [ficha institucional](https://research.tue.nl/en/publications/cluster-and-calendar-based-visualization-of-time-series-data/). DOI: 10.1109/INFVIS.1999.801851.

El trabajo aborda ciclos diarios, semanales y estacionales con patrones y calendarios. Tomamos la organización explícita día × hora y la exploración de similitudes. No copiamos su clustering: nuestra consulta por ejemplo usa distancia sobre distribuciones y conserva cada estación individual. El calendario inspira además comparar temporadas equivalentes. Se consultaron planteamiento, representación de fingerprints y discusión de patrones/limitaciones.

### Hochheiser y Shneiderman (2004): Dynamic Query Tools for Time Series Data Sets

[Paper de los autores](https://www.cs.umd.edu/users/ben/papers/Hochheiser2004Dynamic.pdf) · [registro institucional](https://drum.lib.umd.edu/items/78b040f3-6db0-433c-b783-2132db4eee09). DOI: 10.1057/palgrave.ivs.9500061.

TimeSearcher combina consultas visuales, overview y búsqueda por ejemplo. Inspiró la formación de grupos y la búsqueda de perfiles cercanos a una estación. Nuestro brush selecciona posiciones o filas y no reproduce la semántica de sus timeboxes, que imponen restricciones simultáneas sobre tiempo y valor. Se revisaron la descripción de las consultas, el ejemplo por similitud y sus estudios/discusión; sus resultados no validan automáticamente nuestro producto.

### Haroz, Kosara y Franconeri (2016): The Connected Scatterplot for Presenting Paired Time Series

[Publicación y paper de los autores](https://eagereyes.org/publications/Haroz-TVCG-2016). DOI: 10.1109/TVCG.2015.2502587.

Estudia la conexión de puntos de dos medidas en secuencia temporal y posibles malinterpretaciones. Justifica ensayar el espacio AM × fin de semana, con años y dirección. Se limita la cantidad de trayectorias destacadas y se ofrece enfoque/contexto. La interfaz aclara que las líneas no son viajes ni causalidad. Se consultaron la descripción del diseño, las dificultades de interpretación y las recomendaciones de lectura.

## Herramientas visuales elegidas y descartadas

| Alternativa | Decisión y razón |
|---|---|
| 428 mini líneas visibles simultáneamente | Se reemplazan por una matriz de 424 × 168 con overview y detalle. Favorece reconocer franjas; el comparador conserva líneas para lectura precisa de pocos casos. |
| Atlas de diferencias | Vista principal: mismas columnas para todas las estaciones; azul y naranja representan cambio de peso. Reordenar responde a una tarea, no a decoración. |
| Huella radial de 7 anillos × 24 sectores | Lectura cíclica bajo demanda, a tamaño grande. El área de cada anillo difiere; no codificamos magnitud por área y ofrecemos la misma data como matriz. Requiere evaluación con usuarios. |
| Hellinger y búsqueda por ejemplo | Recupera semejanzas sin inventar tipos discretos. Se muestran definición y valor de distancia. |
| Proyección UMAP/t-SNE | No implementada: podría crear vecindades visuales atractivas pero exigiría evaluar distorsión y estabilidad. Para T2 basta la distancia consultable sobre las 168 dimensiones. |
| Alluvial/Sankey de “tipos de estación” | Aplazado: faltan categorías validadas; los flujos serían cambios de clasificación, no desplazamiento de personas. |
| Grafo origen–destino / edge bundling de viajes | Descartado con esta fuente: no hay destinos ni enlaces de viaje observados. |
| Mapa con 424 glyphs radiales | Descartado por tamaño y oclusión. El mapa conserva puntos; el glyph se abre al investigar un caso. |
| Animación antes/después como único comparador | Descartada por carga de memoria. Se explicita la diferencia y se preservan valores de ambos extremos. |
| Más datos de clima o censo | Aplazados: requieren resolver escalas espaciales/temporales y confusores antes de usarlos como explicación. |

## Codificaciones

- **Atlas:** x = hora de semana ordenada lunes–domingo; y = complejo en orden elegido; color = peso de la celda (%) o diferencia (pp). Escala común y saturación declarada, valores exactos en tooltip. Vista ampliada conserva todas las filas mediante desplazamiento virtual.
- **Huella:** ángulo = hora; anillo = día; color = misma medida y escala del atlas. Equivalente matricial disponible. No se interpreta el área de sectores.
- **Geografía:** posición = coordenada real; puntos de igual tamaño; color = una medida seleccionada. Se distinguen cambio de forma, peso AM, fin de semana e índice de volumen.
- **Trayectorias:** x = peso AM de lunes–viernes; y = peso de fin de semana en semana comparable; línea = secuencia de años; color = sistema, grupo o complejos seleccionados. Enfoque cambia dominios con ejes visibles; contexto permite ver todas las estaciones.
- **Comparador:** x = hora del día; y = porcentaje semanal sumado en esa hora de lunes a domingo; escala compartida; referencia 2020 y selección actual, con pocas estaciones fijadas.

## Interacción y continuidad

El año, filtros, grupo, selección y comparaciones son un único estado. La URL conserva la exploración. El brush crea un conjunto de IDs que viaja entre vistas. Buscar similares recupera una estación y sus 12 vecinos; no borra la estación investigada. Guardar y exportar permiten llevar una lectura a discusión. La evidencia usa exactamente las medidas del grupo visible.

Las ventanas y drawers son detalles de interacción, elegidos cuando ayudan a mantener contexto. El diseño no presupone que usar pop-ups aumente la calidad.

## Criterios visuales

Jerarquía tipográfica sobria, color funcional, escalas explícitas, unidades visibles, regiones y períodos nombrados, pocos trazos destacados y alternativas de lectura. Se usa D3 como herramienta principal, con Canvas para la matriz de alta densidad y SVG para geometría, curvas, glyphs, ejes y selección.

El aporte es una composición e interacción diseñadas para este problema. No se afirma haber inventado una técnica académica inédita ni haber alcanzado ya la efectividad de FINO.
