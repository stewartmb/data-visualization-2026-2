# Ejecutar el atlas

Desde la raíz del repositorio:

```bash
python3 -m http.server 8765
```

Abrir **http://localhost:8765/atlas/**. Servir desde la raíz permite abrir también los enlaces de documentación. No se requiere compilación, conexión externa ni tokens: D3 y los datos están incluidos.

La aplicación usa módulos ES y `fetch`, por lo que necesita HTTP. Datos: `data/atlas.json` y `data/boroughs.geojson`. Se generan con `python3 scripts/redesign/build_atlas.py` desde los snapshots versionados.

Leer [la propuesta completa](../redesign/README.md), [las tareas](../redesign/01-problema-y-tareas.md), [la investigación de diseño](../redesign/02-investigacion-y-diseno.md) y [la metodología](../redesign/03-datos-y-metodos.md).

La aplicación se puede servir en cualquier hosting estático con `/atlas/` como entrada, manteniendo las rutas relativas del repositorio para los documentos. Esta rama no activa ni cambia despliegues de `main`.

Código de visualización propio con D3 v7.9.0 (Mike Bostock; [licencia ISC](lib/LICENSE.d3)). Datos externos atribuidos en la interfaz y metodología. Desarrollo asistido por IA; evaluación con personas pendiente.

### Ordenamiento del atlas

El orden corresponde al modo y al período visible. En un año aislado se ordena por peso horario (mañana 06–10, tarde 16–20, noche 20–24), peso del fin de semana, volumen diario o semejanza de perfiles. Mañana, tarde y noche usan como denominador todas las entradas de lunes a viernes cuando se muestra la semana, o todas las entradas del día elegido. El fin de semana solo está disponible con semana completa.

En Cambio se ordena por redistribución horaria, caída/aumento del peso de la mañana, índice de volumen (2020=100) o semejanza entre vectores de diferencias. Al elegir un día, los cálculos se restringen a ese día. La redistribución conserva el denominador semanal para ser coherente con el color de las celdas; la similitud de perfiles de un año se normaliza dentro del período visible. Distrito y nombre está disponible en ambos modos. La similitud exige una estación seleccionada.

La explicación sobre la matriz indica dirección, período, unidad y denominador. En Leer estaciones, cada fila muestra posición y valor del criterio; también están disponibles al pasar el cursor sobre el nombre. Cambiar año, modo, día o criterio vuelve al principio de la lista.

Validación específica: `scripts/redesign/check-ordering.cjs` (Playwright). Se comprobaron 68 combinaciones numéricas y la interacción real de los controles, restauración de URL, desplazamiento y ancho móvil de 390 px, sin errores de JavaScript.

### Comparación de perfiles

Comparar muestra una sola gráfica de 24 horas que reúne lunes a domingo. Cada valor es la suma del peso semanal de esa hora en los siete días; el perfil completo suma 100 %. Se comparan 2020, el año elegido y las estaciones fijadas con una misma escala vertical. Agrupar días puede ocultar redistribuciones entre ellos: un botón lleva directamente a Huella → Reloj semanal → Diferencia, que conserva las 168 horas utilizadas en la distancia TV.

`scripts/redesign/check-comparison.cjs` verifica la agregación de siete días y la normalización para los 2.120 perfiles, las estaciones fijadas, los tooltips, el acceso al reloj de diferencias y el ancho móvil.

### Colores y filtro TV del mapa

El mapa conserva la escala continua Viridis original para la distancia TV. El dominio usa todas las estaciones del año elegido y no se recalcula al filtrar; una estación mantiene el mismo color. Los cambios mayores se dibujan después para reducir la superposición.

«Filtrar distancia TV» permite definir mínimo y máximo inclusivos en una sola barra con dos extremos ajustables. También se pueden ajustar con las flechas del teclado o pulsar la pista para mover el extremo más cercano. Al soltar un extremo se aplica el rango al grupo compartido, las otras vistas y la exportación. Los puntos fuera del rango no se dibujan como contexto. El rango se guarda en la URL (`tvMin`, `tvMax`) y se restaura al recargar; «Quitar filtro TV» elimina solo este filtro y el restablecimiento general elimina todos. Los límites son puntos porcentuales, no porcentajes de variación de volumen.

`scripts/redesign/check-map-emphasis.cjs` verifica colores continuos, rango inclusivo, contador, restauración desde URL, grupo compartido, colores estables y ancho móvil. `check-map-zoom.cjs` comprueba el tamaño de puntos y bordes durante el zoom.

### Rangos para todas las medidas

El selector de dos extremos también filtra cambio del peso AM, cambio del peso de fin de semana e índice de volumen. Los cambios usan puntos porcentuales y admiten valores negativos; el volumen usa porcentajes. Cada medida conserva su rango por separado y los filtros se combinan por intersección. Las etiquetas «Filtros activos» permiten quitar cada rango, «Quitar este filtro» borra el de la medida visible y el restablecimiento general los elimina todos. Los rangos se guardan en la URL y se aplican al grupo compartido y a la exportación. El color mantiene su dominio completo para el año elegido.

`check-metric-ranges.cjs` verifica los tres rangos nuevos, valores negativos, unidades, combinaciones, restauración desde URL, limpieza individual/general, teclado y vista móvil.

### Fórmulas junto a los filtros

El nombre del filtro abre una ayuda al pasar el cursor o recibir foco con el teclado. Un clic la mantiene abierta; otro clic o Escape la cierra. Cada medida incluye fórmula, variables, unidad, interpretación y ejemplo, con la normalización por calendario y el período de comparación. La ayuda es específica de TV, peso AM, peso del fin de semana o volumen. `check-formula-help.cjs` comprueba las cuatro fórmulas, cursor, teclado, clic y ancho móvil.
