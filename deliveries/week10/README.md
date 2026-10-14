# Semana 10 — Prototipo funcional y design review

**DS5343 Data Visualization · UTEC · 2026-2** · entrega del 14 de octubre de 2026

Prototipo en D3.js de *La forma del día*: siete capítulos guiados y un explorador de cuatro vistas enlazadas sobre los 428 complejos de estación del metro de Nueva York, 2020–2024.

![El prototipo](capturas/01-inicio.png)

---

## Contenido

| Archivo | Qué es |
|---|---|
| [`PrototypeReport.md`](PrototypeReport.md) | funcionalidades, decisiones de diseño, limitaciones y preguntas para los revisores |
| `PresentationWeek10.pptx` | presentación del design review |
| [`prototype/`](prototype/) | código fuente completo del prototipo |
| [`prototype/data/model.json`](prototype/data/model.json) · [`geo.json`](prototype/data/geo.json) | datos procesados que consume la aplicación (1.6 MB + 77 KB) |
| [`code/build_model.py`](code/build_model.py) | construye `model.json` desde las tablas de la Semana 6: 3 s, sin dependencias |
| [`code/build_geo.py`](code/build_geo.py) | construye `geo.json` desde GeoJSON de NYC y el GTFS de la MTA |
| [`code/datos_nuevos.ipynb`](code/datos_nuevos.ipynb) | notebook de Colab con las tres pasadas pendientes (ventana comparable del perfil, perfiles por mes, capa del Census) |
| [`guion-exposicion.md`](guion-exposicion.md) | guion del design review, cronometrado a 5 minutos |
| [`capturas/`](capturas/) | capturas del prototipo corriendo |

```
prototype/
├── index.html                 la página: narrativa + explorador + clave visual
├── src/
│   ├── tokens.css             sistema de diseño: colores por rol, tipografía; modo oscuro
│   ├── estilos.css
│   ├── main.js                carga datos, construye los capítulos, monta el explorador
│   ├── capitulos.js           los siete capítulos: pregunta, hallazgo, gráfico, notas, preset
│   ├── estado.js              estado compartido del explorador
│   ├── panel-estacion.js      panel de evidencia de una estación
│   ├── util.js
│   └── graficos/              perfil · serie · mapa · dispersion · multiples · tarifas
├── data/model.json · geo.json
└── lib/d3.min.js              D3 v7.9.0
```

---

## Ejecución

No hay que instalar ni compilar nada. Hace falta un servidor HTTP porque usa módulos ES y `fetch`:

```bash
cd deliveries/week10/prototype
python3 -m http.server 8000
```

Abrir <http://localhost:8000>. Cualquier servidor estático sirve (`npx serve .`, `php -S localhost:8000`).

Pensado para 1 200 px o más de ancho; funciona en móvil (las vistas se apilan) y en modo oscuro.

**Teclado:** `←` `→` entre capítulos · `Esc` cierra el panel y la clave visual.

---

## Cómo se lee

Arriba, la narrativa: cada capítulo es una pregunta, su hallazgo, el gráfico, *cómo se mide* y *qué no demuestra*. El botón "Ver estas estaciones en el explorador" baja al explorador con ese capítulo ya configurado.

Abajo, el explorador: mapa (cuatro lentes), rejilla de perfiles de 168 h, dispersión y serie mensual, enlazados por una sola selección. Clic en una estación → su panel de evidencia. Rectángulo en la dispersión → filtra. Período en la serie → cambia el tamaño en el mapa. Doble clic limpia un brush; "Quitar todo" limpia todo.

El botón **"Qué significa cada marca"** de la barra abre la clave visual.

---

## Regenerar los datos

```bash
python3 deliveries/week10/code/build_model.py deliveries/week06/data/processed deliveries/week10/prototype/data/model.json
```

`build_model.py` acepta dos entradas opcionales que produce `datos_nuevos.ipynb` (`hourofweek_2024_enefeb.csv`, `acs_por_estacion.csv`); si están en la carpeta de entrada las usa y lo registra en `meta`. Las tablas de entrada se producen con los notebooks de la Semana 6 (ver el README raíz).

---

## Despliegue

Estático y con rutas relativas: funciona en GitHub Pages sin cambios.

1. **Settings → Pages** → *Deploy from a branch* → `main` → `/ (root)` → **Save**
2. Esperar uno o dos minutos.

```
https://stewartmb.github.io/data-visualization-2026-2/deliveries/week10/prototype/
```

La misma aplicación vive también en [`/app`](../../app/) (raíz del repositorio), que es la copia que sigue evolucionando hacia la Semana 12.

---

## Limitaciones

Documentadas en [`PrototypeReport.md`](PrototypeReport.md), sección 3. Las tres que más afectan la lectura: el perfil de 168 h de 2024 es todavía el año completo (la recuperación ya usa la misma ventana calendario); el brush temporal solo cambia el tamaño de las estaciones; la explicación del Bronx es una hipótesis consistente con los datos, no una medición.

---

Datos: Metropolitan Transportation Authority (MTA) vía Open NY · API SODA de Socrata. Geografía: NYC DCP y GTFS de la MTA. D3.js v7.9.0 (BSD-3-Clause). Parte del código se elaboró con asistencia de IA, revisada y validada por el equipo.
