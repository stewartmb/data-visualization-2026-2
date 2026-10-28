# Peer Critique Response — Fractal · Atlas de ritmos

**DS5343 Data Visualization · UTEC · 2026-2 · Semana 12 · 28 de octubre de 2026**
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

Feedback recibido en el design review del 14 de octubre de 2026 (sobre el prototipo de la Semana 10) y la respuesta del equipo a cada sugerencia sustantiva: **implementada**, **aplazada** (a la Semana 15, con fecha) o **rechazada**, con justificación.

---

## 1 · Las preguntas que llevamos al review

| # | Pregunta | Feedback recibido | Decisión | Justificación |
|---|---|---|---|---|
| 1 | ¿La tipología residencial / mixta / laboral convence, o "promete más de lo que mide"? | No hubo objeción directa; la discusión se concentró en la presentación visual (§2). | **reemplazada** por semejanza continua | En el rediseño la clasificación discreta se sustituye por la búsqueda por ejemplo (12 vecinos por distancia de Hellinger) y por medidas continuas (peso AM, fin de semana). No se impone un tipo sin validarlo. |
| 2 | ¿El capítulo del Bronx está bien contado, o parece que forzamos la lectura del teletrabajo? | Sin objeción. | **reformulada** | El atlas no afirma la causa: muestra que el Bronx perdió más volumen y cambió menos su mañana, y lo deja como caso para investigar. La capa del Census que contrastaría la hipótesis es la tarea 2 de la Semana 15. |
| 3 | ¿Narrativa más explorador es la estructura correcta, o estorba a quien ya sabe qué busca? | Se pidió que la visualización pesara más que el texto (§2, sugerencia 5). | **implementada** | La estructura pasa a cuatro lentes enlazadas con una selección compartida; las "entradas al análisis" reemplazan a los capítulos como punto de partida, y el texto largo vive en la guía y en la página del proyecto. |
| 4 | ¿Los hallazgos negativos ("lo que no se sostiene") aportan o confunden? | Sin objeción. | **se mantienen**, como límites declarados | La vista Evidencia y cada medida llevan qué no demuestran; la página del proyecto cierra con "lo que los datos no sostienen". |
| 5 | ¿La capa de confiabilidad se lee, o es ruido? | Sin objeción. | **se mantiene**, como cobertura y contexto | Celdas sin registro contadas por estación y año; tres contextos oficiales (servicio nocturno 2021, L Project, obras de 63 St) como advertencias por complejo. |
| 6 | ¿Qué le falta para que lo use un periodista o un investigador? | Ubicar las estaciones en la ciudad real (§2, sugerencia 6). | **implementada** | Ver sugerencia 6. |

## 2 · Sugerencias recibidas

| # | Sugerencia (textual) | De quién | Sobre | Decisión | Justificación |
|---|---|---|---|---|---|
| 5 | *Ojalá* la visualización se viera más: que el peso esté en las gráficas y no en el texto. | profesor | layout · comunicación | **implementada** | La primera pantalla es el atlas semanal de 424 complejos × 168 horas en modo diferencia, a lo ancho de la vista. Geografía, trayectorias y evidencia ocupan el área principal; el carril izquierdo solo lleva filtros y entradas al análisis. Las explicaciones largas están en la guía (modal) y en la pestaña Proyecto, no entre los gráficos. |
| 6 | *¿Y si* la gráfica de Nueva York se viera como un plano de la ciudad, con las calles, como la vista de mapa de Google Maps, para que se entienda mejor dónde está cada estación? | profesor | codificación · usabilidad | **implementada** | Plano de calles de OpenStreetMap (teselas sin etiquetas) debajo de los complejos, con zoom continuo que pide el nivel de detalle correspondiente y atribución visible. Se eligió la variante sin etiquetas para que los nombres de calles no compitan con el color de la medida; los contornos de boroughs y sus nombres se mantienen encima y quedan como respaldo cuando no hay conexión. |
| 7 | Que un lector sin contexto pueda entender el proyecto desde la propia aplicación. | equipo, a partir del PDF del curso | comunicación | **implementada** | Pestaña **05 Proyecto**: título, introducción, datos, cómo se lee, hallazgos calculados en vivo, conclusión preliminar, límites, equipo y enlaces. |
| 8 | Que el mapa sea lo principal de su vista, lo más grande posible, y lo mínimo indispensable alrededor. | equipo (revisión propia tras el review) | layout | **implementada** | En Geografía el lienzo ocupa todo el alto de la ventana y se encuadra sobre los 424 complejos; encabezado, selector y filtro se compactan en dos filas y se retira el texto narrativo de abajo. |
| 9 | La leyenda del reloj semanal ("0 % … 1,5 %", "interior → exterior") no se entiende. | equipo (revisión propia) | etiquetas · comunicación | **implementada** | Leyenda reescrita: qué codifica el color con sus extremos y el punto medio, qué significa azul/naranja o claro/oscuro, cómo leer anillos (lunes al centro, domingo al borde, letras L–D sobre los anillos) y sectores (00 h arriba, sentido del reloj), y un ejemplo de lectura. |
| 10 | El reloj radial de 168 sectores no se entiende; usar una visualización más clara. | equipo (revisión propia) | codificación | **implementada** | La huella por defecto pasa a ser rectilínea: perfil de 24 h de la semana entera (gris 2020, tinta año elegido, con el pico anotado), matriz día × hora con la franja AM marcada y barras del peso de cada día. Posición en escala común en vez de ángulo y radio (Munzner: la posición es el canal más efectivo). El reloj queda como alternativa. |

## 3 · Cambios que no vinieron del review

Decisiones tomadas por el equipo entre la Semana 10 y la 12, por revisión propia. Se documentan porque explican por qué la aplicación cambió tanto respecto del prototipo.

| # | Cambio | Por qué |
|---|---|---|
| a | La comparación pasa de "ene–feb 2020 frente a todo 2024" a "ene–feb de cada año 2020–2024" | Comparar dos meses de invierno contra un año completo mezcla estaciones del año y composición del calendario. Con la misma temporada, el aplanamiento aparente se reduce y las estaciones estacionales (Mets-Willets Point, playas) dejan de distorsionar. |
| b | Estandarización por exposición del calendario (W = A / N) antes de normalizar | Un período puede tener nueve lunes y otro ocho; sin el ajuste, la forma normalizada cambia por el calendario y no por el uso. |
| c | El dataset completo se descarga y se agrega localmente (DuckDB) | Reproducibilidad: 120 855 567 registros con huella SHA-256; el insumo del atlas coincide celda por celda con el que daba la API, y cualquier corte nuevo cuesta segundos. |
| d | 424 complejos en vez de 428 | Se excluyen los dos complejos de Staten Island Railway y los dos del tranvía para mantener un modo consistente; unión exacta con el catálogo oficial en 424/424. |
| e | Distancia TV como medida principal de cambio de forma, Hellinger para semejanza | Acotadas, simétricas, con precedente en la literatura y explicables en una frase; las fórmulas se muestran en la interfaz. |
| f | Trayectorias por año en vez de antes/después | La evolución 2020–2024 no fue monótona; verla por temporada muestra el retroceso de 2021 y la recuperación parcial. |
| g | Contexto oficial del servicio por estación | Una parte de lo que se leía como demanda era oferta: cierre nocturno de 2021, obras de 63 St (57 St, 21 St-Queensbridge), L Project. |
| h | El proyecto pasa a llamarse Fractal; "Atlas de ritmos" como subtítulo | El nombre describe la idea central: el mismo ritmo semanal se repite, con variaciones, a todas las escalas (sistema, borough, complejo). |
