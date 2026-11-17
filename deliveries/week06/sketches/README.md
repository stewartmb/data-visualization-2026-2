# Bocetos anotados del panel actual

Las láminas congelan estados del prototipo del equipo y añaden una nota sobre el uso previsto. Muestran unidades, leyendas y disposición de vistas. Los archivos previos, incluidos `panel-actual.png` y `panel-actual.svg` del corte 2019–2024, quedan como historial de diseño.

| Boceto | Lectura e interacción |
|---|---|
| [Años, 2025](panel-anos.png) | Una vista general del día promedio. El grosor y el color secuencial del mapa muestran carga asignada. El reloj permite escoger una franja, la dispersión destaca complejos por afluencia y concentración, y la consulta de marcas ofrece valores. |
| [Años, comparación 2021 → 2025](panel-comparacion.png) | Los minimapas comparten referencia y escala. El mapa codifica el signo y la magnitud del cambio. La dispersión separa volumen y TV. El reloj localiza las diferencias por día y hora. |
| [Eventos, episodio del 29 de septiembre de 2023](panel-eventos.png) | La matriz mensual y la lista localizan el episodio. Se consulta la serie observada y habitual y se sincroniza una hora con las marcas del mapa. |

Para abrir los mismos estados, servir el repositorio por HTTP y añadir cada consulta a `/atlas/`:

- Años → `?year=2025`
- Comparación → `?year=2025&odBase=2021`
- Eventos → `?analysis=events&month=2023-09&event=2023-09-4`

Alternativas evaluadas. Los relojes por complejo sobre el mapa dificultaban ver los tramos. La cuadrícula 4 × 3 de meses por año dificultaba comparar el mismo mes entre años. El diseño vigente conserva un reloj enlazado y alinea los meses en columnas.
