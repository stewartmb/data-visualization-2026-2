# Guion · design review Semana 10

**5 minutos.** Dos demos en vivo (slides 3–5). Si te atrasas, recorta la 6 y salta a la 7.

**Antes de entrar:** la aplicación abierta en otra pestaña, en la vista Perfiles, en modo claro. Probar una vez: pestaña Recorrido, `→`, clic en una estación en Explorador, `Esc`.

---

## 1 · Portada — 10 s

> Somos Renzo, Stewart y José. *La forma del día*: cómo cambió el ritmo horario del metro de Nueva York entre 2020 y 2024, y quién no lo cambió.

## 2 · Problema y audiencia — 40 s

> El metro se programa alrededor del doble pico del día laborable. Esa forma cambió con la pandemia, pero la recuperación se reporta con un solo número, que no dice a qué hora volvió la gente ni en qué barrios.
>
> Nuestra unidad de análisis es el perfil horario de cada estación: 24 horas por 7 días, 168 valores, divididos por el total de esa estación. Describe su ritmo, no su tamaño.
>
> Y la pregunta cambió desde la Semana 7. Que el pico se aplanó, ya se sabía. La pregunta ahora es quién resistió y dónde.
>
> La audiencia son investigadores de transporte, periodismo de datos y gobierno local. Ya no decimos "planificadores de la MTA": la MTA tiene datos internos muy superiores a estos.

## 3 · El prototipo — 60 s · **DEMO**

**Cambiar a la pestaña de la aplicación**, vista Perfiles.

> Esta es la vista base. Arriba, los siete hallazgos del proyecto como tarjetas. Abajo a la izquierda, la forma del día de todo el sistema: el área gris es enero–febrero de 2020, la línea negra es 2024; el pico de la mañana pasó del 10.4 al 9.1 por ciento del día. A la derecha, las 428 estaciones, una por tarjeta, 168 horas cada una.

**Clic en la pestaña Recorrido, luego `→` dos veces** hasta el capítulo 2.

> El recorrido lleva los siete capítulos: una pregunta, el hallazgo como frase, el gráfico, y plegados, cómo se mide y qué no demuestra.

> El capítulo 2: el mismo perfil, por borough. Manhattan, Brooklyn y Queens pierden el pico de la mañana. El Bronx, no.

## 4 · El hallazgo — 60 s · **DEMO**

**Presionar `→` tres veces** hasta el capítulo 5.

> El Bronx perdió más pasajeros que ningún otro borough — 56 por ciento de recuperación contra 69 — y es el único donde el día no cambió de forma: su pico cambió 5 por ciento; los demás, entre 16 y 19.
>
> A la izquierda, cada punto es una estación: recuperación en x, cambio del pico en y. Las del Bronx en negro, apiladas donde el pico no cambió. A la derecha, el mapa del Bronx con la lente de cambio del pico: casi nada de azul.
>
> Nuestra lectura: aplanar el pico es lo que hace el trabajo híbrido. Donde la gente no puede quedarse en casa, el pico se queda y solo baja el volumen. Es una hipótesis consistente con los datos, no una medición. Lo decimos en la propia página.

## 5 · El explorador y la evidencia — 50 s · **DEMO**

**Clic en "Ver estas estaciones en el explorador".** Baja con el Bronx filtrado.

> El botón manda al explorador ya configurado: 68 estaciones, el Bronx. Cuatro vistas y una sola selección.

**Clic en una estación grande del mapa** (161 St-Yankee Stadium si se ve; si no, cualquiera).

> Un clic abre el panel de evidencia: las cifras, el perfil antes y después, su serie mensual, y la tabla con los números detrás de cada afirmación. Y si la comparación es poco confiable — acá: Yankee Stadium es estacional, enero–febrero es temporada baja de béisbol — el panel lo dice. Nada se esconde.

**`Esc`. Volver a las slides.**

## 6 · Decisiones y alternativas — 40 s

> Tres decisiones. La tipología residencial / laboral sale de la asimetría mañana/tarde de las entradas: salir de casa, salir del trabajo. Descartamos clustering porque la asimetría tiene significado físico y se explica en una frase.
>
> La confiabilidad se marca en vez de excluir: 37 estaciones con anillo punteado y motivo, fuera de las medianas. Excluir esconde; marcar informa.
>
> Y la ventana: comparamos enero–febrero de 2024 contra enero–febrero de 2020, misma ventana calendario. Contra todo 2024, 155 estaciones cambiaban más de 5 puntos.

## 7 · Lo que corregimos y lo que no sabemos — 30 s

> Desde la Semana 7 corregimos las ventanas del índice, el titular — ya no "372 de 414" sino "80 por ciento con umbral del 5" — y detectamos cortes de servicio en los datos: la línea G de 2024, las obras de la F.
>
> Lo que no sabemos: por qué el Bronx. La hipótesis del teletrabajo se contrasta con el Census en la Semana 12. Y el perfil de 2024 es todavía el año completo; la recuperación ya no.

## 8 · Preguntas — 40 s · **dejar en pantalla**

> Seis cosas en las que estamos divididos.
>
> Uno: si la tipología convence o si "residencial / laboral" promete más de lo que mide.
> Dos: si el Bronx está bien contado o parece que forzamos la lectura del teletrabajo. Qué evidencia pedirían.
> Tres: si narrativa más explorador es la estructura correcta, o estorba a quien ya sabe qué busca.
> Cuatro: si los hallazgos negativos — lo que los datos no sostienen — aportan o confunden.
> Cinco: si la capa de confiabilidad se lee o es ruido.
> Seis: qué le falta para que lo use un periodista o un investigador.
>
> Gracias.

---

## Si preguntan

**¿Por qué cambió tanto desde la Semana 7?**
El prototipo de la 7 funcionaba y no contaba nada. Al revisar la metodología encontramos el sesgo de la ventana y, al buscar quién resistió, el Bronx. Reconstruimos alrededor de eso.

**¿De dónde sale la tipología? ¿No es arbitraria?**
Entradas de 6 a 10 menos entradas de 16 a 20, sobre la suma. Umbral ±0.15. Es la asimetría del propio torniquete. 67 de las 80 laborales están en Manhattan, que es lo que uno esperaría.

**¿Y si el Bronx es un artefacto de cortes de servicio?**
No hay estaciones del Bronx con caídas anómalas en la ventana de comparación. Y el resultado aguanta con todo 2024 y restringido a estaciones grandes.

**¿Por qué D3 y no una librería de alto nivel?**
Lo pide el curso, y las vistas comparten un estado propio que es más fácil de controlar con D3.

**¿Cuánto tarda en cargar?**
1.6 MB de modelo más 77 KB de geografía. El dataset crudo son más de 4 GB; nunca se descarga.

**¿Qué significa "lo que no se sostiene"?**
Un hallazgo negativo: lo que uno esperaría ver y los datos no muestran. Dentro de un borough, cuánto volvió una estación casi no se relaciona con cuánto se aplanó. Lo decimos porque saberlo cambia cómo se lee el resto.
