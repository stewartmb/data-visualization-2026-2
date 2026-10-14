---
title: "Delivery 1 — Consolidación de la primera fase"
subtitle: "Fractal: cómo cambió el ritmo horario del metro de Nueva York, 2020–2024"
author: "Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino"
date: "DS5343 Data Visualization · UTEC · 2026-2"
lang: es
---

## 1. Problema, audiencia y dataset

### 1.1 Problema

El metro de Nueva York programa su servicio alrededor del doble pico del día laborable: una cresta en la mañana y otra al final de la tarde. Sobre esa forma se decide la frecuencia de trenes y la asignación de personal.

Entre 2020 y 2024 esa forma cambió, pero casi siempre se reporta como un solo número: cuánto se recuperó el ridership frente al nivel previo. Ese número dice cuánta demanda volvió, no a qué hora vuelve ni en qué estaciones. Una estación puede haber recuperado el 90 % de sus entradas y aun así haber perdido su pico de la mañana. Si el perfil de demanda cambió y la programación siguió igual, hay trenes de más en unas franjas y de menos en otras.

Por eso no trabajamos con el volumen total sino con el **perfil horario semanal de cada estación**: 24 horas por 7 días, 168 valores normalizados por el total de la estación. Ese vector describe su ritmo, no su tamaño.

Esto necesita una visualización y no una tabla: son más de 400 estaciones con 168 valores cada una, y la pregunta es de comparación de formas —qué perfiles se parecen, cuáles cambiaron y si esos cambios se agrupan en el mapa—. Un listado numérico de ese tamaño no permite ver nada de eso.

### 1.2 Audiencia

**Principal.** Planificadores de servicio de la MTA y analistas de transporte urbano. La visualización debe ayudarlos a decidir dónde reasignar frecuencia, permitiéndoles identificar qué estaciones cambiaron su perfil, en qué dirección y si hay patrón geográfico.

Un uso concreto: filtrar las estaciones cuyo pico matutino cayó más que el de la tarde, verlas sobre el mapa y comparar ese conjunto con la frecuencia programada en esa franja.

**Secundaria.** Periodistas de transporte y gobiernos locales, a quienes la visualización debe ayudar a entender si la recuperación fue pareja entre barrios y quiénes siguieron usando el sistema en los años más bajos.

### 1.3 Dataset

MTA Subway Hourly Ridership: 2020–2024 (`wujg-7c2s`, portal Open NY del Estado de Nueva York). Granularidad horaria, cinco boroughs y tres modos.

Los datos provienen de torniquetes: *swipes* de MetroCard y *taps* de OMNY, estos últimos provistos por Cubic. La MTA limpia, deduplica y retira transacciones de agencias asociadas antes de publicar; declara que sus cifras quedan dentro del 1 % de las que reporta públicamente.

Atributos que usamos: `transit_timestamp`, `station_complex_id`, `station_complex`, `borough`, `latitude`, `longitude`, `ridership`, `payment_method`, `fare_class_category`.

Acceso abierto sin registro. La ficha no declara una licencia específica; el documento metodológico indica que no hay limitaciones de uso y aplican los términos de OPEN-NY.

---

## 2. Preguntas de dominio revisadas

Van de lo general a lo específico: agregado, forma, grupos, cambio, geografía.

1. ¿Cómo evolucionó el volumen total de entradas entre 2020 y 2024, y en qué nivel se estabilizó?
2. **(revisada)** ¿Cuánto se aplanó y se corrió el día laborable respecto de la línea base prepandemia, y qué estaciones cambiaron más?
3. ¿Se pueden agrupar los complejos de estación según la forma de su perfil semanal? ¿Cuántos tipos salen y cómo se caracterizan?
4. ¿Qué estaciones cambiaron de tipo entre 2020 y 2024, y en qué dirección?
5. ¿Cómo se distribuyen geográficamente esos tipos y esos cambios? ¿Hay patrón por borough o por distancia a Manhattan?
6. ¿La recuperación fue pareja? ¿Qué estaciones siguen por debajo de su nivel inicial y cuáles lo superaron?
7. ¿Qué muestra la composición por clase tarifaria sobre quiénes sostuvieron la demanda en los años más bajos?

**Qué cambió.** La pregunta 2 originalmente preguntaba cómo cambió la forma del día laborable. Los datos mostraron que el cambio no es la desaparición del doble pico sino su corrimiento y aplanamiento, y que la magnitud depende críticamente de la línea base elegida. Las preguntas 1 a 5 responden a la audiencia principal; las 6 y 7, a la secundaria.

---

## 3. Análisis de datos

### 3.1 Verificación previa

Todo el proyecto compara la misma estación entre 2020 y 2024, lo cual solo es válido si `station_complex_id` es estable. Consultamos cuatro ventanas de siete días por año y comparamos los conjuntos de identificadores: **428 complejos, presentes los cinco años, sin un solo cambio de nombre**. El riesgo marcado como principal en la propuesta no se materializó.

### 3.2 Transformaciones

El archivo completo supera los gigabytes, así que no se descarga: se agrega del lado del servidor con SoQL contra la API de Socrata.

La primera versión del pipeline agregaba por mes y expiraba. Medimos el comportamiento real de la API con `date_trunc_ymd` en el `$group`:

| Rango | Resultado |
|---|---|
| 1 día | 0.9 s |
| 7 días | 2.0 s |
| 1 mes | expira a los 600 s |

No es degradación gradual: hay un precipicio entre una semana y un mes. Por eso las pasadas que usan expresiones de fecha recorren el período en ventanas de siete días.

Tablas producidas:

| Archivo | Agrupación | Filas |
|---|---|---|
| `ridership_by_station_day.csv` | complejo × día | 780 446 |
| `ridership_by_station_hourofweek_year.csv` | complejo × dow × hora × año | 359 442 |
| `ridership_by_month_borough_payment_fare.csv` | mes × borough × pago × tarifa | 2 811 |
| `station_profiles_normalized.csv` | perfiles que suman 1 | 359 520 |
| `prepandemia_station_hourofweek.csv` | complejo × dow × hora, ene–feb 2020 | 71 866 |
| `stations_coords.csv` | una fila por complejo, con coordenadas | 428 |

Cobertura de la tabla estación × día: 99.8 % de las combinaciones posibles, los 1827 días del período. Cero coordenadas fuera del rango de Nueva York. Cero complejos asignados a más de un borough.

La numeración de `date_extract_dow` se verificó por los datos y no se asumió: los dos valores con menos ridership son 0 (402 M) y 6 (508 M) frente a 710–813 M del resto, lo que confirma 0 = domingo y 6 = sábado.

### 3.3 Hallazgos

**La recuperación se estancó cerca del 70 %.** De 139.0 M de entradas en enero de 2020 al fondo de 12.1 M en abril (8.7 %). La recuperación es sostenida hasta 2023 y ahí se aplana: diciembre de 2024 llega a 105.4 M, un 75.8 %.

**La recuperación fue desigual entre boroughs.**

| Borough | ene-2020 | dic-2024 | Recuperación |
|---|---|---|---|
| Manhattan | 77.2 M | 60.4 M | 78.3 % |
| Queens | 19.6 M | 15.2 M | 77.8 % |
| Brooklyn | 30.7 M | 22.7 M | 73.8 % |
| Bronx | 11.3 M | 6.9 M | 60.9 % |
| Staten Island | 0.3 M | 0.2 M | 58.7 % |

A nivel de estación la mediana de recuperación es 71 %, con p10 en 56 % y p90 en 89 %.

**El día laborable se corrió hacia la tarde.**

| | pico AM | pico PM | AM/PM | pico/valle |
|---|---|---|---|---|
| ene–feb 2020 | 10.43 % a las 8 h | 10.28 % a las 17 h | 1.014 | 2.90 |
| 2024 | 9.11 % a las 8 h | 9.95 % a las 17 h | 0.916 | 2.35 |

Las 8 h pierden 1.31 puntos porcentuales; la franja de 13 a 16 h gana alrededor de medio punto por hora. El fin de semana pasó de 16.1 % a 19.2 % del ridership semanal.

**El pico se aplanó en 372 de 414 estaciones.**

**La composición del pago se dio vuelta.** OMNY pasó de 1.5 % del ridership en enero de 2020 a 65.2 % en diciembre de 2024, superando el 50 % en enero de 2024. OMNY – Full Fare fue de 4.4 % a 54.3 %; MetroCard – Unlimited 30-Day cayó de 19.3 % a 7.9 %, consistente con el aplanamiento del pico.

---

## 4. Dirección de visualización seleccionada

De las direcciones candidatas evaluadas en la propuesta, seleccionamos **la comparación de formas de perfil entre la línea base prepandemia y 2024, anclada geográficamente**.

Descartamos dos alternativas:

- **Adopción de OMNY como eje central.** Es un fenómeno de adopción tecnológica, no de demanda, y no responde a la decisión de reasignar frecuencia. Queda como vista secundaria.
- **Análisis de flujos origen–destino.** Imposible con esta fuente: solo hay entradas.

La dirección seleccionada se sostiene en que el perfil normalizado de 168 valores es simultáneamente comparable entre estaciones y entre años, y en que el resultado se puede llevar al mapa sin unir con otra fuente, porque el dataset trae coordenadas por complejo.

---

## 5. Arquitectura de la aplicación

Una página, cinco vistas, todas enlazadas por brushing: una selección en cualquiera filtra las demás.

```
┌────────────────────────────────────────────────────────┐
│  TÍTULO                                                │
├──────────────────────┬─────────────────────────────────┤
│  A · MAPA            │  B · PERFILES SEMANALES         │
│  428 estaciones      │  small multiples, 168 valores   │
├──────────────────────┴─────────────────────────────────┤
│  C · SERIE TEMPORAL (ene 2020 – dic 2024, con brush)   │
├──────────────────────┬─────────────────────────────────┤
│  D · DISPERSIÓN      │  E · COMPOSICIÓN TARIFARIA      │
└──────────────────────┴─────────────────────────────────┘
```

| Vista | Preguntas | Codificación principal |
|---|---|---|
| A · Mapa | 5, 6 | posición = coordenadas; color = recuperación (divergente); tamaño = volumen |
| B · Perfiles | 2, 3, 4 | small multiples de 168 puntos; prepandemia superpuesto en gris |
| C · Serie temporal | 1 | posición sobre eje común; línea de referencia en el nivel prepandemia |
| D · Dispersión | 3, 4 | x = índice prepandemia; y = índice 2024; diagonal de referencia |
| E · Tarifas | 7 | áreas apiladas al 100 % |

**Justificación resumida.** El mapa reserva la posición al espacio porque es el canal más preciso y aquí el espacio es la variable. Los perfiles van en small multiples porque hay que comparar 428 series y un gráfico compartido sería ilegible. La serie temporal ocupa el ancho completo porque su brush define el rango de todas las demás. La dispersión usa la diagonal como referencia porque la distancia a ella *es* la magnitud del cambio y el lado *es* la dirección.

Los bocetos de cada vista, con títulos, ejes, leyendas, anotaciones e interacciones, están en `sketches/`.

---

## 6. Plan de implementación en D3.js

Priorizado: las tres primeras vistas constituyen el núcleo funcional y sostienen cinco de las siete preguntas.

| Prioridad | Componente | Dependencias |
|---|---|---|
| 1 | Carga de datos y conversión a JSON compacto | ninguna |
| 2 | Vista C — serie temporal con brush | datos cargados |
| 3 | Vista A — mapa de estaciones | coordenadas, recuperación por estación |
| 4 | Vista B — small multiples de perfiles | perfiles normalizados |
| 5 | Estado compartido y brushing entre A, B y C | vistas 2–4 |
| 6 | Vista D — dispersión pico/valle | índices derivados |
| 7 | Vista E — composición tarifaria | tabla de tarifas |
| 8 | Estilo, leyendas, accesibilidad y responsive | todo lo anterior |

**Riesgo principal de implementación.** El volumen de datos en el navegador: 428 estaciones × 168 valores × dos períodos. Mitigación: precalcular los agregados a JSON compacto y no enviar la tabla estación × día completa al cliente.

**Riesgo secundario.** Que el agrupamiento de perfiles no produzca grupos interpretables. Mitigación: reemplazarlo por dos índices directos, la razón pico/valle y la razón laborable sobre fin de semana, que responden las mismas preguntas con menos maquinaria.

---

## 7. Responsabilidades y cronograma

| Integrante | Responsabilidad |
|---|---|
| Renzo Acervo Correa | Pipeline de datos, agregaciones y preparación de los JSON para el cliente |
| Stewart Maquera Bobadilla | Implementación en D3 y vistas enlazadas |
| José Condori Palomino | Narrativa, diseño visual y paper |

Los tres participan en la formulación de preguntas, la crítica de diseño y la presentación final.

| Semana | Fecha | Objetivo |
|---|---|---|
| 10 | 14 oct | Prototipo funcional en D3 con las vistas A, B y C enlazadas |
| 12 | 28 oct | Narrativa integrada, vistas D y E, respuesta a la crítica por pares |
| 15 | 18 nov | Aplicación publicada, paper, teaser, video, poster y presentación final |

---

## 8. Reflexión: qué cambió al examinar los datos

**El riesgo que temíamos no era el riesgo real.** En la propuesta marcamos la estabilidad de `station_complex_id` como el riesgo principal del proyecto. Resultó perfecta: 428 complejos, cinco años, cero cambios. El riesgo real apareció en otro lado.

**La API tiene un límite que no es el que esperábamos.** Asumimos que el problema sería el volumen total. El problema fue un precipicio en el planificador de consultas de Socrata entre una semana y un mes de rango. Medirlo cambió el diseño del pipeline completo.

**La línea base decide la conclusión.** Este es el cambio de fondo. Nuestra primera comparación usaba el año 2020 completo, que mezcla enero y febrero prepandemia con el confinamiento. Contra esa referencia, la razón pico/valle del sistema pasaba de 2.34 a 2.35 y la conclusión habría sido que el día laborable no cambió de forma.

Al extraer por separado el perfil de enero–febrero de 2020, la razón cae de **2.90 a 2.35** y 372 de 414 estaciones muestran aplanamiento. La conclusión se invirtió por completo.

La consecuencia para el proyecto es doble. Primero, reformulamos la pregunta 2 para que hable de magnitud de aplanamiento y corrimiento, no de desaparición del doble pico. Segundo, incorporamos la línea base prepandemia como tabla propia del pipeline, y toda tasa de recuperación del proyecto se calcula contra ella y no contra el año 2020.

**El alcance se mantiene, con una prioridad explícita.** Las cinco vistas siguen en pie, pero las tres primeras son el núcleo entregable y las dos últimas son extensión.
