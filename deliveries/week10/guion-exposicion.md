# Guion · design review Semana 10

**5 minutos.** Los tiempos son la referencia: si te atrasas, recorta la diapositiva 5 y entra directo a la 6.

---

## 1 · Portada — 15 s

> Buenas. Somos Renzo, Stewart y José. Traemos el prototipo funcional de *La forma del día*.

---

## 2 · Problema y audiencia — 40 s

> El metro de Nueva York programa su servicio alrededor del doble pico del día laborable: la mañana y la salida del trabajo. Entre 2020 y 2024 esa forma cambió, pero la recuperación se reporta casi siempre con un solo número. Ese número te dice cuánta demanda volvió. No te dice a qué hora vuelve, ni en qué estaciones.
>
> Por eso nuestra unidad de análisis no es el volumen. Es el perfil horario semanal de cada estación: 24 horas por 7 días, 168 valores, divididos por el total de esa estación. Ese vector describe su ritmo, no su tamaño.
>
> La audiencia son los planificadores de servicio de la MTA, y la decisión que queremos apoyar es dónde reasignar frecuencia.
>
> Son 428 estaciones, 60 meses, 168 horas por estación. Todo se agregó del lado del servidor con la API de Socrata; el navegador carga 1.4 MB.

---

## 3 · El prototipo — 60 s · **DEMO EN VIVO**

> Cuatro vistas. Arriba a la izquierda el mapa: color es recuperación de 2024 contra enero–febrero de 2020, tamaño es entradas por día.
>
> A la derecha la vista central del proyecto: los perfiles semanales, un mini-gráfico por estación. El área gris es el ritmo de antes, la línea azul el de 2024.
>
> Abajo a la izquierda la dispersión pico/valle, y abajo la serie mensual del sistema.

**Mostrar en vivo:** pasar el mouse sobre una estación del mapa · hacer zoom · cambiar el selector *Modo* a **diferencia**.

---

## 4 · La interacción — 50 s · **DEMO EN VIVO**

> Lo importante no son las cuatro vistas, es que son una sola herramienta.

**Hacer el brush en la dispersión**, sobre la zona de pico bajo.

> Al seleccionar acá estas estaciones, el mapa apaga el resto y la rejilla de perfiles se reconstruye con solo esas. Son 161 de 428, el 55 % de las entradas del sistema.
>
> El estado vive en un solo módulo. Cualquier vista que lo cambie redibuja las cuatro.

**Doble clic para limpiar.** Después, **brush en la serie temporal**:

> Y acá, al elegir un período, el tamaño de los puntos del mapa pasa a ser el promedio de ese período.

---

## 5 · Decisiones de diseño — 50 s

> Resumo las dos que más discutimos.
>
> Small multiples en vez de un gráfico con las 428 series encima: con 428 líneas superpuestas la forma desaparece. También descartamos animar la transición entre los dos años; Lee y colegas muestran que la animación es justo donde peor rinde comparar dos momentos distantes. Y descartamos agrupar las estaciones en cuatro tipos, porque el agrupamiento promedia y esconde la variación que el mapa muestra que existe.
>
> La otra: la escala vertical es común a todos los múltiplos. Con una escala por múltiplo, cada gráfico llena su caja y las formas dejan de ser comparables, que es el único motivo para ponerlas juntas.

---

## 6 · La decisión que invirtió la conclusión — 45 s

> Esta es la decisión de la que depende todo el proyecto: la línea base es enero–febrero de 2020, no el año 2020 completo.
>
> Contra el año 2020 completo, la razón pico/valle del sistema va de 2.34 a 2.35. La conclusión habría sido que no pasó nada.
>
> Contra enero–febrero, cae de 2.90 a 2.35. El pico se aplanó, y se aplanó en 372 de 414 estaciones.
>
> El año 2020 completo ya venía aplanado por el confinamiento. Usarlo como referencia esconde exactamente el fenómeno que queremos mostrar. Es el mismo criterio que usa Hsu con el metro de Taipéi: comparar el mismo período calendario entre dos años.

---

## 7 · Limitaciones — 35 s

> Lo que no está. El brush temporal todavía no reconstruye los perfiles: solo cambia el tamaño de los puntos del mapa, porque no agregamos estación por hora de la semana por mes. Se dibujan 120 múltiplos de los 428. El mapa no tiene contexto geográfico de fondo. Y falta la quinta vista, la de composición tarifaria.
>
> De los datos: Mets-Willets Point marca 287 % de recuperación, y es un artefacto — enero y febrero son temporada baja de béisbol. Y son entradas, no viajes: no hay pares origen–destino en esta fuente.

---

## 8 · Preguntas — 45 s · **dejar la diapositiva en pantalla**

> Seis cosas en las que estamos divididos y nos sirve lo que opinen.
>
> Una: si el mapa necesita contorno de boroughs o si el fondo competiría con el color, que es lo que hay que leer.
>
> Dos: si "pico/valle" se entiende. Es un índice nuestro. Si no se lee, cambiamos esa vista por un gráfico de pendientes.
>
> Tres: si el orden por defecto de los perfiles debería ser por recuperación, como está, o por magnitud del cambio.
>
> Cuatro: si el brush temporal vale la pena como está o es una promesa falsa, porque sugiere que filtra más de lo que filtra.
>
> Cinco: qué hacer con Mets-Willets Point: excluirlo, anotarlo, o dejar que se descubra.
>
> Y seis: si recortar el color en p10 y p90 esconde algo útil en los extremos.
>
> Gracias.

---

## Antes de entrar

- [ ] El prototipo **abierto y cargado** en el navegador, en otra pestaña.
- [ ] Probar el brush de la dispersión y el doble clic una vez.
- [ ] Ventana de 1400 px o más de ancho.
- [ ] Si no hay internet: no importa, D3 está servido localmente.

## Si preguntan

**¿Por qué D3 y no una librería de más alto nivel?**
Lo pide el curso, pero además las cuatro vistas están enlazadas por un estado propio, y eso es más fácil de controlar con D3 que peleando con las abstracciones de una librería de gráficos.

**¿Por qué escala logarítmica en la dispersión?**
Pico/valle es una razón y va de 1.06 a 11.4. En log, la distancia a la diagonal es la razón entre ambos índices, que es la medida correcta de cuánto cambió.

**¿Por qué 14 estaciones excluidas?**
Su máximo cae en el borde de la ventana de búsqueda, de 5 a 11 horas. Ahí el pico real puede estar fuera de la ventana y el índice no es confiable.

**¿Cuánto tarda en cargar?**
Un archivo JSON de 1.4 MB. El dataset crudo son varios GB; nunca se descarga, todo se agrega del lado del servidor.
