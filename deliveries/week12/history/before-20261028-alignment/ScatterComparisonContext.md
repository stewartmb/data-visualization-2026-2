# Comparaciones afectadas por cierres: 181 St (1)

Revisión: 28 de octubre de 2026. Alcance de esta corrección: dispersión volumen × forma; no modifica los OD, rutas, perfiles ni cocientes.

## Hallazgo y control

En las particiones originales OD (Parquet anteriores a los agregados de interfaz), se filtró `origin_station_complex_id = '301'`, conservando todos los destinos, meses, horas y días. Para cada año se volvió a sumar `estimated_average_ridership`, ponderando cada promedio mensual por el número de ocurrencias de su día de semana y dividiendo entre las ocurrencias anuales de ese mismo día.

| Año | Viajes por semana representativa | Viajes diarios: semana / 7 |
|---|---:|---:|
| 2021 | 2206.914388824383 | 315.273484117769 |
| 2022 | 37520.58040711176 | 5360.08291530168 |
| 2024 | 42941.36746690855 | 6134.481066701222 |

Índice 2024/2021 × 100 = **1945.7649868232224 %**; incremento = **1845.7649868232224 %**. No son la misma magnitud. 2024/2022 × 100 = **114.44750321284828 %**.

Enero–noviembre de 2021 tiene demanda estimada casi nula. La suma de los 168 promedios OD de diciembre de 2021 es 25763.1402. El cierre reduce el denominador anual; no atribuir el cociente íntegramente a recuperación de demanda ni al COVID.

181 St (A) es otro complejo, ID **146**: su índice 2024/2021 es **101.1758135855434 %**. No se aplica a este complejo la anotación del cierre de la línea 1.

## Regla de representación

`atlas/src/scatter-domain.mjs` mantiene una anotación contextual verificada: complejo 301 y comparación que incluye 2021. La anotación tiene carácter de evento de servicio, no de clasificación estadística.

- Los demás complejos finitos determinan ambos dominios sin recortes ni percentiles. En 2021 → 2024 son 423 puntos, con eje X 0–300 %.
- El complejo anotado no determina el dominio ni se coloca artificialmente en el extremo del eje. A solicitud del usuario se retiró la fila de aviso visible; se conserva el contexto en la evidencia bajo demanda.
- La selección desde el mapa sigue enlazada con el reloj. La evidencia del sujeto conserva la explicación y los enlaces del cierre; los valores siguen en el modelo y la exportación.
- Con base 2022 o 2023, la anotación de 2021 deja de afectar el dominio y el complejo vuelve al gráfico.
- Un cociente grande por sí solo no activa esta excepción. No es una revisión exhaustiva de todos los cierres del sistema.

## Procedencia y reproducción

OD: MTA 2021 `rapa-97zv`, 2022 `nqnz-e9z9`, 2024 `jsu2-fbtj`; archivos, hashes y controles en `data/od_2021_2024/validation.json`. Agregación reproducible: `scripts/prepare_raeb.py`.

Contexto oficial: [MTA, anuncio de cierre por sustitución de ascensores, 25-11-2020](https://apps.cio.ny.gov/apps/mediacontact/public/view.cfm?parm=05263848-E4F1-92EC-B38BB3829F9FE33D). Reapertura: [Patch, 01-12-2021, con anuncio NYCT reproducido](https://patch.com/new-york/washington-heights-inwood/wash-heights-181st-street-1-station-reopens-new-elevators).

Ejecutar `python3 deliveries/week12/scripts/acquire_comparison_context.py` desde la raíz archiva las páginas crudas en `deliveries/week12/data/raw/comparison_context/` (ignorado por Git) y registra URL, fecha, estado HTTP, bytes y SHA-256 en `data/comparison_context/provenance.json`. Una descarga fallida se registra; no se declara adquirida.

Diccionario: `stationId` = identificador del complejo OD; `affectedYears` = años cuya disponibilidad de servicio afecta a la comparación; `label` y `explanation` = anotación contextual; `sources` = referencias de la afirmación. No se introduce una nueva medida de viajes.

Validación: `node deliveries/week12/tests/scatter-domain.test.mjs`; comprueba la excepción por año e identidad, retención de otros extremos, conservación de valores, límites vacíos y dominio 0–300 sobre el OD completo. Copias raíz/Semana 12 sincronizadas.
