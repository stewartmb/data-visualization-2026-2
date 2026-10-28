# Seis tareas del Atlas: demanda, conexiones y vulnerabilidad

Revisión de alcance: **28 de octubre de 2026**. Este documento sustituye las seis tareas anteriores como contrato analítico vigente. Define objetivos y resultados comprobables; **no certifica que las seis estén implementadas**. La guía del profesor (§4.2) pide aproximadamente 5–8 preguntas de dominio; aquí elegimos seis por sus propósitos distintos.

## Problema y audiencia

El volumen agregado del subway oculta dónde se redistribuye la demanda, qué territorios intercambian viajes, cuándo los inician y de qué corredores podrían depender. El Atlas debe ayudar a **analistas de transporte e investigadores urbanos** a priorizar lugares, franjas y conexiones que requieren aforos, revisión de oferta o estudios de contingencia. Periodistas de datos son una audiencia secundaria.

El beneficio es pasar de una impresión visual a una pregunta investigable y documentada. No hay oferta histórica, capacidad, tiempos observados de viaje ni motivos de viaje para recomendar frecuencias, afirmar congestión o explicar causalmente los cambios por COVID, turismo o teletrabajo.

## Seis preguntas diferentes

| ID | Pregunta de dominio | Resultado que obtiene la audiencia | Para qué sirve |
|---|---|---|---|
| T1 | **¿Qué zonas recuperaron demanda y cuáles perdieron peso en el sistema entre 2019 y 2024?** | Zonas con recuperación de volumen, cambio absoluto y cambio de participación; distinguir crecimiento propio de redistribución territorial | Priorizar territorios para investigar demanda rezagada o emergente |
| T2 | **¿Cambió la dependencia de Manhattan o ganaron peso los viajes locales y entre los otros boroughs entre 2021 y 2024?** | Reparto de destinos por territorio de origen y cambios en conexiones locales/interterritoriales, conservando cantidades absolutas | Identificar relaciones que requieren un análisis de conectividad y oferta más detallado |
| T3 | **¿Dónde y cuándo se desplazaron las ventanas de mayor demanda?** | Días y franjas concretas con picos desplazados, aumentos absolutos o cambios de peso semanal | Elegir horarios y lugares para aforos o revisión de patrones de servicio |
| T4 | **¿Qué corredores de la red de referencia sostienen los principales intercambios territoriales?** | Tramos con mayor carga OD asignada y territorios que aportan a esa carga, por cohorte de inicio | Priorizar corredores para contrastar demanda modelada con capacidad y servicio observados |
| T5 | **¿Qué zonas generan más viajes hacia fuera y cuáles atraen más viajes desde otras zonas, y cómo cambia ese balance durante la semana?** | Balance direccional externo y sus cantidades de soporte, con franjas de inversión del balance | Reconocer necesidades distintas según dirección y horario de inicio, sin etiquetar barrios por su supuesto uso |
| T6 | **¿Qué viajes y territorios quedarían más expuestos si se interrumpiera un tramo de la red de referencia?** | Demanda que pierde conexión y distancia adicional para la que conserva un camino alternativo | Priorizar estudios de contingencia por exposición estructural; extensión contrafactual pendiente |

T1 trata de **cuánto y dónde**; T2 de **con quién se conecta**; T3 de **cuándo**; T4 de **por dónde se asigna**; T5 de **asimetría de dirección**; T6 de **consecuencias de una perturbación**. T2 compara composición de destinos; T5 compara el balance externo de una zona. T4 describe la red intacta; T6 la modifica explícitamente. No son seis versiones de un ranking de estaciones.

## Datos y reglas comunes

- **Entradas MTA 2019–2024:** comparación histórica de T1 y T3; 72 meses adquiridos, 141.836.156 registros fuente. La interfaz analiza 424 complejos de subway; otros modos/complejos presentes en los originales no se absorben en ese universo.
- **OD estimado MTA 2021–2024:** T2–T6 y comparaciones temporales desde 2021; 48 meses adquiridos, 446.399.011 registros fuente. No hay OD 2019/2020 en este conjunto.
- **Red GTFS de referencia 2026:** 424 complejos, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. Caminos por distancia sobre la unión de patrones de servicio, con plataformas colapsadas en complejos. No reconstruye operación histórica, esperas ni compatibilidad de servicios.
- **Boroughs y NTA 2020:** agrupación por ubicación del complejo. Un territorio sin complejos cubiertos no equivale a demanda cero. El origen de metro no es el domicilio; el destino no identifica empleo, turismo ni motivo.
- Usar los doce meses de cada año y estandarizar calendario. Comparar meses homólogos si se estudia estacionalidad; el promedio anual puede ocultar cambios mensuales. Una diferencia entre años no prueba un efecto causal de la pandemia.
- Comparación inicial OD: **2021 → 2024**. Para una referencia anual anterior a la pandemia usar **entradas 2019 → 2024**, con entradas en ambos extremos. El año 2020 completo no es una base prepandemia. El mapa mantiene OD 2021–2024; la base histórica independiente de dispersión/reloj no inventa OD previo a 2021.
- Sumar cantidades de los complejos antes de calcular medidas de un territorio o grupo. No promediar porcentajes, ratios ni distancias de sus estaciones. Definir el conjunto comparable de IDs en ambos años y reportar incorporaciones, exclusiones y cobertura por separado.

### Convención temporal y cantidades

Sea `a[y,m,d,h,o,j]` el promedio OD publicado por MTA. Con `n[y,m,d]` ocurrencias del día de semana `d` en el mes:

```text
q[y,d,h,o,j] = Σ_m n[y,m,d] a[y,m,d,h,o,j] / Σ_m n[y,m,d]
u[y,o,d,h] = Σ_j q[y,d,h,o,j]
V[y,R] = Σ_o∈R Σ_d,h u[y,o,d,h]
p[y,R,d,h] = Σ_o∈R u[y,o,d,h] / V[y,R]
```

`V` es una semana representativa con un lunes, un martes, etc.; no el total anual. Para entradas, formar primero promedios horarios por día de semana de las fechas cubiertas y aplicar la misma convención de semana. No equiparar directamente los totales de ambas fuentes. Los resultados de comparación usan la misma fuente en ambos extremos.

La hora OD es la **hora de inicio del viaje**. Los destinos son destinos de esa cohorte, no salidas observadas a esa hora. La carga del tramo tampoco es presencia simultánea ni ocupación de un tren. Mes faltante no equivale a cero; volumen nulo impide normalizar; base cero deja un cociente indefinido.

## T1 — Redistribución territorial de la demanda

**Entrada:** entradas 2019–2024, complejos comparables y agrupación borough/NTA. **Salida verificable:** tabla por territorio con `V_base`, `V_objetivo`, diferencia de viajes/semana representativa, índice de volumen y cambio de participación del sistema.

```text
I_R = 100 V[objetivo,R] / V[base,R]
ΔV_R = V[objetivo,R] − V[base,R]
s[y,R] = V[y,R] / V[y,sistema comparable]
Δs_R_pp = 100 (s[objetivo,R] − s[base,R])
```

Permite distinguir una zona con crecimiento absoluto pero pérdida de participación, de otra con pérdida absoluta pero mayor peso relativo. No se anuncia que existan esos casos antes de calcularlos. El índice y la TV temporal son evidencias complementarias en la dispersión; T1 no se reduce a preguntar si volumen y forma coinciden.

**Munzner:** propósito descubrir; búsqueda explorar zonas con resultado desconocido → localizar un territorio elegido; consulta comparar y resumir atributos espaciales. **Medios candidatos:** selección geográfica directa y detalle territorial compacto; punto enlazado en la dispersión cuando corresponda. **Criterio de éxito:** identificar dos territorios con comportamientos diferentes y citar cantidades, participación y cobertura, sin inferir causas.

**Estado:** base histórica y comparación por complejo disponibles; la síntesis territorial y sus participaciones requieren desarrollo y validación.

## T2 — Dependencia e intercambios entre territorios

**Entrada:** OD 2021–2024 y pertenencia territorial. **Salida verificable:** matriz dirigida de cantidades y participaciones por destino para cada territorio de origen, más su diferencia entre años.

```text
F[y,R,S] = Σ_d,h Σ_o∈R,j∈S q[y,d,h,o,j]
P[y,R,S] = F[y,R,S] / Σ_S F[y,R,S]
ΔP[R,S]_pp = 100 (P[objetivo,R,S] − P[base,R,S])
```

Calcular porcentaje interno `P[R,R]`, hacia Manhattan y hacia los demás boroughs. La dependencia de Manhattan se interpreta principalmente para orígenes fuera de Manhattan. Mostrar `F` junto con `P`: ganar participación no implica ganar viajes. Para NTA, declarar el nivel de agrupación de destinos; no mezclar denominadores ni comparar particiones distintas. Hellinger podría resumir cambio del reparto, pero no es necesaria para resolver esta tarea ni se declara implementada.

**Munzner:** propósito descubrir/verificar una hipótesis descriptiva; búsqueda explorar conexiones → buscar las de un origen conocido; consulta comparar relaciones y resumir distribuciones. **Medios candidatos:** seleccionar territorio/origen en el mapa, resaltar relaciones y mostrar composición exacta en detalle bajo demanda. No deducir porcentajes del ancho aparente de un haz.

**Criterio de éxito:** nombrar una relación territorial y cuantificar su cambio absoluto y relativo entre años. **Estado:** OD completo y selección de conexiones salientes disponibles; agregados territoriales y comparación de composición pendientes.

## T3 — Nuevas ventanas de demanda

**Entrada:** perfiles día × hora de complejos o territorios, entradas 2019–2024 u OD 2021–2024 según el contraste. **Salida verificable:** ventanas de máxima demanda y franjas que ganan/pierden cantidad o peso semanal, con valores de ambos años.

```text
Δu[d,h] = u[objetivo,d,h] − u[base,d,h]
Δp_pp[d,h] = 100 (p[objetivo,d,h] − p[base,d,h])
TV_pp = 50 Σ_d,h |p[objetivo,d,h] − p[base,d,h]|
```

Como extensión, buscar la ventana móvil de tres horas consecutivas de mayor cantidad en cada día (24 inicios posibles, continuidad a medianoche y empates explícitos). Mantener la duración fija al comparar; distinguir cantidad de viajes de participación semanal. No imponer “mañana laboral” como la única punta posible. Examinar meses homólogos antes de atribuir un pico anual a un cambio persistente.

**Munzner:** propósito descubrir; búsqueda explorar franjas desconocidas → localizar una conocida; consulta identificar extremos y comparar distribuciones temporales. **Medios:** reloj radial enlazado, celda activa con valores exactos y selección manual del horario; mapa conserva el contexto espacial. La TV es un resumen, no localiza por sí sola las horas ni considera su distancia temporal.

**Criterio de éxito:** señalar día, intervalo y magnitudes de un cambio, indicando si es absoluto, composicional o ambos. **Estado:** reloj y contraste de perfiles disponibles; detector de ventanas y comprobación mensual son extensiones pendientes.

## T4 — Corredores que sostienen los intercambios

**Entrada:** OD de una cohorte día–hora y caminos `P[o,j]` asignados a la red constante. **Salida verificable:** carga por tramo y contribución por territorio de origen/destino.

```text
L[y,e,d,h] = Σ_o,j q[y,d,h,o,j] 1[e ∈ P[o,j]]
L_R→S[y,e,d,h] = Σ_o∈R,j∈S q[y,d,h,o,j] 1[e ∈ P[o,j]]
```

Si se presenta un enlace sin dirección, sumar ambos sentidos e indicarlo; no afirmar que RAEB separa sentidos. Un viaje aporta a varios tramos: sumar `L` en toda la red no produce el total de viajes. Origen=destino, demanda no mapeada y no asignable quedan separados.

**Munzner:** propósito descubrir; búsqueda explorar red → localizar un tramo conocido; consulta identificar extremos y resumir aportes sobre caminos. **Medios:** mapa con geometría real de referencia y consulta de tramo; seleccionar una relación territorial destaca su contribución. Las barras de agrupación/fidelidad cambian la representación, nunca `L`.

**Criterio de éxito:** citar la carga modelada de un tramo y los territorios que contribuyen, pudiendo volver a los caminos de referencia. **Estado:** asignación y cargas por enlace preparadas, representación disponible; inspección cuantitativa y desglose territorial pendientes. La fusión visual de haces no es una nueva arista agregada y su grosor no debe usarse como lectura exacta de `L`. No mide congestión ni pasajeros presentes.

## T5 — Balance externo de origen y destino

**Entrada:** OD dirigido y una partición territorial, para la misma cohorte día–hora. **Salida verificable:** balance de cada territorio, cantidades externas y franjas de cambio de signo.

```text
O_ext[R] = Σ_o∈R,j∉R q[o,j]
D_ext[R] = Σ_o∉R,j∈R q[o,j]
B[R] = (D_ext[R] − O_ext[R]) / (D_ext[R] + O_ext[R])
```

Rango `[-1,1]`: positivo = predominan viajes con destino en R; negativo = predominan los iniciados en R hacia fuera. Sin viajes externos, `B` es indefinido. Los viajes internos se muestran aparte: se excluyen del denominador para no diluir la asimetría externa. Acompañar siempre `B` de `D_ext` y `O_ext`; un balance extremo con poco volumen no equivale a un gran polo de demanda.

**Munzner:** propósito descubrir; búsqueda explorar territorios y franjas; consulta comparar direcciones e identificar inversiones. **Medios candidatos:** selección territorial y detalle bidireccional con cantidades; el reloj podría mostrar balance en un modo explícitamente rotulado, nunca reutilizando silenciosamente la leyenda de diferencia de peso.

**Criterio de éxito:** identificar un territorio y una franja con predominio de una dirección, y contrastarlo con otro horario. **Estado:** calculable con los OD disponibles; métrica y lectura visual pendientes. No llamarlo “entradas menos salidas a esa hora”: los destinos pertenecen a viajes iniciados en esa cohorte. Tampoco inferir “barrio dormitorio”, zona laboral o turismo.

## T6 — Exposición ante una interrupción de referencia

**Extensión propuesta; no implementada.** Es un experimento de escenario con demanda fija, no una predicción del comportamiento real ni una técnica validada por RAEB.

**Entrada:** OD de una cohorte, grafo de referencia intacto y un enlace ferroviario elegido. Retirar sus aristas dirigidas en ambos sentidos si existen, identificando qué IDs se eliminan; no retirar transferencias peatonales ni enlaces paralelos sin declararlo. Un enlace GTFS no identifica necesariamente una infraestructura física completa: no llamarlo “cierre de túnel” sin verificar todos los tramos involucrados.

Recalcular caminos de menor distancia con el mismo criterio y desempates de la referencia. Comparar solo pares de complejos distintos que eran asignables en la red intacta. Separar los no asignables previos y origen=destino.

```text
Q = Σ_OD elegibles q_OD
U_e = Σ_OD que pierden conexión q_OD / Q
Δkm_e = Σ_OD aún conectados q_OD (distancia_sin_e − distancia_original)
        / Σ_OD aún conectados q_OD
```

`U_e` y `Δkm_e` deben mostrarse por separado: excluir desconectados del segundo promedio podría hacer parecer benigno un cierre grave. Denominador cero implica métrica indefinida. Con distancias no negativas, el camino mínimo no debe acortarse al eliminar aristas; ese es un control del cálculo.

**Salida verificable:** cuota y cantidad de demanda que pierde conexión, distancia adicional ponderada para la restante y territorios afectados; cantidades conservadas y escenario identificado. **Munzner:** propósito producir un escenario y descubrir su efecto; búsqueda sobre enlace conocido; consulta comparar red intacta/alterada y resumir exposición. **Medios candidatos:** seleccionar un tramo y activar un escenario reversible, con diferencia explícita en el mismo mapa; la red original permanece recuperable.

**Valor:** distinguir corredores voluminosos de enlaces con pocas alternativas y orientar estudios de contingencia. No ofrece minutos de demora, evacuación, trenes de reemplazo ni demanda adaptada: faltan horarios, capacidad, frecuencias y respuesta de viajeros.

## Un panel, varias tareas; estado de implementación

Se mantiene el panel integrado: mapa central + dispersión volumen × forma + reloj radial + minimapa. No se añaden seis pantallas ni seis formularios. Las tareas determinan qué información hace falta; la composición actual no se declara suficiente antes de probarla. T2, T5 y T6 requieren agregados/derivaciones y detalles adicionales, que deben diseñarse sin recargar el overview.

| Componente | Función analítica | Límite |
|---|---|---|
| Mapa y caminos de referencia | Espacio, relaciones y contexto de T1–T6 | La abstracción libre puede cruzar agua; no crea infraestructura ni permite medir distancias sobre la curva |
| Dispersión volumen × forma | Seleccionar casos que separan cantidad y reparto temporal, apoyo a T1/T3 | No responde por sí sola sobre dependencia territorial, balance o vulnerabilidad |
| Reloj radial | Localizar franjas de T3 y elegir cohorte de T2/T4/T5/T6 | El color actual es diferencia de peso semanal; otra métrica exige una codificación/leyenda explícita |
| Minimap y navegación | Conservar orientación durante la inspección | Son medios de interacción, no una séptima tarea del dominio |
| Detalle bajo demanda/exportación | Cantidades, denominadores, cobertura y límites de cualquier conclusión | Verificar procedencia es un requisito transversal; no ocupa una de las seis preguntas |

**Overview → zoom y selección directa → detalles bajo demanda.** La búsqueda es auxiliar. No se añade reproducción automática. El overview debe orientar sin configurar filtros; preguntas específicas pueden requerir seleccionar un lugar, hora o escenario. El objetivo es reducir cálculo mental mediante posiciones, tamaños y diferencias explícitas, sin afirmar que toda interpretación puede hacerse sin razonamiento.

## Evaluación y entrega

Cada tarea debe producir una respuesta escrita con entidad/territorio, período, unidad, valores y una cautela pertinente. Comparar esos resultados con agregados reproducibles independientes; después evaluar con personas si la interacción permite encontrarlos. Ausencia de capacidad o tiempo de viaje no se soluciona cambiando el idiom.

Prioridad de desarrollo: cerrar síntesis territorial y lectura exacta (T1/T2/T4/T5), validar franjas (T3), y desarrollar T6 como extensión separada si cabe en la entrega. No presentar T6 como función terminada durante una demostración.

Fuentes y alcance: [ODData](ODData.md), [HistoricalContrast](HistoricalContrast.md), [RAEB Implementation](RAEBImplementation.md). Fundamento visual y alternativas: [revisión de Semana 6](../week06/referencias.md). La literatura respalda métodos y decisiones puntuales; no valida automáticamente estas seis preguntas ni nuestra herramienta.
