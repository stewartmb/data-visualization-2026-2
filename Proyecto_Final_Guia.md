# DS5343 — Data Visualization

## Guía del proyecto final · Semestre 2026-2

**Universidad de Ingeniería y Tecnología (UTEC)**  
**Programa:** Data Science  
**Docente:** Prof. Germain Garcia-Zanabria  
**Entrega final y exhibición:** miércoles 18 de noviembre de 2026

> Esta guía reúne en Markdown la información de *Final Project Guidelines*. En caso de que el docente publique una actualización o comunique instrucciones específicas durante el curso, se debe consultar la versión más reciente.

## Contenido

- [1. Descripción y objetivos](#1-descripción-y-objetivos)
- [2. Selección del tema y los datos](#2-selección-del-tema-y-los-datos)
- [3. Equipos e infraestructura](#3-equipos-e-infraestructura)
- [4. Hitos del proyecto](#4-hitos-del-proyecto)
- [5. Entregables finales](#5-entregables-finales)
- [6. Evaluación](#6-evaluación)
- [7. Requisitos generales](#7-requisitos-generales)
- [8. Bono por actividad social](#8-bono-por-actividad-social)

## 1. Descripción y objetivos

El proyecto final ofrece una experiencia práctica a lo largo del semestre en visualización analítica, diseño de interacciones y comunicación visual con datos complejos del mundo real. Cada equipo elegirá un conjunto de datos, formulará un problema de visualización concreto y diseñará, implementará, publicará y comunicará una solución interactiva.

El proyecto **no es una competencia de machine learning** ni se evalúa por el tamaño de la base de código. Se busca demostrar dominio de visualización de datos: formular preguntas relevantes, transformar los datos adecuadamente, elegir codificaciones visuales expresivas y efectivas, diseñar interacciones útiles, implementar la solución en D3.js, derivar hallazgos defendibles y comunicar los resultados como una narrativa coherente. La ejecución enfocada y bien justificada tiene más valor que una propuesta demasiado ambiciosa que intente mostrarlo todo.

Al finalizar, cada equipo debe poder:

- Definir un problema de visualización concreto y bien motivado.
- Identificar a los usuarios o audiencia y las preguntas o decisiones que la visualización debe apoyar.
- Evaluar, limpiar, transformar y documentar datos del mundo real.
- Formular una secuencia coherente de preguntas de dominio que puedan responderse visualmente.
- Justificar las codificaciones visuales, interacciones, composición, color y anotaciones.
- Implementar una visualización interactiva original con D3.js.
- Evaluar y mejorar el diseño mediante crítica e iteración.
- Comunicar el proyecto mediante una aplicación publicada, artículo, videos, póster, página del proyecto y exposición oral.

## 2. Selección del tema y los datos

Los equipos pueden escoger cualquier tema y conjunto de datos que consideren relevantes. Entre los dominios posibles están los datos urbanos, transporte, seguridad pública, salud, deportes, entretenimiento, finanzas, clima, educación, ciencia y comportamiento social; también se puede proponer otro dominio sujeto a aprobación del docente.

Los datos elegidos deben:

- Ser accesibles para todo el equipo y utilizables legalmente.
- Tener suficiente riqueza para sostener varias preguntas analíticas relacionadas (por ejemplo, varias tablas o dimensiones).
- Estar suficientemente documentados para explicar su fuente, método de recolección, atributos y limitaciones.
- Ser manejables durante el semestre y compatibles con una implementación web en D3.js.
- Preferentemente tener estructura temporal, espacial, multivariada, jerárquica, relacional u otra estructura interesante.

Antes de proponer un tema, el equipo debe inspeccionar los datos reales. Compartir un enlace no demuestra que el conjunto de datos contenga los atributos necesarios para responder las preguntas propuestas. Si se utilizan datos privados o sensibles, se deben cumplir los requisitos aplicables de privacidad, anonimización, ética y acceso.

## 3. Equipos e infraestructura

### 3.1 Formación del equipo

El proyecto se realizará normalmente en equipos de tres estudiantes. Las excepciones requieren autorización explícita del docente. Se espera que todos los integrantes contribuyan durante todo el proceso: formulación del problema, análisis de datos, diseño, implementación, redacción y presentación.

Cada equipo debe acordar desde el inicio sus prácticas de comunicación, frecuencia de reuniones, responsabilidades, plazos internos y procedimientos ante retrasos. Las contribuciones individuales deben documentarse en el repositorio. El docente podrá ajustar las calificaciones individuales si la evidencia indica una participación sustancialmente desigual.

### 3.2 Repositorio y colaboración

Cada equipo debe mantener un repositorio compartido en GitHub o GitLab desde el inicio del proyecto. El repositorio debe incluir código fuente, scripts de procesamiento cuando correspondan, documentación, fuente del informe, póster y materiales finales que se puedan compartir legalmente.

Se espera el uso de control de versiones durante todo el proyecto. Crear o poblar el repositorio únicamente cerca de la fecha final no es evidencia suficiente de colaboración ni de desarrollo iterativo.

### 3.3 Tecnología requerida

La visualización interactiva final debe implementarse con **D3.js**. Se pueden utilizar tecnologías complementarias como HTML, CSS, módulos JavaScript, scripts de preprocesamiento, herramientas de compilación o frameworks web ligeros, siempre que D3.js siga siendo la tecnología principal de implementación de la visualización.

Tableau, Power BI, Looker o Excel pueden utilizarse de forma privada para exploración inicial, pero no son aceptables como solución visual final. Se deben reconocer las bibliotecas, ejemplos de código, asistencia de IA, conjuntos de datos, íconos e inspiraciones visuales externas. El equipo debe aportar una cantidad sustancial de trabajo original y cada integrante debe poder explicar la implementación y las decisiones de diseño.

## 4. Hitos del proyecto

Salvo que se anuncie otra cosa, las entregas se realizan el miércoles indicado a través de la plataforma del curso. El docente comunicará la hora exacta de entrega y el orden de las presentaciones.

| Semana | Fecha | Hito | Evidencia principal |
|---|---|---|---|
| 4 | 2 de septiembre | Selección y entrega del dataset | Archivos de datos, fuente, licencia, diccionario de datos e instrucciones de acceso |
| 5 | 9 de septiembre | Equipo y propuesta del proyecto | Problema, audiencia, datos, preguntas, factibilidad y repositorio |
| 6 | 16 de septiembre | Análisis de datos y bocetos/inspiración | Muestras procesadas, transformaciones, hallazgos y bocetos de visualización |
| 7 | 23 de septiembre | Entrega 1 | Primera fase consolidada, alcance revisado, plan de diseño y plan de trabajo |
| 10 | 14 de octubre | Prototipo funcional y revisión de diseño | Prototipo D3 funcional, interacciones principales y presentación de revisión |
| 12 | 28 de octubre | Borrador refinado y crítica entre pares | Narrativa integrada, prototipo mejorado y respuesta documentada a la crítica |
| 15 | 18 de noviembre | Entrega final, exposición oral y exhibición de póster | Paquete final completo y presentación pública |

**Semana 8 no tiene entrega del proyecto**, debido al examen de mitad de ciclo. El equipo debe dejarla libre de entregas del proyecto, aunque puede usar ese intervalo para consolidar los comentarios de la Entrega 1 y planificar la implementación.

### 4.1 Semana 4 — Selección y entrega del dataset (2 de septiembre de 2026)

Este hito se limita intencionalmente a los datos; no se requiere una propuesta completa. Cada equipo debe identificar un dataset candidato, inspeccionar su contenido real y entregar un paquete de datos utilizable.

Entregar en `deliveries/week04/`:

- `README.md`: título del dataset, URL de origen, organización o recolector, método de recolección si se conoce, cobertura geográfica y temporal, fecha de acceso, licencia o términos de uso y breve explicación de su utilidad potencial para visualización.
- `data/`: archivos del dataset, preferentemente en CSV.
- `data/sample.csv`: muestra representativa si el dataset completo es demasiado grande, está restringido, se obtiene mediante API o se distribuye en otro formato.
- `data_dictionary.csv`: una fila por atributo con nombre del campo, descripción, tipo de dato, unidad o formato, valores posibles cuando corresponda y códigos conocidos para valores faltantes.
- `acquisition.md` o un script de adquisición si los datos deben descargarse, consultarse por API o generarse desde otra fuente.

No se debe cargar a un repositorio público información privada, confidencial, identificable, protegida por derechos de autor o de otra manera restringida. En esos casos, se entrega una muestra legalmente compartible y se documenta el procedimiento de acceso y las restricciones.

### 4.2 Semana 5 — Equipo y propuesta del proyecto (9 de septiembre de 2026)

Entregar una propuesta concisa de aproximadamente 2–3 páginas que incluya:

1. **Equipo y título provisional:** integrantes, título propuesto y URL del repositorio.
2. **Planteamiento del problema y contexto:** problema concreto, importancia y contexto necesario para comprenderlo.
3. **Audiencia y propósito:** quién usará o leerá la visualización y qué debería ayudarle a entender, explorar o decidir.
4. **Dataset:** fuente, recolector, método de recolección si se conoce, atributos relevantes, problemas de calidad, condiciones de acceso y preprocesamiento esperado.
5. **Preguntas de dominio:** aproximadamente 5–8 preguntas enfocadas que formen una progresión lógica y puedan responderse con los datos disponibles.
6. **Factibilidad inicial:** desafíos técnicos esperados, distribución del trabajo y principales riesgos.

Evitar objetivos vagos como «visualizar el dataset» o «encontrar patrones interesantes». La propuesta debe definir una dirección analítica enfocada sin fijar prematuramente todas las decisiones de diseño.

Entregar en `deliveries/week05/`:

- `ProjectProposal.pdf`: propuesta de 2–3 páginas.
- Fuente editable de la propuesta (`.tex`, `.docx` o formato equivalente).
- `PresentationWeek05.pptx` o `PresentationWeek05.pdf`: presentación concisa del problema, audiencia, datos y preguntas de dominio.
- `README.md`: integrantes, título provisional, estructura del repositorio, responsabilidades y enlaces pertinentes.
- Paquete de datos de Semana 4 actualizado si el dataset cambió después de recibir comentarios.

### 4.3 Semana 6 — Análisis de datos y bocetos/inspiración (16 de septiembre de 2026)

Para cada pregunta de dominio importante, el equipo debe demostrar que puede obtener del dataset la información necesaria y que consideró una respuesta visual apropiada.

Entregar en `deliveries/week06/`:

- `DataAnalysis.md`: informe conciso del entendimiento de los datos, transformaciones, hallazgos, limitaciones y justificación del diseño.
- `PresentationWeek06.pptx` o `PresentationWeek06.pdf`.
- `data/processed/`: archivos CSV procesados que respalden las vistas propuestas.
- `code/`: scripts o notebooks empleados para limpiar, transformar, agregar o analizar los datos.
- `sketches/`: bocetos exportados a PDF, PNG u otro formato ampliamente accesible.
- Revisión de **al menos cuatro artículos** relevantes para las visualizaciones, codificaciones, interacciones o bocetos propuestos. Explicar brevemente cómo cada artículo informa el diseño y presentar los PDF de los artículos.
- `README.md`: instrucciones exactas para reproducir los datos procesados y localizar cada resultado.

El material debe mostrar muestras representativas de datos procesados para cada vista analítica importante; documentar claramente limpieza, filtros, derivaciones, agregaciones y transformaciones; incluir hallazgos exploratorios iniciales, anomalías, limitaciones y preguntas revisadas cuando sea necesario; y presentar bocetos con títulos, etiquetas, leyendas, codificaciones, composición y anotaciones. También debe señalar interacciones previstas —por ejemplo, filtros, selección, zoom, vistas enlazadas, detalles bajo demanda o animación— y explicar por qué cada diseño es adecuado para su pregunta y tipo de datos. Los bocetos pueden ser dibujados a mano o creados con software, pero deben ser trabajo del equipo y tener suficiente detalle para que otra persona entienda la implementación prevista.

### 4.4 Semana 7 — Entrega 1 (23 de septiembre de 2026)

La Entrega 1 consolida la primera fase. Debe incluir:

- Planteamiento del problema, audiencia y descripción del dataset revisados.
- Secuencia revisada de preguntas de dominio.
- Análisis de datos y conjunto final de bocetos candidatos.
- Dirección de visualización elegida y su justificación.
- Arquitectura de información o composición inicial de la aplicación.
- Plan de implementación priorizado para la solución D3.js.
- Distribución de responsabilidades y calendario hasta la Semana 15.
- Breve reflexión sobre los cambios realizados tras examinar los datos.

Esta entrega es un punto de control de alcance. Se puede solicitar al equipo que lo reduzca, replantee o revise antes de continuar.

Entregar en `deliveries/week07/`:

- `Delivery1Report.pdf` o `Delivery1Report.md`: informe consolidado de la primera fase.
- Fuente editable del informe.
- `PresentationWeek07.pptx` o `PresentationWeek07.pdf`.
- Bocetos seleccionados y arquitectura de la aplicación en PDF o PNG.
- Archivos de datos actuales en CSV, diccionario de datos y código de procesamiento.
- `README.md` raíz actualizado con responsabilidades, calendario, estructura del repositorio e instrucciones de reproducción.

### 4.5 Semana 10 — Prototipo funcional y revisión de diseño (14 de octubre de 2026)

Publicar en el repositorio un prototipo D3.js funcional y, cuando sea posible, como aplicación web. No necesita tener el estilo final, pero debe mostrar avances sustanciales:

- Las visualizaciones principales se renderizan con datos reales del proyecto.
- Las interacciones centrales funcionan.
- El flujo analítico o navegación principal es evidente.
- Las codificaciones, escalas, etiquetas y leyendas se pueden interpretar.
- Las limitaciones conocidas y los elementos incompletos están documentados.

Cada equipo dará una presentación de revisión de diseño de **máximo 5 minutos**, que cubra el problema y la audiencia, una demostración del prototipo, las decisiones de diseño principales y alternativas consideradas, y preguntas específicas para recibir comentarios.

La crítica entre pares debe usar la estructura **«Me gusta… / Desearía… / ¿Y si…?»** (*I like… / I wish… / What if…?*) y tratar codificación visual, interacción, usabilidad, valor analítico, composición, etiquetado y comunicación. Los comentarios deben ser constructivos, específicos y viables.

Entregar en `deliveries/week10/`:

- Código fuente completo del prototipo, incluidos HTML, CSS, JavaScript, módulos D3.js y recursos requeridos.
- Datos procesados actuales en CSV o JSON.
- `PrototypeReport.pdf` o `PrototypeReport.md`: funciones implementadas, decisiones de diseño, limitaciones conocidas y preguntas para revisores.
- `PresentationWeek10.pptx` o `PresentationWeek10.pdf`.
- URL del prototipo desplegado cuando sea técnicamente y legalmente posible.
- `README.md` con instrucciones de configuración, ejecución y despliegue.

### 4.6 Semana 12 — Borrador refinado y crítica entre pares (28 de octubre de 2026)

Convertir el prototipo en una historia visual o experiencia exploratoria coherente. La entrega debe incluir:

- Aplicación D3.js refinada y publicada, con las vistas e interacciones principales implementadas.
- Título, introducción, descripción de los datos, secuencia analítica, hallazgos y conclusión preliminar claros.
- Diseño visual mejorado: tipografía, color, anotaciones, accesibilidad, diseño adaptable cuando sea viable y respuesta visible a las interacciones.
- Versión inicial de la página del proyecto y estructura del artículo.
- Resumen de los comentarios recibidos en la revisión de diseño.
- Registro de respuestas que indique qué sugerencias se implementaron, aplazaron o rechazaron, con justificación.
- Tareas pendientes y responsables para las últimas tres semanas.

En este punto, el proyecto ya no debe parecer una colección desconectada de gráficos. Una persona que no conozca el tema debe poder entender la motivación, recorrer el análisis visual e identificar los hallazgos principales.

Entregar en `deliveries/week12/`:

- Código fuente actualizado de la aplicación y enlace de despliegue.
- Datos procesados candidatos finales en CSV o JSON y todos los scripts de reproducción.
- `RefinedDraftReport.pdf` o `RefinedDraftReport.md`: narrativa, justificación del diseño, hallazgos preliminares, limitaciones y trabajo pendiente.
- `PresentationWeek12.pptx` o `PresentationWeek12.pdf`.
- `PeerCritiqueResponse.pdf`: comentarios recibidos y respuesta del equipo a cada sugerencia sustantiva.
- Fuente inicial del artículo y borrador en PDF.
- Página inicial del proyecto y README actualizado.

### 4.7 Semana 15 — Entrega final y exhibición (18 de noviembre de 2026)

Todos los materiales finales deben estar completos y accesibles desde el repositorio y la página del proyecto antes del horario asignado para la presentación o exhibición. El equipo participará en una exhibición de póster y dará una presentación oral de **10 minutos**. Puede haber un breve período de preguntas y respuestas.

Distribución aproximada de la presentación oral:

- **2 minutos:** problema, audiencia, motivación y datos.
- **6 minutos:** visualización, interacciones, decisiones de diseño y hallazgos principales.
- **2 minutos:** conclusiones, limitaciones y trabajo futuro.

La entrega es el repositorio y página del proyecto completos con todos los artefactos de la sección 5. Además, se debe incluir `PresentationFinal.pptx` o `PresentationFinal.pdf`, póster final en PDF, artículo final y fuente editable, aplicación D3.js publicada, ambos enlaces de video, paquete de datos final, código fuente completo y README final.

## 5. Entregables finales

### 5.1 Aplicación D3.js publicada

La aplicación final debe ser accesible públicamente siempre que las restricciones del proyecto y los datos lo permitan. Se recomienda GitHub Pages para proyectos estáticos en HTML/CSS/JavaScript. Si se usa otro servicio de alojamiento, el repositorio debe conservar el código fuente y las instrucciones completas para reproducir o ejecutar el proyecto.

La aplicación debe funcionar con los datos entregados, cargarse de forma confiable y ofrecer una experiencia coherente con su audiencia y propósito. Las fuentes de datos y las inspiraciones externas relevantes deben reconocerse en la interfaz o la documentación.

### 5.2 Artículo en formato de conferencia

Entregar un artículo de **2–4 páginas, sin contar referencias**, en formato de conferencia a dos columnas, como IEEE VIS o ACM CHI. El PDF final debe llamarse `FinalPaper.pdf` y debe acompañarse de su fuente editable.

El artículo debe contener:

- **Resumen gráfico:** representación gráfica de la metodología y las transformaciones.
- **Introducción:** problema, audiencia, motivación y contribuciones.
- **Trabajo relacionado:** sistemas, diseños o investigación pertinente en visualización.
- **Datos y métodos:** fuente, transformaciones, proceso analítico y enfoque de implementación.
- **Diseño de la visualización:** codificaciones, interacciones, composición y justificación del diseño.
- **Resultados o caso de estudio:** hallazgos y ejemplos que muestren cómo la visualización responde a las preguntas.
- **Discusión:** aprendizajes, fortalezas, limitaciones y evaluación informal u observaciones de uso.
- **Trabajo futuro y conclusión:** extensiones posibles y conclusiones principales.

### 5.3 Video teaser

Crear un teaser de **1 minuto**, a modo de tráiler del proyecto. En vez de demostrar todas las funciones, debe comunicar la motivación y resaltar uno o dos hallazgos o interacciones atractivos que inviten a explorar la aplicación completa.

### 5.4 Video de presentación

Crear un video de **máximo 5 minutos** que cubra la motivación del proyecto, el dataset y la audiencia, una demostración de la aplicación final, las principales decisiones de diseño y los hallazgos más importantes. El video debe estar accesible desde la página del proyecto.

### 5.5 Póster

Preparar un póster para la exhibición de la Semana 15. El formato puede ser creativo, pero debe comunicar claramente el problema, los datos, el enfoque de visualización, las interacciones clave, los hallazgos y la información de acceso al proyecto. Incluir un código QR o URL corta hacia la página del proyecto o la aplicación publicada.

### 5.6 Página del proyecto

La página debe incluir:

- Título del proyecto e integrantes.
- Imagen representativa o resumen visual.
- Resumen o sinopsis breve.
- Enlace a la aplicación publicada.
- Enlace al artículo final.
- Videos teaser y de presentación incrustados o enlazados.
- Fuentes de datos y reconocimientos.
- Instrucciones para ejecutar el software.
- Enlaces al repositorio y a cualquier material complementario opcional.

### 5.7 Repositorio, README y código

El repositorio final debe contener:

- Todo el código fuente original necesario para construir y ejecutar la visualización.
- Datos o instrucciones documentadas para adquirirlos, sujeto a restricciones de licencia y privacidad.
- Scripts de preprocesamiento e instrucciones reproducibles cuando corresponda.
- Artículo final y fuente editable.
- Póster y enlaces a los videos.
- `README.md` con descripción del proyecto, instrucciones de instalación o ejecución, enlace de despliegue, dependencias, fuentes de datos y limitaciones conocidas.
- Declaración de contribuciones que describa la distribución del trabajo entre integrantes.
- Breve reflexión sobre el proceso de diseño y desarrollo del equipo.

El equipo docente debe poder seguir el README y ejecutar el proyecto sin pasos sin documentar. No incluir credenciales, claves privadas ni datos restringidos en el repositorio.

## 6. Evaluación

### Proceso de trabajo

Las calificaciones individuales pueden ajustarse si el historial del repositorio, las declaraciones de contribuciones, la evidencia de pares o la capacidad de explicar el trabajo indican una participación sustancialmente desigual.

## 7. Requisitos generales

- Probar todos los enlaces antes de entregar y mantenerlos accesibles durante la evaluación.
- Incluir en las visualizaciones títulos, etiquetas, leyendas, unidades, fuentes de datos y explicaciones apropiadas.
- Reconocer el código, bibliotecas, datasets, íconos, imágenes y diseños visuales que hayan influido en el trabajo.
- No exponer información sensible ni personalmente identificable en la aplicación final.
- Mantener una historia coherente y afirmaciones consistentes entre el artículo, póster, videos, página y aplicación.
- Preparar a cada integrante para explicar los datos, el código, las codificaciones visuales, el diseño de interacciones y los hallazgos.
- Las entregas tardías o incompletas están sujetas a las políticas del curso anunciadas en el sílabo. Un enlace roto o inaccesible se considera un componente faltante hasta que se corrija.

## 8. Bono por actividad social

Esta actividad opcional busca promover la interacción social del equipo fuera del trabajo académico. Los integrantes pueden recibir puntos adicionales si participan en una actividad social presencial con su equipo y no relacionada con el curso. Algunos ejemplos son una comida informal, un juego de mesa o de computadora, una actividad de rompecabezas o trivia, o una película.

Para obtener el crédito, se debe entregar evidencia —hasta el viernes de la Semana 15— que muestre claramente la actividad y a los integrantes participantes. Una selfie fuera del salón sin una actividad social reconocible no califica. Los equipos pueden realizar la actividad junto con otros equipos.
