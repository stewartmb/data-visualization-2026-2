# RAEB ferroviario: método, reproducción y límites

Actualizado el 13 de noviembre de 2026. Fuente primaria: Zeng, Shen, Jiang y Telea, *Route-Aware Edge Bundling for Visualizing Origin-Destination Trails in Urban Traffic*, EuroVis 2019, [PDF](https://zeng-wei.com/publication/papers/2019_RAEB.pdf).

## Qué utiliza la interfaz

Los doce meses de 2021, 2022, 2023 y 2024, procedentes de los cuatro datasets MTA identificados en `ODData.md`. La adquisición previa validada contiene 446.399.011 registros. Los originales se mantienen fuera de Git. La interfaz consume agregados y una matriz de la cohorte activa; no carga todos esos registros ni los 283 MB de matrices a la vez.

Para cada mes y tipo de día, `a` es `estimated_average_ridership`; `n` es el número de ese día en el mes. El promedio anual comparable es `q = Σ(n × a)/Σ n`. No se promedian indiscriminadamente doce promedios mensuales. La ausencia de un par dentro de un mes validado completo se considera cero; un mes faltante provoca rechazo. Se conserva el detalle de procedencia en `flows.json.meta` y SHA-256 por artefacto en `data/raeb/manifest.json`.

La referencia GTFS 2026 contiene **424 complejos OD, 475 paradas padre GTFS, 556 enlaces ferroviarios y 75 transbordos declarados**. Los recorridos se construyen desde las secuencias de paradas, con extremos comunes por parada padre. El máximo ajuste entre extremos proyectados en este archivo fue 0,04 m. El ruteo elige cualquier parada del complejo para salir o llegar. Para pasar entre paradas intermedias exige el enlace ferroviario o el transbordo dirigido declarado en GTFS. Cada arco ferroviario cuesta su longitud. Para un transbordo se usa el máximo de 1 m, su separación geométrica y los segundos mínimos declarados multiplicados por 8 m/s. La conversión es un supuesto del modelo y el resultado se describe en distancia equivalente cuando combina ambas partes. Se utiliza una unión fija de patrones de servicio.

El balance semanal de 2023 incluye 0,133315 viajes representativos no mapeados; queda registrado, no absorbido por los haces. Los otros tres años tienen balance completamente asignado. El volumen de origen conserva sus cantidades disponibles antes de normalizar las 168 celdas. No interpretar la carga como ocupación o congestión.

## Mapa principal con RAEB

El mapa abre con `raeb=paper`, fidelidad 5 y radio cero, mostrando las cargas asignadas sobre la vía. `raeb=atlas` abre el agrupamiento anterior desde el enlace bajo los controles. El selector discreto `p_ra` va de 0 (semillas rectas y agrupamiento libre) a 5 (toda la red guía el agrupamiento). RAEB conserva los extremos de cada curva y modifica la densidad sobre los tramos de la jerarquía seleccionada. Con radio 0 muestra las semillas. En nivel 5 y radio 0 suma la demanda asignada por tramo y la dibuja sobre la geometría GTFS.

Grosor y una escala secuencial petróleo muestran la demanda estimada. Al seleccionar un complejo, el grosor de las ramas muestra las salidas que comparten un tramo y el tamaño de cada destino muestra sus viajes. La vista anual usa una escala por hora/origen en el detalle y una escala común de hasta 17.000 en la vista general. Los círculos opcionales de afluencia muestran salidas más viajes que terminan allí, clasificados por la hora de entrada del viaje. La app conserva el remuestreo de 32 puntos por par ponderado, la cuadrícula de cálculo reducida, WebGPU con respaldo CPU y un tope operativo de 150 iteraciones. El paper utiliza sus propias trayectorias, resolución y muestreo.

## Lectura de escenarios

- **Explorar un haz** inspecciona las curvas calculadas cerca del punto señalado fuera de la red. Muestra la demanda OD que contribuye y la distancia asignada frente a la directa para el par con mayor aporte.
- **Probar enlace hipotético** añade un arco bidireccional de longitud geodésica entre dos paradas existentes. Compara costo y cargas con demanda fija. El modelo no incorpora capacidad, horarios, costos de obra ni cambios de demanda.
- **Dependencia de la red** elimina las paradas del complejo seleccionado para estimar pérdida de acceso, aislamiento y desvíos. «Cierre» significa interrupción de las paradas y los arcos incidentes. No simula un tren que pasa sin detenerse.
- Los minimapas muestran diferencias por tramo frente al año abierto en el mapa principal. En modo Comparar, la referencia pasa a ser el año elegido como A. La escala se comparte entre los minimapas y se ajusta a la franja y referencia activas. La comparación principal aplica una escala fija en la vista general. Los filtros territoriales y de búsqueda acotan los viajes por origen en el mapa principal, en RAEB y en los minimapas. Los tramos y destinos pueden quedar fuera del área de origen.

Para reproducir la reasignación sin repetir la adquisición ni la agregación horaria, ejecutar desde la raíz:

```sh
python3 deliveries/week12/scripts/prepare_raeb.py --reroute-existing
python3 deliveries/week12/scripts/sync_live_atlas.py
node deliveries/week12/tests/validate-raeb-data.mjs
```

## Jerarquía y niveles de fidelidad

La [§4.3 del paper](https://zeng-wei.com/publication/papers/2019_RAEB.pdf#page=5) calcula el puntaje de cada vía como `0,30 × longitud relativa + 0,10 × categoría vial + 0,60 × flujo relativo`. La longitud se divide por la de la vía más larga y el flujo asignado por el mayor flujo de la red. La categoría de OpenStreetMap aporta 1, 0,75, 0,5 o 0,25 según el tipo de vía. Los autores eligieron los pesos experimentalmente. Ordenaron las vías por puntaje descendente y fijaron los cortes acumulados del 5, 10, 20, 40 y 100 %. El artículo presenta los cortes como una elección práctica y no especifica un cálculo para derivarlos.

En el Atlas el ranking usa los enlaces ferroviarios del grafo GTFS. Los transbordos intervienen en la continuidad del recorrido y quedan fuera de la guía ferroviaria. La categoría vale 1 para todos los enlaces, por lo que su aporte de 0,10 es constante y el orden depende de la longitud y del flujo. Para la franja seleccionada, el flujo de cada enlace suma el peso OD de los caminos asignados que lo recorren, en ambos sentidos. Al cambiar de franja puede cambiar qué enlaces entran en el grupo, aunque la cantidad seleccionada siga siendo la misma.

| Nivel | Porcentaje acumulado del ranking | Enlaces que guían el agrupamiento |
|---:|---:|---:|
| 0 | 0 % | 0 |
| 1 | 5 % | 28 |
| 2 | 10 % | 56 |
| 3 | 20 % | 112 |
| 4 | 40 % | 223 |
| 5 | 100 % | 556 |

La app redondea hacia arriba el producto del porcentaje por los 556 enlaces ferroviarios. En el nivel 4, el trazado inicial conserva la geometría de los enlaces seleccionados y une con rectas los huecos del recorrido. En el 5, los **333 enlaces adicionales** aportan su geometría al trazado inicial y a la guía de densidad. Con radio positivo, las curvas todavía se desplazan al agruparse. El caso «Sobre la vía» con nivel 5 y radio cero es una decisión del Atlas. La [figura 11 del paper](https://zeng-wei.com/publication/papers/2019_RAEB.pdf#page=10) compara 0, 1, 3 y 5 para taxis en Manhattan, por lo que no muestra directamente la transición 4 → 5. [Implementación de jerarquía, trazado inicial y guía](atlas/src/raeb-core.mjs)

## Calibración del radio para el subway

1. Usar el ranking de enlaces de la franja, calculado según la jerarquía anterior.
2. Comparar las polilíneas completas mediante Fréchet discreta. Para cada par se usa el menor valor entre los dos sentidos de digitalización, ya que el objeto comparado es el enlace físico. Las coordenadas métricas usan Mercator local con escala en la latitud 40,7° N.
3. Ejecutar DBSCAN con un mínimo de ocho rutas y una vecindad de **1.000 m**. Ese valor equivale a cinco unidades de 200 m, una escala cercana a la de cinco celdas de cálculo en el encuadre de referencia del Atlas. Es una elección de calibración ferroviaria. Se prueba el 1 % del paper y, cuando ese conjunto es insuficiente, se amplía a 5, 10, 20, 40 y 100 %. Se usa el primer conjunto que produce un grupo.
4. Tomar el grupo con más enlaces y calcular la mitad de la distancia media de Fréchet entre sus pares. El cálculo ocurre en metros y el solver lo convierte a celdas. Si una franja futura carece de grupo, la interfaz informa que falta una referencia automática y deja el radio en cero.

| Franja representativa | Candidatos | Mayor grupo | Radio inicial |
|---|---:|---:|---:|
| 2024 · lunes · 8 a. m. | 56 | 14 | 660,61 m |
| 2024 · lunes · 5 p. m. | 56 | 12 | 629,96 m |
| 2024 · domingo · 8 a. m. | 56 | 12 | 629,96 m |
| 2021 · lunes · 8 a. m. | 56 | 10 | 531,15 m |

La comprobación de las 672 franjas de 2021–2024 encontró un grupo en cada una. El radio automático varió de **392,69 m a 878,08 m**. La estimación de cada franja es el máximo del deslizador. **Automático** aplica ese valor. Puedes reducirlo hasta cero o fijar un radio manual en metros. Si otra franja tiene un máximo menor que el radio manual, el control baja a ese máximo. La regla bajo el minimapa cambia con el zoom y el círculo usa la misma escala. El radio representa distancia en línea recta en la primera iteración. En las siguientes se reduce por un factor de 0,9.

Reproducción del valor inicial y verificación de las franjas desde la raíz:

```sh
node deliveries/week12/tests/validate-raeb-data.mjs
```

## Correspondencia con RAEB

| Parte | Implementación | Adaptación explícita |
|---|---|---|
| §4.3, jerarquía | Importancia 0,3 longitud + 0,1 clase + 0,6 flujo; niveles 5/10/20/40/100 % | Cada enlace GTFS es una ruta de referencia con clase 1. En el mapa principal se ordena con el flujo de la franja |
| §4.4, abstracción | Conservar segmentos seleccionados y conectar huecos por cuerdas | Selector discreto 0–5 en el mapa principal. La vista anterior interpola entre niveles |
| §5.1, kernel | Fréchet discreta, DBSCAN con ocho rutas y mitad de la distancia media del mayor grupo | Vecindad métrica de 1 km y ampliación por niveles de la muestra cuando el 1 % resulta insuficiente |
| §3.1, KDEEB | Kernel radial Epanechnikov, advección, suavizado laplaciano; λ=0,9 | Raster de 192–320 columnas; 32 muestras fijas; ponderación por demanda agregada |
| §5.2, guía | Densidad reforzada en los segmentos conservados, θ=1,1 maxρ | La vista anterior usa membresía continua al interpolar jerarquías |
| §6.1, estabilidad | NMI de imágenes de curvas sucesivas con umbral 0,8 | Raster reducido. Tope de 150 iteraciones en RAEB y 48 en la vista anterior |
| §6.2, desviación | Fréchet contra el camino mapeado | Muestra determinista de hasta128 curvas; diagnóstico, no error completo |
| Interacción | WebGPU para cálculo y raster; worker para preparar caminos; CPU/WebGL2 como respaldo | Caché de dos resultados por cohorte. Geometría GTFS completa con nivel 5 y radio 0 |

La **adaptación ferroviaria** aplica estos componentes de RAEB a datos OD estimados y a la red GTFS. La dirección no participa en el campo de agrupamiento; se conserva en las entidades OD y al resaltar los salientes de un origen. En el respaldo CPU de la vista anterior, con f=0 y agrupación al máximo, las curvas O→D y D→O equivalentes se resuelven una vez sumando sus pesos. Después se reconstruyen todas las entidades dirigidas.

En la vista anterior (`raeb=atlas`), la barra de agrupación multiplica el radio estimado, y b=0 desactiva advección. La de fidelidad controla cuánta referencia conserva la semilla y el campo guía: f=0 produce haces libres que pueden cruzar el agua; f=1 muestra los shapes completos. La geometría libre es abstracción visual y nunca se devuelve al grafo como infraestructura.

En el respaldo CPU, la guía de enlaces conservados se dibuja en SVG. El worker entrega primero una semilla del nivel elegido y después su refinamiento; no se interpola una maraña libre para simular alta fidelidad. Las curvas libres conservan WebGL. La vista previa no equivale a una solución convergida y el estado lo indica. El zoom transforma la cámara y las capas SVG: no recalcula KDE ni OD. Durante el movimiento se reduce el muestreo de dibujo a8 vértices y se recuperan32 al estabilizarse; los datos y la solución no cambian.

Campo óptico canónico `τ=Σ(q/800)` por píxel de trazo. WebGPU estiliza la densidad acumulada localmente con grosor e intensidad. WebGL2 colorea cada curva y puede mostrar un solapamiento distinto. La imagen de convergencia NMI conserva la transferencia óptica original. Sobre la vía, el SVG dibuja una marca por tramo ferroviario, con ancho entre 0,85 y 4 píxeles y escala de raíz cuadrada. En la vista general el máximo fijo es 17.000 viajes. El detalle por origen usa la proporción de todas sus salidas en la franja. Los minimapas usan una escala divergente compartida por franja y referencia. El área de los puntos de afluencia usa salidas más llegadas según hora de inicio, con tope de radio de 13 px. Los puntos de destino utilizan su propia escala dentro de la selección.

## Reproducir

```sh
python3 -m venv .venv
.venv/bin/pip install -r deliveries/week12/requirements-data.txt
# Primero adquirir y validar los 48 meses mediante los scripts de OD existentes.
.venv/bin/python deliveries/week12/scripts/prepare_raeb.py
# Para reutilizar una adquisición validada en otra copia:
.venv/bin/python deliveries/week12/scripts/prepare_raeb.py --source-package /ruta/copia/deliveries/week12
node deliveries/week12/tests/raeb-core.test.mjs
node deliveries/week12/tests/validate-raeb-data.mjs
python3 -m http.server 8774
```

Abrir `/deliveries/week12/atlas/?raeb=paper&year=2024&layer=flows&day=0&hour=8&pra=3`. Comparar niveles 0, 3 y 5, radio automático, manual y 0. Cambiar la hora y acercar el mapa para comprobar la regla. No existe avance temporal automático. El nuevo procesamiento sincroniza los datos de raíz y Semana12; mantener también sincronizados sus módulos de interfaz.

## Corrección del 28 de octubre: fidelidad y latencia

Esta sección y la de WebGPU del 28 de octubre documentan la implementación anterior, hoy disponible como `raeb=atlas`. El mapa principal `raeb=paper` usa la jerarquía discreta y el trazado descritos arriba.

Se corrigieron dos fallos: cada nivel se remuestreaba por su propia longitud y la advección podía alejar incluso los tramos conservados. Ahora los niveles comparten el parámetro de longitud del recorrido original. Las muestras conservadas quedan vinculadas a la referencia; para membresía parcial, el anclaje es gradual y el paso se limita a0,45píxeles del raster. Es una estabilización adicional de esta adaptación, no una propiedad atribuida al algoritmo publicado.

Los enlaces conservados se representan sobre sus shapes completos con carga agregada; el shader representa la fracción no conservada de cada muestra. La suma de los pesos analíticos OD y las métricas sigue intacta. La transferencia óptica es `1−exp(−q/800)`, fija entre horas y años, y reemplaza la escala anterior /200 que saturaba el mapa.

Ya no se calcula un haz libre inicial antes del nivel pedido. Se procesa solamente la última petición vigente y se guardan los dos últimos resultados por cohorte y tamaño de viewport; cambiar de cohorte limpia esa caché. El estado termina también cuando se reutiliza un resultado. Una primera carga libre todavía requiere calcular el campo KDE; no se promete latencia constante ni tiempo real estricto.

La convergencia se compara desde la imagen inicial; se retiró la espera mínima artificial de cuatro iteraciones. El cálculo puede terminar tras la primera actualización si satisface NMI≥0,8. La primera carga incluye decodificación y preparación de geometrías y puede tardar varios segundos aunque el solver guiado termine antes.

## Estado de la auditoría de fidelidad

La equivalencia completa con el artículo no está validada. Los tests actuales verifican datos y componentes. En el respaldo CPU, el NMI se calcula sobre curvas completas y su pantalla combina curvas atenuadas con enlaces SVG; esa limitación permanece en dicho respaldo. El backend WebGPU usa un rasterizador óptico compartido para dibujo y NMI, a resoluciones diferentes y sin el resaltado de selección en la medición. El anclaje directo de muestras y la composición SVG son extensiones propias. Los tiempos de caché, preparación y solver no son intercambiables.


## WebGPU activo: integración del 28 de octubre

La aplicación intenta WebGPU al iniciar. El worker conserva la descarga/decodificación, la asignación a caminos ya preparados, la jerarquía y sus semillas. La GPU realiza splatting, convolución radial Epanechnikov, refuerzo de la guía, advección, suavizado, rasterización y cálculo de NMI. Se conservan D3 para cámara, nodos, selección, dispersión y reloj. No existe reproducción temporal automática.

`raeb-overlay.mjs` coordina el backend GPU y `raeb-cpu-overlay.mjs` conserva el respaldo CPU/WebGL2. Primero se inicializa WebGPU, sin crear un renderer WebGL2. Solo si falla esa inicialización o se informa un error/pérdida de dispositivo se construye el respaldo. Los mensajes del worker esperan la elección del backend, incluidas la escena y la selección. Si ambos motores fallan, se detiene el worker y se conserva un error explícito en el estado del mapa. `compute=cpu` permite probar el respaldo directamente en la URL inicial. El backend activo se registra en el atributo de diagnóstico `data-backend` del canvas; el estado visible normal conserva los tres mensajes documentados abajo.

Los puntos permanecen en buffers GPU; durante el solver se leen únicamente 16 bytes de estadísticas por iteración. Las lecturas completas de `readBuffer` están reservadas al test pequeño. La densidad y opacidad se acumulan en punto fijo con dos enteros de 32 bits y escala 65536: evita requerir atómicos de coma flotante, con cuantización explícita de 1/65536. Cada buffer respeta el límite del dispositivo. Se guardan dos poses finales por cohorte en GPU.

La estabilidad GPU compara imágenes canónicas de curvas atenuadas más enlaces GTFS retenidos. El mapa utiliza ese mismo campo óptico y después aplica un estilo de bandas; el NMI se mide antes de ese estilo para conservar el resultado del solver. El análisis usa el raster reducido del solver y omite la selección; el dibujo usa la resolución de pantalla y la cámara. Esta corrección cambia el criterio respecto al respaldo CPU anterior: sus tiempos no son un benchmark de algoritmos numéricamente idénticos. La adaptación y el anclaje adicionales respecto al paper siguen vigentes.

### Comprobaciones realizadas

- `tests/webgpu.html`, servido por HTTP, compila todos los pipelines y compara una iteración con CPU en un fixture determinista: f=0/b=1, f=0,6/b=0,65, f=1/b=1 y f=0/b=0. Máximo error observado: 0,001526 píxeles CSS; extremos fijos y coincidencia exacta de los dos casos sin movimiento. Recalcula NMI en CPU sobre las imágenes GPU para comprobar el histograma y la reducción, con tolerancia 0,0001. No constituye paridad exhaustiva del dataset completo.
- Navegador del equipo Apple M2 Pro: escena 2024/lunes/08h, 143.855 relaciones, 32 muestras por relación, f=0/b=1: 37 iteraciones, NMI=0,806786, solver 1.059,9 ms y carga/preparación/solver 3.238,3 ms en una ejecución. Antes se observó 997,4 ms de solver. f=0,91/b=1: 42,5 ms, una iteración. Son mediciones puntuales de tiempo de pared; no garantizan latencia universal.
- Cambio manual a 09h, selección de Kew Gardens-Union Tpke, zoom y cambios rápidos de parámetros: comprobación de interfaz con backend GPU activo. Respaldo `compute=cpu` completó la misma cohorte de 08h. Las pruebas del núcleo y de la dispersión siguen pasando.

### Límites pendientes

Falta una auditoría numérica de múltiples iteraciones y de todas las cohortes, pruebas de pérdida real del dispositivo y de otros navegadores/equipos, y un benchmark con criterio de parada idéntico. Preparar una cohorte o un nivel de jerarquía por primera vez todavía cuesta CPU; no se promete una transición instantánea de primera carga. No se modificaron OD ni caminos de referencia.


## Bandas continuas en lugar de sobredibujo de líneas

Cambio de presentación en WebGPU: los centros de los trazos mantienen su geometría y pesos. La pasada final obtiene una envolvente alrededor del campo óptico acumulado, uniendo visualmente trazos próximos. Para cada píxel toma la máxima cobertura de las bandas vecinas, en lugar de acumular de nuevo sus opacidades. No es una extracción de un grafo simplificado ni una nueva asignación de rutas: la proximidad visual puede unir envolventes sin representar una conexión ferroviaria o un transbordo.

Si `τ` es el peso óptico acumulado del trazo (`q/800`), el semiancho es `r = 0,5 + b × min(4; 1,25√τ)` píxeles CSS, con antialiasing. El grosor nominal máximo es 9 px. La escala es fija entre cohortes, incluye saturación y representa peso **local** acumulado, no una medición exacta de carga por corredor extraído. La selección conserva solo la carga del origen elegido y aplica la misma escala de color. Con `b=0` se conserva la representación fina anterior.

El solver, los valores OD, las semillas y el NMI canónico no cambian por este estilo. Por tanto, el NMI no es una comparación de capturas finales con bandas. La leyenda muestra el gradiente y sus valores de referencia.

Prueba reproducible: servir `tests/webgpu-bands.html` por HTTP. Comprueba que mayor peso produce mayor ancho, nueve aportes coincidentes equivalen exactamente a su suma, la opacidad central queda acotada, `b=0` conserva un píxel y el foco conserva el color de volumen del origen seleccionado. Resultado observado: anchos de 5 y 9 píxeles en el fixture, 1 píxel sin agrupación y alfa central máximo 0,8196. La prueba CPU/GPU de una iteración continúa pasando. Comprobación visual adicional en la escena completa, zoom y fidelidad=1.


## Controles y retorno a la vista general

El estado visible del cálculo usa tres mensajes normales: `Procesando…`, `Completado` y `Completado (parcial)`. El último conserva el significado previo: finalizó el presupuesto de iteraciones sin cumplir el umbral de NMI. Los detalles técnicos quedan en el título del estado y en los atributos de diagnóstico del canvas; los errores reales siguen mostrándose como errores. Se aplica tanto a WebGPU como al respaldo CPU.

Agrupación y fidelidad geométrica ocupan filas separadas con sliders de ancho completo. `Vista general ↺` elimina el complejo seleccionado y restablece el zoom; pulsar el mismo nodo de nuevo o el fondo del mapa elimina la selección manteniendo la cámara. También se conserva Escape. La dispersión y el reloj vuelven al sujeto general, sin cambiar año, hora ni año de contraste.

En el diseño estrecho, la capa de curvas y el fondo geográfico se posicionan sobre el rectángulo real del SVG del mapa, debajo de los controles. Se comprobó que canvas y SVG comparten ubicación y tamaño después de apilar los sliders.

## Regresión del arranque gráfico

Ejecutar `node deliveries/week12/tests/backend-startup.test.mjs` desde la raíz. Usa los coordinadores reales con dispositivos gráficos controlados: WebGPU disponible sin WebGL2, respaldo diferido tras fallo GPU, mensajes de escena/selección recibidos durante el arranque, fallo de ambos motores, pérdida de dispositivo en uso y modo CPU explícito. No sustituye las pruebas numéricas de GPU ni certifica compatibilidad de todos los navegadores.
