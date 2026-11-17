# Semana 6 · Investigación que informa el Atlas

La selección de Semana 6 reúne cinco artículos vinculados a la implementación del Atlas 2021–2025. RAEB y KDEEB explican la guía ferroviaria y el cálculo de los haces. ManyWaves fundamenta el detector de Eventos. Dhont et al. y Fredriksson y Karlström respaldan el reloj semanal y la métrica de cambio de forma. El [catálogo de PDF](papers/README.md) identifica las ediciones consultadas. La [revisión anterior](history/before-20261116-current-atlas/referencias.md) documenta las alternativas que se evaluaron.

## Selección principal

### P1. RAEB — relaciones con contexto de la red

**Zeng, Shen, Jiang y Telea (2019), *Route-Aware Edge Bundling for Visualizing Origin-Destination Trails in Urban Traffic*.** Las secciones 4–6 definen una jerarquía de vías que combina longitud, clase y flujo. Al aumentar el nivel de detalle, más vías guían el agrupamiento de trayectorias. El radio inicial se estima con distancias de Fréchet entre las vías del mayor grupo encontrado por DBSCAN. [Artículo y figuras](https://zeng-wei.com/publication/papers/2019_RAEB.pdf#page=5) · [DOI](https://doi.org/10.1111/cgf.13712).

**En Fractal.** El mapa abre con carga asignada sobre los tramos GTFS. El radio en metros y la fidelidad 0–5 permiten pasar de ese trazado a haces que resaltan relaciones origen–destino. El ruteo se hace entre paradas padre GTFS y mantiene los transbordos declarados. La jerarquía usa **556 enlaces ferroviarios** con clase constante y carga de la franja. Los niveles conservan 0, 28, 56, 112, 223 o 556 enlaces. En la calibración local, el lunes a las 08:00 de 2024 produjo **660,61 m** con 56 vías candidatas y 14 en el mayor grupo. [Método, prueba y diferencias con el artículo](../week12/RAEBImplementation.md#calibración-del-radio-para-el-subway).

El artículo trabaja con trayectorias y red vial. En el Atlas, el camino inicial se asigna por costo mínimo sobre la red de referencia y los haces son una abstracción de OD estimados. Las curvas fuera de la red permiten formular hipótesis sobre conexiones que merecen examinarse.

### P2. KDEEB — cálculo de los haces

**Hurter, Ersoy y Telea (2012), *Graph Bundling by Kernel Density Estimation*.** El algoritmo estima densidad a partir de muestras en las curvas, desplaza los puntos interiores en la dirección del gradiente y suaviza la geometría. El radio decrece durante las iteraciones. [Artículo, método](https://webspace.science.uu.nl/~telea001/uploads/PAPERS/EuroVis12/kdeeb.pdf#page=2) · [DOI](https://doi.org/10.1111/j.1467-8659.2012.03079.x).

**En Fractal.** Es la base numérica del agrupamiento que RAEB guía con los tramos retenidos. La adaptación usa pesos OD, 32 muestras por curva, WebGPU y un respaldo CPU/WebGL2. El estilo de dibujo y los criterios operativos del Atlas se documentan por separado de la estimación de densidad. El rendimiento depende de la cohorte y del equipo. [Implementación y comprobaciones](../week12/RAEBImplementation.md#correspondencia-con-raeb).

### P3. ManyWaves — eventos espaciales y temporales

**Valdrighi, Garcia-Zanabria, Diaz, Nonato, Ferreira y Poco (2026), *ManyWaves: A Visual Analytics Approach for Exploring Multivariate Spatiotemporal Data Based on the Graph Wavelet Transform*.** Las secciones 4–6 construyen un grafo espacio-temporal, usan coeficientes wavelet de alta frecuencia para destacar cambios bruscos y enlazan resúmenes, mapas y series. Germain Garcia-Zanabria es coautor. [Manuscrito de los autores](https://files.visualdslab.com/files/papers/2026-ManyWaves-CGF.pdf#page=3) · [DOI](https://doi.org/10.1111/cgf.70653).

**En Fractal.** Cada variable del original se transforma por separado. El Atlas aplica esa idea a **una señal**, las diferencias entre entradas horarias y su referencia habitual, sobre el grafo de complejos del subway. Usa la banda de alta frecuencia y añade criterios de magnitud, conectividad y duración para formar episodios. La matriz mensual resume la señal y enlaza los episodios con el mapa y la serie observada frente a habitual. El autoencoder y la proyección multivariada quedan como componentes del sistema original. Una detección es una desviación a investigar. [Método de Eventos y contraste con el residuo directo](../week12/SpectralEvents.md).

### P4. Dhont et al. — reloj semanal

**Dhont, Tsiporkova, Tourwé y González-Deleito (2020), *Visual Analytics for Extracting Trends from Spatio-temporal Data*.** Las secciones 3.2–3.3 organizan días y horas en anillos y sectores y muestran diferencias por resta entre mapas circulares. [PDF del taller](https://project.inria.fr/aaltd20/files/2020/08/AALTD_20_paper_DhontVisual.pdf) · [DOI](https://doi.org/10.1007/978-3-030-65742-0_9).

**En Fractal.** El reloj mantiene siete anillos y 24 sectores. El color indica el peso de la franja en la semana o su cambio en puntos porcentuales. Pulsar una celda selecciona día y hora en el mapa. Los anillos exteriores ocupan más superficie por geometría, por eso la magnitud se lee por color y se confirma al consultar la celda.

### P5. Fredriksson y Karlström — variación total

**Fredriksson y Karlström (2025), *A Fully Neural Network-Based Travel Demand and Scheduling Model, Covering Activities, Destinations, and Modes of Transportation*.** La ecuación 11 usa variación total para comparar distribuciones de modos. [Artículo, ecuación 11](https://doi.org/10.1007/s42421-025-00141-5).

**En Fractal.** Al comparar dos años la dispersión usa TV sobre 168 participaciones semanales. El eje horizontal mide el volumen relativo y el vertical cuánto cambió el reparto horario. El reloj permite localizar las celdas que explican ese cambio. La métrica trata cada celda como una categoría y no pondera la cercanía entre horas. El modelo neuronal del artículo queda fuera de la adaptación.

## Antecedentes de diseño

Gleicher et al., Brehmer y Munzner, Shneiderman y las demos de MBTA y Tube Heartbeat quedan documentados en la [revisión anterior](history/before-20261116-current-atlas/referencias.md) como referencias de diseño. La selección de esta entrega se concentra en los métodos, codificaciones y métricas que el Atlas adapta directamente.

| Artículo o familia | Motivo |
|---|---|
| Van der Knaap et al. · Hellinger | La búsqueda de vecinos similares ya no forma parte del panel estudiado. |
| Haroz et al. · Connected Scatterplot | Los puntos del Atlas representan complejos independientes. La trayectoria bivariada fue una alternativa anterior. |
| Hochheiser y Shneiderman · TimeSearcher | El reloj elige franjas. El Atlas carece de consultas conjuntas de rango temporal y valor mediante cajas. |
| Van Wijk y Van Selow · calendario con clustering | Eventos colorea meses por señal espectral de episodios. El calendario por clases de perfiles diarios fue otra propuesta. |
| Liu et al. y estudios generales de demanda o COVID | Permanecen como antecedentes del dominio. El período actual y las tareas no dependen de atribuir cambios a la pandemia. |
| Estudios generales de cantidad de vistas y navegación en pantallas grandes | Sus resultados no corresponden directamente a la composición y las interacciones que validamos aquí. |
