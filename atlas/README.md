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
