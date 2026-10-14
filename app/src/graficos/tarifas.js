// Composición tarifaria: áreas apiladas al 100 % por clase de pago, 60 meses.
// Las clases menores se pliegan en "otras" para no pasar de siete colores con
// significado. Los colores son los ocho de la paleta categórica, en orden fijo.

import { fmt, tooltip, cssVar } from '../util.js';

const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const NOMBRES = {
  'OMNY - Full Fare': 'OMNY, tarifa completa',
  'Metrocard - Full Fare': 'MetroCard, tarifa completa',
  'Metrocard - Unlimited 7-Day': 'MetroCard ilimitada 7 días',
  'Metrocard - Unlimited 30-Day': 'MetroCard ilimitada 30 días',
  'Metrocard - Other': 'MetroCard, otras',
  'Metrocard - Seniors & Disability': 'MetroCard adultos mayores y discapacidad',
  'Metrocard - Fair Fare': 'MetroCard Fair Fares',
  'Metrocard - Students': 'MetroCard estudiantes',
};

export function tarifas(cont, opts) {
  const o = Object.assign({ modelo: null, alto: 300, margen: { t: 16, r: 16, b: 28, l: 44 }, resaltar: null, maxClases: 6 }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const T = o.modelo.tarifas, meses = o.modelo.meta.meses;
  const root = d3.select(el); root.selectAll('svg.tarifas, .leyenda').remove();
  const svg = root.append('svg').attr('class', 'tarifas').attr('role', 'img').attr('aria-label', 'Share de cada clase de pago, por mes');

  // clases principales + "otras"
  const principales = T.clases.slice(0, o.maxClases);
  const otras = T.clases.slice(o.maxClases);
  const series = principales.map((c, i) => ({ id: c, nombre: NOMBRES[c] || c, color: PALETA[i], v: T.series[c] }));
  if (otras.length) series.push({ id: 'otras', nombre: 'otras clases', color: cssVar('--tinta-4'), v: meses.map((_, i) => d3.sum(otras, c => T.series[c][i])) });
  const claves = series.map(s => s.id);
  const filas = meses.map((m, i) => { const r = { m }; series.forEach(s => (r[s.id] = s.v[i])); return r; });
  const apilado = d3.stack().keys(claves).order(d3.stackOrderNone).offset(d3.stackOffsetExpand)(filas);

  const m = o.margen, g = svg.append('g');
  const gx = g.append('g').attr('class', 'eje'), gy = g.append('g').attr('class', 'eje');
  const gA = g.append('g'), gAn = g.append('g');
  let x, y, W, H;

  function dibujar() {
    const r = el.getBoundingClientRect();
    W = Math.max(60, r.width - m.l - m.r); H = Math.max(60, o.alto - m.t - m.b);
    svg.attr('width', r.width).attr('height', o.alto); g.attr('transform', `translate(${m.l},${m.t})`);
    x = d3.scalePoint().domain(meses).range([0, W]); y = d3.scaleLinear().domain([0, 1]).range([H, 0]);
    gx.attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(meses.filter(d => d.endsWith('-01'))).tickFormat(s => s.slice(0, 4)).tickSize(4));
    gy.call(d3.axisLeft(y).ticks(4).tickFormat(v => (v * 100).toFixed(0) + ' %').tickSize(0));
    const area = d3.area().x(d => x(d.data.m)).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveMonotoneX);
    gA.selectAll('path').data(apilado).join('path')
      .attr('d', area).attr('fill', d => series.find(s => s.id === d.key).color).attr('stroke', cssVar('--superficie')).attr('stroke-width', 1.5)
      .attr('opacity', d => (o.resaltar ? (o.resaltar === d.key ? 1 : .28) : .92))
      .on('mousemove', (ev, d) => {
        const px = d3.pointer(ev, g.node())[0];
        const i = Math.round(px / W * (meses.length - 1)); const s = series.find(s => s.id === d.key);
        tooltip(`<b>${s.nombre}</b><div class="fila"><span>${fmt.mes(meses[i])}</span><span>${fmt.pct(s.v[i], 1)}</span></div><div class="enc">share de las entradas del mes</div>`, ev);
      }).on('mouseleave', () => tooltip(null));
    gAn.selectAll('*').remove();
    if (T.cruceOmny50) {
      gAn.append('line').attr('class', 'referencia').attr('x1', x(T.cruceOmny50)).attr('x2', x(T.cruceOmny50)).attr('y1', 0).attr('y2', H);
      gAn.append('text').attr('class', 'etiqueta').attr('x', x(T.cruceOmny50) - 6).attr('y', 12).attr('text-anchor', 'end').text(`${fmt.mes(T.cruceOmny50)}: OMNY pasa el 50 %`);
    }
  }
  dibujar();
  const ley = root.append('div').attr('class', 'leyenda');
  series.forEach(s => ley.append('span').attr('class', 'item').html(`<i class="muestra" style="background:${s.color}"></i>${s.nombre}`));
  const ro = new ResizeObserver(dibujar); ro.observe(el);
  return { destruir() { ro.disconnect(); svg.remove(); ley.remove(); } };
}
