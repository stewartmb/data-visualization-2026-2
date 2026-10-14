// Vista C · Serie temporal del sistema, con brush que define el período.

import { estado } from './estado.js';
import { tooltip } from './main.js';

export function initSerie(datos){
  const svg   = d3.select('#serie');
  const serie = datos.serie;
  const base  = datos.meta.base;
  const m = {t:22, r:16, b:24, l:52};

  const g     = svg.append('g');
  const gx    = g.append('g').attr('class','eje');
  const gy    = g.append('g').attr('class','eje');
  const area  = g.append('path').attr('fill','#1b4f8c').attr('opacity',.1);
  const linea = g.append('path').attr('fill','none').attr('stroke','#1b4f8c').attr('stroke-width',1.8);
  const ref   = g.append('line').attr('class','ref');
  const refTx = g.append('text').attr('class','ref-txt');
  const tituY = g.append('text').attr('class','eje-titulo')
                 .attr('x', -44).attr('y', -9).text('millones de entradas / mes');
  const gb    = g.append('g');

  let x, y, W, H;

  function medir(){
    const r = svg.node().getBoundingClientRect();
    W = Math.max(10, r.width  - m.l - m.r);
    H = Math.max(10, r.height - m.t - m.b);
    g.attr('transform', `translate(${m.l},${m.t})`);
    x = d3.scalePoint().domain(serie.map(d => d.m)).range([0, W]);
    y = d3.scaleLinear().domain([0, d3.max(serie, d => d.v) * 1.08]).range([H, 0]);
  }

  function dibujar(){
    medir();

    gx.attr('transform', `translate(0,${H})`).call(
      d3.axisBottom(x).tickValues(serie.filter(d => d.m.endsWith('-01')).map(d => d.m))
        .tickFormat(s => s.slice(0,4)));
    gy.call(d3.axisLeft(y).ticks(4).tickFormat(v => (v/1e6).toFixed(0) + ' M'));

    linea.attr('d', d3.line().x(d => x(d.m)).y(d => y(d.v))(serie));
    area .attr('d', d3.area().x(d => x(d.m)).y0(H).y1(d => y(d.v))(serie));

    ref.attr('x1',0).attr('x2',W).attr('y1',y(base)).attr('y2',y(base));
    refTx.attr('x', W - 2).attr('y', y(base) - 5).attr('text-anchor','end')
         .text('nivel de enero 2020');

    const brush = d3.brushX().extent([[0,0],[W,H]])
      .on('end', ev => {
        if (!ev.sourceEvent) return;
        if (!ev.selection){ estado.fijarRango(null); return; }
        const [a,b] = ev.selection;
        const dentro = serie.filter(d => x(d.m) >= a && x(d.m) <= b);
        estado.fijarRango(dentro.length ? [dentro[0].m, dentro.at(-1).m] : null);
      });

    gb.call(brush);
    svg.on('dblclick', () => { gb.call(brush.move, null); estado.fijarRango(null); });

    gb.selectAll('rect.overlay')
      .on('mousemove', ev => {
        const px = d3.pointer(ev, g.node())[0];
        const d  = serie.reduce((best, s) =>
          Math.abs(x(s.m) - px) < Math.abs(x(best.m) - px) ? s : best, serie[0]);
        tooltip(`<b>${d.m}</b><br>${d3.format(',')(d.v)} entradas<br>
                 ${(100*d.v/base).toFixed(0)} % del nivel de enero 2020`, ev);
      })
      .on('mouseleave', () => tooltip(null));
  }

  dibujar();
  addEventListener('resize', dibujar);

  return { update(){} };
}
