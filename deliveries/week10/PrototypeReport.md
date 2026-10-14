# Prototype Report — La forma del día

**DS5343 Data Visualization · UTEC · 2026-2 · Semana 10**
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

Prototipo funcional en D3.js de *La forma del día: cómo cambió el ritmo horario del metro de Nueva York, 2020–2024*.
En línea: <https://stewartmb.github.io/data-visualization-2026-2/deliveries/week10/prototype/>

---

## 1 · Qué está implementado

Una aplicación a pantalla completa con tres vistas que comparten una sola selección. Todo corre en el navegador sobre los datos reales del proyecto: 428 complejos de estación, 60 meses, perfiles de 168 horas, desde un modelo de 1.6 MB y una geografía de 77 KB.

| Vista | Qué es |
|---|---|
| **Matriz** | la vista base: las 428 estaciones como filas, agrupadas por borough, contra las 168 horas de la semana o los 60 meses, con tres lentes (forma del día 2024 · qué cambió 2020 → 2024 · mes a mes), bandas de fase, dos tiras sincronizadas debajo (forma del sistema y dónde se movió el día; entradas y composición tarifaria) y los ocho hallazgos como chips. Un submodo muestra la rejilla de perfiles de 168 h |
| **Recorrido** | los ocho capítulos como botones con Play: la pregunta y el hallazgo en una columna angosta, el gráfico ocupando el resto |
| **Explorador** | mapa con cinco lentes (incluida *forma del día*: cada estación como un reloj de 24 h), dispersión con brush, serie mensual con brush, panel de evidencia por estación |

### El recorrido

Cada capítulo tiene la misma anatomía: una **pregunta** como título, el **hallazgo** como una frase etiquetada (hallazgo · lo que no se sostiene · límite), el **gráfico** a pantalla completa, dos notas plegadas — **cómo se mide** y **qué no demuestra** — y un botón que abre el explorador ya configurado en lo que se acaba de ver. Un clic en cualquier tarjeta de hallazgo de la vista Perfiles abre su capítulo.

| | Pregunta | Hallazgo | Gráfico |
|---|---|---|---|
| | La forma del día | el perfil del sistema, 2020 frente a 2024, con el pico de la mañana desdibujándose al cargar | perfil de 24 h |
| 1 | ¿Cuánta gente volvió? | la recuperación se estancó cerca del 70 % | serie mensual con línea de referencia |
| 2 | ¿Sigue existiendo el doble pico? | el pico de la mañana se aplanó en 80 % de las estaciones | cuatro relojes de 24 h (uno por borough) + tiras de puntos del cambio del pico, una estación por punto |
| 3 | ¿Qué días de la semana cambiaron? | la semana se inclinó: el viernes perdió 2.4 puntos del total semanal y el fin de semana ganó 3.1 | barras divergentes de las 168 horas, por borough y por tipo |
| 4 | ¿Para qué se usa cada estación? | el cambio fue en una sola dirección: la mañana perdió peso | mapa por tipo + gráfico de pendientes de la asimetría 2020 → 2024, una línea por estación |
| 5 | ¿Qué cambió más: cuánto o cómo? | dentro de un borough, recuperación y aplanamiento son casi independientes | dispersión recuperación × cambio del pico |
| 6 | ¿Por qué el Bronx? | perdió más pasajeros que nadie y es el único borough donde el día no cambió de forma | dispersión con énfasis + mapa del Bronx con un reloj por estación + tabla |
| 7 | ¿Quién dejó de comprar el abono? | el pase de 30 días se desplomó: la evidencia del uso intermitente | áreas apiladas al 100 % por clase de pago |
| 8 | ¿Qué no podemos afirmar? | 37 estaciones tienen una comparación poco confiable, y están marcadas | mapa de confiabilidad + lista con motivos |

Los hallazgos no se escriben a mano: los genera `code/build_model.py` desde los datos, con sus cifras. Dos son negativos — lo que los datos *no* sostienen — y uno es un límite.

### El explorador

| Vista | Qué muestra | Interacción |
|---|---|---|
| Mapa | 428 estaciones sobre los boroughs y el trazado del metro (`d3.geoMercator`) | cinco lentes: tipo · forma del día (reloj de 24 h por estación) · recuperación · cambio del pico · confiabilidad; zoom y paneo; clic |
| Dispersión | recuperación (x) × cambio del pico (y), color por tipo | brush rectangular que filtra todo lo demás; clic |
| Serie mensual | entradas del sistema, 60 meses | brush horizontal: el tamaño de las estaciones del mapa pasa a ser el promedio del período |

Una sola selección compartida (`src/estado.js`) que sobrevive al cambio de vista. La rejilla de perfiles de la vista base (168 h por estación, escala común, línea del color del tipo, cinco órdenes) la lee también. Filtros de borough, tipo y "solo comparaciones sólidas"; cada filtro activo es un chip que se quita con un clic. La barra dice siempre cuántas estaciones y qué share de entradas quedan, y de qué capítulo vino el lector.

**Panel de evidencia.** Un clic en cualquier estación abre su panel: cifras (recuperación en las dos ventanas, razón pico/valle, asimetría), el perfil del día laborable antes y después, la serie mensual con los meses anómalos sombreados, y la tabla con los números detrás de cada afirmación. Si la comparación es poco confiable, el panel dice por qué.

**Clave visual.** Un botón de la barra abre la leyenda de significado: qué codifica cada marca y qué *no* significa ("más azul no es mejor"; "el área gris no es un año normal").

**Accesibilidad.** `←` `→` mueven entre capítulos, `Esc` cierra paneles; modo oscuro como conjunto propio de tokens, con botón para fijarlo; móvil (las vistas se apilan); `prefers-reduced-motion` respetado; paleta validada para daltonismo.

### Implementación

D3.js v7.9.0 servido desde `lib/`, módulos ES nativos, sin bundler. Unas 2 000 líneas propias entre HTML, CSS y JS, más 350 de Python. Probado en Chromium headless con Playwright: los ocho bloques renderizan, las interacciones responden en las cuatro vistas y los presets de los capítulos, y la consola queda limpia.

---

## 2 · Decisiones de diseño

### 2.1 Es un argumento, no un dashboard

La Semana 7 proponía cuatro paneles en una pantalla. Funcionaban y no contaban nada. La estructura de este prototipo toma de FINO (VAST Challenge 2026, UTEC) la forma de aplicación — vistas en pestañas, una selección compartida, capítulos con Play dentro de una vista — y cuatro principios: las vistas se titulan con **preguntas**; los hallazgos se escriben como **afirmaciones** e incluyen lo que no se demuestra; la **confiabilidad** de cada dato es una capa visible; y cada afirmación está a un clic de su **evidencia**. El lector puede empezar por la vista base, por el recorrido o por el explorador; la selección lo sigue.

### 2.2 La pregunta cambió

"¿Se aplanó el pico?" es el hecho más reportado del transporte desde 2020. La pregunta pasó a ser "¿quién resistió y dónde?", y la respuesta — el Bronx — no estaba en ningún lado. Para hacerla legible hacía falta una tipología de estaciones, que resultó derivable del propio torniquete.

### 2.3 Una tipología sin datos externos

Las entradas de la mañana son gente saliendo de casa; las de la tarde, gente saliendo del trabajo. La asimetría (AM − PM) / (AM + PM) sobre el día laborable de la línea base clasifica cada estación en residencial, mixta o laboral. **Alternativa descartada:** clustering de los 168 valores. La asimetría tiene significado físico, es un número por estación y se explica en una frase.

### 2.4 La línea base y la confiabilidad

Este dataset no tiene 2019; la única línea base previa a la pandemia son enero y febrero de 2020. La Semana 7 los comparaba contra todo 2024: 155 estaciones cambiaban más de cinco puntos según la ventana, y Mets-Willets Point marcaba 287 %. La recuperación se calcula ahora sobre la **misma ventana calendario** (enero–febrero de 2024), siguiendo a Hsu et al. (2021). Y en vez de esconder las estaciones donde ni eso basta, se las marca: una capa de confiabilidad con tres motivos (estacional, ventana anómala, línea base pequeña), dibujada con anillo punteado en todas las lentes y excluida de las medianas por grupo. **Alternativa descartada:** excluirlas. Excluir esconde; marcar informa.

### 2.5 El índice y el titular

Las ventanas del índice pico/valle dejaron de solaparse (pico 6–10 h, valle 11–15 h; las de la Semana 6 compartían las 10 y 11 h). Y el titular pasó de "372 de 414 aplanaron" — que contaba cualquier reducción, incluida una de 0.08 % — a "80 % aplanó más de 5 %, caída mediana del 17 %". El número robusto resiste una pregunta incómoda.

### 2.6 Codificación

El único color de la página es el dato; el cromo es negro y gris.

| canal | lleva | por qué |
|---|---|---|
| posición | lugar | el canal más preciso para la variable espacial; ahora sobre boroughs y metro reales |
| color categórico | tipo de estación | identidad: sigue a la estación en todas las vistas; tres tonalidades validadas en todos los pares (peor par ΔE 9.2 bajo deuteranopia) |
| color secuencial | recuperación | una magnitud, una tonalidad; recortada en p10–p90 y dicho en la leyenda |
| color divergente | cambio del pico | polaridad real: aplanó ↔ igual ↔ afiló; punto medio gris |
| tamaño | entradas por día | contexto, en el canal menos preciso; no cambia con la lente |
| anillo punteado | confiabilidad | el estado se ve sin robar el canal de color |
| área gris + línea | antes / ahora | con dos líneas superpuestas el "antes" quedaba tapado |
| matriz (canvas) | 428 × 168 celdas | la vista base muestra todas las estaciones y todas las horas a la vez; el patrón (pico de la mañana, jueves–viernes, el Bronx) aparece antes de leer una sola cifra |
| reloj de 24 h | forma del día de una estación | en coordenadas polares la forma se lee como glifo y cabe en un mapa; la hora es cíclica |

**Alternativas descartadas:** 428 líneas superpuestas (el *overplotting* borra la forma); animar la transición entre años (rinde peor para comparar dos momentos distantes, Lee et al. 2020); cuatro mapas en vez de cuatro lentes (el lector compararía con la memoria y no con el ojo); una dispersión pico/valle antes × después (los dos ejes del cambio son la pregunta; el antes/después ya lo cuenta el perfil).

### 2.7 Un pipeline del que sale todo

`build_model.py` reconstruye el modelo en tres segundos, sin dependencias, desde las tablas de la Semana 6. Generar los hallazgos desde el modelo evitó un error: una versión escrita a mano decía "ninguna estación cambió de tipo" y era falsa — 54 cruzaron el umbral. El hallazgo verdadero (53 de las 54 en la misma dirección) es mejor. El detector de caídas anómalas, sin usar avisos de servicio, recuperó cierres conocidos: la línea G en julio–agosto de 2024 y 21 St-Queensbridge entre septiembre de 2023 y marzo de 2024.

---

## 3 · Limitaciones conocidas

### Del prototipo

1. **El perfil de 168 h de 2024 es el año completo**, no enero–febrero. La recuperación ya usa la misma ventana calendario; la forma del día todavía no. Lo corrige una pasada adicional de la API (`code/datos_nuevos.ipynb`, pasada D), pendiente.
2. **El brush temporal solo cambia el tamaño** de las estaciones del mapa. Reconstruir la forma del día del período elegido necesita perfiles por mes (pasada E del mismo notebook).
3. **La explicación del Bronx es una hipótesis.** Los datos del torniquete muestran el patrón, no la causa. La capa del Census (share de trabajo desde casa por área de influencia de cada estación, pasada F) es lo que podría sostenerla.
4. **La rejilla de perfiles dibuja 120 múltiplos a la vez** de los 428; el contador lo dice. La matriz sí dibuja las 428.
6. **El hallazgo de la semana (jueves–viernes) compara 2024 completo con enero–febrero de 2020**: incluye feriados y verano. Se afina con la ventana comparable (pasada D).
5. **Sin navegación por teclado dentro del mapa** ni descripción textual de los gráficos más allá del `aria-label`.

### De los datos

6. **Son entradas, no viajes.** No hay origen–destino. "Laboral" y "residencial" describen a qué hora entra la gente, no a dónde va.
7. **Los cambios de servicio no están controlados.** Se detectan en los datos las caídas grandes; no se cruzan con avisos de la MTA.
8. **La línea base son dos meses de invierno.** La ventana comparable corrige la estacionalidad, pero enero–febrero de 2024 tuvo obras en la línea F. Las estaciones afectadas están marcadas; el problema de fondo no desaparece.
9. **Es el complejo de estación, no la estación individual.** Times Sq-42 St agrupa varias líneas.
10. **Son estimaciones de la MTA**, dentro del 1 % de sus cifras oficiales.

---

## 4 · Preguntas para los revisores

Las seis preguntas de la propuesta original (contexto geográfico, legibilidad de pico/valle, orden de los perfiles, el brush temporal, Mets-Willets Point, recorte del color) ya tienen respuesta en este prototipo. Estas son las que quedan abiertas:

1. **¿La tipología convence?** "Residencial / laboral" sale solo de a qué hora entra la gente. ¿Se lee como una clasificación creíble, o como un nombre que promete más de lo que mide? ¿Preferirían "AM / PM"?

2. **¿El capítulo del Bronx está bien contado o estamos forzando la lectura?** Presentamos el teletrabajo como hipótesis consistente, no como causa. ¿Se percibe así, o el lector sale creyendo que lo demostramos? ¿Qué evidencia pedirían antes de creerlo?

3. **¿Tres vistas es la estructura correcta?** Perfiles como vista base, Recorrido con los capítulos, Explorador libre. ¿Sobra alguna? ¿El recorrido debería ser la entrada por defecto?

4. **¿Los hallazgos negativos aportan o confunden?** Dos de los ocho dicen lo que los datos no sostienen. ¿Dan confianza, o parecen un relleno?

5. **¿La capa de confiabilidad se lee?** El anillo punteado y el capítulo 7 marcan 37 estaciones. ¿Es la cantidad correcta de aviso, o es ruido? ¿Deberíamos excluirlas de las vistas por defecto?

6. **¿Qué le falta para que lo use un periodista o un investigador?** Es la audiencia que declaramos. ¿Qué pregunta harían que la herramienta no responde?

---

## 5 · Qué sigue

| | Para la Semana 12 |
|---|---|
| 1 | Integrar las tres pasadas de `datos_nuevos.ipynb`: ventana comparable del perfil, perfiles por mes, capa del Census |
| 2 | Contrastar la hipótesis del Bronx con el share de trabajo desde casa por estación |
| 3 | Brush temporal que reconstruya la forma del día del período |
| 4 | Responder cada sugerencia del design review (`deliveries/week12/PeerCritiqueResponse.md`) |
| 5 | Paper en dos columnas; borrador en `deliveries/week12/paper/` |

---

## Referencias

- Lee, Archambault y Nacenta (2020). *The Effectiveness of Interactive Visualization Techniques for Time Navigation of Dynamic Graphs on Large Displays*. arXiv:2008.12747 — sostiene §2.6.
- Hsu, Wu et al. (2021). *Investigating spatio-temporal mobility patterns and changes in metro usage under the impact of COVID-19 using Taipei Metro smart card data*. Public Transport — sostiene §2.4.
- Yap y Cats (2022). *Identifying Human Mobility Patterns using Smart Card Data*. arXiv:2208.05352 — sostiene §2.3.
- Sasaki, Nakamura et al. (2022). *An Empirical Study on the Relationship Between the Number of Coordinated Views and Visual Analysis*. arXiv:2204.09524 — sostiene el límite de cuatro vistas enlazadas.
- Aquino, Arbulú, Acuña y Pajuelo (2026). *FINO — Forensic Intelligence and Network Oversight*, VAST Challenge 2026 MC1, UTEC — sostiene §2.1.

## Créditos

Datos: Metropolitan Transportation Authority (MTA) vía Open NY, acceso por la API SODA de Socrata. Geografía: NYC Department of City Planning (boroughs, vía dwillis/nyc-maps) y GTFS estático de la MTA (vía kjhealy/nycroutes). Librería: D3.js v7.9.0 (BSD-3-Clause). Parte del código y de la documentación se elaboró con asistencia de IA, revisada y validada por el equipo.
