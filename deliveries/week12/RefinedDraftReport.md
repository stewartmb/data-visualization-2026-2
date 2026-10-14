# Refined Draft Report — La forma del día

**DS5343 Data Visualization · UTEC · 2026-2 · Semana 12 · borrador**
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

> Borrador preparado tras el design review de la Semana 10. Las secciones marcadas **[pendiente]** se completan con el feedback recibido y con los datos nuevos del notebook de Colab (`app/code/datos_nuevos.ipynb`).

---

## 1 · De dónde venimos y qué cambia en esta entrega

El prototipo de la Semana 10 ya es la aplicación narrativa: siete capítulos, explorador enlazado, capa de confiabilidad, hallazgos generados desde el modelo, mapa con geografía real. Esta entrega no reconstruye; integra y responde.

| | Semana 10 | Semana 12 |
|---|---|---|
| Perfil de 168 h de 2024 | año completo | enero–febrero de 2024, la misma ventana que la línea base (pasada D del notebook) **[pendiente]** |
| Brush temporal | cambia el tamaño de las estaciones en el mapa | reconstruye la forma del día del período elegido (pasada E) **[pendiente]** |
| Capítulo 5, el Bronx | hipótesis del trabajo híbrido, declarada como hipótesis | contrastada con el share de trabajo desde casa del Census por área de influencia de cada estación (pasada F) **[pendiente]** |
| Feedback del design review | seis preguntas abiertas | cada sugerencia respondida en `PeerCritiqueResponse.md` **[pendiente]** |
| Paper | — | borrador completo en dos columnas, `paper/` |
| Página del proyecto | — | la propia aplicación, con enlaces al paper, al repositorio y a los videos cuando existan |

## 2 · El problema y la audiencia

El metro de Nueva York se programa alrededor del doble pico del día laborable. Entre 2020 y 2024 esa forma cambió, pero la recuperación se reporta casi siempre con un solo número: dice cuánta demanda volvió, no a qué hora ni en qué estaciones.

**Unidad de análisis.** El perfil horario de cada estación — 24 horas × 7 días, 168 valores — dividido por el total de esa estación. Describe su ritmo, no su tamaño.

**Audiencia.** Investigadores de transporte urbano, periodismo de datos y gobierno local: lectores que necesitan entender *cómo* cambió el uso del metro por barrio, no solo cuánto. La Semana 7 proponía "planificadores de servicio de la MTA"; se descarta porque la MTA tiene datos internos (origen–destino, carga por tren) muy superiores a las entradas públicas, y esta herramienta no contiene nada de lo que esa decisión necesita.

**Preguntas de dominio.** Las siete de la propuesta se mantienen; el eje pasa de la 2 (¿cómo cambió la forma del día?) a la 6 (¿la recuperación fue pareja entre barrios?), porque ahí está el hallazgo que no se sabía.

---

## 3 · Datos y método

**Fuente.** MTA Subway Hourly Ridership 2020–2024 (`wujg-7c2s`, Open NY). Registros horarios por complejo de estación, método de pago y clase tarifaria. Nunca se descarga crudo: se agrega del lado del servidor con SoQL en ventanas de 7 días (Semana 6).

**Tablas agregadas.** Estación × día; estación × día-de-la-semana × hora, por año y para enero–febrero de 2020; mes × borough × pago × tarifa.

**Derivaciones** (`app/code/build_model.py`, ~3 s, sin dependencias):

| medida | definición |
|---|---|
| perfil | 168 valores normalizados por el total de la estación |
| recuperación | entradas/día de enero–febrero de 2024 ÷ entradas/día de enero–febrero de 2020 |
| razón pico/valle | máximo del día laborable entre 6 y 10 h ÷ mínimo entre 11 y 15 h (ventanas sin solape; la Semana 6 las tenía solapadas en 10 y 11 h) |
| aplanamiento | cambio relativo de la razón; cuenta si supera el 5 % |
| asimetría | (entradas 6–10 h − entradas 16–20 h) ÷ (suma). +1 residencial puro, −1 laboral puro. Umbral ±0.15 |
| sensibilidad estacional | recuperación con todo 2024 − recuperación con enero–febrero de 2024, respecto de la mediana del sistema |
| caída anómala | un mes por debajo de la mitad de la mediana de sus ±6 meses vecinos, desde julio de 2021 |

**Confiabilidad de la comparación.** Cada estación recibe un nivel: sólida (391), estacional (32: la sensibilidad estacional supera 10 puntos), interrumpida (4: una caída anómala en la ventana de comparación), pequeña (1: menos de 300 entradas/día en la línea base). Las tres últimas se muestran con anillo punteado y no entran en las medianas por borough ni por tipo.

**Datos nuevos [pendiente].** El notebook `datos_nuevos.ipynb` trae tres cosas: el perfil hora-de-la-semana de enero–febrero de 2024 (corrige la ventana del perfil, no solo de la recuperación), estación × mes × hora × laborable (para reconstruir la forma del día en cualquier período) y la capa ACS 2018–2022 del Census por área de influencia de 800 m (share de trabajo desde casa, transporte público, ingreso, densidad). La tercera es la que contrasta la hipótesis del capítulo 5.

**Geografía.** Contornos de boroughs (NYC DCP) y trazado del metro (GTFS estático de la MTA), simplificados con Douglas–Peucker a 77 KB.

---

## 4 · Hallazgos

Los siete se generan desde el modelo. Tres son positivos, dos son negativos (lo que los datos *no* sostienen) y uno es un límite.

1. **La recuperación se estancó cerca del 70 %.** Desde 2023 el sistema oscila entre el 65 y el 76 % de las entradas de enero de 2020.

2. **El pico de la mañana se aplanó en 80 % de las estaciones.** La razón pico/valle cayó un 17 % en la estación mediana. Con cualquier margen serían 378 de 428; con el umbral del 5 %, 341.

3. **El Bronx perdió más pasajeros que nadie y es el único borough donde el día no cambió de forma.** Recuperación mediana del 56 % frente al 69 % en Manhattan, Brooklyn y Queens; cambio del pico de −5 % frente a −16 a −19 %. El perfil agregado del Bronx en 2024 es casi idéntico al de 2020 (13.8 % → 13.2 % a las 7 h); los otros tres perdieron 2–4 puntos del pico matutino. Aguanta con el umbral del 5 %, con todo 2024 y restringido a estaciones de más de 2 000 entradas/día.

4. **Dentro de un borough, cuánto volvió una estación no dice casi nada de cuánto se aplanó** (ρ de Spearman entre −0.07 y −0.18). Son dos ejes distintos y la aplicación los codifica en canales distintos. La relación que sí existe (−0.24 global) es entre boroughs, y es la del Bronx.

5. **El cambio fue en una sola dirección: la mañana perdió peso frente a la tarde.** La asimetría bajó 0.04 en la mediana y 53 de las 54 estaciones que cruzaron un umbral de tipo lo hicieron hacia "laboral". El 87 % conservó su tipo: la ciudad no se reorganizó, se atenuó.

6. **37 estaciones tienen una comparación poco confiable, y están marcadas.** Playas, estadios y aeropuerto (sensibilidad estacional), cuatro con caída anómala en enero–febrero de 2024 (entre ellas 21 St-Queensbridge y 57 St, de la línea F, por obras), una con línea base demasiado pequeña.

7. **El abono de 30 días se desplomó: la evidencia del uso intermitente.** Del 25 % al 6 % de las entradas. Un pase mensual solo conviene con uso diario; su caída es consistente con el aplanamiento. La migración MetroCard → OMNY es adopción tecnológica, no demanda.

**Lectura.** Aplanar el pico es lo que hace el trabajo híbrido. Donde la gente no puede quedarse en casa, el pico se queda y solo baja el volumen. Es una hipótesis consistente con los datos, no una medición: la capa del Census la contrasta **[pendiente]**.

---

## 5 · Diseño

### 5.1 Narrativa

Siete capítulos, cada uno con la misma anatomía: una **pregunta** como título, el **hallazgo** como una frase con su tipo (hallazgo · lo que no se sostiene · límite), el **gráfico**, dos notas (**cómo se mide** · **qué no demuestra**) y un botón que abre el **explorador** ya configurado en lo que se acaba de ver. El lector puede leer de corrido, saltar con `←` `→`, o irse a explorar en cualquier punto sin perder el contexto.

La referencia es la estructura de FINO (VAST Challenge 2026, UTEC): vistas tituladas con preguntas, hallazgos como afirmaciones que incluyen lo que no se demuestra, una jerarquía epistémica visible, y cada afirmación a un clic de su evidencia.

### 5.2 Codificación

| canal | qué lleva | por qué |
|---|---|---|
| posición en el mapa | lugar | el canal más preciso, para la variable que es espacial |
| color categórico (3) | tipo de estación | identidad; sigue a la estación en todas las vistas; validado para daltonismo (peor par ΔE 9.2) |
| color secuencial | recuperación | una magnitud, una tonalidad; recortada en p10–p90 y dicho en la leyenda |
| color divergente | cambio del pico | polaridad real: aplanó ↔ igual ↔ afiló; punto medio gris |
| tamaño | entradas por día | contexto, en el canal menos preciso; nunca cambia con la lente |
| anillo punteado | confiabilidad | el estado se ve en todas las lentes sin robar el canal de color |
| área gris + línea | antes / ahora | con dos líneas superpuestas el "antes" quedaba tapado |

Regla del sistema: el único color de la página es el dato. El cromo es negro y gris.

### 5.3 Alternativas descartadas

| elegido | descartado | por qué |
|---|---|---|
| small multiples con escala común | 428 líneas superpuestas · animar la transición · agrupar en tipos y mostrar un representante | el overplotting borra la forma; la animación rinde peor para comparar dos momentos distantes (Lee et al., 2020); agrupar promedia y esconde la variación |
| tipología por asimetría de entradas | clustering de los 168 valores | la asimetría tiene significado físico (salir de casa / salir del trabajo), es un número por estación y se explica en una frase |
| dispersión recuperación × aplanamiento | dispersión pico/valle antes × después | los dos ejes del cambio son la pregunta; el antes/después lo cuenta el perfil |
| lentes en un mapa | cuatro mapas | el lector compara con la memoria, no con el ojo; cambiar la lente conserva posición y tamaño |
| anillo punteado para confiabilidad | excluir las estaciones dudosas | excluir esconde; marcar informa |
| contornos de boroughs y metro | solo puntos | las preguntas 5 y 6 son geográficas; con el fondo recesivo no compite con el color |

### 5.4 Interacción

Una sola selección compartida. Clic en una estación la resalta en el mapa, la dispersión y la rejilla, y abre su panel de evidencia. Un rectángulo en la dispersión filtra; un período en la serie temporal cambia el canal de tamaño del mapa. La barra de estado dice siempre cuántas estaciones y qué share de entradas quedan, y de qué capítulo vino el lector. Los filtros son chips que se quitan con un clic.

### 5.5 Accesibilidad

Paleta validada con el script de la guía; dark mode como conjunto propio de tokens (no un flip automático); leyenda de significado abierta a un clic; valores en tablas en el panel de cada estación; navegación por teclado entre capítulos y cierre con `Esc`; `prefers-reduced-motion` respetado.

---

## 6 · Feedback del design review **[pendiente]**

Resumen del feedback recibido el 14 de octubre, en el formato *Me gusta / Ojalá / ¿Y si…?*. El registro sugerencia por sugerencia, con la decisión tomada y su justificación, está en `PeerCritiqueResponse.md`.

---

## 7 · Limitaciones

1. **La línea base son dos meses de invierno.** Este dataset no tiene 2019. La comparación de misma ventana calendario (enero–febrero de 2024) corrige la estacionalidad, pero enero–febrero de 2024 tuvo obras en la línea F y un invierno propio. Las estaciones afectadas están marcadas; el problema de fondo no desaparece.
2. **El perfil de 168 h de 2024 todavía es el año completo** hasta integrar la pasada D del notebook **[pendiente]**.
3. **Son entradas, no viajes.** No hay origen–destino. "Laboral" y "residencial" describen a qué hora entra la gente, no a dónde va.
4. **Los cambios de servicio no están controlados.** Se detectan en los datos las caídas grandes; no se cruzan con avisos de la MTA.
5. **La explicación del Bronx es una hipótesis.** Los datos muestran el patrón; la capa del Census es lo que podría sostener el mecanismo **[pendiente]**.
6. **Complejo, no estación.** Times Sq-42 St agrupa varias líneas.
7. **Se dibujan 120 múltiplos a la vez** de los 428; el contador lo dice.

---

## 8 · Lo que falta y quién lo hace

| | tarea | responsable | para |
|---|---|---|---|
| 1 | Correr `datos_nuevos.ipynb` e integrar la ventana comparable del perfil, los perfiles por mes y la capa ACS | Renzo | 21 oct |
| 2 | Capítulo 5: contrastar la hipótesis del teletrabajo con el share de trabajo desde casa por estación | Renzo · José | 24 oct |
| 3 | Brush temporal que reconstruya la forma del día del período elegido (con los perfiles por mes) | Stewart | 24 oct |
| 4 | Responder cada sugerencia del design review en `PeerCritiqueResponse.md` | los tres | 20 oct |
| 5 | Paper: borrador completo en dos columnas (`paper/`) | José | 26 oct |
| 6 | Página del proyecto (es la propia aplicación) y README raíz | Stewart | 26 oct |
| 7 | Revisión cruzada: cada uno lee un capítulo que no escribió y anota qué no se entiende | los tres | 27 oct |

Para la Semana 15: video teaser, video de presentación, poster, presentación final.

---

## Referencias

- Lee, Archambault y Nacenta (2020). *The Effectiveness of Interactive Visualization Techniques for Time Navigation of Dynamic Graphs on Large Displays*. arXiv:2008.12747.
- Sasaki, Nakamura et al. (2022). *An Empirical Study on the Relationship Between the Number of Coordinated Views and Visual Analysis*. arXiv:2204.09524.
- Yap, Cats et al. (2022). *Identifying Human Mobility Patterns using Smart Card Data*. arXiv:2208.05352.
- Hsu, Wu et al. (2021). *Investigating spatio-temporal mobility patterns and changes in metro usage under the impact of COVID-19 using Taipei Metro smart card data*. Public Transport.
- Aquino, Arbulú, Acuña y Pajuelo (2026). *FINO — Forensic Intelligence and Network Oversight*. VAST Challenge 2026 MC1, UTEC. Referencia de estructura narrativa y de jerarquía epistémica visible.
