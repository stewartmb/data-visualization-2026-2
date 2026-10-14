// Tiras de puntos (beeswarm) por grupo: cada estación es un punto sobre un eje
// común, apilado sin solaparse. Sirve para ver la distribución entera de una
// medida por borough, con la mediana y un umbral marcados.

import { estado } from '../estado.js';
import { fmt, tooltip, ttEstacion, cssVar, colorTipo } from '../util.js';

/** Apilado de puntos sin solape (dodge), a lo Observable. */
function dodge(xs, radio, pad = 1) {
  const r2 = (radio * 2 + pad) ** 2;
  const circles = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const ys = new Array(xs.length);
  const queue = [];
  for (const c of circles) {
    let y = 0;
    // candidatos: y=0 y los que tocan a los vecinos cercanos
    const cerca = queue.filter(q => Math.abs(q.x - c.x) < radio * 2 + pad);
    const cands = [0];
    for (const q of cerca) { const dx = q.x - c.x; const dy = Math.sqrt(Math.max(0, r2 - dx * dx)); cands.push(q.y + dy, q.y - dy); }
    cands.sort((a, b) => Math.abs(a) - Math.abs(b));
    for (const cand of cands) { if (cerca.every(q => (q.x - c.x) ** 2 + (q.y - cand) ** 2 >= r2 - 1e-6)) { y = cand; break; } }
    c.y = y; queue.push(c); ys[c.i] = y;
  }
  return ys;
}

export function tiras(cont, opts) {
  const o = Object.assign({ modelo: null, grupos: [], valor: e => e.aplan, dominio: null, umbral: null, etiquetaUmbral: '', formato: fmt.cambio, altoFila: 86, margen: { t: 26, r: 20, b: 26, l: 150 }, radio: 3, ejeTitulo: '', interactivo: true, visible: null }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const root = d3.select(el); root.selectAll('svg.tiras').remove();
  const svg = root.append('svg').attr('class', 'tiras').attr('role', 'img');
  const m = o.margen, H = m.t + o.grupos.length * o.altoFila + m.b;
  const visible = e => (o.visible ? o.visible(e) : estado.esVisible(e));
  let puntos;

  function pintar() {
    const W = el.getBoundingClientRect().width; if (W < 300) return;
    svg.attr('width', W).attr('height', H).selectAll('*').remove();
    const todos = o.grupos.flatMap(g => g.estaciones).filter(e => o.valor(e) != null);
    const dom = o.dominio || d3.extent(todos, o.valor);
    const x = d3.scaleLinear(dom, [m.l, W - m.r]).clamp(true);
    const ejeX = d3.axisTop(x).ticks(8).tickFormat(v => o.formato(v)).tickSize(-(H - m.t - m.b));
    svg.append('g').attr('class', 'eje').attr('transform', `translate(0,${m.t})`).call(ejeX).call(g => g.select('.domain').remove());
    if (o.ejeTitulo) svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').attr('class', 'eje-titulo').text(o.ejeTitulo);
    if (o.umbral != null) {
      svg.append('line').attr('x1', x(o.umbral)).attr('x2', x(o.umbral)).attr('y1', m.t).attr('y2', H - m.b).attr('class', 'umbral');
      svg.append('text').attr('x', x(o.umbral) + 4).attr('y', H - m.b + 14).attr('class', 'umbral-etq').text(o.etiquetaUmbral);
    }
    const gP = svg.append('g');
    o.grupos.forEach((g, k) => {
      const y0 = m.t + k * o.altoFila, yc = y0 + o.altoFila / 2;
      const es = g.estaciones.filter(e => o.valor(e) != null);
      const ys = dodge(es.map(e => x(o.valor(e))), o.radio, 0.8);
      const med = d3.median(es, o.valor), bajo = es.filter(e => o.valor(e) < (o.umbral ?? 0)).length;
      svg.append('text').attr('x', m.l - 12).attr('y', yc - 8).attr('text-anchor', 'end').attr('class', 'grupo' + (g.fuerte ? ' fuerte' : '')).text(g.nombre);
      svg.append('text').attr('x', m.l - 12).attr('y', yc + 6).attr('text-anchor', 'end').attr('class', 'grupo-sub').text(`${es.length} estaciones · mediana ${o.formato(med)}`);
      if (o.umbral != null) svg.append('text').attr('x', m.l - 12).attr('y', yc + 19).attr('text-anchor', 'end').attr('class', 'grupo-sub').text(`${fmt.pct(bajo / es.length)} más allá del umbral`);
      svg.append('line').attr('x1', x(med)).attr('x2', x(med)).attr('y1', yc - o.altoFila / 2 + 6).attr('y2', yc + o.altoFila / 2 - 6).attr('class', 'mediana');
      gP.selectAll(null).data(es).join('circle').attr('cx', e => x(o.valor(e))).attr('cy', (e, i) => yc + ys[i]).attr('r', o.radio).attr('fill', e => colorTipo(e.tipo)).attr('class', 'punto');
    });
    puntos = gP.selectAll('circle');
    if (o.interactivo) puntos.on('mousemove', (ev, d) => tooltip(ttEstacion(d), ev)).on('mouseleave', () => tooltip(null)).on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); });
    actualizar();
  }
  function actualizar() {
    if (!puntos) return;
    const sel = estado.seleccion;
    puntos.classed('apagada', e => !visible(e)).classed('sel', e => e.id === sel).classed('dudosa', e => e.conf.nivel !== 'solida');
    puntos.filter(e => e.id === sel).raise();
  }
  pintar();
  const ro = new ResizeObserver(pintar); ro.observe(el);
  return { update: actualizar, destruir() { ro.disconnect(); svg.remove(); } };
}
