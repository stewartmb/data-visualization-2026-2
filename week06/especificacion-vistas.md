# Especificación de vistas — para dibujar los sketches

**DS5343 · Semana 6 · Proyecto "La forma del día"**

Este documento define qué dibujar en cada boceto. Cada vista incluye título, ejes, leyenda, codificaciones, anotaciones, interacciones y por qué ese diseño responde a su pregunta.

Los bocetos pueden ser a mano o en Figma. Lo que importa es que se lean el layout, los encodings y las anotaciones.

---

## Arquitectura de la aplicación

Una sola página, cuatro zonas, todas enlazadas por brushing. La selección en cualquier vista filtra las demás.

```
┌────────────────────────────────────────────────────────────────┐
│  TÍTULO + una línea de contexto                                │
├──────────────────────────┬─────────────────────────────────────┤
│                          │                                     │
│   A · MAPA               │   B · PERFILES SEMANALES            │
│   428 estaciones         │   small multiples, 168 valores      │
│   color = recuperación   │   ordenados por tipo                │
│                          │                                     │
├──────────────────────────┴─────────────────────────────────────┤
│   C · SERIE TEMPORAL  (ene 2020 – dic 2024, con brush)         │
├──────────────────────────┬─────────────────────────────────────┤
│   D · DISPERSIÓN         │   E · COMPOSICIÓN TARIFARIA         │
│   pico/valle antes/después│   streamgraph mensual              │
└──────────────────────────┴─────────────────────────────────────┘
```

Regla de lectura: arriba el **dónde** y el **cuándo dentro del día**; al medio el **cuándo a lo largo de 5 años**; abajo el **cómo cambió** y el **quién**.

---

## Vista A — Mapa de estaciones

**Responde:** preguntas 5 y 6 (distribución geográfica, recuperación desigual).

| Elemento | Definición |
|---|---|
| Marca | un punto por complejo de estación (428) |
| Posición | longitud → x, latitud → y, proyección Mercator |
| Color | tasa de recuperación 2024 vs prepandemia, escala divergente rojo–azul centrada en la mediana (71 %) |
| Tamaño | ridership diario promedio 2024, escala de raíz cuadrada |
| Título | "Recuperación por estación, 2024 frente a enero–febrero 2020" |
| Leyenda | barra de color con los valores de p10 (56 %), mediana (71 %) y p90 (89 %) marcados; tres círculos de referencia para el tamaño |
| Anotaciones | etiquetar las 3 estaciones más bajas y las 3 más altas |

**Interacciones:** hover con tooltip (nombre, borough, recuperación, ridership); clic para seleccionar y filtrar el resto; lazo para selección múltiple; zoom y paneo.

**Por qué.** El atributo es espacial y la pregunta es si el cambio tiene patrón geográfico. La posición está reservada al espacio porque es el canal más preciso y aquí el espacio *es* la variable. La recuperación va a color porque es un valor divergente respecto a un punto de referencia, y una escala divergente hace que "por encima" y "por debajo" se lean sin consultar la leyenda. El tamaño lleva el volumen porque es el canal menos preciso y el volumen es contexto, no el foco.

---

## Vista B — Perfiles semanales (la vista central)

**Responde:** preguntas 2, 3 y 4 (forma del día, tipología, cambio de tipo).

| Elemento | Definición |
|---|---|
| Marca | un mini-gráfico por estación; dentro, área o línea de 168 puntos |
| Posición x (dentro) | hora de la semana, 0 a 167, con separadores tenues cada 24 |
| Posición y (dentro) | share del total semanal de esa estación |
| Layout | rejilla de small multiples, ordenada por tipo de perfil |
| Color | tipo de perfil (4 categorías, paleta cualitativa) |
| Superposición | el perfil prepandemia en gris detrás del perfil 2024 |
| Título | "Cada estación tiene un ritmo. Casi todas lo cambiaron." |
| Etiquetas | día de la semana bajo cada bloque de 24 h en el primer múltiplo |
| Anotaciones | señalar el pico de las 8 h y la meseta de 13–16 h en un múltiplo de ejemplo |

**Interacciones:** clic en un múltiplo para ampliarlo a detalle; filtro por tipo de perfil; conmutador prepandemia / 2024 / diferencia; ordenar por recuperación, por volumen o por magnitud del cambio.

**Por qué.** La pregunta es de comparación de formas entre cientos de series. Los small multiples permiten comparar muchas series sin superposición, que es el problema de un gráfico único con 428 líneas. El perfil se normaliza por el total de cada estación para que la comparación sea de forma y no de tamaño. Superponer el perfil prepandemia en gris convierte la comparación temporal en una comparación de posición dentro de un mismo marco, que se lee más rápido que dos gráficos lado a lado.

---

## Vista C — Serie temporal del sistema

**Responde:** pregunta 1 (evolución del volumen y nivel de estabilización).

| Elemento | Definición |
|---|---|
| Marca | línea con área bajo la curva |
| Posición x | mes, enero 2020 a diciembre 2024 |
| Posición y | entradas mensuales, en millones |
| Referencia | línea horizontal punteada en el nivel de enero 2020 |
| Título | "La recuperación se estancó cerca del 70 %" |
| Ejes | y con unidades explícitas ("millones de entradas/mes") |
| Anotaciones | abril 2020 (12.1 M, 9 %); la meseta desde 2023 |

**Interacciones:** brush horizontal que define el rango temporal de todas las demás vistas; hover con el valor del mes.

**Por qué.** La serie es temporal y continua, así que la posición sobre un eje común es el canal correcto. La línea de referencia en el nivel prepandemia convierte una lectura de magnitud absoluta en una de brecha, que es lo que la pregunta pide. Es la vista que ancla el rango temporal del resto: por eso ocupa el ancho completo.

---

## Vista D — Dispersión pico/valle

**Responde:** preguntas 3 y 4 (tipología y cambio de tipo).

| Elemento | Definición |
|---|---|
| Marca | un punto por estación (414; se excluyen 14, ver nota) |
| Posición x | razón pico/valle en enero–febrero 2020 |
| Posición y | razón pico/valle en 2024 |
| Referencia | diagonal y = x |
| Color | naranja si aplanó, azul si se afiló |
| Título | "El pico se aplanó en 9 de cada 10 estaciones" |
| Anotaciones | "372 de 414 aplanaron su pico"; etiqueta "sin cambio" sobre la diagonal |

**Interacciones:** selección por lazo que filtra el mapa y los perfiles; hover con nombre y ambos valores.

**Por qué.** La pregunta es si un índice cambió entre dos momentos, y un scatter antes/contra después con la diagonal de referencia responde eso directamente: la distancia a la diagonal *es* la magnitud del cambio, y el lado *es* la dirección. Un gráfico de barras de la diferencia perdería el nivel de partida, que importa porque una estación que va de 6 a 5 no cambió lo mismo que una que va de 2 a 1.

**Nota metodológica para el boceto:** se excluyen 14 estaciones cuyo pico matutino cae en el borde de la ventana de búsqueda (5–11 h), donde la razón no es confiable. Anotar esa exclusión en la vista.

---

## Vista E — Composición tarifaria

**Responde:** pregunta 7 (quién sostuvo la demanda).

| Elemento | Definición |
|---|---|
| Marca | áreas apiladas al 100 % (streamgraph o stacked area) |
| Posición x | mes |
| Posición y | share del ridership, 0 a 100 % |
| Color | clase tarifaria; agrupar las menores en "otras" |
| Título | "La composición tarifaria se dio vuelta" |
| Anotaciones | el cruce de enero 2024, cuando OMNY supera el 50 % |

**Interacciones:** hover con el share de cada clase en ese mes; clic en una banda para aislarla.

**Por qué.** La pregunta es de composición a lo largo del tiempo y las partes suman un todo, que es exactamente para lo que sirve un área apilada al 100 %. Se elige share y no valor absoluto porque la pregunta es de proporción, y porque el volumen total ya lo cuenta la vista C.

**Advertencia que debe quedar en la vista:** la migración de MetroCard a OMNY es adopción tecnológica, no cambio de demanda. Una nota al pie debe decirlo, o el lector va a leer una caída donde no la hay.

---

## Qué dibujar

Cinco bocetos, uno por vista, más uno del layout completo. En cada uno tienen que verse:

- el título y los ejes con sus unidades
- la leyenda
- al menos una anotación
- las interacciones indicadas con flechas o notas al margen

Exportar como PNG o PDF a `deliveries/week06/sketches/`.
