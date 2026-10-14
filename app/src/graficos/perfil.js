// Perfil de 24 horas del día laborable: el "antes" como área gris y el "ahora"
// como línea. Es el gráfico que da nombre al proyecto y se reutiliza en el hero,
// en los paneles por borough y en el panel de cada estación.

import { fmt, tooltip, cssVar } from '../util.js';

const HORAS = d3.range(24);

export function perfil24(cont, opts) {
  const o = Object.assign({
    pre: null, cur: null, tipo: null, alto: 260, animar: false, anotaciones: false,
    ejeY: true, ventanas: false, etiquetaPre: 'enero–febrero 2020', etiquetaCur: '2024',
    maxY: null, margen: { t: 18, r: 18, b: 30, l: 40 }, compacto: false,
  }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const root = d3.select(el);
  root.selectAll('svg.perfil').remove();
  const svg = root.append('svg').attr('class', 'perfil').attr('role', 'img')
    .attr('aria-label', `Perfil de 24 horas, ${o.etiquetaPre} frente a ${o.etiquetaCur}`);

  let x, y, W, H;
  const m = o.margen;
  const g = svg.append('g');
  const gVent = g.append('g');
  const gGrid = g.append('g').attr('class', 'rejilla');
  const area = g.append('path').attr('class', 'antes-area');
  const linea = g.append('path').attr('class', 'ahora-linea' + (o.tipo ? ' ' + o.tipo : ''));
  const gx = g.append('g').attr('class', 'eje');
  const gy = g.append('g').attr('class', 'eje');
  const gAn = g.append('g');
  const cursor = g.append('g').style('display', 'none');
  const cLinea = cursor.append('line').attr('class', 'referencia');
  const cPre = cursor.append('circle').attr('r', 4).attr('fill', cssVar('--antes-borde'));
  const cCur = cursor.append('circle').attr('r', 4).attr('fill', o.tipo ? cssVar('--' + o.tipo) : cssVar('--tinta'));
  const overlay = g.append('rect').attr('fill', 'none').attr('pointer-events', 'all');

  const curva = d3.curveMonotoneX;
  const lineaGen = () => d3.line().x((_, i) => x(i)).y(v => y(v)).curve(curva);
  const areaGen = () => d3.area().x((_, i) => x(i)).y0(() => y(0)).y1(v => y(v)).curve(curva);

  function dibujar(animado) {
    const r = el.getBoundingClientRect();
    W = Math.max(60, r.width - m.l - m.r);
    H = Math.max(40, o.alto - m.t - m.b);
    svg.attr('width', r.width).attr('height', o.alto);
    g.attr('transform', `translate(${m.l},${m.t})`);
    x = d3.scaleLinear().domain([0, 23]).range([0, W]);
    const maxY = o.maxY ?? d3.max([...o.pre, ...o.cur]) * 1.12;
    y = d3.scaleLinear().domain([0, maxY]).range([H, 0]);

    gGrid.selectAll('line').data(y.ticks(o.compacto ? 2 : 4)).join('line')
      .attr('x1', 0).attr('x2', W).attr('y1', d => y(d)).attr('y2', d => y(d));

    if (o.ventanas) {
      const v = [[6, 10, 'pico de la mañana'], [11, 15, 'valle'], [16, 20, 'pico de la tarde']];
      gVent.selectAll('rect').data(v).join('rect')
        .attr('x', d => x(d[0]) ).attr('width', d => x(d[1]) - x(d[0])).attr('y', 0).attr('height', H)
        .attr('fill', cssVar('--superficie-2'));
      gVent.selectAll('text').data(v).join('text').attr('class', 'etiqueta suave')
        .attr('x', d => (x(d[0]) + x(d[1])) / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(d => d[2]);
    }

    gx.attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues([0, 6, 12, 18, 23]).tickFormat(h => h === 23 ? '23 h' : h + ' h').tickSize(4));
    if (o.ejeY) gy.call(d3.axisLeft(y).ticks(o.compacto ? 2 : 4).tickFormat(v => (v * 100).toFixed(0) + ' %').tickSize(0));
    else gy.selectAll('*').remove();

    area.attr('d', areaGen()(o.pre));
    const dCur = lineaGen()(o.cur);
    if (animado) {
      linea.attr('d', lineaGen()(o.pre)).transition().delay(900).duration(1700).ease(d3.easeCubicInOut).attr('d', dCur);
    } else linea.attr('d', dCur);

    gAn.selectAll('*').remove();
    if (o.anotaciones) anotar();

    overlay.attr('width', W).attr('height', H)
      .on('mousemove', ev => {
        const h = Math.round(x.invert(d3.pointer(ev, g.node())[0]));
        const hh = Math.max(0, Math.min(23, h));
        cursor.style('display', null);
        cLinea.attr('x1', x(hh)).attr('x2', x(hh)).attr('y1', 0).attr('y2', H);
        cPre.attr('cx', x(hh)).attr('cy', y(o.pre[hh]));
        cCur.attr('cx', x(hh)).attr('cy', y(o.cur[hh]));
        tooltip(`<b>${hh}:00 – ${hh}:59</b>
          <div class="fila"><span>${o.etiquetaPre}</span><span>${fmt.pct(o.pre[hh], 1)}</span></div>
          <div class="fila"><span>${o.etiquetaCur}</span><span>${fmt.pct(o.cur[hh], 1)}</span></div>
          <div class="enc">share del total del día laborable</div>`, ev);
      })
      .on('mouseleave', () => { cursor.style('display', 'none'); tooltip(null); });
  }

  function anotar() {
    const hPre = d3.maxIndex(o.pre.slice(6, 11)) + 6, hCur = d3.maxIndex(o.cur.slice(6, 11)) + 6;
    const vPre = d3.minIndex(o.pre.slice(11, 16)) + 11, vCur = d3.minIndex(o.cur.slice(11, 16)) + 11;
    const t1 = gAn.append('text').attr('class', 'etiqueta fuerte').attr('x', x(hPre) + 8).attr('y', y(o.pre[hPre]) - 6);
    t1.append('tspan').text(`pico de la mañana: ${fmt.pct(o.pre[hPre], 1)} → ${fmt.pct(o.cur[hCur], 1)}`);
    const t2 = gAn.append('text').attr('class', 'etiqueta').attr('x', x(vPre)).attr('y', y(Math.min(o.pre[vPre], o.cur[vCur])) + 16).attr('text-anchor', 'middle');
    t2.text(`valle: ${fmt.pct(o.pre[vPre], 1)} → ${fmt.pct(o.cur[vCur], 1)}`);
    const pvA = o.pre[hPre] / o.pre[vPre], pvB = o.cur[hCur] / o.cur[vCur];
    gAn.append('text').attr('class', 'etiqueta suave').attr('x', W).attr('y', -4).attr('text-anchor', 'end')
      .text(`razón pico/valle ${pvA.toFixed(2)} → ${pvB.toFixed(2)}`);
  }

  dibujar(o.animar && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ro = new ResizeObserver(() => dibujar(false));
  ro.observe(el);
  return { actualizar(pre, cur, tipo) { o.pre = pre; o.cur = cur; if (tipo !== undefined) { o.tipo = tipo; linea.attr('class', 'ahora-linea' + (tipo ? ' ' + tipo : '')); } dibujar(false); }, destruir() { ro.disconnect(); svg.remove(); } };
}

/** Versión mínima para small multiples: 168 h, área gris + línea del tipo. */
export function perfil168(svgEl, pre, cur, tipo, maxY) {
  const W = 136, H = 44;
  const s = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'none');
  s.selectAll('*').remove();
  const sx = d3.scaleLinear().domain([0, 167]).range([0, W]);
  const sy = d3.scaleLinear().domain([0, maxY]).range([H, 1]);
  for (let k = 1; k < 7; k++) s.append('line').attr('x1', sx(k * 24)).attr('x2', sx(k * 24)).attr('y1', 0).attr('y2', H).attr('stroke', cssVar('--regla')).attr('stroke-width', .7);
  s.append('path').attr('d', d3.area().x((_, i) => sx(i)).y0(H).y1(v => sy(v)).curve(d3.curveMonotoneX)(pre)).attr('class', 'antes-area').attr('stroke-width', .5);
  s.append('path').attr('d', d3.line().x((_, i) => sx(i)).y(v => sy(v)).curve(d3.curveMonotoneX)(cur)).attr('fill', 'none').attr('stroke', cssVar('--' + tipo)).attr('stroke-width', 1.3);
}
