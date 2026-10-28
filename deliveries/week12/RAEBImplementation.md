# RAEB ferroviario: método, reproducción y límites

Actualizado el 28 de octubre de 2026. Fuente primaria: Zeng, Shen, Jiang y Telea, *Route-Aware Edge Bundling for Visualizing Origin-Destination Trails in Urban Traffic*, EuroVis 2019, [PDF](https://zeng-wei.com/publication/papers/2019_RAEB.pdf).

## Qué utiliza la interfaz

Los doce meses de 2021, 2022, 2023 y 2024, procedentes de los cuatro datasets MTA identificados en `ODData.md`. La adquisición previa validada contiene 446.399.011 registros. Los originales se mantienen fuera de Git. La interfaz consume agregados y una matriz de la cohorte activa; no carga todos esos registros ni los 283 MB de matrices a la vez.

Para cada mes y tipo de día, `a` es `estimated_average_ridership`; `n` es el número de ese día en el mes. El promedio anual comparable es `q = Σ(n × a)/Σ n`. No se promedian indiscriminadamente doce promedios mensuales. La ausencia de un par dentro de un mes validado completo se considera cero; un mes faltante provoca rechazo. Se conserva el detalle de procedencia en `flows.json.meta` y SHA-256 por artefacto en `data/raeb/manifest.json`.

La referencia GTFS 2026 contiene 424 complejos y 549 enlaces: 547 ferroviarios y 2 transferencias peatonales explícitas. Se recortan shapes entre paradas consecutivas, con control monótono y tolerancia máxima de 250 m. No se crean enlaces por cercanía. La asignación es distancia mínima sobre adyacencias dirigidas, en una unión estática de patrones con plataformas colapsadas: no comprueba horarios ni compatibilidad de servicios, ni reconstruye servicio histórico. No son recorridos observados.

El balance semanal de 2023 incluye 0,133315 viajes representativos no mapeados; queda registrado, no absorbido por los haces. Los otros tres años tienen balance completamente asignado. El volumen de origen conserva sus cantidades disponibles antes de normalizar las 168 celdas. No interpretar la carga como ocupación o congestión.

## Correspondencia con RAEB

| Parte | Implementación | Adaptación explícita |
|---|---|---|
| §4.3, jerarquía | Importancia 0,3 longitud + 0,1 clase + 0,6 flujo; niveles 5/10/20/40/100 % | Cada enlace GTFS es una ruta de referencia; clase=1; importancia estable con todos los años |
| §4.4, abstracción | Conservar segmentos seleccionados y conectar huecos por cuerdas | `p_ra=5f`, interpolación entre niveles |
| §5.1, kernel | Fréchet discreto, DBSCAN ε=5 px/minNum=8, mitad de distancia media del mayor grupo | Raster reducido; pool mínimo16 y fallback declarado cuando DBSCAN no encuentra grupo; radio acotado |
| §3.1, KDEEB | Kernel radial Epanechnikov, advección, suavizado laplaciano; λ=0,9 | Raster de 192–320 columnas; 32 muestras fijas; ponderación por demanda agregada |
| §5.2, guía | Densidad reforzada en los segmentos conservados, θ=1,1 maxρ | Membresía continua al interpolar jerarquías |
| §6.1, estabilidad | NMI de imágenes de curvas sucesivas; umbral0,8 | Raster reducido, máximo48 iteraciones; reportar `converged=false` si no llega |
| §6.2, desviación | Fréchet contra el camino mapeado | Muestra determinista de hasta128 curvas; diagnóstico, no error completo |
| Interacción | WebGPU para cálculo y raster; worker para preparar caminos; CPU/WebGL2 como respaldo | Caché de dos resultados por cohorte; geometría GTFS completa en f=1 |

Esto es una **adaptación ferroviaria implementada de los componentes de RAEB**, no una reproducción idéntica de los experimentos ni del ejecutable original. La dirección no participa en el campo de agrupamiento; se conserva en las entidades OD y al resaltar los salientes de un origen. En f=0 se resuelven una vez las curvas O→D y D→O equivalentes, sumando pesos; después se expanden todas las entidades dirigidas. No hay muestreo de pares.

La barra de agrupación multiplica el radio estimado, y b=0 desactiva advección. La de fidelidad controla cuánta referencia conserva la semilla y el campo guía: f=0 produce haces libres que pueden cruzar el agua; f=1 muestra los shapes completos. La geometría libre es abstracción visual y nunca se devuelve al grafo como infraestructura.

En el respaldo CPU, la guía de enlaces conservados se dibuja en SVG. El worker entrega primero una semilla del nivel elegido y después su refinamiento; no se interpola una maraña libre para simular alta fidelidad. Las curvas libres conservan WebGL. La vista previa no equivale a una solución convergida y el estado lo indica. El zoom transforma la cámara y las capas SVG: no recalcula KDE ni OD. Durante el movimiento se reduce el muestreo de dibujo a8 vértices y se recuperan32 al estabilizarse; los datos y la solución no cambian.

Campo óptico canónico: `τ=Σ(q/800)` por píxel de trazo; en el respaldo CPU se representa por opacidad. WebGPU representa ese campo como bandas fusionadas, descritas al final de este documento. En f=1 se agrega la carga de enlaces coincidentes sobre su geometría completa. Nodos: área proporcional a viajes iniciados, con radio mínimo1,8px para valores positivos pequeños y1,6px para cero; la escala superior fija corresponde a13px. No confundir tamaño mínimo con volumen observado.

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

Abrir `/deliveries/week12/atlas/?view=map&year=2024&base=2021&layer=flows&hour=8&fidelity=0&bundling=1`. Comparar f=0, intermedio y1, b=0 y1; cambiar manualmente hora y día, seleccionar un origen y ampliar el mapa. No existe avance temporal automático. El nuevo procesamiento sincroniza los datos de raíz y Semana12; mantener también sincronizados sus módulos de interfaz.

## Corrección del 28 de octubre: fidelidad y latencia

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

Si `τ` es el peso óptico acumulado del trazo (`q/800`), el semiancho es `r = 0,5 + b × min(4; 1,25√τ)` píxeles CSS, con antialiasing. El grosor nominal máximo es 9 px. La escala es fija entre cohortes, incluye saturación y representa peso **local** acumulado, no una medición exacta de carga por corredor extraído. El naranja sigue destacando los viajes de la selección y el contexto se atenúa sin reducir su ancho por esa atenuación. Con `b=0` se conserva la representación fina anterior.

El solver, los valores OD, las semillas y el NMI canónico no cambian por este estilo. Por tanto, el NMI no es una comparación de capturas finales con bandas. La leyenda del mapa indica la escala raíz y la fusión visual. El respaldo CPU conserva su dibujo anterior.

Prueba reproducible: servir `tests/webgpu-bands.html` por HTTP. Comprueba que mayor peso produce mayor ancho, nueve aportes coincidentes equivalen exactamente a su suma, la opacidad central queda acotada, `b=0` conserva un píxel y la selección es naranja. Resultado observado: anchos de 5 y 9 píxeles en el fixture, 1 píxel sin agrupación y alfa central máximo 0,8196. La prueba CPU/GPU de una iteración continúa pasando. Comprobación visual adicional en la escena completa, zoom y fidelidad=1.


## Controles y retorno a la vista general

El estado visible del cálculo usa tres mensajes normales: `Procesando…`, `Completado` y `Completado (parcial)`. El último conserva el significado previo: finalizó el presupuesto de iteraciones sin cumplir el umbral de NMI. Los detalles técnicos quedan en el título del estado y en los atributos de diagnóstico del canvas; los errores reales siguen mostrándose como errores. Se aplica tanto a WebGPU como al respaldo CPU.

Agrupación y fidelidad geométrica ocupan filas separadas con sliders de ancho completo. `Vista general ↺` elimina el complejo seleccionado y restablece el zoom; pulsar el mismo nodo de nuevo o el fondo del mapa elimina la selección manteniendo la cámara. También se conserva Escape. La dispersión y el reloj vuelven al sujeto general, sin cambiar año, hora ni año de contraste.

En el diseño estrecho, la capa de curvas y el fondo geográfico se posicionan sobre el rectángulo real del SVG del mapa, debajo de los controles. Se comprobó que canvas y SVG comparten ubicación y tamaño después de apilar los sliders.

## Regresión del arranque gráfico

Ejecutar `node deliveries/week12/tests/backend-startup.test.mjs` desde la raíz. Usa los coordinadores reales con dispositivos gráficos controlados: WebGPU disponible sin WebGL2, respaldo diferido tras fallo GPU, mensajes de escena/selección recibidos durante el arranque, fallo de ambos motores, pérdida de dispositivo en uso y modo CPU explícito. No sustituye las pruebas numéricas de GPU ni certifica compatibilidad de todos los navegadores.
