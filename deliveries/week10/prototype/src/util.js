// Utilidades compartidas: formato, colores por rol, tooltip.

export const NOMBRE_TIPO = { residencial: 'residencial', mixta: 'mixta', laboral: 'laboral' };
export const DESC_TIPO = {
  residencial: 'más entradas por la mañana que por la tarde: la gente sale de casa',
  laboral:     'más entradas por la tarde que por la mañana: la gente sale del trabajo',
  mixta:       'entradas parejas entre mañana y tarde',
};
export const NOMBRE_CONF = {
  solida: 'comparación sólida',
  estacional: 'sensible a la estación del año',
  interrumpida: 'ventana de comparación anómala',
  pequena: 'línea base pequeña',
};
export const ORDEN_TIPO = ['residencial', 'mixta', 'laboral'];
export const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

export function cssVar(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}
export function colorTipo(tipo) { return cssVar(`--${tipo}`); }
export function colorConf(nivel) { return nivel === 'solida' ? cssVar('--tinta-4') : cssVar(`--${nivel}`); }

const nf = new Intl.NumberFormat('es-PE');
export const fmt = {
  pct: (x, d = 0) => (x == null ? '—' : (x * 100).toFixed(d) + '\u00a0%'),
  pp:  (x, d = 0) => (x == null ? '—' : (x > 0 ? '+' : '') + (x * 100).toFixed(d) + ' pp'),
  cambio: (x, d = 0) => (x == null ? '—' : (x > 0 ? '+' : '') + (x * 100).toFixed(d) + '\u00a0%'),
  int: (x) => (x == null ? '—' : nf.format(Math.round(x))),
  millones: (x, d = 1) => (x == null ? '—' : (x / 1e6).toFixed(d).replace('.', ',') + ' M'),
  miles: (x) => (x == null ? '—' : x >= 1e6 ? (x / 1e6).toFixed(1).replace('.', ',') + ' M' : x >= 1e3 ? Math.round(x / 1e3) + ' k' : Math.round(x)),
  razon: (x) => (x == null ? '—' : x.toFixed(2)),
  mes: (m) => {
    const [y, mm] = m.split('-');
    return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+mm - 1] + ' ' + y;
  },
  hora: (h) => `${h} h`,
};

// ---------------------------------------------------------------- tooltip
let tt;
export function tooltip(html, ev) {
  if (!tt) tt = d3.select('body').append('div').attr('class', 'tooltip').attr('role', 'tooltip');
  if (!html) { tt.style('opacity', 0); return; }
  const w = 280;
  const x = Math.min(ev.clientX + 14, innerWidth - w - 10);
  const y = ev.clientY + 16 > innerHeight - 140 ? ev.clientY - 120 : ev.clientY + 16;
  tt.html(html).style('left', x + 'px').style('top', y + 'px').style('opacity', 1);
}

/** Tooltip de una estación: valores + qué significa el canal que se está mirando. */
export function ttEstacion(e, extra = '') {
  const conf = e.conf.nivel !== 'solida'
    ? `<div class="enc">${NOMBRE_CONF[e.conf.nivel]}: ${e.conf.motivos[0]}</div>` : '';
  return `<b>${e.n}</b><div class="fila"><span>${e.b}</span><span style="color:${colorTipo(e.tipo)}">${e.tipo}</span></div>
    <div class="fila"><span>recuperación</span><span>${fmt.pct(e.rec)}</span></div>
    <div class="fila"><span>pico/valle</span><span>${fmt.razon(e.pvA)} → ${fmt.razon(e.pvB)} (${fmt.cambio(e.aplan)})</span></div>
    <div class="fila"><span>entradas/día 2024</span><span>${fmt.int(e.d24)}</span></div>${extra}${conf}`;
}

export const dentro = (v, [a, b]) => v >= a && v <= b;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
