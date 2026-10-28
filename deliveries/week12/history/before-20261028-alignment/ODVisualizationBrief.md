# Prompt para el agente: Atlas OD con RAEB y abstracción graduable

Trabaja en la raíz del repositorio `stewartmb/data-visualization-2026-2`. Todas las rutas siguientes son relativas a esa raíz; consulta `deliveries/week12/DataSharing.md` para obtener los archivos en otra computadora. Implementa una versión funcional del siguiente diseño, con datos reales y procesamiento reproducible. Lee primero `AGENTS.md`, `Proyecto_Final_Guia.md` —especialmente la entrega de Semana 12— y la documentación existente. Conserva el trabajo local del usuario. No hagas push ni despliegues públicos.

## 1. Objetivo y límites

Construye **un único panel integrado para explorar los ritmos y las conexiones estimadas del subway de Nueva York**. El mapa es el overview central; a su derecha conviven una dispersión volumen × forma arriba y un reloj semanal abajo. Las tres vistas comparten selección y año objetivo. La base del contraste de la columna derecha puede elegirse de forma independiente del mapa. No conviertas cada tarea en una pestaña o un formulario de filtros.

El overview usa **OD MTA 2021–2024** y una red ferroviaria con geometrías para asignar caminos plausibles. Por indicación del usuario, la columna derecha admite 2019 y 2020 como base histórica: en ese caso ambos años de la dispersión y el reloj se calculan con la serie de entradas estimadas MTA 2019–2024. No se mezclan entradas de un año con OD de otro; 2019/2020 no modifican el mapa. Ver `HistoricalContrast.md`. El mapa base y los contornos son contexto, sin métricas territoriales externas. No incorporar tarifas, turismo ni indicadores socioeconómicos en esta versión.

Las imágenes adjuntas son referencias de composición: mapa dominante, dispersión, reloj y minimapa. No copies sus cifras, etiquetas de años ni controles heredados. En particular, no heredes “Base 2020” como base fija del mapa, ni “enero–febrero” como cobertura. El contraste histórico de la derecha permite 2019/2020 explícitamente; solo 2019 se interpreta como año anterior a la pandemia. Si las imágenes no están disponibles, esta especificación define el resultado.

Referencias a consultar:

- RAEB, Zeng et al., EuroVis 2019: https://zeng-wei.com/publication/papers/2019_RAEB.pdf
- Página de los autores: https://webspace.science.uu.nl/~telea001/InfoVis/RAEB
- Tube Heartbeat: https://misc.oomap.co.uk/tubeheartbeat.com/london/

La indicación más reciente del usuario es permitir **abstracción geométrica libre con fidelidad 0** y recuperar progresivamente los caminos de referencia al aumentarla. Esta indicación sustituye el requisito anterior de mantener todas las curvas dentro de un corredor ferroviario. El grafo y los valores OD siguen siendo invariantes: un puente visual en una abstracción no representa nueva infraestructura.

Implementa los componentes de RAEB, no una simplificación Douglas–Peucker ni un cambio de separación entre carriles. Declara las adaptaciones ferroviarias y numéricas; no lo presentes como reproducción idéntica de los experimentos de los autores.

## 2. Decisiones iniciales explícitas

- Comparación inicial: **2021 → 2024**, los doce meses de cada año. Se interpreta como cambio desde un año pandémico, no como recuperación respecto a una normalidad anterior al COVID.
- El mapa conserva su ámbito OD 2021–2024. La columna derecha tiene un único selector compartido por dispersión y reloj para la base de contraste (2019–2023, anterior al objetivo); cambiarlo no redibuja el mapa. El año objetivo sigue al del mapa. Las fuentes equivalentes para cada comparación se explican en `HistoricalContrast.md`.
- Dispersión: **un solo diagrama bivariado**, como la imagen; no una matriz SPLOM con muchas variables.
- Hora inicial: **lunes, 08:00–09:00**, como hora de inicio del viaje. Reloj y barra horaria permiten cambiarla.
- Mapa: magnitud absoluta del año objetivo. Dispersión y reloj: comparación entre los dos años. Títulos y leyendas deben indicar esta diferencia de escala temporal.
- Las métricas de dispersión describen la semana completa y permanecen fijas al seleccionar día y hora. La hora activa solo cambia el mapa y el indicador del reloj.
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

## 4. Red y asignación de referencia

Utiliza el GTFS MTA adquirido por `scripts/acquire_network.py`: secuencias consecutivas de paradas y transferencias explícitas, recortadas sobre `shapes.txt` con orden monótono y distancia máxima de proyección de 250 m. No añadas enlaces por proximidad. La referencia disponible corresponde a 2026, no al servicio histórico 2021–2024.

`prepare_raeb.py` prepara una referencia estática de 424 complejos, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. La asignación minimiza distancia geométrica sobre las adyacencias dirigidas del GTFS, con desempates deterministas. Es una unión de patrones de servicio y colapsa las plataformas en complejos: no comprueba horarios, esperas ni compatibilidad temporal de servicios. No denominarla ruta observada, mejor ruta real ni asignación de menor tiempo. Estas limitaciones permanecen explícitas.

Conserva por separado demanda asignada, no mapeada, no asignable y origen=destino. No conviertas OD internos de un complejo en bucles inventados. No cambies ninguna de estas cantidades al mover parámetros visuales.

## 5. Dos barras y motor RAEB

**Fidelidad geométrica f ∈ [0,1], inicial 0,90.** Normaliza `p_ra=5f`. Jerarquía de enlaces por importancia: 0,3 × longitud normalizada + 0,1 × clase + 0,6 × flujo normalizado. En este ferrocarril la clase es constante 1: no se fabrican clases de carreteras. Se conserva el top 5 %, 10 %, 20 %, 40 % y 100 % en cinco niveles anidados; los huecos se sustituyen por cuerdas entre segmentos conservados, siguiendo §4.4. La importancia usa el conjunto de años/horas para mantener estable la referencia.

- f=0: OD rectos como semilla y bundling sin guía ferroviaria. Pueden aparecer cruces visuales sobre el agua. Son abstracciones, no nuevos caminos reales.
- 0<f<1: se conservan progresivamente tramos de la jerarquía. Se interpola entre niveles vecinos para una barra continua.
- f=1: mostrar la geometría completa del GTFS y la carga asignada, sin atajos introducidos por el muestreo de curvas.

**Agrupación b ∈ [0,1], inicial 0,65.** Multiplica el radio inicial del kernel estimado. b=0 elimina la atracción entre curvas de la semilla del nivel elegido; b=1 usa el radio estimado completo. No modifica pesos, extremos ni asignación.

El motor calcula KDE radial con kernel Epanechnikov, advección por su gradiente, suavizado laplaciano, radio decreciente λ=0,9 y refuerzo de densidad de la guía `θ=1,1 maxρ`. Estima el radio con Fréchet discreto y DBSCAN; controla convergencia mediante imágenes de curvas y NMI≥0,8. El máximo de 48 iteraciones es una salvaguarda y no equivale automáticamente a convergencia.

Adaptaciones declaradas: raster acotado, 32 muestras por curva, mínimo 16 enlaces para estimar el kernel en una red pequeña, radio acotado, interpolación de niveles, pesos OD agregados y curva ferroviaria exacta en f=1. La desviación Fréchet mostrada en el diagnóstico se estima con hasta 128 curvas, no con todo el conjunto. RAEB original no separa sentidos durante el agrupamiento; esta versión tampoco lo promete. La selección de origen conserva el significado dirigido del OD.

Mantén las muestras alineadas por longitud del recorrido original y ancla los segmentos conservados. Dibuja sus shapes completos con carga agregada y usa WebGL para la fracción no conservada. Usa un worker para el cálculo. Las barras deben responder inmediatamente con una **vista previa**, luego interpolar al resultado calculado. Explica este estado en una línea breve. La vista previa no es una solución convergida de RAEB. El zoom cambia solo la cámara; no repite la asignación ni el bundling.

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
- Densidad visual: cada OD aporta opacidad α=1−exp(−q/800), con escala fija entre años y horas. La superposición revela haces; es una lectura cualitativa, con saturación y precisión de raster. Los valores exactos pertenecen al dato OD. En f=1, sumar carga por enlace y aplicar la misma transferencia óptica sobre la geometría completa.
- No inventar separación direccional: RAEB agrupa por geometría. Al seleccionar un origen, distinguir sus relaciones salientes; no confundir orientación del OD con velocidad o posición instantánea.
- Nodos: **área proporcional a viajes iniciados en el origen** para día y hora activos. No uses radio proporcional. Mantén hit areas cómodas y una marca neutra distinguible para valor cero; si aplicas pisos o topes de tamaño, explica la excepción y conserva el valor exacto.
- Halo y contorno indican selección. Un acento cálido resalta las conexiones salientes del origen seleccionado; la red completa sigue visible como contexto. No emplees simultáneamente color para borough, línea, cambio, volumen y selección.
- Selección temporal manual: los nodos y la densidad cambian al elegir un día y una hora en el reloj. No incorporar reproducción automática, botón play/pausa ni un temporizador. No simules velocidad de trenes ni un punto por pasajero.
- Detalles del nodo: viajes iniciados y selección de conexiones salientes. Mantener la procedencia y el significado de curvas modeladas accesibles bajo demanda.

### Dispersión superior derecha: volumen × forma

- Cada punto es un complejo con datos comparables; todos se conservan. No muestrees puntos ni ocultes los que no pertenecen a la selección.
- X: volumen relativo, base=100 %. Línea vertical en 100 con etiqueta del año base.
- Y: TV en puntos porcentuales, 0 significa misma distribución semanal.
- Color neutro/contextual y acento para selección; no introduzcas categorías territoriales extra para rellenar canales.
- Hover, clic y selección por pincel resaltan los mismos complejos en mapa y reloj. Los no seleccionados se atenúan sin desaparecer.
- Sin jitter que falsee posiciones. Resuelve puntos coincidentes mediante selección de candidatos o detalle bajo demanda.
- Dominio estable al cambiar de día y hora; muestra todos los valores válidos sin recortes silenciosos. Informa aparte cuántos complejos no tienen comparación válida.
- Tooltip/foco del eje X: “100 %: mismo volumen de viajes iniciados que en el año base”. Eje Y: “Cuánto cambió el reparto de viajes entre días y horas; 0: mismo patrón”. Fórmula disponible en una segunda capa.

### Reloj inferior derecho: matriz radial semanal

- Siete anillos, lunes interior a domingo exterior; 24 sectores horarios, medianoche arriba y sentido horario. Misma geometría y escala en toda selección.
- Color divergente azul–neutro–terracota centrado en 0: `Delta_pp` del peso semanal de viajes iniciados. Leyenda simétrica estable para el ámbito comparado, con saturación declarada si existe.
- Inicialmente representa todo el sistema OD; al seleccionar, representa ese complejo o grupo. El título identifica claramente el ámbito.
- Clic en una celda fija día y hora del mapa. La barra horaria permite elegir manualmente otra hora del mismo día; nunca avanza por sí sola. El sector activo se reconoce con contorno, no cambiando su valor cromático.
- Tooltip: día, intervalo horario, viajes representativos de ambos años, peso en cada año y diferencia en pp. Nombra las unidades: viajes y porcentaje no son intercambiables.
- Mantén el reloj como idiom principal. No agregues otro gráfico o pestañas de huella que dupliquen esta función.

## 8. Navegación y mantra

**Overview → zoom/selección → detalles bajo demanda.** El estado inicial ya debe mostrar conexiones principales, distribución de complejos y patrón semanal sin exigir filtros.

En una esquina inferior del mapa coloca un **minimapa geográfico fijo de contexto**, independiente del zoom principal: contornos grises, red/nodos simplificados y rectángulo de la extensión visible. El rectángulo se deriva de los límites reales de la cámara; no es decorativo. Actualízalo al mover o ampliar, permite arrastrarlo y ofrece “Ver toda la red”. El control explícito “Vista general” limpia la selección y recupera la extensión completa; mover o ampliar el mapa conserva la selección. Clic de fondo o Escape permiten limpiar la selección manteniendo la cámara.

Controles visibles: pareja de años, selección manual de hora, dos barras del bundling, zoom/recentrar y búsqueda discreta. No añadir reproducción automática ni un botón de reproducción. Días se eligen en el reloj; grupos se construyen por selección directa. La búsqueda complementa la exploración, no la habilita. No añadas menús de borough, tarifas, categorías, modos de red o métricas sin necesidad comprobada.

Al alejar: simplificación de geometría, jerarquía de etiquetas y agrupación espacial de nodos cuando sea necesaria. Los grupos visuales deben señalar cuántos complejos contienen y permitir abrirlos al acercarse; conserva la selección individual. Al acercar: usa las coordenadas reales y tamaños estables en pantalla dentro de límites declarados. No desplaces estaciones para evitar solapamiento geográfico; separa representación agregada de posición real. No normalices valores ni excluyas flujos porque quedaron fuera del viewport.

El detalle debe aparecer junto al elemento o en una franja compacta de la columna existente, sin un cuarto panel permanente. Leyendas visibles para magnitudes; explicaciones breves también accesibles por teclado y toque. No dependas exclusivamente de hover.

## 9. Tareas y valor para la audiencia

El contrato analítico vigente está en [AnalyticalTasks.md](AnalyticalTasks.md), revisión del 28 de octubre. Sustituye la lista anterior; distingue datos disponibles, funciones existentes y desarrollo pendiente.

1. Redistribución territorial de demanda, con entradas 2019–2024.
2. Dependencia de Manhattan e intercambios locales/interterritoriales, con OD 2021–2024.
3. Desplazamiento de ventanas de demanda, con cantidades y peso semanal.
4. Corredores que sostienen intercambios, con carga asignada por tramo.
5. Balance externo entre viajes originados y destinados a cada territorio, por cohorte de inicio.
6. Exposición ante la retirada de un enlace de referencia: desconexión y distancia adicional; extensión contrafactual no implementada.

No declarar que el panel actual resuelve íntegramente las seis: agregados territoriales, balances y escenarios requieren cálculo, validación y diseño adicional. La selección enlazada, trazabilidad y barras son medios transversales. Los papers de [Semana 6](../week06/referencias.md) informan técnicas puntuales; no validan automáticamente cada nueva métrica ni una predicción operacional.

## 10. Ingeniería, entrega y aceptación

Implementa en `deliveries/week12/` y sincroniza la aplicación raíz con el mecanismo existente cuando esté verificada. Conserva las otras entregas. Reutiliza componentes útiles sin heredar métricas incompatibles. No envíes gigabytes de OD al navegador: prepara agregados, índices y geometrías; conserva el detalle completo en almacenamiento procesado. Usa Canvas/WebGL y workers si lo exige el volumen. Separa asignación, bundling y rendering; cambiar una barra no debe recalcular el modelo OD ni bloquear el hilo principal.

Documenta adquisición, transformación, parámetros, URL/consultas/fechas/SHA-256, diccionario y controles. Ningún conjunto grande crudo, credencial o token en Git. No prometas un algoritmo disponible si solo hay una aproximación estética.

Antes de declarar terminado, comprueba:

- Conteos/cobertura OD contrastados con fuente; datos incompletos distinguidos de cero.
- Balance de demanda: asignada + no asignable + origen=destino coincide con la demanda de entrada de cada cohorte, sin doble conteo entre esas categorías.
- La matriz OD y la asignación no cambian al mover b/f o hacer zoom. Elegir otra hora cambia la cohorte y las cantidades del mapa; los índices semanales de la dispersión permanecen fijos.
- Casos conocidos de puente/túnel, líneas paralelas, express y cruce sin transbordo; prueba combinaciones extremas e intermedias de ambas barras. Cero enlaces topológicos inventados.
- f=0 permite geometría libre; f=1 usa las geometrías completas de referencia. En todos los valores, conservar los extremos OD y la demanda. Un cruce de curvas no añade una conexión al grafo.
- TV=0 para perfiles proporcionales con volúmenes distintos; faltantes y denominadores cero tratados correctamente.
- Comparación de grupo calculada desde cantidades, no desde medias de ratios.
- Selección enlazada en las tres vistas, minimapa con extensión correcta y orientación conservada después del zoom.
- Las 168 combinaciones día–hora se pueden seleccionar manualmente; mapa y reloj quedan sincronizados y las leyendas/escalas son estables. No existe avance automático del tiempo.
- Evidencia visual a 1440×900 y otra resolución de escritorio; sin controles tapando grandes regiones del mapa ni gráficos cortados.

Entrega la aplicación ejecutable, scripts reproducibles y una nota breve de decisiones/limitaciones con capturas reales. Indica qué está descargado, qué está validado y qué utiliza la interfaz. Si la descarga aún impide una verificación final, deja ese estado explícito y termina todo el trabajo independiente; no sustituyas la validación pendiente por una afirmación de completitud.
