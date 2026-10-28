# Ejecutar el Atlas actual

Desde la raíz del repositorio: `python3 -m http.server 8775`; abrir `/atlas/` o `/deliveries/week12/atlas/`. Se usan módulos ES y fetch: requiere HTTP. Publicación mediante HTTPS para WebGPU. D3 local; se intenta WebGPU primero, sin crear un contexto WebGL2. Solo si WebGPU falla se inicia el respaldo CPU/WebGL2. Si ambos fallan se indica que el mapa de flujos no está disponible; los gráficos SVG siguen funcionando.

**Entradas 2019–2024:** 72 meses, 141.836.156 registros fuente, 12 campos originales. Fuentes MTA/Open NY `t69i-h2me` (solo 2019) y `wujg-7c2s` (2020–2024). **OD estimado 2021–2024:** 48 meses, 446.399.011 registros, 16 campos; fuentes `rapa-97zv`, `nqnz-e9z9`, `uhf3-t34z` y `jsu2-fbtj`. **Red:** GTFS de referencia 2026, 424 complejos de subway, 547 enlaces ferroviarios y 2 transferencias peatonales declaradas. **Territorio:** borough y NTA 2020 según ubicación del complejo.

La derecha abre con entradas 2019→2024; **Base histórica** permite 2020. El encabezado «Flujos OD» elige un único año entre 2021 y 2024: conexiones, nodos y perfil horario usan ese año, sin selector ni curva de año base en el mapa. Las fuentes no se mezclan entre extremos. No existe avance automático de hora. Los controles de agrupación/fidelidad están apilados y Vista general limpia selección y cámara.

Código principal en Semana 12, espejo byte a byte en la raíz. Todos los recursos cliente están incluidos; datos crudos y credenciales quedan fuera. Consultar el README raíz y Semana 12 para pruebas, diccionarios y tareas pendientes. Se conserva atribución D3 y asistencia de IA. No confundir los módulos históricos preservados con vistas adicionales del panel actual.
