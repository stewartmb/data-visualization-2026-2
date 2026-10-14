// Vista D · Dispersion pico/valle: razon prepandemia (x) contra razon 2024 (y).
//
// La diagonal y = x es la referencia: debajo de ella la estacion aplano su pico,
// encima lo afilo. La distancia a la diagonal es la magnitud del cambio y el
// lado es la direccion. Escalas logaritmicas porque el dato es una razon y la
// distribucion esta sesgada a la derecha.

import { estado } from './estado.js';
import { tooltip } from './main.js';

export function initDispersion(datos){
  const svg = d3.select('#dispersion');
  const est = datos.estaciones.filter(e => e.pvA && e.pvB);
  const m   = {t:10, r:12, b:42, l:46};

  const g    = svg.append('g');
  const gx   = g.append('g').attr('class','eje');
  const gy   = g.append('g').attr('class','eje');
  const diag = g.append('line').attr('class','diag');
  // el brush va DEBAJO de los puntos: si fuera encima, su rectangulo de captura
  // bloquearia el hover y el clic sobre cada estacion
  const gb   = g.append('g');
  const gp   = g.append('g');
  const txt  = g.append('text').attr('class','anotacion');
  const tx   = g.append('text').attr('class','eje-titulo');
  const ty   = g.append('text').attr('class','eje-titulo');

  const dom = [1, d3.max(est, d => Math.max(d.pvA, d.pvB)) * 1.05];
  let x, y, W, H, brush;

  function medir(){
    const r = svg.node().getBoundingClientRect();
    W = Math.max(10, r.width  - m.l - m.r);
    H = Math.max(10, r.height - m.t - m.b);
    g.attr('transform', `translate(${m.l},${m.t})`);
    x = d3.scaleLog().domain(dom).range([0, W]);
    y = d3.scaleLog().domain(dom).range([H, 0]);
  }

  const puntos = gp.selectAll('circle').data(est, d => d.id)
    .join('circle')
      .attr('class','pt')
      .attr('r', 3)
      .attr('fill', d => d.pvB < d.pvA ? '#e07a16' : '#1b4f8c')
      .on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); })
      .on('mousemove', (ev, d) => tooltip(
        `<b>${d.n}</b><br>${d.b}<br>
         pico/valle ${d.pvA.toFixed(2)} → ${d.pvB.toFixed(2)}
         (${d.pvB < d.pvA ? 'aplanó' : 'afiló'})`, ev))
      .on('mouseleave', () => tooltip(null));

  function dibujar(){
    medir();

    const ticks = [1, 1.5, 2, 3, 4, 6, 8, 12].filter(v => v >= dom[0] && v <= dom[1]);
    gx.attr('transform', `translate(0,${H})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format('~g')));
    gy.call(d3.axisLeft(y).tickValues(ticks).tickFormat(d3.format('~g')));

    diag.attr('x1', x(dom[0])).attr('y1', y(dom[0]))
        .attr('x2', x(dom[1])).attr('y2', y(dom[1]));

    tx.attr('x', W).attr('y', H + 34).attr('text-anchor','end')
      .text('razón pico/valle · enero–febrero 2020');
    ty.attr('transform', `translate(-34,0) rotate(-90)`).attr('y', 0).attr('x', 0)
      .attr('text-anchor','end').text('razón pico/valle · 2024');

    const aplanaron = est.filter(d => d.pvB < d.pvA).length;
    txt.attr('x', 4).attr('y', 12).attr('text-anchor','start')
       .text(`${aplanaron} de ${est.length} aplanaron su pico`);

    puntos.attr('cx', d => x(d.pvA)).attr('cy', d => y(d.pvB));

    brush = d3.brush().extent([[0,0],[W,H]])
      .on('end', ev => {
        if (!ev.sourceEvent) return;
        if (!ev.selection){ estado.fijarFiltro(null); return; }
        const [[x0,y0],[x1,y1]] = ev.selection;
        const ids = new Set(est.filter(d => {
          const px = x(d.pvA), py = y(d.pvB);
          return px >= x0 && px <= x1 && py >= y0 && py <= y1;
        }).map(d => d.id));
        estado.fijarFiltro(ids);
      });

    gb.call(brush);
    // en el svg y no en gb: el doble clic puede caer sobre un punto, que esta encima
    svg.on('dblclick', () => { gb.call(brush.move, null); estado.fijarFiltro(null); });
  }

  dibujar();
  addEventListener('resize', dibujar);

  return {
    update(){
      const sel = estado.seleccion;
      puntos
        .classed('sel',     d => d.id === sel)
        .classed('apagada', d => !estado.esVisible(d) || (sel !== null && d.id !== sel))
        .attr('r', d => d.id === sel ? 6 : 3);
    }
  };
}
