# Evaluacion inicial de calidad

## Alcance

La evaluacion se ejecuto el 2026-09-02 sobre una muestra reproducible de **10,000 registros** obtenida mediante la API oficial. La muestra contiene:

- 2,000 registros por ano, de 2020 a 2024;
- 500 registros por combinacion ano-trimestre;
- 8,800 registros subway, 600 Staten Island Railway y 600 tram;
- MetroCard y OMNY;
- los cinco boroughs atendidos por los modos incluidos.

La asignacion modal fue controlada para garantizar cobertura. Por ello, sus proporciones no estiman la distribucion de los 120,855,568 registros completos.

## Resultados

| Prueba | Resultado | Porcentaje de la muestra |
|---|---:|---:|
| Filas | 10,000 | 100% |
| Claves compuestas duplicadas | 0 | 0% |
| Valores faltantes | 0 en los 12 campos | 0% |
| Timestamps fuera de 2020-2024 | 0 | 0% |
| Timestamps no redondeados a la hora | 0 | 0% |
| Tipos temporales invalidos | 0 | 0% |
| Tipos numericos invalidos | 0 | 0% |
| Ridership negativo | 0 | 0% |
| Transfers negativos | 0 | 0% |
| Transfers mayores que ridership | 0 | 0% |
| Ridership igual a cero | 0 | 0% |
| Coordenadas fuera del rango esperado | 0 | 0% |

La clave compuesta revisada fue: `transit_timestamp`, `transit_mode`, `station_complex_id`, `payment_method` y `fare_class_category`.

## Rangos observados

- Timestamp minimo: `2020-02-15 08:00:00`.
- Timestamp maximo: `2024-11-16 00:00:00`.
- Ridership: 1 a 2,725.
- Transfers: 0 a 213.
- Metodos: `metrocard` y `omny`.
- Boroughs: Bronx, Brooklyn, Manhattan, Queens y Staten Island.
- Modos: subway, Staten Island Railway y tram.

## Limitaciones

1. La muestra es adecuada para probar scripts y estructura, pero no para estimar participaciones poblacionales.
2. La seleccion usa ventanas semanales fijas por trimestre; no representa todas las horas del periodo.
3. La ausencia de problemas en 10,000 filas no garantiza que el universo completo no tenga incidencias.
4. Ridership representa entradas estimadas por combinacion horaria y tarifaria, no viajes origen-destino individuales.
5. Transfers es un subconjunto de ridership; no debe sumarse nuevamente para calcular pasajeros totales.
6. Las transferencias internas dentro de un complejo no estan capturadas.
7. Los datos historicos pueden cambiar por transacciones tardias y correcciones metodologicas.

## Recomendaciones

- Usar el dataset completo para estimaciones oficiales.
- Mostrar ridership como suma y nunca sumar transfers encima de ridership.
- Ponderar o reconstruir la poblacion antes de comparar participaciones modales usando la muestra.
- Conservar banderas de calidad y documentar cualquier exclusion.
- Tratar `station_complex_id` como texto, no como numero.

Metricas auditables: `docs/data_quality_metrics.csv`.

