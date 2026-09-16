# Revisión de referencias

**DS5343 · Semana 6 · Proyecto "La forma del día"**

Cuatro trabajos que informan las decisiones de diseño del proyecto: dos sobre técnica de visualización y dos sobre el dominio del transporte público. Los cuatro son de acceso abierto y los PDF están en [`papers/`](papers/).

---

## 1 · Lee, Archambault y Nacenta (2020)

**The Effectiveness of Interactive Visualization Techniques for Time Navigation of Dynamic Graphs on Large Displays**
arXiv:2008.12747 · <https://arxiv.org/pdf/2008.12747>

**Qué hace.** Compara experimentalmente tres formas de navegar datos que cambian en el tiempo: small multiples, animación interactiva, y una técnica más reciente basada en cortes temporales interactivos. Mide desempeño en tareas de comparación entre distintos momentos.

**Qué concluye.** Los cortes temporales interactivos ayudan cuando hay que comparar puntos distantes en el tiempo, pero aportan menos al analizar intervalos contiguos. Los small multiples se desempeñan bien de forma consistente y son la referencia contra la que se mide el resto.

**Cómo informa el diseño.** Sostiene la **vista B**. Nuestra tarea central es comparar dos momentos distantes —la línea base prepandemia y 2024— sobre cientos de estaciones, y el trabajo muestra que ese tipo de comparación entre puntos lejanos es precisamente donde la animación pierde frente a representaciones que muestran ambos estados simultáneamente. De ahí la decisión de superponer el perfil prepandemia en gris detrás del de 2024 en cada múltiplo, en lugar de animar la transición entre años.

---

## 2 · Sasaki, Nakamura et al. (2022)

**An Empirical Study on the Relationship Between the Number of Coordinated Views and Visual Analysis**
arXiv:2204.09524 · <https://arxiv.org/pdf/2204.09524>

**Qué hace.** Estudia empíricamente cómo afecta al análisis visual el número de vistas coordinadas que se presentan a la vez. Recoge las ventajas reportadas en la literatura, como encontrar relaciones ocultas, y también los costos, como la carga cognitiva de sostener muchas vistas simultáneas.

**Cómo informa el diseño.** Sostiene la **arquitectura completa** de la aplicación. Nuestras cinco vistas están enlazadas por brushing: una selección en el mapa filtra los perfiles, la serie temporal y la dispersión. Este trabajo justifica esa decisión y, sobre todo, justifica el límite: son cinco vistas y no diez, porque el beneficio de coordinar no crece indefinidamente con el número de paneles. También nos da la vía a la literatura clásica del tema, ya que sintetiza los trabajos fundacionales de vistas coordinadas.

---

## 3 · Yap, Cats et al. (2022)

**Identifying Human Mobility Patterns using Smart Card Data**
arXiv:2208.05352 · <https://arxiv.org/pdf/2208.05352>

**Qué hace.** Revisión sistemática de los métodos que agrupan usuarios y estaciones de transporte público según sus características temporales y espaciotemporales. Distingue entre la variabilidad dentro de una misma persona y la variabilidad entre personas, y sintetiza los enfoques de análisis.

**Cómo informa el diseño.** Sostiene la **vista D** y la pregunta 3. Confirma que caracterizar estaciones por su perfil temporal es un enfoque establecido en la literatura, no una ocurrencia nuestra, y que normalizar el perfil antes de agrupar es práctica estándar cuando el interés es la forma y no el volumen. Entre las líneas de aplicación que señala está el apoyo a la planificación de servicio, que es justamente la decisión que nuestra audiencia principal necesita tomar.

---

## 4 · Hsu, Wu et al. (2021)

**Investigating spatio-temporal mobility patterns and changes in metro usage under the impact of COVID-19 using Taipei Metro smart card data**
*Public Transport*, Springer · <https://pmc.ncbi.nlm.nih.gov/articles/PMC8365295/>

**Qué hace.** Analiza los patrones espaciotemporales del metro de Taipéi por franjas horarias a lo largo de la semana, identifica días y horas con comportamientos similares, y compara enero–marzo de 2019 contra el mismo período de 2020 para medir el efecto de la pandemia.

**Cómo informa el diseño.** Es el precedente de dominio más cercano: mismo tipo de dato y misma pregunta de cambio antes y después de la pandemia. Nos aporta dos cosas. Primera, el método de comparar **el mismo período calendario** entre dos años en lugar de años completos, que es exactamente la corrección que aplicamos al extraer la línea base de enero–febrero de 2020 y que resultó decisiva: sin ella la conclusión sobre el aplanamiento del pico habría sido la contraria. Segunda, la decisión de conservar el análisis visual en lugar de reducir todo a un agrupamiento, porque el agrupamiento promedia y esconde la variación que el mapa sí muestra.

---

## Síntesis

| Decisión de diseño | Referencia |
|---|---|
| Small multiples con el estado previo superpuesto, en lugar de animación | Lee et al. (2020) |
| Cinco vistas enlazadas por brushing, y no más | Sasaki et al. (2022) |
| Tipología de estaciones por perfil normalizado | Yap, Cats et al. (2022) |
| Línea base de igual período calendario | Hsu, Wu et al. (2021) |
