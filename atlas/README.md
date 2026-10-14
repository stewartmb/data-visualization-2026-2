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

### Legibilidad de la TV en el mapa

La TV usa cinco intervalos fijos en puntos porcentuales: [0,5), [5,10), [10,15), [15,20) y [20,100]. Son bandas de presentación, no categorías estadísticas aprendidas ni umbrales de significancia. La leyenda informa cuántas estaciones del grupo hay en cada banda y el rango real. Los valores bajos usan un gris azulado suave; los altos se dibujan después para evitar quedar tapados.

El control «Destacar TV desde» atenúa los valores inferiores sin eliminarlos ni cambiar el grupo compartido; el contador distingue estaciones destacadas de estaciones seleccionadas. «Destacar todas» restablece la opacidad. Los colores y las posiciones de los puntos no cambian al mover el control. El control se conserva al cambiar de vista en la sesión, pero no se guarda en la URL. `scripts/redesign/check-map-emphasis.cjs` comprueba bandas, orden de dibujo, umbral, contador, tamaño de grupo y ancho móvil; `check-map-zoom.cjs` comprueba el tamaño de puntos y bordes durante el zoom.
