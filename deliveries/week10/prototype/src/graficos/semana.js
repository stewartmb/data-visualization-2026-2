// La semana entera, en filas: para cada grupo (borough, tipo…) el share de cada
// una de las 168 horas en 2024 menos el de 2020, como barras divergentes sobre
// un eje común. Azul: la hora perdió peso; rojo: lo ganó. Muestra en qué días y
// a qué horas se movió el día, cosa que el perfil de 24 h promedia.

import { fmt, tooltip, cssVar } from '../util.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Perfil de 168 h de un conjunto de estaciones, ponderado por volumen. */
export function perfil168(estaciones) {
  const pre = new Array(168).fill(0), cur = new Array(168).fill(0);
  let wp = 0, wc = 0;
  estaciones.forEach(e => { for (let i = 0; i < 168; i++) { pre[i] += e.pre[i] * e.dPre; cur[i] += e.cur[i] * e.d24; } wp += e.dPre; wc += e.d24; });
  for (let i = 0; i < 168; i++) { pre[i] /= wp || 1; cur[i] /= wc || 1; }
  return { pre, cur };
}

export function semana(cont, opts) {
  const o = Object.assign({ grupos: [], altoFila: 64, margen: { t: 30, r: 16, b: 8, l: 120 }, resaltar: null }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const root = d3.select(el); root.selectAll('svg.semana').remove();
  const svg = root.append('svg').attr('class', 'semana').attr('role', 'img').attr('aria-label', 'Cambio del share de cada hora de la semana, por grupo');
  const m = o.margen;
  const H = m.t + o.grupos.length * o.altoFila + m.b;
  const maxAbs = d3.max(o.grupos, g => d3.max(g.cur, (v, i) => Math.abs(v - g.pre[i])));

  function pintar() {
    const W = el.getBoundingClientRect().width;
    if (W < 300) return;
    svg.attr('width', W).attr('height', H).selectAll('*').remove();
    const x = d3.scaleLinear([0, 168], [m.l, W - m.r]);
    const cw = x(1) - x(0);
    // cabecera: días y ventanas de pico
    for (let d = 0; d < 7; d++) {
      svg.append('rect').attr('x', x(d * 24) + 1).attr('y', 4).attr('width', x(24) - x(0) - 2).attr('height', 15).attr('class', d === 0 || d === 6 ? 'banda-fin' : 'banda-lab');
      svg.append('text').attr('x', x(d * 24 + 12)).attr('y', 15).attr('text-anchor', 'middle').attr('class', 'dia').text(DIAS[d]);
      if (d > 0) svg.append('line').attr('x1', x(d * 24)).attr('x2', x(d * 24)).attr('y1', 4).attr('y2', H - m.b).attr('class', 'sep');
      if (d > 0 && d < 6) [[6, 10], [16, 20]].forEach(([a, b]) => svg.append('rect').attr('x', x(d * 24 + a)).attr('y', m.t - 4).attr('width', x(b) - x(a)).attr('height', H - m.t - m.b + 4).attr('class', 'ventana'));
    }
    o.grupos.forEach((g, k) => {
      const y0 = m.t + k * o.altoFila, y = d3.scaleLinear([-maxAbs, maxAbs], [y0 + o.altoFila - 6, y0 + 4]);
      const dif = g.cur.map((v, i) => v - g.pre[i]);
      const perdioAM = d3.sum(dif.filter((v, i) => { const h = i % 24, d = Math.floor(i / 24); return d > 0 && d < 6 && h >= 6 && h < 10; }));
      svg.append('text').attr('x', m.l - 10).attr('y', y(0) - 2).attr('text-anchor', 'end').attr('class', 'grupo' + (o.resaltar === g.nombre ? ' fuerte' : '')).text(g.nombre);
      svg.append('text').attr('x', m.l - 10).attr('y', y(0) + 11).attr('text-anchor', 'end').attr('class', 'grupo-sub').text(`mañanas laborables ${fmt.pp(perdioAM, 1)}`);
      svg.append('line').attr('x1', x(0)).attr('x2', x(168)).attr('y1', y(0)).attr('y2', y(0)).attr('class', 'cero');
      svg.append('g').selectAll('rect').data(dif).join('rect').attr('x', (d, i) => x(i) + .2).attr('width', cw - .4)
        .attr('y', d => Math.min(y(0), y(d))).attr('height', d => Math.abs(y(d) - y(0)))
        .attr('fill', d => d < 0 ? cssVar('--neg') : cssVar('--pos'))
        .on('mousemove', (ev, d) => { const i = dif.indexOf(d); tooltip(`<b>${g.nombre}</b><div class="fila"><span>${DIAS[Math.floor(i / 24)]}, ${i % 24} h</span></div><div>share de la semana: ${fmt.pct(g.pre[i], 2)} → ${fmt.pct(g.cur[i], 2)} (<b>${fmt.pp(d, 2)}</b>)</div>`, ev); })
        .on('mouseleave', () => tooltip(null));
    });
    svg.append('text').attr('x', W - m.r).attr('y', H - 2).attr('text-anchor', 'end').attr('class', 'nota').text(`escala común: ±${(maxAbs * 100).toFixed(2)} pp del share semanal · azul perdió · rojo ganó`);
  }
  pintar();
  const ro = new ResizeObserver(pintar); ro.observe(el);
  return { update() {}, destruir() { ro.disconnect(); svg.remove(); } };
}
