# Ejecutar el Atlas actual

Desde la raíz del repositorio: `python3 -m http.server 8775`; abrir `/atlas/` o `/deliveries/week12/atlas/`. Se usan módulos ES y fetch: requiere HTTP. Publicación mediante HTTPS para WebGPU. D3 local; se intenta WebGPU primero, sin crear un contexto WebGL2. Solo si WebGPU falla se inicia el respaldo CPU/WebGL2. Si ambos fallan, la vista sobre vías y los gráficos SVG siguen disponibles. El agrupamiento interactivo requiere un backend gráfico.

**OD estimado 2021–2025** · 60 meses, 567.608.985 registros y 16 campos. Fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z`, `jsu2-fbtj` y `y2qv-fytt`. **Red:** GTFS de referencia 2026, 424 complejos OD, 475 paradas padre, 556 enlaces ferroviarios y 75 transbordos declarados. **Territorio:** borough y NTA 2020 según ubicación del complejo.

El Atlas abre sobre las vías. El radio y la fidelidad permiten pasar a los haces RAEB. Seleccionar un complejo muestra sus salidas y destinos, y actualiza el reloj y la dispersión. Los minimapas comparan la misma franja con el año abierto en el mapa principal como referencia; el botón Comparar permite elegir cualquier par de años OD. El enlace Fractal vuelve a la vista general y restablece el año, los filtros, la selección y la cámara. Borough, búsqueda y selección de área acotan los orígenes de los flujos, con destinos en toda la red. El mapa principal y los mapas anuales usan el mismo grupo de orígenes.

Código principal en Semana 12, espejo byte a byte en la raíz. Todos los recursos cliente están incluidos; datos crudos y credenciales quedan fuera. Consultar el README raíz y Semana 12 para pruebas, diccionarios y tareas pendientes. Se conserva atribución D3 y asistencia de IA. El mapa, el reloj, la dispersión y las exportaciones usan OD 2021–2025.

**Eventos** usa el [catálogo preparado con entradas horarias de 2021–2025](https://github.com/stewartmb/data-visualization-2026-2/blob/main/deliveries/week12/SpectralEvents.md). Elige un mes y un episodio para comparar las entradas de cada hora con su valor habitual en el mapa y la serie temporal.
