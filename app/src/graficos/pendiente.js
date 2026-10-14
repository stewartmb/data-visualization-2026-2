// Gráfico de pendientes: la asimetría mañana/tarde de cada estación en 2020 y en
// 2024, una línea por estación. Las bandas horizontales son los tres tipos; una
// línea que cruza una banda es una estación que cambió de tipo. Color = tipo en 2020.

import { estado } from '../estado.js';
import { fmt, tooltip, ttEstacion, cssVar, colorTipo } from '../util.js';

export function pendiente(cont, opts) {
  const o = Object.assign({ modelo: null, alto: null, margen: { t: 26, r: 150, b: 30, l: 150 }, interactivo: true, visible: null, soloCruces: false }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const M = o.modelo, est = M.estaciones, U = M.meta.umbrales.tipo;
  const root = d3.select(el); root.selectAll('svg.pendiente').remove();
  const svg = root.append('svg').attr('class', 'pendiente').attr('role', 'img').attr('aria-label', 'Asimetría mañana/tarde de cada estación en 2020 y 2024');
  const g = svg.append('g');
  const gB = g.append('g'), gL = g.append('g'), gE = g.append('g'), gS = g.append('g');
  const tipoDe = a => a > U ? 'residencial' : a < -U ? 'laboral' : 'mixta';
  const cruza = e => tipoDe(e.asymPre) !== tipoDe(e.asymCur);
  const visible = e => (o.visible ? o.visible(e) : estado.esVisible(e));
  let W, H, x, y;

  function pintar() {
    const r = el.getBoundingClientRect();
    W = r.width; H = o.alto || r.height;
    if (W < 300 || H < 100) return;
    svg.attr('width', W).attr('height', H);
    const m = o.margen;
    x = d3.scalePoint(['2020', '2024'], [m.l, W - m.r]);
    const ext = d3.max(est, e => Math.max(Math.abs(e.asymPre), Math.abs(e.asymCur)));
    y = d3.scaleLinear([-ext, ext], [H - m.b, m.t]);
    // bandas de tipo
    gB.selectAll('*').remove();
    [['residencial', U, ext], ['mixta', -U, U], ['laboral', -ext, -U]].forEach(([t, a, b]) => {
      gB.append('rect').attr('x', m.l - 10).attr('y', y(b)).attr('width', W - m.l - m.r + 20).attr('height', y(a) - y(b)).attr('fill', colorTipo(t)).attr('fill-opacity', 0.07);
      gB.append('text').attr('x', m.l - 16).attr('y', (y(a) + y(b)) / 2 + 4).attr('text-anchor', 'end').attr('class', 'banda-etq').attr('fill', colorTipo(t)).text(t);
    });
    [[U, '+' + U], [-U, '−' + U], [0, '0']].forEach(([v, t]) => {
      gB.append('line').attr('x1', m.l - 10).attr('x2', W - m.r + 10).attr('y1', y(v)).attr('y2', y(v)).attr('class', v === 0 ? 'cero' : 'umbral');
      gB.append('text').attr('x', W - m.r + 14).attr('y', y(v) + 3).attr('class', 'eje-etq').text(t);
    });
    gB.append('text').attr('x', W - m.r + 14).attr('y', H - 6).attr('class', 'eje-etq').text('asimetría = (E 6–10 h − E 16–20 h) / suma');
    gB.append('text').attr('x', m.l - 16).attr('y', m.t + 4).attr('text-anchor', 'end').attr('class', 'eje-etq').text('más entradas por la mañana ↑');
    gB.append('text').attr('x', m.l - 16).attr('y', H - m.b - 4).attr('text-anchor', 'end').attr('class', 'eje-etq').text('más entradas por la tarde ↓');
    ['2020', '2024'].forEach(a => gB.append('text').attr('x', x(a)).attr('y', H - m.b + 18).attr('text-anchor', 'middle').attr('class', 'anio').text(a === '2020' ? 'enero–febrero 2020' : '2024'));
    // líneas
    const datos = o.soloCruces ? est.filter(cruza) : est;
    gL.selectAll('line').data(datos, d => d.id).join('line')
      .attr('x1', x('2020')).attr('x2', x('2024')).attr('y1', d => y(d.asymPre)).attr('y2', d => y(d.asymCur))
      .attr('stroke', d => colorTipo(d.tipo));
    gE.selectAll('circle').data(datos, d => d.id).join('circle').attr('cx', x('2024')).attr('cy', d => y(d.asymCur)).attr('r', 2).attr('fill', d => colorTipo(d.tipo));
    // resumen: medianas por tipo
    gS.selectAll('*').remove();
    ['residencial', 'mixta', 'laboral'].forEach(t => {
      const es = est.filter(e => e.tipo === t);
      const a = d3.median(es, e => e.asymPre), b = d3.median(es, e => e.asymCur);
      gS.append('line').attr('x1', x('2020')).attr('x2', x('2024')).attr('y1', y(a)).attr('y2', y(b)).attr('stroke', colorTipo(t)).attr('class', 'mediana');
      gS.append('text').attr('x', x('2024') + 8).attr('y', y(b) + 4).attr('class', 'mediana-etq').attr('fill', colorTipo(t)).text(`mediana ${a > 0 ? '+' : ''}${a.toFixed(2)} → ${b > 0 ? '+' : ''}${b.toFixed(2)}`);
    });
    const nCruzan = est.filter(cruza).length, haciaTarde = est.filter(e => cruza(e) && e.asymCur < e.asymPre).length;
    actualizar();
  }
  function actualizar() {
    const sel = estado.seleccion;
    gL.selectAll('line').classed('cruza', d => cruza(d)).classed('apagada', d => !visible(d)).classed('sel', d => d.id === sel);
    gE.selectAll('circle').classed('apagada', d => !visible(d)).classed('sel', d => d.id === sel);
    gL.selectAll('line.sel').raise();
  }
  if (o.interactivo) {
    gL.on('mousemove', (ev) => { const d = ev.target.__data__; if (d) tooltip(ttEstacion(d, `<div class="fila"><span>asimetría</span><span>${d.asymPre > 0 ? '+' : ''}${d.asymPre.toFixed(2)} → ${d.asymCur > 0 ? '+' : ''}${d.asymCur.toFixed(2)}</span></div>`), ev); })
      .on('mouseleave', () => tooltip(null))
      .on('click', (ev) => { const d = ev.target.__data__; if (d) { ev.stopPropagation(); estado.seleccionar(d.id); } });
  }
  pintar();
  const ro = new ResizeObserver(pintar); ro.observe(el);
  return { update: actualizar, destruir() { ro.disconnect(); svg.remove(); } };
}
