// Cinta de recuperación: entradas de cada mes sobre enero–febrero de 2020, para el
// sistema y cada borough, con la banda p10–p90 de las 428 estaciones detrás.
// Bandas de fase, ventana de comparación y el cruce de OMNY como marcas.

import { estado } from '../estado.js';
import { fmt, tooltip, cssVar } from '../util.js';

const FASES = [['Antes', '2020-01', '2020-02'], ['Cierre', '2020-03', '2020-06'], ['Recuperación', '2020-07', '2022-12'], ['Meseta', '2023-01', '2024-12']];

export function cinta(cont, opts) {
  const o = Object.assign({ modelo: null, margen: { t: 44, r: 150, b: 34, l: 54 }, resaltar: 'Bronx' }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const M = o.modelo, meses = M.meta.meses, est = M.estaciones;
  const iMes = new Map(meses.map((m, i) => [m, i]));
  const root = d3.select(el); root.selectAll('svg.cinta').remove();
  const svg = root.append('svg').attr('class', 'cinta').attr('role', 'img').attr('aria-label', 'Recuperación mes a mes, sistema y boroughs');
  // series
  const base = e => (e.ms[0] + e.ms[1]) / 2 || 1;
  const idxEst = est.map(e => e.ms.map(v => v / base(e)));
  const p = q => meses.map((_, i) => d3.quantile(idxEst.map(s => s[i]).sort(d3.ascending), q));
  const banda = { lo: p(0.1), hi: p(0.9), med: p(0.5) };
  const agregado = es => { const b = d3.sum(es, e => (e.ms[0] + e.ms[1]) / 2); return meses.map((_, i) => d3.sum(es, e => e.ms[i]) / b); };
  // el Bronx es la excepción y lleva el rojo de "contra la corriente"; los demás, grises
  const COLOR_B = { Manhattan: cssVar('--tinta-3'), Brooklyn: cssVar('--tinta-4'), Queens: cssVar('--tinta-3'), Bronx: cssVar('--pos') };
  const series = [{ nombre: 'Sistema', color: cssVar('--tinta'), v: agregado(est), grueso: true },
    ...['Manhattan', 'Brooklyn', 'Queens', 'Bronx'].map(b => ({ nombre: b, color: COLOR_B[b], v: agregado(est.filter(e => e.b === b)) }))];

  function pintar() {
    const r = el.getBoundingClientRect(), W = r.width, H = r.height; if (W < 300 || H < 200) return;
    svg.attr('width', W).attr('height', H).selectAll('*').remove();
    const m = o.margen;
    const x = d3.scaleLinear([0, meses.length - 1], [m.l, W - m.r]);
    const y = d3.scaleLinear([0, 1.15], [H - m.b, m.t]);
    // fases
    FASES.forEach(([n, a, b]) => {
      const x0 = x(iMes.get(a)) - 4, x1 = x(iMes.get(b)) + 4;
      svg.append('rect').attr('x', x0).attr('y', 6).attr('width', x1 - x0).attr('height', 16).attr('class', 'fase fase-' + n.toLowerCase().replace('ó', 'o'));
      svg.append('text').attr('x', (x0 + x1) / 2).attr('y', 18).attr('text-anchor', 'middle').attr('class', 'fase-etq').text(n);
      svg.append('line').attr('x1', x0).attr('x2', x0).attr('y1', 6).attr('y2', H - m.b).attr('class', 'sep');
    });
    // ejes
    svg.append('g').attr('class', 'eje').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(v => fmt.pct(v)).tickSize(-(W - m.l - m.r))).call(g => g.select('.domain').remove());
    svg.append('g').attr('class', 'eje').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(meses.map((mm, i) => mm.endsWith('-01') ? i : null).filter(v => v != null)).tickFormat(i => meses[i].slice(0, 4))).call(g => g.select('.domain').remove());
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(1)).attr('y2', y(1)).attr('class', 'cien');
    svg.append('text').attr('x', W - m.r - 4).attr('y', y(1) - 4).attr('text-anchor', 'end').attr('class', 'nota').text('nivel de enero–febrero 2020');
    // banda p10–p90 de las estaciones
    svg.append('path').attr('class', 'banda').attr('d', d3.area().x((d, i) => x(i)).y0((d, i) => y(banda.lo[i])).y1((d, i) => y(banda.hi[i])).curve(d3.curveMonotoneX)(meses));
    svg.append('text').attr('x', x(30)).attr('y', y(banda.hi[30]) - 6).attr('text-anchor', 'middle').attr('class', 'nota').text('banda: del 10 % al 90 % de las estaciones');
    // ventana de comparación y OMNY
    const [ca, cb] = M.meta.ventanaCmp;
    svg.append('rect').attr('x', x(iMes.get(ca)) - 4).attr('y', m.t - 10).attr('width', x(iMes.get(cb)) - x(iMes.get(ca)) + 8).attr('height', H - m.b - m.t + 10).attr('class', 'ventana-cmp');
    svg.append('text').attr('x', x(iMes.get(ca)) - 8).attr('y', m.t - 2).attr('text-anchor', 'end').attr('class', 'nota').text('ventana de comparación ▸');
    if (M.tarifas.cruceOmny50) { const xo = x(iMes.get(M.tarifas.cruceOmny50)); svg.append('line').attr('x1', xo).attr('x2', xo).attr('y1', m.t + 6).attr('y2', H - m.b).attr('class', 'evento'); svg.append('text').attr('x', xo + 4).attr('y', m.t + 16).attr('class', 'nota evento-etq').text('OMNY pasa el 50 %'); }
    // líneas
    const linea = d3.line().x((d, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);
    series.forEach(s => {
      svg.append('path').attr('d', linea(s.v)).attr('class', 'serie' + (s.grueso ? ' sistema' : '') + (s.nombre === o.resaltar ? ' resaltada' : '')).attr('stroke', s.color)
        .on('mousemove', ev => { const i = Math.round(x.invert(d3.pointer(ev, svg.node())[0])); tooltip(`<b>${s.nombre}</b><div class="fila"><span>${fmt.mes(meses[i])}</span><span>${fmt.pct(s.v[i])}</span></div><div class="enc">entradas del mes sobre enero–febrero 2020</div>`, ev); })
        .on('mouseleave', () => tooltip(null));
      const ult = s.v[s.v.length - 1];
      svg.append('text').attr('x', W - m.r + 8).attr('y', y(ult) + 4).attr('class', 'serie-etq' + (s.nombre === o.resaltar ? ' resaltada' : '')).attr('fill', s.color).text(`${s.nombre} ${fmt.pct(ult)}`);
    });
    // desenredar etiquetas finales
    const etqs = svg.selectAll('text.serie-etq').nodes().sort((a, b) => +a.getAttribute('y') - +b.getAttribute('y'));
    for (let i = 1; i < etqs.length; i++) { const prev = +etqs[i - 1].getAttribute('y'), cur = +etqs[i].getAttribute('y'); if (cur - prev < 13) etqs[i].setAttribute('y', prev + 13); }
  }
  pintar();
  const ro = new ResizeObserver(pintar); ro.observe(el);
  return { update() {}, destruir() { ro.disconnect(); svg.remove(); } };
}
