# Cuatro referencias principales del atlas

Selección final revisada el **14 de octubre de 2026**. Se eligieron por su relación con procedimientos concretos del atlas: comparar perfiles, medir diferencias entre distribuciones, buscar semejanzas y representar ciclos semanales. FINO es un referente de experiencia de investigación; no sustituye estas fuentes metodológicas.

Los cuatro textos completos tienen enlaces públicos. Los enlaces conducen a versiones editoriales abiertas o a la copia depositada por los autores en el sitio del taller. Las copias consultadas se encuentran en [papers/](papers/README.md), con enlaces a las fuentes y huellas SHA-256. Se conservan sin modificar, incluidos sus avisos de autoría y derechos.

## 1. Comparación de forma de perfiles horarios

**Liu, L., Miller, H. J., & Scheff, J. (2020).** The impacts of COVID-19 pandemic on public transit demand in the United States. *PLOS ONE, 15*(11), e0242476. https://doi.org/10.1371/journal.pone.0242476

- **PDF en esta rama:** [Abrir o descargar](papers/liu_2020_transit_demand.pdf)
- **Texto completo abierto:** https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0242476
- **Dónde revisar:** sección *Change in daily transit demand dynamics*, Figura 3 y ecuaciones 9–10.
- **Procedimiento del artículo:** compara curvas horarias antes/durante la pandemia mediante Procrustes ordinario, limitado al cambio de escala; también compara miércoles y domingo. La Figura 3 muestra perfiles del sistema MTA de Nueva York. La fuente horaria es actividad en la aplicación Transit, un indicador de demanda, no conteos de entradas de estaciones.
- **Qué informa en el atlas:** estudiar por separado caída de volumen y modificación del perfil horario; comparar perfiles entre períodos y grupos de días.
- **Adaptación y límite:** el atlas usa entradas MTA por complejo y perfiles de 168 horas normalizados por suma, y calcula TV, no Procrustes. Este artículo es un antecedente del problema y de la comparación de forma; no justifica por sí solo nuestra fórmula TV, el ajuste por calendario ni una interpretación causal.

## 2. Distancia de variación total sobre participaciones de transporte

**Fredriksson, J., & Karlström, A. (2025).** A Fully Neural Network-Based Travel Demand and Scheduling Model, Covering Activities, Destinations, and Modes of Transportation. *Data Science for Transportation, 7*, 28. https://doi.org/10.1007/s42421-025-00141-5

- **PDF en esta rama:** [Abrir o descargar](papers/fredriksson_2025_travel_demand_tv.pdf)
- **Texto completo abierto:** https://link.springer.com/article/10.1007/s42421-025-00141-5
- **Dónde revisar:** ecuación 11 y explicación de la propagación de errores hacia el reparto modal.
- **Procedimiento del artículo:** compara la distribución observada y simulada de cuatro modos (caminar, bicicleta, transporte público y automóvil), mediante `TV(p,q) = ½ Σ |p_m − q_m|`. Interpreta la medida como la proporción del reparto modal que difiere entre distribuciones.
- **Qué informa en el atlas:** usar una distancia simétrica y acotada para resumir diferencias entre dos distribuciones sobre las mismas categorías. Nuestra presentación es `100 × TV`, en puntos porcentuales.
- **Adaptación y límite:** sustituimos las categorías modales por 168 combinaciones día–hora y las distribuciones observada/simulada por perfiles de dos años. Coincide la operación matemática, no el diseño completo del estudio. No demuestra que TV sea la métrica óptima para ritmos semanales, que tenga significancia estadística ni que mida pasajeros individuales que cambiaron de horario. TV no incorpora la distancia entre horas: una diferencia a las 08 h y otra a las 20 h se suman sin considerar su separación temporal.

## 3. Normalización, separación de volumen y estructura, y Hellinger

**Van der Knaap, R. J. H., de Bruyn, M., van Oort, N., Huisman, D., & Goverde, R. M. P. (2024).** Clustering railway passenger demand patterns from large-scale origin–destination data. *Journal of Rail Transport Planning & Management, 31*, 100452. https://doi.org/10.1016/j.jrtpm.2024.100452

- **PDF en esta rama:** [Abrir o descargar](papers/van_der_knaap_2024_normalization_hellinger.pdf)
- **PDF completo abierto (TU Delft, versión proof):** https://pure.tudelft.nl/ws/portalfiles/portal/206768699/1-s2.0-S2210970624000222-main.pdf
- **Dónde revisar:** sección 2.1, ecuaciones 1–3, páginas numeradas 4–5 del artículo (el archivo incluye una portada institucional).
- **Procedimiento del artículo:** divide cada celda de una matriz origen–destino por la suma de todas sus celdas para obtener una distribución que suma 1. Compara matrices normalizadas con Hellinger cuadrática; contrasta ese análisis con el de matrices sin normalizar, que conservan volumen además de estructura.
- **Qué informa en el atlas:** dividir un conjunto de conteos no negativos por su total para representar composición, mantener volumen como una dimensión separada y buscar semejanzas con Hellinger.
- **Adaptación y límite:** nuestras categorías son horas de una semana, no pares origen–destino. Antes de normalizar construimos W ajustando la cantidad de lunes, martes, etc.; ese paso no se atribuye a este artículo. El paper define `S = Σ(√p − √q)²`; el atlas usa `H = √(S/2)`, con rango 0–1. Para los mismos vectores, esta transformación conserva el orden de cercanía. El atlas recupera vecinos, no ejecuta su clustering jerárquico ni infiere conexiones de viaje.

## 4. Reloj semanal y comparación mediante resta de mapas circulares

**Dhont, M., Tsiporkova, E., Tourwé, T., & González-Deleito, N. (2020).** Visual Analytics for Extracting Trends from Spatio-temporal Data. En *Advanced Analytics and Learning on Temporal Data*, LNCS 12588, pp. 122–137. https://doi.org/10.1007/978-3-030-65742-0_9

- **PDF en esta rama:** [Abrir o descargar](papers/dhont_2020_circular_heatmaps.pdf)
- **PDF completo público del taller:** https://project.inria.fr/aaltd20/files/2020/08/AALTD_20_paper_DhontVisual.pdf
- **Ficha institucional:** https://researchportal.vub.be/en/publications/visual-analytics-for-extracting-trends-from-spatio-temporal-data/
- **Dónde revisar en la versión del taller:** sección 3.2, sección 3.3 y Figuras 2–3, páginas 6–8.
- **Procedimiento del artículo:** representa huellas temporales con siete anillos (lunes interior y domingo exterior) y 24 sectores horarios en sentido horario desde medianoche. Compara mapas mediante resta, tanto entre períodos consecutivos como contra una base, usando un color neutral para igualdad y colores divergentes para diferencias positivas/negativas. La Figura 2 ejemplifica consumo eléctrico; el caso de estudio también usa tráfico de Bruselas.
- **Qué informa en el atlas:** la organización visual exacta día × hora del reloj semanal y el modo Diferencia contra la base 2020.
- **Adaptación y límite:** el color del atlas representa participación semanal o su diferencia en pp; no magnitudes eléctricas o tráfico absoluto. El paper no fundamenta nuestra TV. La representación radial no garantiza mejor lectura que una matriz: los anillos exteriores ocupan más área, por lo que el atlas conserva una alternativa rectangular y la efectividad queda pendiente de evaluación con usuarios.

## Trazabilidad de decisiones

| Decisión implementada | Referencia principal | Alcance de la relación |
|---|---|---|
| Comparar forma temporal y volumen por separado | Liu et al.; van der Knaap et al. | Antecedentes de análisis; adaptación de unidad y período |
| Normalizar por suma para obtener probabilidades | Van der Knaap et al., ecuación 1 | Misma operación sobre otras categorías |
| TV para resumir diferencias de composición | Fredriksson y Karlström, ecuación 11 | Misma fórmula; categorías y propósito adaptados |
| Hellinger para recuperar perfiles cercanos | Van der Knaap et al., ecuación 2 | Versión reescalada y con raíz; búsqueda por vecinos |
| Reloj de siete días y 24 horas | Dhont et al., sección 3.2 | Antecedente visual directo |
| Resta de celdas contra una referencia y color divergente | Dhont et al., sección 3.3 | Misma operación; valores normalizados en nuestro caso |

## Decisiones que estas cuatro referencias no validan automáticamente

- Elegir enero–febrero y usar 2020 como base: se documentan las razones de comparabilidad y disponibilidad, pero la selección no controla todos los efectos estacionales ni operativos.
- Ajustar conteos por exposición de cada día de semana: es una decisión explícita de estandarización del calendario que debe explicarse por su denominador.
- Fijar AM en 06:00–09:59, recuperar 12 vecinos, usar los umbrales de presets o saturar color en ±0,65 pp: son parámetros propios y requieren evaluación/sensibilidad.
- Clasificar estaciones como residenciales o laborales, atribuir cambios al teletrabajo o recomendar frecuencias: este atlas no realiza esas inferencias.
- Afirmar superioridad de TV o del reloj semanal: requiere comparación de alternativas y evaluación con personas.

Las fórmulas implementadas, sus denominadores y los datos de entrada se describen en [03-datos-y-metodos.md](03-datos-y-metodos.md). La literatura complementaria sobre tareas, comparación visual y trayectorias se mantiene en [02-investigacion-y-diseno.md](02-investigacion-y-diseno.md); no forma parte de esta selección de cuatro referencias principales.
