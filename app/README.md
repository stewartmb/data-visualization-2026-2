# La forma del día — la aplicación

Visualización interactiva en D3.js de cómo cambió el ritmo horario del metro de Nueva York entre 2020 y 2024, estación por estación. Una aplicación de tres vistas — Perfiles, Recorrido y Explorador — con una sola selección compartida.

**En línea:** <https://stewartmb.github.io/data-visualization-2026-2/app/> *(requiere GitHub Pages activado en el repositorio: Settings → Pages → `main` → `/ (root)`)*

---

## Correr en local

No hay que instalar ni compilar nada. Hace falta un servidor HTTP porque la aplicación usa módulos ES y `fetch`:

```bash
cd app
python3 -m http.server 8000
```

Abrir <http://localhost:8000>. Cualquier servidor estático sirve (`npx serve .`, `php -S localhost:8000`).

Pensada para 1 200 px o más de ancho. Funciona en móvil (las vistas se apilan) y en modo oscuro (sigue la preferencia del sistema).

---

## Cómo se lee

| | Capítulo | Pregunta | Hallazgo |
|---|---|---|---|
| | Inicio | La forma del día | el perfil del sistema, 2020 frente a 2024 |
| 1 | Volumen | ¿Cuánta gente volvió? | la recuperación se estancó cerca del 70 % |
| 2 | Forma | ¿Sigue existiendo el doble pico? | el pico de la mañana se aplanó en 80 % de las estaciones |
| 3 | Tipos | ¿Para qué se usa cada estación? | el cambio fue en una sola dirección: la mañana perdió peso |
| 4 | Ejes | ¿Qué cambió más: cuánto o cómo? | dentro de un borough, recuperación y aplanamiento son casi independientes |
| 5 | Bronx | ¿Por qué el Bronx? | perdió más pasajeros que nadie y es el único borough donde el día no cambió de forma |
| 6 | Abono | ¿Quién dejó de comprar el abono? | el pase de 30 días se desplomó: la evidencia del uso intermitente |
| 7 | Límites | ¿Qué no podemos afirmar? | 37 estaciones tienen una comparación poco confiable, y están marcadas |

**Perfiles** es la vista base: los siete hallazgos como tarjetas, el perfil de 24 h con selector (sistema · borough · tipo) y la rejilla de las 428 estaciones a 168 h. **Recorrido** lleva los capítulos como botones, con Play; cada uno termina con *cómo se mide* y *qué no demuestra* plegados, y un botón que abre el explorador ya configurado en lo que se acaba de leer. Los hallazgos no se escriben a mano: los genera `code/build_model.py` desde los datos, incluidos los negativos.

**Explorador.** Mapa (cuatro lentes: tipo · recuperación · cambio del pico · confiabilidad), dispersión recuperación × cambio del pico, serie mensual. Un clic en una estación abre su panel de evidencia: cifras, perfil antes/después, serie mensual y la tabla con los números detrás de cada afirmación. Un rectángulo en la dispersión o un período en la serie filtran todo lo demás. `←` `→` mueven entre capítulos dentro de Recorrido; `Esc` cierra paneles. La selección sobrevive al cambio de vista.

**Qué significa cada marca.** El botón de la barra abre la clave visual: qué codifica cada color y cada forma, y qué *no* significa.

---

## Estructura

```
app/
├── index.html                 la aplicación: tres vistas + panel de evidencia + clave visual
├── src/
│   ├── tokens.css             el sistema de diseño: colores por rol, tipografía, ritmo; modo oscuro
│   ├── estilos.css            estilos
│   ├── main.js                carga datos, monta las tres vistas y el panel
│   ├── capitulos.js           los siete capítulos: pregunta, hallazgo, gráfico, notas, preset
│   ├── estado.js              estado compartido del explorador (selección, filtros, lente, período)
│   ├── panel-estacion.js      el panel de evidencia de una estación
│   ├── util.js                formato, colores por rol, tooltip
│   └── graficos/
│       ├── perfil.js          perfil de 24 h (hero, boroughs, tipos, panel) y de 168 h (rejilla)
│       ├── serie.js           serie mensual con brush
│       ├── mapa.js            mapa con d3.geoMercator, lentes y leyenda de significado
│       ├── dispersion.js      recuperación × cambio del pico, con brush
│       ├── multiples.js       rejilla de perfiles semanales
│       └── tarifas.js         composición tarifaria apilada al 100 %
├── data/
│   ├── model.json             el modelo analítico (1.6 MB): estaciones, agregados, hallazgos, estadísticos
│   └── geo.json               boroughs y líneas del metro, simplificados (77 KB)
├── lib/d3.min.js              D3 v7.9.0, servido localmente
└── code/
    ├── build_model.py         construye model.json desde las tablas agregadas de la Semana 6
    ├── build_geo.py           construye geo.json desde GeoJSON de NYC y el GTFS de la MTA
    └── datos_nuevos.ipynb     notebook de Colab: trae los datos que corrigen la ventana de comparación y la capa del Census
```

---

## Reconstruir los datos

```bash
# el modelo analítico, ~3 s, sin dependencias
python3 app/code/build_model.py deliveries/week06/data/processed app/data/model.json

# la geografía, ~5 s, sin dependencias
python3 app/code/build_geo.py <boroughs.geojson> <carpeta_gtfs> app/data/geo.json
```

`build_model.py` acepta dos entradas opcionales que produce `datos_nuevos.ipynb`: `hourofweek_2024_enefeb.csv` (reemplaza el perfil de 2024 completo por el de enero–febrero de 2024, la misma ventana calendario que la línea base) y `acs_por_estacion.csv` (la capa del Census por área de influencia). Si están en la carpeta de entrada, las usa y lo deja registrado en `meta.ventanaComparable` y `meta.tieneACS`.

Las tablas agregadas de entrada se producen con los notebooks de la Semana 6 a partir de la API SODA de Socrata (ver el README raíz).

---

## El modelo de datos (`model.json`)

| clave | qué es |
|---|---|
| `meta` | ventanas de comparación, umbrales, percentiles, meses |
| `hallazgos` | los siete hallazgos como afirmaciones, con su tipo: positivo · negativo · límite |
| `stats` | conteos, medianas, correlaciones de Spearman (global y por borough) |
| `sistema` | serie mensual y perfil de 24 h del sistema, antes y ahora |
| `boroughs`, `tipos` | resúmenes por grupo: medianas sobre estaciones con comparación sólida, perfiles agregados |
| `tarifas` | share mensual por clase de pago |
| `estaciones[]` | por estación: tipo, asimetría, recuperación (dos ventanas), razón pico/valle, confiabilidad y sus motivos, serie mensual, perfiles de 168 h |

**Confiabilidad.** Cada estación lleva `conf.nivel`: `solida`, `estacional` (la recuperación con todo 2024 se desvía más de 10 puntos de la de enero–febrero, respecto del sistema), `interrumpida` (un mes de la ventana de comparación cae por debajo de la mitad de su entorno), `pequena` (menos de 300 entradas por día en la línea base). Las tres últimas se dibujan con anillo punteado y no entran en las medianas por grupo.

---

## Sistema de diseño

El único color de la página es el dato; el cromo es negro y gris. `src/tokens.css` define cada color por el trabajo que hace:

| rol | colores | validación |
|---|---|---|
| tipo de estación (identidad) | residencial `#eb6834` · mixta `#1baf7a` · laboral `#6250d6` | pasa los seis chequeos de `validate_palette.js` en todos los pares: peor par ΔE 9.2 bajo deuteranopia, 27.6 en visión normal |
| recuperación (magnitud) | azul, claro → oscuro | una sola tonalidad, recortada en p10–p90 |
| cambio del pico (polaridad) | azul ↔ gris ↔ rojo | dos polos cálido/frío con punto medio neutro |
| confiabilidad (estado) | ámbar · naranja · gris | siempre con texto, nunca solo por color |
| antes | gris | el perfil de 2020 detrás del dato actual |

Tipografía: Newsreader para las preguntas, Inter para todo lo demás; con `font-display: swap` y fallbacks del sistema.

---

## Créditos

Datos: MTA Subway Hourly Ridership 2020–2024, Metropolitan Transportation Authority vía Open NY. Geografía: NYC Department of City Planning (boroughs, vía dwillis/nyc-maps) y GTFS estático de la MTA (vía kjhealy/nycroutes). D3.js v7 (BSD-3-Clause). Parte del código se elaboró con asistencia de IA, revisada y validada por el equipo.
