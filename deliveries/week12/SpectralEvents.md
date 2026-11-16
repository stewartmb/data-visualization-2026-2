# Eventos de afluencia en la red

**Pregunta.** ¿Qué complejos conectados se apartaron de su patrón habitual al mismo tiempo y cuánto duró ese cambio? El modo **Eventos** del Atlas usa las entradas horarias de **2019–2024**, con hora local de Nueva York. El modo **Flujos** usa las estimaciones OD de 2021–2025.

- El calendario resume la mayor señal detectada en cada mes. Al pulsar una celda, aparecen hasta seis episodios candidatos.
- El mapa muestra los complejos detectados. El color codifica la diferencia porcentual entre entradas observadas y habituales, acumuladas para las horas en que el algoritmo detectó cada complejo. La escala de color va de −100 % a +100 % y se satura a partir de ese límite. Al pasar por un complejo se pueden consultar los conteos y el porcentaje.
- La serie de tiempo compara las entradas por hora observadas con las habituales, antes, durante y después. Se puede inspeccionar el conjunto o un complejo pulsando su marca en el mapa.

## Fuentes y reproducción

| Insumo | Procedencia y escala |
|---|---|
| Entradas | [MTA 2017–2019](https://data.ny.gov/d/t69i-h2me), solo 2019, y [MTA 2020–2024](https://data.ny.gov/d/wujg-7c2s). Las entradas se suman por `station_complex_id` y `transit_timestamp`, filtrando `transit_mode = subway`. |
| Grafo espacial | [Red de referencia GTFS 2026](RAEBImplementation.md), archivo [network_current.json](atlas/data/network_current.json), con 424 complejos y 549 conexiones únicas al unir ambos sentidos y deduplicar tramos y transbordos declarados. Se usa la misma topología de referencia para todo el período. |
| Método | [ManyWaves, Valdrighi, García-Zanabria et al., secciones 4 y 5](https://files.visualdslab.com/files/papers/2026-ManyWaves-CGF.pdf#page=3). Esta adaptación usa una variable de entradas y el calendario, mapa y serie del Atlas. |

El [índice procesado](atlas/data/spectral/index.json) registra los SHA-256 de los 72 Parquet y del grafo, así como cobertura y parámetros. [FullPeriodData](FullPeriodData.md) describe adquisición y conversión de los originales. Con los insumos locales y las dependencias de [Semana 12](requirements-data.txt), desde la raíz:

```bash
resultado=$(mktemp -d)
python deliveries/week12/scripts/prepare_spectral_events.py --output "$resultado"
cp "$resultado"/index.json "$resultado"/????-??.json atlas/data/spectral/
cp "$resultado"/index.json "$resultado"/????-??.json deliveries/week12/atlas/data/spectral/
cp "$resultado"/comparison.json deliveries/week12/data/spectral_comparison.json
node --test deliveries/week12/tests/spectral-data.test.mjs
```

## Cálculo

1. **Hora habitual.** Mediana del mismo día de la semana y hora en las cuatro semanas anteriores y cuatro siguientes, usando al menos cuatro observaciones. El residuo firmado usa el contraste de raíces cuadradas `2(√(observadas + 3/8) − √(habituales + 3/8))` para reducir la influencia de estaciones con conteos altos.
2. **Grafo espacio-temporal.** Cada nodo representa un complejo en una hora. El producto fuerte conecta vecinos ferroviarios en la misma hora, el mismo complejo en horas consecutivas y vecinos ferroviarios en horas consecutivas. El operador usa el Laplaciano combinatorio `D − A` sobre un grafo no dirigido y sin ponderar. Se aplica de forma dispersa a matrices de complejos por horas, con 30 horas de margen a cada lado de los bloques anuales.
3. **Respuesta espectral.** Filtro spline cúbico de Hammond en cuatro escalas logarítmicas y aproximación de Chebyshev de orden 30. El límite espectral es dos veces el grado máximo del grafo espacio-temporal. La detección usa la magnitud de la banda de mayor frecuencia, que se interpreta junto con el contraste firmado de entradas.
4. **Episodios.** Se exige un coeficiente en el percentil 99 global o superior y un desvío de al menos 20 entradas y 15 % sobre la referencia local. Se agrupan al menos tres complejos conectados en una hora. Los grupos se enlazan entre horas consecutivas cuando comparten al menos dos complejos. El calendario incluye grupos de al menos dos horas y retiene hasta seis episodios por mes de su pico, ordenados por la mayor media horaria de la respuesta del grupo.
5. **Ausencias.** Las celdas sin observación o sin referencia se usan con residuo neutro para el filtrado y se excluyen de la detección. En las series se conservan los huecos. Las sumas por hora del grupo incluyen solo los complejos con ambas cifras; los complejos incluidos en esa suma pueden variar por hora. El análisis usa la hora local publicada por la MTA. La señal puede reflejar feriados, cambios de servicio o cambios en los registros.

## Comprobación exploratoria

La ejecución encontró **391 episodios candidatos en 69 meses** de 72. Se comparó contra el residuo directo, manteniendo las reglas de agrupamiento, el número máximo de resultados y el percentil de corte para cada método. Los recuentos corresponden a los candidatos publicados que intersecan cada ventana.

| Caso documentado | Método espectral | Residuo directo |
|---|---:|---:|
| 29–30 sep. 2023, lluvias de Ophelia | 16 h, 44 complejos | 16 h, 148 complejos |
| 1–2 sep. 2021, inundaciones asociadas a Ida | 6 h, 20 complejos | 6 h, 72 complejos |
| Ocho ventanas de contraste con el mismo día y horario | 0 episodios | 0 episodios |

Estas ventanas permiten comparar la amplitud de los candidatos. Se requiere una referencia por complejo para medir cuál método delimita mejor la afectación real. [Resultado de la comparación](data/spectral_comparison.json) · [Informe municipal de Ophelia](https://comptroller.nyc.gov/reports/is-new-york-city-ready-for-rain/) · [Alerta oficial de Ida](https://www.weather.gov/media/okx/Ida/FFW40_NYC.pdf)

Para abrir el caso de 2023, añade `?analysis=events&month=2023-09&event=2023-09-6` a la dirección del Atlas.
