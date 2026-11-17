# Eventos de afluencia en la red

**Eventos** usa entradas horarias de 2021–2025 y se abre desde la pestaña del mismo nombre en el Atlas. Este documento describe su cálculo.

**Pregunta.** ¿En qué horas se apartan de lo habitual las entradas de complejos conectados y cuánto dura cada episodio? El detector usa los 60 meses de entradas en hora local de Nueva York.

- El panel izquierdo muestra una matriz de años por meses. Cada columna alinea el mismo mes de 2021 a 2025. El color resume la mayor señal detectada en cada mes. La escala va del menor al mayor de esos máximos mensuales. Cada tarjeta indica su señal numérica. Al pulsar un mes, el mismo panel muestra hasta seis episodios candidatos debajo de la matriz.
- El mapa muestra los complejos detectados. Cada episodio abre en la hora con la mayor suma de diferencias absolutas entre las entradas observadas y habituales de sus complejos. La tarjeta indica las horas de inicio y fin del episodio. Los círculos se actualizan al recorrer las horas de la serie. El área por encima del mínimo visible indica la diferencia absoluta en entradas, con escala fija durante el episodio y su contexto horario. El color indica la diferencia porcentual de esa hora y se satura a partir de ±100 %. Los complejos sin comparación horaria se muestran en gris. Al pasar por una marca se pueden consultar los conteos y el porcentaje. Al seleccionar un complejo, su serie se añade a las destacadas y conserva la hora del mapa.
- El panel derecho muestra el total del episodio y las series de los tres complejos con mayor diferencia por hora frente a lo habitual. Se pueden desplegar todas las series. La serie de tiempo compara las entradas por hora observadas con las habituales, antes, durante y después. Pasar el cursor por la serie muestra una vista previa. Al salir de la serie se vuelve a la hora inicial o a la última hora fijada con un clic o con las flechas del teclado. Al recorrer las horas, se lee la diferencia neta y el complejo con la mayor diferencia absoluta de entradas en esa hora. Se puede inspeccionar su serie pulsando su nombre o su marca en el mapa.

## Fuentes y reproducción

| Insumo | Procedencia y escala |
|---|---|
| Entradas | [MTA, entradas de 2021–2024](https://data.ny.gov/d/wujg-7c2s) y [MTA, entradas de 2025](https://data.ny.gov/d/5wq4-mkjj). Las entradas se suman por `station_complex_id` y `transit_timestamp`, filtrando `transit_mode = subway`. |
| Grafo espacial | [Red de referencia GTFS 2026](RAEBImplementation.md), archivo [network_current.json](atlas/data/network_current.json), con 424 complejos y 549 conexiones únicas al unir ambos sentidos y deduplicar tramos y transbordos declarados. Se usa la misma topología de referencia para todo el período. |
| Método | [ManyWaves, Valdrighi, García-Zanabria et al., secciones 4 y 5](https://files.visualdslab.com/files/papers/2026-ManyWaves-CGF.pdf#page=3). Esta adaptación usa una variable de entradas y el calendario, mapa y serie del Atlas. |

El [índice procesado](data/spectral/index.json) registra los SHA-256 de los 60 Parquet y del grafo, así como cobertura y parámetros. [FullPeriodData](FullPeriodData.md) describe adquisición y conversión de los originales. Con los insumos locales y las dependencias de [Semana 12](requirements-data.txt), desde la raíz:

```bash
resultado=$(mktemp -d)
python deliveries/week12/scripts/prepare_spectral_events.py --output "$resultado"
mkdir -p deliveries/week12/data/spectral
cp "$resultado"/index.json "$resultado"/????-??.json deliveries/week12/data/spectral/
cp "$resultado"/comparison.json deliveries/week12/data/spectral_comparison.json
node --test deliveries/week12/tests/spectral-data.test.mjs
```

## Cálculo

1. **Desviación respecto a lo habitual.** La referencia es la mediana del mismo día de la semana y hora en las cuatro semanas anteriores y cuatro siguientes, usando al menos cuatro observaciones. La señal de entrada usa el contraste firmado `2 × (√(observadas + 3/8) − √(habituales + 3/8))` para atenuar la influencia de los conteos altos.
2. **Grafo espacio-temporal.** Cada nodo representa un complejo en una hora. El producto fuerte conecta vecinos ferroviarios en la misma hora, el mismo complejo en horas consecutivas y vecinos ferroviarios en horas consecutivas. El operador usa el Laplaciano combinatorio `D − A` sobre un grafo no dirigido y sin ponderar. Se aplica de forma dispersa a matrices de complejos por horas, con 30 horas de margen a cada lado de los bloques anuales.
3. **Respuesta espectral.** El filtro spline cúbico de Hammond usa cuatro escalas logarítmicas y una aproximación de Chebyshev de orden 30. Para la banda de mayor frecuencia se toma la magnitud, se divide entre el rango intercuartílico, se aplica `log(1 + x)` y se divide entre el máximo global de la banda. El resultado está entre 0 y 1.
4. **Corte y agrupación.** Se toma el máximo coeficiente por complejo entre las horas comparables y se calcula el percentil 80 entre esos máximos, siguiendo el criterio de resaltado de ManyWaves (§6.1). Fractal aplica ese corte a cada complejo y hora con entradas observadas y habituales. Se agrupan al menos tres complejos conectados por hora. Los grupos se enlazan entre horas consecutivas cuando comparten al menos dos complejos. El calendario retiene hasta seis episodios de al menos dos horas por mes de su pico, ordenados por la mayor media horaria de la señal del grupo.
5. **Ausencias.** Si falta la observación o la referencia, se usa un contraste neutro para la transformada y se excluye esa hora del cálculo del corte y de la detección para ese complejo. Las series conservan los huecos y las sumas del grupo incluyen solo los complejos con ambas cifras en cada hora.

## Comprobación exploratoria

El catálogo contiene **147 episodios candidatos en 49 de los 60 meses**. Contiene episodios en los cinco Labor Day entre 2021 y 2025. El 2 de septiembre de 2024, los 12 complejos del episodio de la mañana sumaron 7.409 entradas frente a 33.855 habituales a las 08:00, una caída del 78,1 %. Como referencia, también se detectaron episodios usando la diferencia absoluta entre entradas observadas y habituales, con el mismo percentil aplicado a los máximos de esa diferencia y las mismas reglas de agrupación. Los recuentos se refieren a los candidatos del catálogo que coinciden con cada ventana.

| Caso documentado | Método espectral | Diferencia absoluta de entradas |
|---|---:|---:|
| 29–30 sep. 2023, lluvias de Ophelia | 3 h, 5 complejos | 4 h, 9 complejos |
| 1–2 sep. 2021, inundaciones asociadas a Ida | 2 h, 4 complejos | 0 episodios |
| Ocho ventanas de contraste con el mismo día y horario | 0 episodios | 0 episodios |

La señal identifica cambios frente a lo habitual. La causa de cada episodio requiere evidencia adicional. Los casos conocidos permiten comprobar la cobertura del catálogo y, para medir la precisión, se requiere una referencia por complejo y hora. [Resultado de la comparación](data/spectral_comparison.json) · [Informe municipal de Ophelia](https://comptroller.nyc.gov/reports/is-new-york-city-ready-for-rain/) · [Alerta oficial de Ida](https://www.weather.gov/media/okx/Ida/FFW40_NYC.pdf)

Para abrir el caso de 2023, añade `?analysis=events&month=2023-09&event=2023-09-d-2` a la dirección del Atlas.
