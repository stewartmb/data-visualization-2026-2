---
title: "La forma del día: cómo cambió el ritmo horario del metro de Nueva York, 2020–2024"
subtitle: "DS5343 Data Visualization — Propuesta de Proyecto (Semana 5)"
author: "Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino"
date: "9 de septiembre de 2026"
lang: es
---

## 1. Equipo y título de trabajo

**Título de trabajo:** La forma del día: cómo cambió el ritmo horario del metro de Nueva York, 2020–2024.

**Integrantes:** Renzo Acervo Correa, Stewart Maquera Bobadilla, José Condori Palomino.

**Repositorio:** <https://github.com/stewartmb/data-visualization-2026-2>

## 2. Problema y contexto

El metro de Nueva York programa su servicio alrededor del doble pico del día laborable: una cresta en la mañana y otra al final de la tarde. Sobre esa forma se decide la frecuencia de trenes y la asignación de personal.

Entre 2020 y 2024 esa forma cambió. El problema es que casi siempre se reporta como un solo número: cuánto se recuperó el ridership frente al nivel previo. Ese número dice cuánta demanda volvió, pero no dice a qué hora vuelve ni en qué estaciones. Son cosas distintas. Una estación puede haber recuperado el 90% de sus entradas y aun así haber perdido su pico de la mañana. Importa porque si el perfil de demanda de un grupo de estaciones cambió y la programación siguió igual, hay trenes de más en unas franjas y de menos en otras.

Por eso no vamos a trabajar con el volumen total sino con el perfil horario semanal de cada estación: 24 horas por 7 días, o sea 168 valores por estación. Ese vector describe el ritmo de la estación, no su tamaño. Comparándolo entre estaciones y entre años se puede ver qué cambió y dónde.

Esto necesita una visualización y no una tabla. Son más de 400 estaciones, cada una con 168 valores por año, y la pregunta es de comparación de formas: qué perfiles se parecen entre sí, cuáles cambiaron y si esos cambios se agrupan en el mapa. Un listado numérico de ese tamaño no permite ver parecidos ni detectar el patrón geográfico; codificar el perfil visualmente y enlazarlo con un mapa sí.

Contexto mínimo para entender los datos: el metro opera 24 horas, tiene más de 400 complejos de estación en cinco boroughs, y durante el período convivieron dos sistemas de pago, MetroCard y OMNY, en plena transición.

## 3. Audiencia y propósito

La audiencia principal son planificadores de servicio de la MTA y analistas de transporte urbano. La visualización debe ayudarlos a decidir dónde reasignar frecuencia, permitiéndoles identificar qué estaciones cambiaron su perfil de demanda, en qué dirección y si hay algún patrón geográfico.

Un uso concreto sería este: un planificador filtra las estaciones cuyo pico matutino cayó más que su pico de la tarde, las ve resaltadas sobre el mapa, y compara ese conjunto con la frecuencia programada en esa franja.

Como audiencia secundaria vemos a periodistas de transporte y gobiernos locales. A ellos la visualización debe ayudarlos a entender si la recuperación fue pareja entre barrios y quiénes siguieron usando el sistema en los años más bajos.

## 4. Dataset

**Fuente.** MTA Subway Hourly Ridership: 2020–2024, publicado por la Metropolitan Transportation Authority en el portal Open NY del Estado de Nueva York. Identificador Socrata `wujg-7c2s`. Son 120,855,568 registros con granularidad horaria, de 2020 a 2024, para los cinco boroughs y tres modos: metro, Staten Island Railway y el tranvía de Roosevelt Island.

**Colector y método de recolección.** La MTA registra las entradas al sistema en los torniquetes: swipes de MetroCard y taps de OMNY, estos últimos provistos por Cubic. Antes de publicar limpia y deduplica las transacciones y saca las de agencias asociadas. Son estimaciones, no un conteo exacto; la MTA declara que quedan dentro del 1% de las cifras que reporta públicamente.

**Atributos relevantes.** `transit_timestamp` para el eje temporal; `station_complex_id` y `station_complex` como unidad de análisis; `borough`, `latitude` y `longitude` para lo espacial; `ridership` como medida principal; `payment_method` y `fare_class_category` para desagregar.

**Problemas de calidad.** Corrimos 33 controles sobre la muestra de trabajo, documentados en el repositorio. No salieron valores faltantes, duplicados en la clave compuesta, valores negativos, casos donde `transfers` supere a `ridership`, ni coordenadas fuera del rango de Nueva York. Los problemas que sí encontramos son estructurales:

- Son entradas, no salidas. No hay pares origen–destino, así que no podemos analizar flujos de viaje con esta fuente.
- `transfers` es un subconjunto de `ridership`, no una medida aparte. Sumarlas duplicaría el conteo.
- La granularidad es de complejo, no de estación individual. Un complejo puede agrupar varias estaciones conectadas.
- El histórico puede cambiar por transacciones tardías.
- La transición de MetroCard a OMNY complica comparar por método de pago a lo largo del tiempo. Una caída en MetroCard no es una caída de demanda, es migración.

**Condiciones de acceso.** Datos abiertos, sin registro. La ficha oficial no declara una licencia específica; el documento metodológico de la MTA dice que no hay limitaciones de uso, y además aplican los términos de OPEN-NY. Atribuimos a MTA y Open NY.

**Preprocesamiento esperado.** El archivo completo pesa varios gigabytes, así que no se puede descargar entero ni servir al navegador. Vamos a agregar del lado del servidor con consultas SoQL contra la API de Socrata y bajar tres tablas de pocos megabytes:

1. `ridership_by_station_day`: suma por complejo y día. Sirve para el mapa y las series temporales.
2. `ridership_by_station_hourofweek_year`: suma por complejo, día de la semana y hora, separada por año. Es la base de los perfiles de 168 valores.
3. `ridership_by_month_borough_payment_fare`: base de la composición tarifaria.

Sobre la segunda vamos a normalizar cada perfil dividiéndolo por su propio total, para que las estaciones se agrupen por forma y no por tamaño.

**Por qué esta data soporta el proyecto.** El perfil de 168 valores requiere granularidad horaria, identificador de estación y cinco años continuos, y el dataset tiene las tres cosas. Las coordenadas por estación permiten llevar el resultado al mapa sin unir con otra fuente. Y `fare_class_category` da la desagregación por tipo de usuario que necesita la pregunta 7. Ninguna de nuestras preguntas depende de datos que no estén en la fuente.

## 5. Preguntas de dominio

Van de lo general a lo específico: primero el agregado, después la forma, después los grupos, después el cambio, después la geografía. Las preguntas 1 a 5 responden a la audiencia principal, porque terminan en qué estaciones cambiaron y dónde están. Las preguntas 6 y 7 responden a la audiencia secundaria, porque tratan de desigualdad y de composición de usuarios.

1. ¿Cómo evolucionó el volumen total de entradas entre 2020 y 2024, y en qué nivel se estabilizó?
2. ¿Cómo es el perfil de un día laborable frente al de un fin de semana, y cómo cambió esa forma en el período?
3. ¿Se pueden agrupar los complejos de estación según la forma de su perfil semanal? ¿Cuántos tipos salen y cómo se caracterizan?
4. ¿Qué estaciones cambiaron de tipo entre 2020 y 2024, y en qué dirección?
5. ¿Cómo se distribuyen geográficamente esos tipos y esos cambios? ¿Hay patrón por borough o por distancia a Manhattan?
6. ¿La recuperación fue pareja? ¿Qué estaciones siguen por debajo de su nivel inicial y cuáles lo superaron?
7. ¿Qué muestra la composición por clase tarifaria sobre quiénes sostuvieron la demanda en los años más bajos?

## 6. Factibilidad inicial

**Desafíos técnicos esperados.** El tamaño del archivo obliga a agregar del lado del servidor antes de bajar nada. Para el agrupamiento de perfiles hay que elegir el número de grupos y validarlo. Y en el navegador, más de 400 estaciones por 168 valores por varios años exige agregación previa y cuidado con el renderizado de los small multiples.

**Alcance.** El proyecto es realista para el semestre porque el pipeline se reduce a tres tablas agregadas que ya sabemos construir, y el script de adquisición está hecho desde la Semana 4. Las preguntas 1 a 5 son el núcleo y bastan para un proyecto completo; las preguntas 6 y 7 son extensión y las haremos solo si el tiempo alcanza. Si el agrupamiento resultara demasiado costoso, lo reemplazamos por dos índices directos, la razón pico/valle y la razón laborable/fin de semana, que responden las mismas preguntas con menos maquinaria.

**División del trabajo.** Renzo: pipeline de datos y agregaciones. Stewart: implementación en D3 y vistas enlazadas. José: narrativa, diseño visual y paper. Los tres participamos en la formulación de preguntas, la crítica de diseño y la presentación final.

**Riesgos principales.**

- Que `station_complex_id` no sea estable a lo largo del período. Para comparar una estación entre 2020 y 2024 el identificador tiene que ser el mismo; si hubo renombres o fusiones de complejos, las series se rompen. Es el riesgo más serio del proyecto.
- Que el agrupamiento de perfiles no produzca grupos interpretables.
- Que los límites de la API frenen la extracción de los agregados.
- Que el alcance quede demasiado grande para el semestre.
