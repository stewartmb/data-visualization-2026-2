# Prompt para el agente: Atlas OD con bundling restringido a la red

Trabaja en la raíz del repositorio `stewartmb/data-visualization-2026-2`. Todas las rutas siguientes son relativas a esa raíz; consulta `deliveries/week12/DataSharing.md` para obtener los archivos en otra computadora. Implementa una versión funcional del siguiente diseño, con datos reales y procesamiento reproducible. Lee primero `AGENTS.md`, `Proyecto_Final_Guia.md` —especialmente la entrega de Semana 12— y la documentación existente. Conserva el trabajo local del usuario. No hagas push ni despliegues públicos.

## 1. Objetivo y límites

Construye **un único panel integrado para explorar los ritmos y las conexiones estimadas del subway de Nueva York**. El mapa es el overview central; a su derecha conviven una dispersión volumen × forma arriba y un reloj semanal abajo. Las tres vistas comparten selección y comparación temporal. No conviertas cada tarea en una pestaña o un formulario de filtros.

Usa exclusivamente **OD MTA 2021–2024** para las magnitudes y métricas analíticas, y una red ferroviaria con geometrías para asignar caminos plausibles. El mapa base y los contornos son contexto, sin métricas territoriales externas. No incorpores la base de entradas 2019–2024, tarifas, turismo ni indicadores socioeconómicos en esta versión.

Las imágenes adjuntas son referencias de composición: mapa dominante, dispersión, reloj y minimapa. No copies sus cifras, etiquetas de años ni controles heredados. En particular, elimina cualquier dependencia de “Base 2020”, “enero–febrero” o “recuperación prepandemia”. Si las imágenes no están disponibles, esta especificación define el resultado.

Referencias a consultar:

- RAEB, Zeng et al., EuroVis 2019: https://zeng-wei.com/publication/papers/2019_RAEB.pdf
- Página de los autores: https://webspace.science.uu.nl/~telea001/InfoVis/RAEB
- Tube Heartbeat: https://misc.oomap.co.uk/tubeheartbeat.com/london/

RAEB aporta el principio de simplificar recorridos considerando la red subyacente. Tube Heartbeat inspira la exploración horaria y los nodos que cambian de tamaño. **Nuestra propuesta añade restricciones topológicas duras y bundling direccional**; no atribuyas estas extensiones al algoritmo original. Si implementas una adaptación, denomínala “bundling restringido a la red, inspirado en RAEB”. Solo afirma reproducir RAEB si realmente implementas y documentas sus componentes.

## 2. Decisiones iniciales explícitas

- Comparación inicial: **2021 → 2024**, los doce meses de cada año. Se interpreta como cambio desde un año pandémico, no como recuperación respecto a una normalidad anterior al COVID.
- Años comparables: dos selectores compactos, con base anterior al año objetivo, entre 2021 y 2024. No agregues un selector por cada vista.
- Dispersión: **un solo diagrama bivariado**, como la imagen; no una matriz SPLOM con muchas variables.
- Hora inicial: **lunes, 08:00–09:00**, como hora de inicio del viaje. Reloj y barra horaria permiten cambiarla.
- Mapa: magnitud absoluta del año objetivo. Dispersión y reloj: comparación entre los dos años. Títulos y leyendas deben indicar esta diferencia de escala temporal.
- Las métricas de dispersión describen la semana completa y permanecen fijas durante la animación horaria. La hora activa solo cambia el mapa y el indicador del reloj.
- Red de referencia constante para todos los años, para que las diferencias visuales procedan del OD y no de un cambio silencioso de red. Esto es un escenario modelado, no una reconstrucción histórica del servicio.

Estas son decisiones de diseño para avanzar. Documenta cualquier cambio necesario por una limitación comprobada.

## 3. Datos y semántica: no inventar observaciones

Consulta `deliveries/week12/ODData.md`, los diccionarios oficiales y los manifiestos. Los 48 CSV comprimidos se colocan en `deliveries/week12/data/raw/od_2021_2024/`; su manifiesto y diccionarios están en `deliveries/week12/data/od_2021_2024/`. Los originales grandes no vienen en el clone. Fuentes:

- 2021: https://data.ny.gov/d/rapa-97zv
- 2022: https://data.ny.gov/d/nqnz-e9z9
- 2023: https://data.ny.gov/d/uhf3-t34z
- 2024: https://data.ny.gov/d/jsu2-fbtj

El campo `estimated_average_ridership` es un **promedio OD estimado por MTA**, por mes, día de semana y hora de inicio. El `timestamp` es representativo: no es una fecha individual de viaje. No son trayectorias GPS ni salidas observadas por torniquete.

Separa tres niveles en el procesamiento y en la explicación al usuario:

1. OD estimado publicado por MTA.
2. Camino asignado por nuestro modelo sobre una red de referencia.
3. Curva simplificada por el algoritmo de visualización.

No llames a los segmentos “ocupación”, “congestión”, “trenes en tiempo real” o “pasajeros presentes a esa hora”. El volumen de una ruta se atribuye a la **cohorte que inicia el viaje en la hora seleccionada**, no al instante en que atraviesa cada segmento. Tampoco interpretes destinos agrupados por hora de origen como salidas ocurridas en esa hora.

Verifica el estado real de adquisición y validación; no supongas que ya terminó. La descarga tiene su propio proceso: no lo dupliques ni lo interrumpas. Desarrolla en paralelo lo independiente. Antes de publicar cifras completas, exige los controles del procesamiento OD; si faltan meses, muestra su ausencia y no rellenes con datos ficticios ni ceros. No ejecutes el validador completo sobre archivos parciales.

## 4. Red, asignación de rutas y conservación de conectividad

Ya existen:

- `deliveries/week12/data/raw/enrichments/gtfs_subway.zip`, con `shapes.txt`, `stop_times.txt`, `stops.txt`, `trips.txt`, `routes.txt`, transferencias y calendarios.
- `deliveries/week12/atlas/data/network_current.json`, un resumen de adyacencias de servicios; **no sustituye una red enrutable con geometrías**.

El snapshot disponible tiene versión `20260826-X-long-term-supplement-trip-ids`, de 2026. Confirma los metadatos. No lo presentes como GTFS histórico de 2021–2024. La interfaz debe indicar de forma discreta y visible: **“OD estimado MTA · rutas modeladas sobre red de referencia 2026”**. Si se incorpora otra red, actualiza su procedencia y significado.

Construye el grafo respetando secuencia de paradas, dirección, pertenencia a servicios y conexiones de transbordo permitidas. Conserva plataformas/servicios durante el cálculo aunque los nodos visuales sean complejos. No conectes estaciones porque estén cerca ni porque sus líneas se crucen en pantalla. Recorta las geometrías de `shapes` al tramo correcto entre paradas, con control de orden; una adyacencia express no es un segmento recto que salta sobre el territorio.

Para esta versión usa una **asignación determinista de menor tiempo programado de recorrido**, con costes de transbordo documentados y desempates estables. El tiempo de recorrido, los enlaces de transferencia y cualquier penalización adicional deben quedar separados en la configuración. No inventes frecuencias, esperas, probabilidades de elección ni calibración de preferencias. Si falta un coste necesario, utiliza un supuesto explícito y reproducible, y evalúa su sensibilidad; no lo presentes como medición.

No combines servicios incompatibles de distintos calendarios en un recorrido imposible. Define una instancia de servicio coherente del snapshot para cada tipo de día y declara cualquier simplificación. Mantén el modelo de rutas separado del motor de bundling.

Conserva los OD no asignables como categoría auditable; informa su número y peso. Los OD con origen igual a destino no deben producir viajes circulares inventados: cuentan en las métricas del origen y quedan sin carga de tramo. No fuerces el universo a 424 complejos: calcula el universo real del OD, su intersección con la red y los casos no mapeados. Ninguna exclusión silenciosa.

### Regla inviolable

**El bundling cambia la representación, nunca el grafo, los caminos asignados ni los valores.** Preserva origen, destino, orden de segmentos, sentido y cruces ferroviarios válidos de cada camino. Un cruce visual no crea una conexión ni permite cambiar de tren. Mantén identificadores de segmento y de cruces sobre/bajo el agua.

No se permiten nuevos puentes, túneles, atajos, transbordos o enlaces por proximidad. La suavización de curvas también debe cumplirlo: una spline puede inventar un cruce aunque sus puntos de control sean válidos. Si una curva no supera los controles, usa la geometría original en ese tramo.

## 5. Dos barras de 0 a 1, con semántica comprobable

Coloca dos controles compactos bajo “Agrupación de recorridos”, sin dominar el mapa. Son **parámetros propios de esta adaptación**, no dos parámetros originales de RAEB normalizados arbitrariamente.

**A. Agrupación, b ∈ [0,1], inicial 0,65.**

- 0: caminos asignados sin desplazamiento de bundling; puede haber superposición natural en tramos compartidos.
- 1: máxima agrupación visual permitida entre caminos compatibles que comparten corredor y sentido.
- No agrupar líneas paralelas distintas solo por cercanía. Los haces pueden compartir representación de un tramo, conservando la posibilidad de seguir cada conexión de extremo a extremo.

**B. Fidelidad geométrica, f ∈ [0,1], inicial 0,90.**

- 1: eje del camino sobre su geometría de referencia, sin desplazamiento lateral ni suavizado que la desvíe.
- 0: máxima simplificación/desplazamiento permitida **dentro del corredor admisible de ese camino**; sigue prohibido alterar conexiones o cruces.
- Define una tolerancia geométrica máxima `epsilon_max`, explícita y comprobada, con `epsilon(f) = (1-f) × epsilon_max`. El ancho visual del trazo no se confunde con el desplazamiento de su eje.
- Los corredores admisibles se identifican por el camino y sus segmentos, no únicamente por distancia al ferrocarril más cercano. No hagas una interpolación libre hacia una curva que pueda cortar un río.

Los dos controles nunca modifican OD, asignación de rutas ni métricas. Explica brevemente los extremos junto a las barras. Documenta la función de `b`, las unidades de `epsilon_max` y su comportamiento al hacer zoom. Si con f=1 o b=0 desaparece un efecto de desplazamiento, es correcto; informa esa dependencia sin simular un cambio inexistente.

## 6. Métricas coherentes para mapa, dispersión y reloj

Define `a[y,m,d,h,o,j]` como el promedio publicado para año, mes, día de semana, hora, origen y destino. Para combinar los doce meses:

```text
n[y,m,d] = cantidad de ocurrencias del día de semana d en ese mes
q[y,d,h,o,j] = Σ_m n[y,m,d] × a[y,m,d,h,o,j] / Σ_m n[y,m,d]
u[y,o,d,h] = Σ_j q[y,d,h,o,j]
V[y,o] = Σ_d Σ_h u[y,o,d,h]
p[y,o,d,h] = u[y,o,d,h] / V[y,o]
Volumen_relativo[o] = 100 × V[objetivo,o] / V[base,o]
TV_pp[o] = 100 × 0,5 × Σ_d,h |p[objetivo,o,d,h] - p[base,o,d,h]|
Delta_pp[o,d,h] = 100 × (p[objetivo,o,d,h] - p[base,o,d,h])
```

`V` es volumen de una **semana representativa estandarizada**, con un lunes, un martes, etc.; no el total anual. `u` es viajes iniciados por hora en un día representativo. `TV_pp` está entre 0 y 100: cuánto peso semanal se redistribuye entre las 168 celdas, sin depender de un aumento uniforme del volumen.

Antes de rellenar un OD ausente con cero, verifica y documenta la convención de publicación de MTA. La ausencia de un mes, cobertura insuficiente o dato no interpretable es faltante. Base cero implica razón indefinida; sin volumen no hay perfil normalizable. No pongas esos casos artificialmente en x=0 o y=0.

Para un grupo, suma primero las cantidades de sus orígenes y después calcula perfiles, cocientes y TV. No promedies porcentajes o distancias entre estaciones. El denominador de un origen no cambia porque se seleccionó otro destino.

La carga de un tramo dirigido es la suma de los `q` de los OD cuyos caminos asignados lo recorren, en la cohorte seleccionada. Se suma toda la demanda asignable, no solo los OD mayores. Los totales entre tramos no son totales de viajes: una misma persona puede aportar a varios segmentos.

## 7. Composición y codificación visual

Diseña para escritorio como la referencia: aproximadamente **70 % mapa / 30 % columna derecha**, ajustable para conservar legibilidad. Fondo general claro, tipografía sobria, márgenes contenidos. La columna derecha no debe ocultar el mapa al seleccionar un complejo. A 1440×900 deben verse mapa, dispersión y reloj sin recorrer una página larga.

### Mapa central: conexiones y pulso horario

- Fondo geográfico **en grises**, agua y tierra distinguibles por luminosidad; etiquetas discretas. Sin colores de calles, parques ni líneas oficiales compitiendo con las métricas.
- Red de referencia como estructura fina gris. Capa analítica de haces con un tono azul petróleo de buen contraste.
- Grosor de haces: volumen asignado al tramo/cohorte. Usa una escala explícita y fija durante la reproducción y entre los años comparados. Si necesita transformación para el rango, declárala en una leyenda con valores; no normalices por fotograma.
- Sentidos opuestos: carriles/offsets separados, con flechas legibles. No muestres solo el sentido dominante. Agrupar flujos opuestos debe quedar prohibido.
- Nodos: **área proporcional a viajes iniciados en el origen** para día y hora activos. No uses radio proporcional. Mantén hit areas cómodas y una marca neutra distinguible para valor cero; si aplicas pisos o topes de tamaño, explica la excepción y conserva el valor exacto.
- Halo y contorno indican selección. Un acento cálido resalta las conexiones salientes del origen seleccionado; la red completa sigue visible como contexto. No emplees simultáneamente color para borough, línea, cambio, volumen y selección.
- Animación: crecen/disminuyen nodos y grosores al recorrer las 24 horas. Flechas o pulsos de dirección con velocidad visual constante, sin aparentar velocidades medidas de trenes. No animes un punto por pasajero. Respeta movimiento reducido y permite pausa.
- Tooltip del tramo: orígenes/destinos asociados, sentido, valor, unidad y explicación “rutas asignadas de viajes que comienzan a esta hora”. Explica allí el modelo y la red de referencia.

### Dispersión superior derecha: volumen × forma

- Cada punto es un complejo con datos comparables; todos se conservan. No muestrees puntos ni ocultes los que no pertenecen a la selección.
- X: volumen relativo, base=100 %. Línea vertical en 100 con etiqueta del año base.
- Y: TV en puntos porcentuales, 0 significa misma distribución semanal.
- Color neutro/contextual y acento para selección; no introduzcas categorías territoriales extra para rellenar canales.
- Hover, clic y selección por pincel resaltan los mismos complejos en mapa y reloj. Los no seleccionados se atenúan sin desaparecer.
- Sin jitter que falsee posiciones. Resuelve puntos coincidentes mediante selección de candidatos o detalle bajo demanda.
- Dominio estable durante la animación; muestra todos los valores válidos sin recortes silenciosos. Informa aparte cuántos complejos no tienen comparación válida.
- Tooltip/foco del eje X: “100 %: mismo volumen de viajes iniciados que en el año base”. Eje Y: “Cuánto cambió el reparto de viajes entre días y horas; 0: mismo patrón”. Fórmula disponible en una segunda capa.

### Reloj inferior derecho: matriz radial semanal

- Siete anillos, lunes interior a domingo exterior; 24 sectores horarios, medianoche arriba y sentido horario. Misma geometría y escala en toda selección.
- Color divergente azul–neutro–terracota centrado en 0: `Delta_pp` del peso semanal de viajes iniciados. Leyenda simétrica estable para el ámbito comparado, con saturación declarada si existe.
- Inicialmente representa todo el sistema OD; al seleccionar, representa ese complejo o grupo. El título identifica claramente el ámbito.
- Clic en una celda fija día y hora del mapa. La barra horaria conserva ese día y recorre sus 24 horas. El sector activo se reconoce con contorno, no cambiando su valor cromático.
- Tooltip: día, intervalo horario, viajes representativos de ambos años, peso en cada año y diferencia en pp. Nombra las unidades: viajes y porcentaje no son intercambiables.
- Mantén el reloj como idiom principal. No agregues otro gráfico o pestañas de huella que dupliquen esta función.

## 8. Navegación y mantra

**Overview → zoom/selección → detalles bajo demanda.** El estado inicial ya debe mostrar conexiones principales, distribución de complejos y patrón semanal sin exigir filtros.

En una esquina inferior del mapa coloca un **minimapa geográfico fijo de contexto**, independiente del zoom principal: contornos grises, red/nodos simplificados y rectángulo de la extensión visible. El rectángulo se deriva de los límites reales de la cámara; no es decorativo. Actualízalo al mover o ampliar, permite arrastrarlo y ofrece “Ver toda la red”. No resetees selección al recentrar.

Controles visibles: pareja de años, play/pausa y hora, dos barras del bundling, zoom/recentrar y búsqueda discreta. Días se eligen en el reloj; grupos se construyen por selección directa. La búsqueda complementa la exploración, no la habilita. No añadas menús de borough, tarifas, categorías, modos de red o métricas sin necesidad comprobada.

Al alejar: simplificación de geometría, jerarquía de etiquetas y agrupación espacial de nodos cuando sea necesaria. Los grupos visuales deben señalar cuántos complejos contienen y permitir abrirlos al acercarse; conserva la selección individual. Al acercar: usa las coordenadas reales y tamaños estables en pantalla dentro de límites declarados. No desplaces estaciones para evitar solapamiento geográfico; separa representación agregada de posición real. No normalices valores ni excluyas flujos porque quedaron fuera del viewport.

El detalle debe aparecer junto al elemento o en una franja compacta de la columna existente, sin un cuarto panel permanente. Leyendas visibles para magnitudes; explicaciones breves también accesibles por teclado y toque. No dependas exclusivamente de hover.

## 9. Tareas que debe resolver y su valor

Valida el diseño con estas tareas distintas, siguiendo la separación de Munzner entre propósito, datos y medios:

1. **Explorar/resumir la distribución espacial de demanda asignada:** localizar los corredores que concentran conexiones en distintas horas. Sirve para priorizar dónde investigar la demanda; no prueba insuficiencia de capacidad.
2. **Localizar/identificar las conexiones de un origen conocido:** seguir hacia dónde se dirigen sus viajes y por qué tramos los asigna el modelo. Sirve para reconocer dependencia y conectividad modelada.
3. **Comparar volumen y forma entre complejos:** encontrar lugares con volumen semejante pero semanas distintas, o mayor volumen con patrón estable. Sirve para distinguir expansión de demanda y redistribución horaria.
4. **Identificar cuándo ocurre un cambio:** pasar de un caso de la dispersión a las celdas del reloj y sus conexiones en el mapa. Sirve para localizar franjas concretas que merecen estudio.
5. **Verificar una lectura:** consultar fuente, cobertura, año de red y límites del modelo. Sirve para decidir qué conclusiones son defendibles.

Zoom, bundling y selección son medios de interacción, no nuevas tareas del dominio. No describas estas vistas como predicción o evaluación de congestión.

## 10. Ingeniería, entrega y aceptación

Implementa en `deliveries/week12/` y sincroniza la aplicación raíz con el mecanismo existente cuando esté verificada. Conserva las otras entregas. Reutiliza componentes útiles sin heredar métricas incompatibles. No envíes gigabytes de OD al navegador: prepara agregados, índices y geometrías; conserva el detalle completo en almacenamiento procesado. Usa Canvas/WebGL y workers si lo exige el volumen. Separa asignación, bundling y rendering; cambiar una barra no debe recalcular el modelo OD ni bloquear el hilo principal.

Documenta adquisición, transformación, parámetros, URL/consultas/fechas/SHA-256, diccionario y controles. Ningún conjunto grande crudo, credencial o token en Git. No prometas un algoritmo disponible si solo hay una aproximación estética.

Antes de declarar terminado, comprueba:

- Conteos/cobertura OD contrastados con fuente; datos incompletos distinguidos de cero.
- Balance de demanda: asignada + no asignable + origen=destino coincide con la demanda de entrada de cada cohorte, sin doble conteo entre esas categorías.
- Volúmenes y métricas no cambian al mover b/f, hacer zoom o animar.
- Casos conocidos de puente/túnel, líneas paralelas, express y cruce sin transbordo; prueba combinaciones extremas e intermedias de ambas barras. Cero enlaces topológicos inventados.
- La trayectoria renderizada conserva la secuencia válida de segmentos; control geométrico por tramo y retorno a la geometría original si falla.
- TV=0 para perfiles proporcionales con volúmenes distintos; faltantes y denominadores cero tratados correctamente.
- Comparación de grupo calculada desde cantidades, no desde medias de ratios.
- Selección enlazada en las tres vistas, minimapa con extensión correcta y orientación conservada después del zoom.
- 24 horas reproducibles, leyendas/escala estables y opción de movimiento reducido.
- Evidencia visual a 1440×900 y otra resolución de escritorio; sin controles tapando grandes regiones del mapa ni gráficos cortados.

Entrega la aplicación ejecutable, scripts reproducibles y una nota breve de decisiones/limitaciones con capturas reales. Indica qué está descargado, qué está validado y qué utiliza la interfaz. Si la descarga aún impide una verificación final, deja ese estado explícito y termina todo el trabajo independiente; no sustituyas la validación pendiente por una afirmación de completitud.
