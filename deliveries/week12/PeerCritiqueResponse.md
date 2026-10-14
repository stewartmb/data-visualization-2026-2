# Peer Critique Response — La forma del día

**DS5343 Data Visualization · UTEC · 2026-2 · Semana 12**
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

Feedback recibido en el design review del 14 de octubre de 2026 y la respuesta del equipo a cada sugerencia sustantiva: **implementada**, **aplazada** (a la Semana 15, con fecha) o **rechazada**, con justificación.

> Cómo llenarlo: una fila por sugerencia. Copiar la sugerencia tal como se dijo, en el formato *Me gusta / Ojalá / ¿Y si…?* si vino así. La decisión tiene que ser una de las tres palabras. La justificación cabe en dos líneas; si no cabe, es que no está decidida.

---

## 1 · Las seis preguntas que llevamos al review

Estas eran las decisiones en las que estábamos divididos. Lo que se decidió, y por qué:

| # | Pregunta | Feedback recibido | Decisión | Justificación |
|---|---|---|---|---|
| 1 | ¿El mapa necesita contexto geográfico? | **[pendiente]** | **implementada** | Contornos de boroughs y trazado del metro con `d3.geoMercator`, en gris recesivo. Las preguntas 5 y 6 son geográficas; el fondo no compite con el color porque solo el dato tiene color. |
| 2 | ¿Se entiende "pico/valle"? | **[pendiente]** | **implementada** | Se mantiene el índice, pero ya no se pide que el lector lo compre a ciegas: el capítulo 2 lo muestra sobre el perfil (pico 10.4 % → 9.1 %, valle 3.6 % → 3.9 %, razón 2.90 → 2.35) y cada capítulo dice *cómo se mide*. |
| 3 | ¿El orden por defecto de los perfiles? | **[pendiente]** | **implementada** | Por defecto, "más se aplanó": es la pregunta del proyecto. Las estaciones poco confiables llevan ⚠ en la tarjeta para que el primer puesto no engañe. |
| 4 | ¿Vale la pena el brush temporal como está? | **[pendiente]** | **aplazada** al 24 oct | Se mantiene porque la barra dice exactamente qué hace ("el tamaño pasa a ser el promedio del período"). Con los perfiles por mes del notebook, pasará a reconstruir la forma del día del período. |
| 5 | ¿Qué hacemos con Mets-Willets Point? | **[pendiente]** | **implementada** | Ni excluirla ni anotarla: convertir el problema en una capa. 37 estaciones con comparación poco confiable llevan anillo punteado y motivo, no entran en las medianas por grupo, y el capítulo 7 las lista. |
| 6 | ¿El recorte de color en p10/p90 esconde algo? | **[pendiente]** | **implementada** | Se mantiene el recorte y se declara en la leyenda ("fuera de ese rango el color no distingue"). Los extremos se leen en el panel de la estación y en la dispersión, que no recorta. |

---

## 2 · Sugerencias recibidas

| # | Sugerencia (textual) | De quién | Sobre | Decisión | Justificación |
|---|---|---|---|---|---|
| 7 | **[pendiente]** | | codificación / interacción / usabilidad / valor analítico / layout / etiquetas / comunicación | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |

---

## 3 · Cambios que no vinieron del review

Decisiones tomadas por el equipo entre la Semana 10 y la 12, por revisión propia. Se documentan porque cambian lo que el revisor vio.

| # | Cambio | Por qué |
|---|---|---|
| a | La ventana de comparación de la recuperación pasa de "todo 2024" a "enero–febrero de 2024" | La línea base son dos meses de invierno; compararlos contra un año completo sesgaba a 155 estaciones en más de 5 puntos y a 49 en más de 10. Mets-Willets Point pasaba de 287 % a 86 %. |
| b | Las ventanas del índice pico/valle dejan de solaparse (pico 6–10 h, valle 11–15 h) | Con las ventanas de la Semana 6 (5–11 / 10–14), 13 estaciones tenían el pico dentro de la ventana del valle. |
| c | El titular pasa de "372 de 414" a "80 % con el umbral del 5 %, mediana −17 %" | "372 de 414" contaba cualquier reducción, incluida una de 0.08 %. El número robusto resiste una pregunta incómoda; el frágil no. |
| d | La pregunta central pasa de "¿cambió la forma del día?" a "¿quién resistió y dónde?" | Que la pandemia aplanó el pico es el hecho más reportado del transporte desde 2020. Que el Bronx no lo aplanó, no. |
| e | La audiencia deja de ser "planificadores de la MTA" | La MTA tiene datos internos muy superiores a las entradas públicas; la herramienta no contiene nada de lo que esa decisión necesita. |
| f | Se detectan caídas anómalas de entradas en los datos | Una parte de lo que se leía como demanda era oferta: la línea G cerró en julio–agosto de 2024, 21 St-Queensbridge entre septiembre de 2023 y marzo de 2024. |
| g | Los hallazgos se generan desde el modelo, no se escriben a mano | Un hallazgo escrito a mano ("ninguna estación cambió de tipo") resultó falso al verificarlo: 54 cruzaron el umbral. El verdadero es mejor: 53 de las 54 en la misma dirección. |
