# Capa «Tramos»: mapa troceado y wavelets de grafo (12 de noviembre)

Responde a dos indicaciones del profesor: trocear el mapa en tramos de estación a estación, y revisar *ManyWaves* (Valdrighi, Garcia-Zanabria, Diaz, Nonato, Ferreira y Poco, Computer Graphics Forum 2026) para tomar sus vistas. La capa es nueva; no cambia las curvas OD ni el agrupamiento RAEB.

## Qué se ve

En el panel del mapa, el interruptor **Curvas OD | Tramos** cambia de capa.

| Vista | Qué codifica | Equivalente en ManyWaves |
|---|---|---|
| Mapa troceado | Cada tramo entre dos estaciones es una marca. Color y ancho: carga del sentido elegido en la hora del slider, o su coeficiente de cambio, o su zona geográfica | Map View (6.1) |
| Cambios bruscos por hora | Una fila por sentido y año, 168 columnas. Intensidad: promedio entre tramos del coeficiente wavelet de alta frecuencia | Heatmap of Changes |
| Series de la semana | Carga de los tramos seleccionados en los dos sentidos, sobre la banda mínimo–máximo de toda la red | Time Series View |
| Proyección | Un punto por tramo. Cerca = cambian a las mismas horas. Color: posición geográfica | Wavelet Encoding |

Enlaces: clic en una celda de la matriz lleva el mapa a ese año, sentido y hora y selecciona los tramos cuyo coeficiente supera el umbral τ; Mayús + clic cruza con otra celda (intersección). Clic en un tramo o en un punto lo añade a la selección; arrastrar en la proyección selecciona un grupo. La selección se resalta en las cuatro vistas.

No se incluyó la tabla de correlaciones del artículo: con dos variables es un solo número (r ≈ 0,73 entre los dos sentidos en los cuatro años; queda en `corr` del archivo de datos).

## Datos

- **Ubicación:** los 549 tramos de la red de referencia (547 ferroviarios y 2 transbordos a pie), ya presentes en `atlas/data/flows.json`. No se descargó nada nuevo.
- **Grafo espacial:** dos tramos son vecinos si comparten una estación (grado medio 4,7; máximo 17).
- **Tiempo:** las 168 horas de la semana representativa de cada año (2021–2024).
- **Variables:** carga en el *sentido de la mañana* y en el *sentido contrario*. El sentido de la mañana de un tramo es el que lleva más carga de lunes a viernes entre 6 y 10 h, sumando los cuatro años. Así las dos variables significan lo mismo en toda la red.

## Método

`deliveries/week12/scripts/build_segment_waves.py` lee `flows.json` y escribe `atlas/data/segment_waves.json` (1,1 MB) y su copia en `deliveries/week12/atlas/data/`. Tarda cerca de un minuto. Requiere `numpy` y `umap-learn`.

1. **Grafo espacio-temporal (4.1 del artículo).** Una copia del grafo por hora; cada tramo se une a sí mismo y a sus vecinos en la hora anterior y siguiente. 92.232 nodos por año.
2. **Transformada wavelet de grafo (4.2).** Laplaciano L = D − A, kernel spline cúbico de Hammond et al. y 4 escalas logarítmicas (0,669; 0,196; 0,057; 0,017, con λmax = 59,77). Se aplica por separado a cada variable y año. El coeficiente de alta frecuencia es el de la escala menor.
3. **Normalización (5.2).** Valor absoluto, división por el rango intercuartílico, log(1 + w) y división por el máximo. Resultado entre 0 y 1.
4. **Heatmap of Changes (6.1).** Promedio por hora de los coeficientes normalizados, descartando los menores que 10⁻³.
5. **Proyección (5.3).** AlignedUMAP sobre los 336 coeficientes de alta frecuencia de cada tramo (168 por variable).

### Diferencias con el artículo

| Artículo | Aquí | Motivo |
|---|---|---|
| Fechas consecutivas | Semana promedio cíclica (domingo 23 h se une a lunes 0 h) | Los datos son promedios de doce meses por día y hora, no fechas. Un «evento» aquí es un cambio brusco de la semana tipo, no un incidente de un día |
| GWT aproximada con PyGSP | GWT exacta | El tiempo cíclico se diagonaliza con una DFT y queda un problema propio de 549×549 por frecuencia temporal |
| Normalización por conjunto de datos | Los cuatro años juntos | Para comparar años en la misma escala |
| Escalado robusto con IQR | \|w\| / IQR, sin restar la mediana | El artículo no detalla el centrado; así el cero sigue siendo cero |
| Autoencoder convolucional + t-SNE | AlignedUMAP con métrica coseno | Ver abajo |
| Tabla de correlación, 6 a 9 variables | 2 variables, sin tabla | Solo hay carga por sentido |

### Por qué AlignedUMAP y no UMAP

Son los mismos 549 tramos en cuatro años. UMAP por separado da cuatro mapas sin relación entre sí, y un solo UMAP con los cuatro años juntos pega los cuatro puntos de cada tramo entre sí en vez de agrupar tramos parecidos. AlignedUMAP calcula una proyección por año y ancla cada tramo a su posición del año vecino, de modo que al cambiar de año los puntos se desplazan poco y el desplazamiento se puede leer. Parámetros: 15 vecinos, `min_dist` 0,15, regularización 0,01, ventana 2, semilla 42. Dos ejecuciones dan el mismo archivo.

Métrica coseno: con distancia euclídea la proyección se reduce a un arco ordenado por magnitud del coeficiente, que ya se ve en el mapa. Con coseno, dos tramos quedan cerca si cambian a las mismas horas y en el mismo sentido; el tamaño del punto conserva la magnitud.

Se sustituye el autoencoder porque con 549 tramos no hay datos para entrenar una red de forma fiable y el resultado no sería reproducible sin fijar más hiperparámetros. Es una simplificación, no una mejora del artículo.

## Cómo leer el coeficiente

Un coeficiente alto significa que la carga del tramo difiere de la de sus tramos vecinos y de la hora anterior y siguiente. Con estos datos pesa más la diferencia en el espacio: el 70 % de la varianza del coeficiente la explica el promedio de cada tramo. Por eso los tramos que llegan a grandes complejos (Times Sq, Union Sq, Atlantic Av) y los expresos destacan a casi toda hora, y la componente temporal aparece como intensificación en las horas punta.

Lo que sí muestra la matriz:
- El sentido de la mañana tiene su máximo de lunes a viernes a las 7–8 h; el contrario, a las 17 h.
- El fin de semana no tiene picos: el cambio es bajo y parejo durante el día.
- El cambio promedio sube de 2021 a 2024 en los dos sentidos (0,093 → 0,113 en el de la mañana), en línea con el aumento de viajes.

Se probó aplicar la transformada a √carga y a log(1 + carga). Se descartó: el coeficiente casi deja de variar en el tiempo (85 % y 96 % de la varianza explicada por el promedio del tramo) y la matriz queda plana.

## Límites

- Las cargas por tramo vienen de asignar el OD estimado al camino más corto sobre la red GTFS de referencia. No son conteos observados por tramo.
- La proyección no es un agrupamiento: sirve para proponer grupos que luego se revisan en el mapa y en las series.
- El filtro de borough y la búsqueda dejan en gris los tramos sin ninguna estación en el grupo activo; no recalculan las wavelets.
- La vista pinta un sentido a la vez. El tooltip muestra los dos.

## Pruebas

`python3 deliveries/week12/tests/test_segment_waves.py` comprueba:
- las cuatro escalas contra la descomposición propia densa en un grafo de prueba (error < 10⁻⁸);
- en la red real, que la banda de alta frecuencia es exactamente L²f/λmax², con el Laplaciano escrito arista por arista;
- el sentido de la mañana, la conservación de la carga total y la normalización 0–1;
- que `segment_waves.json` corresponde a `flows.json` (SHA-256) y a este cálculo.

La interacción se revisó en navegador: cambio de capa, slider de hora, cambio de año, clic y Mayús + clic en la matriz, selección por arrastre en la proyección y clic en tramos.
