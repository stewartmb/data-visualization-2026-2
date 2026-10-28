// Mapa de estaciones sobre un plano de calles (teselas CARTO/OpenStreetMap vía d3-tile,
// con los boroughs como respaldo sin red) y el trazado del metro (d3.geoMercator).
// Cuatro lentes, cada una con su leyenda de significado:
//   tipo   identidad: residencial · mixta · laboral
//   rec    magnitud: recuperación (azul claro → oscuro)
//   aplan  polaridad: se aplanó (azul) ↔ sin cambio ↔ se afiló (rojo)
//   conf   estado: confiabilidad de la comparación
// Las estaciones con comparación poco confiable llevan anillo punteado en todas las lentes.

import { estado } from '../estado.js';
import { fmt, tooltip, ttEstacion, cssVar, colorTipo, colorConf, NOMBRE_CONF } from '../util.js';

export function mapa(cont, opts) {
  const o = Object.assign({
    modelo: null, geo: null, lente: null, interactivo: true, zoom: true, leyenda: true,
    visible: null,            // fn(e) → bool; si es null usa estado.esVisible
    enfoqueBorough: null,     // 'Bronx' → encuadra ese borough
    radioMax: 12, tamanoPorRango: true, alto: null, escalaGlifo: 1,
    calles: true,             // plano de calles de fondo (teselas); si fallan, quedan los boroughs
  }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const M = o.modelo, G = o.geo, est = M.estaciones;
  const root = d3.select(el).style('position', 'relative');
  root.selectAll('svg.mapa, .mapa-leyenda').remove();
  const svg = root.append('svg').attr('class', 'mapa').attr('role', 'img').attr('aria-label', 'Mapa de las estaciones del metro de Nueva York');
  const gTiles = svg.append('g').attr('class', 'teselas');
  const g = svg.append('g');
  const gBoro = g.append('g');
  const gLin = g.append('g');
  const gEst = g.append('g');
  const gGlif = g.append('g').attr('class', 'glifos');
  const ley = o.leyenda ? root.append('div').attr('class', 'mapa-leyenda') : null;
  const usaCalles = o.calles && typeof d3.tile === 'function';
  const credito = usaCalles ? root.append('div').attr('class', 'mapa-credito').html('plano: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors') : null;
  let callesFallaron = false;
  const esOscuro = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  const urlTesela = ([x, y, z]) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  // Las teselas se calculan con la proyección compuesta (encuadre × zoom), fuera del <g> con
  // transform, para que se pidan al nivel de detalle que corresponde y no se vean pixeladas.
  function pintarTeselas(tr) {
    if (!usaCalles || callesFallaron) return;
    const k = proy.scale() * 2 * Math.PI * tr.k, tx = proy.translate()[0] * tr.k + tr.x, ty = proy.translate()[1] * tr.k + tr.y;
    const teselas = d3.tile().size([W, H]).scale(k).translate([tx, ty]).tileSize(256).clampX(false)();
    const [sx, sy] = [teselas.scale, teselas.scale];
    gTiles.selectAll('image').data(teselas, d => d.join('/')).join(
      enter => enter.append('image').attr('href', urlTesela).on('error', () => { callesFallaron = true; gTiles.remove(); root.classed('sin-calles', true); credito && credito.remove(); })
    ).attr('x', ([x]) => Math.round((x + teselas.translate[0]) * sx)).attr('y', ([, y]) => Math.round((y + teselas.translate[1]) * sy)).attr('width', Math.ceil(sx)).attr('height', Math.ceil(sy));
  }
  root.classed('con-calles', usaCalles);

  const proy = d3.geoMercator();
  const path = d3.geoPath(proy);
  const radio = d3.scaleSqrt().domain([0, d3.max(est, d => d.d24)]).range([1.8, o.radioMax]).clamp(true);
  const recScale = d3.scaleSequential().domain([M.meta.recP10, M.meta.recP90]).interpolator(t => d3.interpolateRgb(cssVar('--azul-100'), cssVar('--azul-700'))(t)).clamp(true);
  const aplanScale = d3.scaleDiverging().domain([-0.4, 0, 0.4]).interpolator(t => t < .5 ? d3.interpolateRgb(cssVar('--neg'), cssVar('--cero'))(t * 2) : d3.interpolateRgb(cssVar('--cero'), cssVar('--pos'))((t - .5) * 2)).clamp(true);

  let zk = 1, W, H, zoom;
  const lente = () => o.lente || estado.lente;
  const visible = e => (o.visible ? o.visible(e) : estado.esVisible(e));
  const rad = e => radio(o.tamanoPorRango && estado.rango ? estado.volumen(e) : e.d24) / Math.sqrt(zk);
  const fill = e => {
    const l = lente();
    if (l === 'rec') return recScale(e.rec ?? e.recFY);
    if (l === 'aplan') return e.aplan == null ? cssVar('--tinta-4') : aplanScale(e.aplan);
    if (l === 'conf') return colorConf(e.conf.nivel);
    return colorTipo(e.tipo);
  };

  const puntos = gEst.selectAll('circle').data(est, d => d.id).join('circle').attr('class', 'estacion');
  // lente "forma": cada estación es un reloj de 24 h; radio = share de la hora, escala por volumen
  const perfil24De = arr => { const p = new Array(24).fill(0); for (let i = 0; i < 168; i++) if (i >= 24 && i < 144) p[i % 24] += arr[i]; const s = d3.sum(p) || 1; return p.map(v => v / s); };
  const p24 = new Map(est.map(e => [e.id, { pre: perfil24De(e.pre), cur: perfil24De(e.cur) }]));
  const maxP = d3.quantile(est.flatMap(e => p24.get(e.id).cur), 0.98);
  const glifo = (perfil, R) => d3.lineRadial().angle((d, i) => i / 24 * 2 * Math.PI).radius(d => Math.min(1.15, d / maxP) * R).curve(d3.curveCardinalClosed)(perfil);
  const glifos = gGlif.selectAll('g').data(est, d => d.id).join('g').attr('class', 'glifo');
  glifos.append('path').attr('class', 'glifo-antes');
  glifos.append('path').attr('class', 'glifo-ahora');
  if (o.interactivo) {
    glifos.on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); })
      .on('mousemove', (ev, d) => tooltip(ttEstacion(d), ev))
      .on('mouseleave', () => tooltip(null));
    puntos.on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); })
      .on('mousemove', (ev, d) => tooltip(ttEstacion(d, estado.rango ? `<div class="fila"><span>entradas/día en el período</span><span>${fmt.int(estado.volumen(d))}</span></div>` : ''), ev))
      .on('mouseleave', () => tooltip(null));
    svg.on('click', () => estado.limpiarSeleccion());
  }

  function encuadrar() {
    const r = el.getBoundingClientRect();
    W = r.width; H = o.alto || r.height;
    svg.attr('width', W).attr('height', H);
    let objetivo;
    if (o.enfoqueBorough) {
      const f = G.boroughs.features.find(b => b.properties.nombre === o.enfoqueBorough);
      objetivo = f || G.boroughs;
    } else {
      // encuadre sobre las estaciones de los cuatro boroughs con metro; Staten Island
      // (dos estaciones del SIR) estiraría el encuadre y achicaría todo lo demás
      const pts = est.filter(e => e.b !== 'Staten Island').map(e => [e.lon, e.lat]);
      objetivo = { type: 'MultiPoint', coordinates: pts };
    }
    proy.fitExtent([[14, 14], [W - 14, H - 14]], objetivo);
    pintarTeselas(zoom ? d3.zoomTransform(svg.node()) : d3.zoomIdentity);
    gBoro.selectAll('path').data(G.boroughs.features).join('path').attr('class', 'boro').attr('d', path);
    gLin.selectAll('path').data(G.lineas.features).join('path').attr('class', 'linea-metro').attr('d', path);
    puntos.attr('cx', e => proy([e.lon, e.lat])[0]).attr('cy', e => proy([e.lon, e.lat])[1]);
    glifos.attr('transform', e => `translate(${proy([e.lon, e.lat])})`);
  }

  function pintar() {
    const sel = estado.seleccion;
    puntos
      .attr('r', e => rad(e))
      .attr('fill', e => fill(e))
      .classed('dudosa', e => e.conf.nivel !== 'solida')
      .classed('sel', e => e.id === sel)
      // un filtro apaga; una selección no: en el mapa el contexto geográfico importa
      .classed('apagada', e => !visible(e));
    puntos.filter(e => e.id === sel).raise();
    const esForma = lente() === 'forma';
    gEst.style('display', esForma ? 'none' : null);
    gGlif.style('display', esForma ? null : 'none');
    if (esForma) {
      const R = e => (rad(e) * 1.7 + 2.5 / Math.sqrt(zk)) * o.escalaGlifo;
      glifos.classed('apagada', e => !visible(e)).classed('sel', e => e.id === sel).classed('dudosa', e => e.conf.nivel !== 'solida');
      glifos.select('.glifo-antes').attr('d', e => glifo(p24.get(e.id).pre, R(e)));
      glifos.select('.glifo-ahora').attr('d', e => glifo(p24.get(e.id).cur, R(e))).attr('stroke', e => colorTipo(e.tipo)).attr('fill', e => colorTipo(e.tipo)).attr('stroke-width', 1.1 / Math.sqrt(zk));
      glifos.filter(e => e.id === sel).raise();
    }
    if (ley) pintarLeyenda();
  }

  function pintarLeyenda() {
    const l = lente();
    let html = '';
    if (l === 'tipo') {
      html = `<b>Para qué se usa cada estación</b>
        <div><i class="punto" style="background:${colorTipo('residencial')}"></i> residencial: salen de casa por la mañana</div>
        <div><i class="punto" style="background:${colorTipo('mixta')}"></i> mixta</div>
        <div><i class="punto" style="background:${colorTipo('laboral')}"></i> laboral: salen del trabajo por la tarde</div>
        <div class="nota">según la asimetría mañana/tarde de las entradas en enero–febrero de 2020</div>`;
    } else if (l === 'forma') {
      html = `<b>La forma del día de cada estación</b>
        <div>cada marca es un reloj de 24 h: medianoche arriba, las horas en el sentido del reloj, el radio es el share de la hora</div>
        <div><i class="punto" style="background:${cssVar('--antes')};border:1px solid ${cssVar('--antes-borde')}"></i> gris: enero–febrero 2020</div>
        <div><i class="punto" style="background:${colorTipo('residencial')}"></i><i class="punto" style="background:${colorTipo('mixta')}"></i><i class="punto" style="background:${colorTipo('laboral')}"></i> color del tipo: 2024</div>
        <div class="nota">una punta hacia las 8 es el pico de la mañana; hacia las 17, el de la tarde. Acerca el mapa para leer Manhattan</div>`;
    } else if (l === 'rec') {
      html = `<b>Recuperación: entradas en ene–feb 2024 frente a ene–feb 2020</b>
        <div class="barra-color" style="background:linear-gradient(90deg,${cssVar('--azul-100')},${cssVar('--azul-700')})"></div>
        <div class="extremos"><span>${fmt.pct(M.meta.recP10)}</span><span>mediana ${fmt.pct(M.meta.recMed)}</span><span>${fmt.pct(M.meta.recP90)}</span></div>
        <div class="nota">más oscuro = volvió más gente. Recortado en p10 y p90; fuera de ese rango el color no distingue</div>`;
    } else if (l === 'aplan') {
      html = `<b>Cambio del pico de la mañana</b>
        <div class="barra-color" style="background:linear-gradient(90deg,${cssVar('--neg')},${cssVar('--cero')},${cssVar('--pos')})"></div>
        <div class="extremos"><span>se aplanó −40 %</span><span>igual</span><span>se afiló +40 %</span></div>
        <div class="nota">cambio de la razón pico/valle del día laborable. Azul es la dirección común; rojo, la excepción</div>`;
    } else {
      html = `<b>Qué tan confiable es la comparación</b>
        <div><i class="punto" style="background:${colorConf('solida')}"></i> sólida</div>
        <div><i class="punto" style="background:${colorConf('estacional')}"></i> sensible a la estación del año</div>
        <div><i class="punto" style="background:${colorConf('interrumpida')}"></i> ventana de comparación anómala</div>
        <div><i class="punto" style="background:${colorConf('pequena')}"></i> línea base pequeña</div>
        <div class="nota">las tres últimas llevan anillo punteado en todas las lentes</div>`;
    }
    html += `<div class="nota">tamaño = entradas por día${estado.rango ? ' en el período elegido' : ' en 2024'}</div>`;
    ley.html(html);
    ley.selectAll('i.punto').style('display', 'inline-block').style('width', '9px').style('height', '9px').style('border-radius', '50%').style('margin-right', '6px').style('vertical-align', 'middle');
  }

  if (o.zoom) {
    zoom = d3.zoom().scaleExtent([1, 10]).on('zoom', ev => { zk = ev.transform.k; g.attr('transform', ev.transform); pintarTeselas(ev.transform); puntos.attr('r', e => rad(e)); gLin.selectAll('path').attr('stroke-width', .9 / Math.sqrt(zk)); if (lente() === 'forma') pintar(); });
    svg.call(zoom);
  }

  encuadrar(); pintar();
  const ro = new ResizeObserver(() => { encuadrar(); pintar(); }); ro.observe(el);
  return {
    update: pintar,
    enfocar(borough) { o.enfoqueBorough = borough; if (zoom) svg.call(zoom.transform, d3.zoomIdentity); encuadrar(); pintar(); },
    destruir() { ro.disconnect(); svg.remove(); ley && ley.remove(); credito && credito.remove(); },
  };
}
