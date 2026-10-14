// Dispersión: los dos ejes del cambio. x = cuánta gente volvió (recuperación),
// y = cuánto cambió la forma del día (cambio de la razón pico/valle).
// Un punto abajo se aplanó; a la derecha, recuperó más. Color = tipo de estación,
// o énfasis de un grupo (los demás en gris) cuando el capítulo lo pide.

import { estado } from '../estado.js';
import { fmt, tooltip, ttEstacion, cssVar, colorTipo } from '../util.js';

export function dispersion(cont, opts) {
  const o = Object.assign({
    modelo: null, alto: null, brush: true, interactivo: true,
    resaltar: null,       // fn(e) → bool: los que no cumplen van en gris
    etiquetaResaltado: null,
    visible: null, margen: { t: 22, r: 18, b: 44, l: 52 }, cuadrantes: true,
  }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const M = o.modelo;
  const est = M.estaciones.filter(e => e.rec != null && e.aplan != null);
  const root = d3.select(el);
  root.selectAll('svg.dispersion').remove();
  const svg = root.append('svg').attr('class', 'dispersion').attr('role', 'img').attr('aria-label', 'Recuperación frente a cambio del pico de la mañana, una estación por punto');
  const m = o.margen;
  const g = svg.append('g');
  const gGrid = g.append('g').attr('class', 'rejilla');
  const gb = g.append('g');
  const gRef = g.append('g');
  const gp = g.append('g');
  const gx = g.append('g').attr('class', 'eje');
  const gy = g.append('g').attr('class', 'eje');
  const gAn = g.append('g');
  const domX = [Math.max(0.1, d3.quantile(est.map(e => e.rec).sort(d3.ascending), 0.005)), d3.quantile(est.map(e => e.rec).sort(d3.ascending), 0.995)];
  const domY = [-0.55, 0.35];
  let x, y, W, H, brush;
  const visible = e => (o.visible ? o.visible(e) : estado.esVisible(e));

  const puntos = gp.selectAll('circle').data(est, d => d.id).join('circle').attr('class', 'pt').attr('r', 3.6);
  if (o.interactivo) {
    puntos.on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); })
      .on('mousemove', (ev, d) => tooltip(ttEstacion(d), ev))
      .on('mouseleave', () => tooltip(null));
  }

  function dibujar() {
    const r = el.getBoundingClientRect();
    W = Math.max(60, r.width - m.l - m.r); H = Math.max(60, (o.alto || r.height) - m.t - m.b);
    svg.attr('width', r.width).attr('height', o.alto || r.height);
    g.attr('transform', `translate(${m.l},${m.t})`);
    x = d3.scaleLinear().domain(domX).range([0, W]).clamp(true);
    y = d3.scaleLinear().domain(domY).range([H, 0]).clamp(true);

    gGrid.selectAll('line.h').data(y.ticks(5)).join('line').attr('class', 'h').attr('x1', 0).attr('x2', W).attr('y1', d => y(d)).attr('y2', d => y(d));
    gx.attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).ticks(6).tickFormat(v => (v * 100).toFixed(0) + ' %').tickSize(4));
    gy.call(d3.axisLeft(y).ticks(5).tickFormat(v => (v > 0 ? '+' : '') + (v * 100).toFixed(0) + ' %').tickSize(0));

    gRef.selectAll('*').remove();
    gRef.append('line').attr('class', 'referencia').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0));
    gRef.append('line').attr('class', 'referencia').attr('x1', x(M.meta.recMed)).attr('x2', x(M.meta.recMed)).attr('y1', 0).attr('y2', H);
    gRef.append('text').attr('class', 'etiqueta suave').attr('x', x(M.meta.recMed) + 5).attr('y', 11).text(`mediana ${fmt.pct(M.meta.recMed)}`);
    gRef.append('text').attr('class', 'etiqueta suave').attr('x', W).attr('y', y(0) - 5).attr('text-anchor', 'end').text('el pico no cambió');
    gRef.append('text').attr('class', 'titulo-eje').attr('x', W).attr('y', H + 36).attr('text-anchor', 'end').text('recuperación: entradas de enero–febrero de 2024 frente a enero–febrero de 2020');
    gRef.append('text').attr('class', 'titulo-eje').attr('transform', `translate(${-m.l + 11},${0}) rotate(-90)`).attr('text-anchor', 'end').text('cambio de la razón pico/valle ↓ se aplanó');
    if (o.cuadrantes) {
      gRef.append('text').attr('class', 'etiqueta suave').attr('x', 6).attr('y', H - 8).text('volvió menos gente y el pico se aplanó');
      gRef.append('text').attr('class', 'etiqueta suave').attr('x', 6).attr('y', 11).text('volvió menos gente y el pico se afiló');
    }

    puntos.attr('cx', e => x(e.rec)).attr('cy', e => y(e.aplan));

    gAn.selectAll('*').remove();
    if (o.etiquetaResaltado && o.resaltar) {
      const sel = est.filter(o.resaltar);
      const cx = d3.median(sel, e => x(e.rec)), cy = d3.median(sel, e => y(e.aplan));
      gAn.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 7).attr('fill', 'none').attr('stroke', cssVar('--tinta')).attr('stroke-width', 1.5);
      gAn.append('text').attr('class', 'etiqueta fuerte').attr('x', cx + 12).attr('y', cy + 4).text(o.etiquetaResaltado);
    }

    gb.selectAll('*').remove();
    if (o.brush) {
      brush = d3.brush().extent([[0, 0], [W, H]]).on('end', ev => {
        if (!ev.sourceEvent) return;
        if (!ev.selection) { estado.fijarFiltro(null); return; }
        const [[x0, y0], [x1, y1]] = ev.selection;
        estado.fijarFiltro(new Set(est.filter(d => { const px = x(d.rec), py = y(d.aplan); return px >= x0 && px <= x1 && py >= y0 && py <= y1; }).map(d => d.id)));
      });
      gb.call(brush);
      svg.on('dblclick', () => { gb.call(brush.move, null); estado.fijarFiltro(null); });
    }
  }

  function pintar() {
    const sel = estado.seleccion;
    puntos
      .attr('fill', e => (o.resaltar ? (o.resaltar(e) ? cssVar('--tinta') : cssVar('--antes')) : colorTipo(e.tipo)))
      .attr('fill-opacity', e => (o.resaltar ? (o.resaltar(e) ? .9 : .55) : .75))
      .classed('dudosa', e => e.conf.nivel !== 'solida')
      .classed('sel', e => e.id === sel)
      .classed('apagada', e => !visible(e))
      .attr('r', e => (e.id === sel ? 6.5 : 3.6));
    puntos.filter(e => o.resaltar && o.resaltar(e)).raise();
    puntos.filter(e => e.id === sel).raise();
  }

  dibujar(); pintar();
  const ro = new ResizeObserver(() => { dibujar(); pintar(); }); ro.observe(el);
  return { update: pintar, limpiarBrush() { if (brush) gb.call(brush.move, null); }, destruir() { ro.disconnect(); svg.remove(); } };
}
