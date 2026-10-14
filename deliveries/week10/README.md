# Semana 10 — Prototipo funcional y design review

**DS5343 Data Visualization · UTEC · 2026-2** · entrega del 14 de octubre de 2026

Prototipo en D3.js de *La forma del día*. Cuatro vistas enlazadas sobre 428 complejos de estación del metro de Nueva York, 2020–2024.

---

## Contenido

| Archivo | Qué es |
|---|---|
| [`PrototypeReport.md`](PrototypeReport.md) | funcionalidades, decisiones de diseño, limitaciones y preguntas para los revisores |
| `PresentationWeek10.pptx` | presentación del design review |
| [`prototype/`](prototype/) | código fuente completo del prototipo |
| [`prototype/data/app.json`](prototype/data/app.json) | datos procesados que consume la aplicación (1.4 MB) |
| [`code/build_app_json.py`](code/build_app_json.py) | script que reconstruye `app.json` desde los CSV de la Semana 6 |

```
prototype/
├── index.html
├── src/
│   ├── styles.css
│   ├── main.js              punto de entrada, tooltip y barra de estado
│   ├── estado.js            estado compartido entre las cuatro vistas
│   ├── vista-mapa.js        A · mapa de estaciones
│   ├── vista-perfiles.js    B · perfiles semanales
│   ├── vista-serie.js       C · serie temporal
│   └── vista-dispersion.js  D · dispersión pico/valle
├── lib/d3.min.js            D3 v7.9.0
└── data/app.json
```

---

## Ejecución

No hay que instalar nada ni compilar nada. Sí hace falta un servidor HTTP: el prototipo usa módulos ES y `fetch`, y ninguno de los dos funciona abriendo el archivo con doble clic (`file://`).

```bash
cd deliveries/week10/prototype
python3 -m http.server 8000
```

Abrir <http://localhost:8000>.

Cualquier servidor estático sirve igual:

```bash
npx serve .          # Node
php -S localhost:8000
```

Probado en Chrome, Firefox y Safari recientes. Pensado para una ventana de 1400 px o más de ancho; por debajo de 980 px las vistas se apilan en una columna.

---

## Cómo se lee

| | |
|---|---|
| **A · Mapa** | color = recuperación 2024 frente a enero–febrero 2020 · tamaño = entradas/día |
| **B · Perfiles** | 168 valores (24 h × 7 días) por estación, divididos por su total semanal · área gris = ene–feb 2020 · línea azul = 2024 |
| **C · Serie** | entradas mensuales del sistema, con línea de referencia en el nivel de enero 2020 |
| **D · Dispersión** | razón pico/valle antes (x) contra después (y) · bajo la diagonal = el pico se aplanó |

Interacciones: clic en cualquier estación para resaltarla en las tres vistas · arrastrar en **D** para filtrar · arrastrar en **C** para cambiar el período del canal de tamaño del mapa · doble clic para limpiar · rueda y arrastre para zoom en el mapa.

---

## Regenerar los datos

`app.json` ya está en el repositorio, así que esto solo hace falta si cambian las tablas agregadas.

```bash
python3 deliveries/week10/code/build_app_json.py \
        deliveries/week06/data/processed \
        deliveries/week10/prototype/data/app.json
```

Toma unos 3 segundos y no requiere red ni dependencias externas. Las tablas de entrada se producen con los notebooks de la Semana 6; el procedimiento está en el README raíz del repositorio.

---

## Despliegue

El prototipo es estático y con rutas relativas, así que funciona en GitHub Pages sin cambios.

1. En el repositorio: **Settings → Pages**
2. *Source*: **Deploy from a branch** · *Branch*: `main` · *Folder*: `/ (root)` · **Save**
3. Esperar uno o dos minutos.

URL resultante:

```
https://stewartmb.github.io/data-visualization-2026-2/deliveries/week10/prototype/
```

> **Estado:** pendiente de activar GitHub Pages en el repositorio. Una vez activado, la URL de arriba queda operativa sin tocar el código.

También se puede publicar cualquier otro hosting estático (Netlify, Vercel, Surge) apuntando a `deliveries/week10/prototype/`.

---

## Limitaciones

Están documentadas en [`PrototypeReport.md`](PrototypeReport.md), sección 3. Las tres que más afectan el uso:

- El brush de la serie temporal no reconstruye los perfiles horarios: solo cambia el canal de tamaño del mapa.
- Se dibujan 120 múltiplos a la vez de los 428; el contador del panel indica cuántos.
- El mapa no tiene contexto geográfico de fondo.

---

Datos: Metropolitan Transportation Authority (MTA) vía Open NY · API SODA de Socrata.
D3.js v7.9.0 (BSD-3-Clause), Mike Bostock.
Parte del código y la documentación se elaboró con asistencia de IA, revisada y validada por el equipo.
