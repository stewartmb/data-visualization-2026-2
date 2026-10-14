# Prototype Report — La forma del día

**DS5343 Data Visualization · UTEC · 2026-2 · Semana 10**
Acervo Correa, Renzo Alfonso · Maquera Bobadilla, Diva Stewart · Condori Palomino, José Eduardo

Prototipo funcional en D3.js del proyecto *La forma del día: cómo cambió el ritmo horario del metro de Nueva York, 2020–2024*.

---

## 1 · Qué está implementado

Cuatro vistas enlazadas sobre los datos reales del proyecto: 428 complejos de estación, 60 meses, perfiles de 168 horas. Todo corre en el navegador desde un solo archivo JSON de 1.4 MB.

| | Vista | Qué muestra | Estado |
|---|---|---|---|
| **A** | Mapa de estaciones | 428 puntos · posición = lat/lon · color = recuperación 2024 vs prepandemia · tamaño = entradas/día | completa |
| **B** | Perfiles semanales | small multiples de 168 valores · área gris = ene–feb 2020 · línea azul = 2024 | completa |
| **C** | Serie temporal | entradas mensuales del sistema, ene 2020 – dic 2024, con línea de referencia en el nivel de enero 2020 | completa |
| **D** | Dispersión pico/valle | 414 estaciones · x = razón prepandemia · y = razón 2024 · diagonal y = x | completa |

De las cinco vistas propuestas en la Semana 6 faltan la **E** (composición tarifaria) y la capa de anotaciones.

### Interacciones funcionales

| Interacción | Dónde | Efecto |
|---|---|---|
| Clic en una estación | mapa, perfil o dispersión | la resalta en las tres vistas y la sube al primer lugar de la rejilla de perfiles |
| Brush rectangular | dispersión | filtra el mapa y los perfiles; la barra superior reporta cuántas estaciones y qué share de entradas quedan |
| Brush horizontal | serie temporal | el tamaño de los puntos del mapa pasa a ser el promedio diario de ese período; la barra reporta el nivel respecto de enero 2020 |
| Ordenar | perfiles | recuperación · volumen · magnitud del cambio · nombre |
| Modo | perfiles | ambos · solo 2024 · solo prepandemia · diferencia |
| Zoom y paneo | mapa | con compensación de radio para que los puntos no engorden al acercar |
| Hover | las cuatro vistas | tooltip con nombre, borough y los valores de la vista |
| Doble clic | dispersión y serie | limpia el filtro o el período |

El estado vive en un solo módulo (`src/estado.js`). Cualquier vista que lo modifique dispara un redibujado de las cuatro: eso es el *brushing & linking* del proyecto y es lo que hace que las vistas sean una sola herramienta y no cuatro gráficos juntos.

### Implementación

- **D3.js v7.9.0**, servido desde `lib/` y no desde un CDN: el prototipo funciona sin conexión y la versión queda fijada.
- **Módulos ES nativos**, sin bundler ni framework. 952 líneas propias entre HTML, CSS, JS y el script de datos.
- `code/build_app_json.py` reconstruye `data/app.json` desde los CSV de la Semana 6 en unos 3 segundos.
- Probado en Chromium headless con Playwright: las cuatro vistas renderizan, las interacciones responden y la consola queda limpia.

---

## 2 · Decisiones de diseño

### 2.1 La unidad de análisis es la forma, no el tamaño

El perfil de cada estación son 168 valores (24 h × 7 días) **divididos por el total semanal de esa estación**. Así Times Square y Burke Av se comparan por su ritmo y no por su volumen, que es lo que pregunta el proyecto. El volumen no desaparece: se va al canal de tamaño del mapa, que es el canal menos preciso, porque aquí es contexto.

### 2.2 Small multiples en lugar de 428 líneas superpuestas

**Alternativa descartada 1:** un solo gráfico con las 428 series. Ilegible: el *overplotting* convierte la comparación de formas en una mancha.
**Alternativa descartada 2:** animar la transición entre la línea base y 2024. Lee et al. (2020) muestran que la animación es justamente donde peor rinde la comparación entre dos momentos distantes, que es nuestra tarea; los small multiples con ambos estados a la vista rinden mejor y de forma consistente.
**Alternativa descartada 3:** agrupar las estaciones en 4 tipos de perfil y mostrar un representante de cada uno. El agrupamiento promedia, y la variación entre estaciones del mismo grupo es justamente lo que el mapa muestra que existe. Hsu, Wu et al. (2021) toman la misma decisión con datos del metro de Taipéi.

La escala vertical es **común a todos los múltiplos**. Con una escala por múltiplo cada gráfico ocuparía toda su caja y las formas dejarían de ser comparables, que es el único motivo por el que están juntos.

### 2.3 El perfil prepandemia va como área gris, no como segunda línea

La primera versión dibujaba dos líneas superpuestas. A 124 × 42 píxeles la línea gris quedaba tapada casi por completo por la azul y la comparación antes/después —el punto entero de la vista— no se leía. El área gris de fondo con la línea azul encima resuelve eso sin agregar un segundo gráfico.

### 2.4 La línea base es enero–febrero de 2020, no el año 2020 completo

Es la decisión más consecuente del proyecto y **invierte la conclusión**. Contra el año 2020 completo la razón pico/valle del sistema pasa de 2.34 a 2.35: no habría pasado nada. Contra la línea base prepandemia cae de 2.90 a 2.35. El año 2020 completo ya venía aplanado por el confinamiento; usarlo como referencia esconde el fenómeno que el proyecto quiere mostrar.

### 2.5 Color divergente y recortado en el mapa

La recuperación es un valor **respecto de una referencia**, así que la escala es divergente (RdYlBu) centrada en la mediana (71 %), no secuencial. Está recortada en p10 (56 %) y p90 (89 %) porque unos pocos valores extremos —Mets-Willets Point llega a 287 %— comprimían todo el resto a un solo tono.

### 2.6 Escala logarítmica en la dispersión

Pico/valle es una razón y su distribución está sesgada a la derecha (1.06 a 11.4). En log, la distancia a la diagonal es la razón entre ambos índices, que es la medida correcta de "cuánto cambió", y la masa de estaciones entre 2 y 5 deja de amontonarse.

**Alternativa descartada:** un gráfico de barras de la diferencia 2024 − prepandemia. Pierde el nivel de partida, y una estación que va de 6 a 5 no cambió lo mismo que una que va de 2 a 1.

### 2.7 Detalles de implementación que afectan la lectura

- El rectángulo de captura del brush va **debajo** de los puntos de la dispersión: encima bloqueaba el hover y el clic sobre cada estación.
- Los círculos de la leyenda de tamaño están **alineados por la base**, no por el centro, que es como se comparan círculos sin engañar al ojo.
- Seleccionar una estación **no recorta** la rejilla de perfiles: la sube al primer lugar y la resalta. Recortarla a una sola tarjeta destruía el contexto que hace útil la comparación.
- Un brush que no encierra ningún punto deja el conjunto vacío a propósito. Es información ("ahí no hay estaciones"), no un error que haya que deshacer solo.

---

## 3 · Limitaciones conocidas

### Del prototipo

1. **El brush temporal no reconstruye los perfiles.** Los 168 valores están fijos a dos ventanas (ene–feb 2020 y 2024). Cambiarlos con el período exigiría agregar estación × hora-de-la-semana × mes, que no está en las tablas de la Semana 6. Hoy el brush solo cambia el canal de tamaño del mapa y el reporte de la barra superior.
2. **Solo se dibujan 120 múltiplos a la vez** de los 428. El contador del panel lo dice. Falta scroll virtual.
3. **El mapa no tiene contexto geográfico.** Son puntos sobre latitud y longitud con una corrección de aspecto por latitud; no hay contorno de boroughs, ni costa, ni líneas del metro. Se reconoce la forma del sistema, no la de la ciudad.
4. **Falta la vista E** (composición tarifaria) y la capa de anotaciones de los bocetos.
5. **No hay accesibilidad por teclado** y la paleta no se verificó todavía con un simulador de daltonismo.
6. **Responsive mínimo:** por debajo de 980 px las vistas se apilan en una columna, sin rediseño.

### De los datos

7. **Mets-Willets Point aparece con 287 % de recuperación.** Es un artefacto de la línea base: enero–febrero es temporada baja de béisbol y el denominador queda muy chico. Lo mismo, en menor grado, con el RI Tramway (158 %). El prototipo todavía no marca estos casos en la interfaz.
8. **Se excluyen 14 estaciones de la dispersión** porque su máximo cae en el borde de la ventana de búsqueda (5–11 h) y ahí la razón no es confiable. El conteo "372 de 414" lo refleja.
9. **Son entradas, no viajes.** No hay pares origen–destino en esta fuente, así que ningún análisis de flujo es posible.
10. **Es el complejo de estación, no la estación individual.** Times Sq-42 St agrupa varias líneas.
11. **La migración MetroCard → OMNY es adopción tecnológica**, no cambio de demanda. Importa para la vista E, que todavía no existe.

---

## 4 · Preguntas para los revisores

Son las decisiones en las que estamos realmente divididos. Agradecemos feedback concreto sobre estas:

1. **¿El mapa necesita contexto geográfico?** Hoy son puntos sueltos. Agregar contorno de boroughs cuesta un GeoJSON y cambiar a una proyección de D3, es asumible. La duda es si el fondo ayuda a ubicar o si compite con el color, que es lo que hay que leer.

2. **¿"Pico/valle" se entiende?** Es un índice que inventamos nosotros y la vista D depende de que el lector lo compre. ¿Se lee, o conviene reemplazar D por un gráfico de pendientes (dos ejes verticales y una línea por estación), que no exige entender una razón?

3. **¿El orden por defecto de los perfiles es el correcto?** Hoy entran ordenados por recuperación ascendente, así que lo primero que se ve son las estaciones que menos volvieron. La alternativa es ordenar por magnitud del cambio, que es la pregunta real del proyecto pero da una primera pantalla menos intuitiva.

4. **¿Vale la pena el brush temporal como está?** Solo cambia el tamaño de los puntos del mapa. ¿Es una interacción útil o una promesa falsa que sugiere que filtra más de lo que filtra? Si es lo segundo, la quitamos hasta la Semana 12.

5. **¿Qué hacemos con los artefactos de línea base?** Mets-Willets Point con 287 % es el punto rojo más llamativo del mapa y es ruido estacional. ¿Excluirlo, anotarlo en la vista, o dejar que el lector lo descubra con el tooltip?

6. **¿El recorte de color en p10/p90 esconde algo útil?** Gana contraste en el 80 % central y a cambio vuelve indistinguibles los dos extremos.

---

## 5 · Qué sigue

| | Para la Semana 12 |
|---|---|
| 1 | Vista E (composición tarifaria) y la capa de anotaciones |
| 2 | Lo que salga de las respuestas a la sección 4 |
| 3 | Scroll virtual en los perfiles para las 428 estaciones |
| 4 | Narrativa integrada: un recorrido guiado que conecte las cuatro vistas en un orden de lectura |
| 5 | Marcado de los casos con línea base poco confiable |

---

## Referencias

Las cuatro revisadas en la Semana 6 (`deliveries/week06/referencias.md`). Las dos que sostienen decisiones de este prototipo:

- Lee, Archambault y Nacenta (2020). *The Effectiveness of Interactive Visualization Techniques for Time Navigation of Dynamic Graphs on Large Displays*. arXiv:2008.12747 — sostiene §2.2.
- Hsu, Wu et al. (2021). *Investigating spatio-temporal mobility patterns and changes in metro usage under the impact of COVID-19 using Taipei Metro smart card data*. *Public Transport*, Springer — sostiene §2.2 y §2.4.

## Créditos

Datos: Metropolitan Transportation Authority (MTA) vía Open NY, acceso por la API SODA de Socrata.
Librería: D3.js v7.9.0 (BSD-3-Clause), Mike Bostock.
Parte del código y de la documentación se elaboró con asistencia de IA, revisada y validada por el equipo.
