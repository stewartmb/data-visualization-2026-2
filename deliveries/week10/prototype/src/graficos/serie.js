// Serie mensual del sistema con línea de referencia en enero de 2020.
// Con `brush`, el rango elegido se escribe en el estado y las demás vistas lo leen.

import { fmt, tooltip, cssVar } from '../util.js';

export function serieMensual(cont, opts) {
  const o = Object.assign({
    serie: null, base: null, alto: 220, brush: false, anotaciones: false, onRango: null,
    margen: { t: 26, r: 16, b: 28, l: 48 }, resaltar: null,
  }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const root = d3.select(el);
  root.selectAll('svg.serie').remove();
  const svg = root.append('svg').attr('class', 'serie').attr('role', 'img').attr('aria-label', 'Entradas mensuales al sistema, 2020–2024');
  const m = o.margen, S = o.serie;
  const g = svg.append('g');
  const gGrid = g.append('g').attr('class', 'rejilla');
  const gRes = g.append('g');
  const area = g.append('path').attr('fill', cssVar('--azul-100')).attr('opacity', .55);
  const linea = g.append('path').attr('fill', 'none').attr('stroke', cssVar('--azul-500')).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
  const ref = g.append('line').attr('class', 'referencia');
  const refTx = g.append('text').attr('class', 'etiqueta suave');
  const tituY = g.append('text').attr('class', 'titulo-eje').text('millones de entradas por mes');
  const gx = g.append('g').attr('class', 'eje');
  const gy = g.append('g').attr('class', 'eje');
  const gAn = g.append('g');
  const gb = g.append('g').attr('class', 'brush');
  const cursor = g.append('g').style('display', 'none');
  const cL = cursor.append('line').attr('class', 'referencia');
  const cP = cursor.append('circle').attr('r', 4).attr('fill', cssVar('--azul-600'));
  let x, y, W, H, brush;

  function dibujar() {
    const r = el.getBoundingClientRect();
    W = Math.max(60, r.width - m.l - m.r); H = Math.max(40, o.alto - m.t - m.b);
    svg.attr('width', r.width).attr('height', o.alto);
    g.attr('transform', `translate(${m.l},${m.t})`);
    x = d3.scalePoint().domain(S.map(d => d.m)).range([0, W]);
    y = d3.scaleLinear().domain([0, d3.max(S, d => d.v) * 1.08]).range([H, 0]);

    gGrid.selectAll('line').data(y.ticks(4)).join('line').attr('x1', 0).attr('x2', W).attr('y1', d => y(d)).attr('y2', d => y(d));
    gx.attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).tickValues(S.filter(d => d.m.endsWith('-01')).map(d => d.m)).tickFormat(s => s.slice(0, 4)).tickSize(4));
    gy.call(d3.axisLeft(y).ticks(4).tickFormat(v => (v / 1e6).toFixed(0)).tickSize(0));
    tituY.attr('x', -m.l + 4).attr('y', -10);

    linea.attr('d', d3.line().x(d => x(d.m)).y(d => y(d.v))(S));
    area.attr('d', d3.area().x(d => x(d.m)).y0(H).y1(d => y(d.v))(S));
    ref.attr('x1', 0).attr('x2', W).attr('y1', y(o.base)).attr('y2', y(o.base));
    refTx.attr('x', W).attr('y', y(o.base) - 5).attr('text-anchor', 'end').text('nivel de enero de 2020');

    gRes.selectAll('*').remove();
    if (o.resaltar) {
      const [a, b] = o.resaltar;
      gRes.append('rect').attr('x', x(a)).attr('width', x(b) - x(a)).attr('y', 0).attr('height', H).attr('fill', cssVar('--superficie-2'));
    }

    gAn.selectAll('*').remove();
    if (o.anotaciones) {
      const min = S.reduce((a, b) => (b.v < a.v ? b : a));
      gAn.append('text').attr('class', 'etiqueta').attr('x', x(min.m) + 8).attr('y', y(min.v) + 4)
        .text(`${fmt.mes(min.m)}: ${fmt.millones(min.v)}, el ${(100 * min.v / o.base).toFixed(0)} % del nivel previo`);
      const ult = S[S.length - 1];
      gAn.append('text').attr('class', 'etiqueta fuerte').attr('x', x(ult.m) - 6).attr('y', y(ult.v) - 10).attr('text-anchor', 'end')
        .text(`${fmt.mes(ult.m)}: ${(100 * ult.v / o.base).toFixed(0)} %`);
      const i23 = S.findIndex(d => d.m === '2023-01');
      if (i23 > 0) {
        const med = d3.median(S.slice(i23), d => d.v);
        gAn.append('line').attr('x1', x('2023-01')).attr('x2', x(ult.m)).attr('y1', y(med)).attr('y2', y(med)).attr('stroke', cssVar('--tinta')).attr('stroke-width', 1).attr('opacity', .5);
        gAn.append('text').attr('class', 'etiqueta').attr('x', x('2023-01')).attr('y', y(med) - 7).text(`desde 2023: mediana ${(100 * med / o.base).toFixed(0)} % del nivel previo`);
      }
    }

    gb.selectAll('*').remove();
    if (o.brush) {
      brush = d3.brushX().extent([[0, 0], [W, H]]).on('end', ev => {
        if (!ev.sourceEvent) return;
        if (!ev.selection) { o.onRango && o.onRango(null); return; }
        const [a, b] = ev.selection;
        const dentro = S.filter(d => x(d.m) >= a && x(d.m) <= b);
        o.onRango && o.onRango(dentro.length ? [dentro[0].m, dentro[dentro.length - 1].m] : null);
      });
      gb.call(brush);
      svg.on('dblclick', () => { gb.call(brush.move, null); o.onRango && o.onRango(null); });
      gb.selectAll('.overlay').on('mousemove', hover).on('mouseleave', salir);
    } else {
      g.append('rect').attr('width', W).attr('height', H).attr('fill', 'none').attr('pointer-events', 'all').on('mousemove', hover).on('mouseleave', salir);
    }
  }
  function hover(ev) {
    const px = d3.pointer(ev, g.node())[0];
    const d = S.reduce((best, s) => Math.abs(x(s.m) - px) < Math.abs(x(best.m) - px) ? s : best, S[0]);
    cursor.style('display', null); cL.attr('x1', x(d.m)).attr('x2', x(d.m)).attr('y1', 0).attr('y2', H); cP.attr('cx', x(d.m)).attr('cy', y(d.v));
    tooltip(`<b>${fmt.mes(d.m)}</b><div class="fila"><span>entradas</span><span>${fmt.int(d.v)}</span></div><div class="fila"><span>frente a enero 2020</span><span>${(100 * d.v / o.base).toFixed(0)} %</span></div>`, ev);
  }
  function salir() { cursor.style('display', 'none'); tooltip(null); }

  dibujar();
  const ro = new ResizeObserver(dibujar); ro.observe(el);
  return {
    moverBrush(rango) { if (!brush) return; if (!rango) gb.call(brush.move, null); else gb.call(brush.move, [x(rango[0]), x(rango[1])]); },
    destruir() { ro.disconnect(); svg.remove(); },
  };
}
