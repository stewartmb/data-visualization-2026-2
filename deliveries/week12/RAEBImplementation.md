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
| Interacción | Worker cancelable y WebGL2 | Vista previa GPU continua; resultado final interpolado en90 ms; geometría GTFS completa en f=1 |

Esto es una **adaptación ferroviaria implementada de los componentes de RAEB**, no una reproducción idéntica de los experimentos ni del ejecutable original. La dirección no participa en el campo de agrupamiento; se conserva en las entidades OD y al resaltar los salientes de un origen. En f=0 se resuelven una vez las curvas O→D y D→O equivalentes, sumando pesos; después se expanden todas las entidades dirigidas. No hay muestreo de pares.

La barra de agrupación multiplica el radio estimado, y b=0 desactiva advección. La de fidelidad controla cuánta referencia conserva la semilla y el campo guía: f=0 produce haces libres que pueden cruzar el agua; f=1 muestra los shapes completos. La geometría libre es abstracción visual y nunca se devuelve al grafo como infraestructura.

La guía de enlaces conservados se dibuja inmediatamente en SVG. El worker entrega primero una semilla del nivel elegido y después su refinamiento; no se interpola una maraña libre para simular alta fidelidad. Las curvas libres conservan WebGL. La vista previa no equivale a una solución convergida y el estado lo indica. El zoom transforma la cámara y las capas SVG: no recalcula KDE ni OD. Durante el movimiento se reduce el muestreo de dibujo a8 vértices y se recuperan32 al estabilizarse; los datos y la solución no cambian.

Densidad visual: opacidad `1−exp(−q/800)` por OD; la superposición es cualitativa, con saturación y cuantización del framebuffer. En f=1 se agrega la carga de enlaces coincidentes sobre su geometría completa. Nodos: área proporcional a viajes iniciados, con radio mínimo1,8px para valores positivos pequeños y1,6px para cero; la escala superior fija corresponde a13px. No confundir tamaño mínimo con volumen observado.

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

La equivalencia completa con el artículo no está validada. Los tests actuales verifican datos y componentes. El NMI se calcula sobre curvas completas, mientras la pantalla combina curvas atenuadas por retención y enlaces SVG completos; ambas imágenes deben unificarse antes de tratar esa convergencia como validación del resultado visible. El anclaje directo de muestras y la composición SVG son extensiones propias. Los tiempos de caché, preparación y solver no son intercambiables.


## Avance WebGPU incluido en esta rama

Los módulos `raeb-webgpu.mjs` y `raeb-gpu-shaders.mjs`, presentes en ambas copias de la aplicación, son trabajo en desarrollo. Todavía no están importados por `raeb-overlay.mjs`: la interfaz publicada en esta revisión continúa calculando el agrupamiento en un worker de CPU y dibujando las curvas con WebGL2. No se declara una aceleración WebGPU activa.

El avance incluye kernels de densidad, advección, suavizado y raster óptico, además de gestión de buffers y estadísticas en GPU. Quedan pendientes su integración con el worker y el overlay, compilación WGSL en el navegador, comparación numérica CPU/GPU y medición con el conjunto completo. La comprobación previa de disponibilidad WebGPU del equipo no valida estos kernels. La unificación del raster visible y el utilizado para NMI sigue pendiente en la aplicación activa.

Esta rama incluye las 672 matrices OD procesadas, el grafo de referencia, los agregados y scripts reproducibles para que otra copia pueda ejecutar la interfaz sin descargar nuevamente los originales. Las descargas crudas permanecen excluidas de Git.
