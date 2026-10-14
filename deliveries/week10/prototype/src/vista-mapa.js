// Vista A · Mapa de estaciones
// posicion = coordenadas · color = recuperacion (divergente) · tamano = entradas/dia
//
// El tamano se recalcula con el rango temporal activo: si la serie tiene un
// brush puesto, el radio es el promedio diario de ese periodo y no el de 2024.

import { estado } from './estado.js';
import { tooltip } from './main.js';

export function initMapa(datos){
  const svg = d3.select('#mapa');
  const g   = svg.append('g');
  const est = datos.estaciones;
  const M   = datos.meta;

  const color = d3.scaleDiverging()
    .domain([M.recP10, M.recMed, M.recP90])
    .interpolator(d3.interpolateRdYlBu).clamp(true);

  const radio = d3.scaleSqrt()
    .domain([0, d3.max(est, d => d.d24)])
    .range([2, 13]).clamp(true);

  const rad = d => radio(estado.rango ? estado.volumen(d) : d.d24);

  let x, y, zk = 1;

  function medir(){
    const r = svg.node().getBoundingClientRect();
    const w = r.width, h = r.height;
    const lons = d3.extent(est, d => d.lon);
    const lats = d3.extent(est, d => d.lat);
    // correccion de aspecto por latitud (Mercator simple a esta escala)
    const k = Math.cos(40.7 * Math.PI / 180);
    const dw = (lons[1] - lons[0]) * k, dh = lats[1] - lats[0];
    const pad = 22;
    const s = Math.min((w - 2*pad) / dw, (h - 2*pad) / dh);
    const ox = (w - dw*s) / 2, oy = (h - dh*s) / 2;
    x = lon => ox + (lon - lons[0]) * k * s;
    y = lat => h - oy - (lat - lats[0]) * s;
  }

  medir();

  const puntos = g.selectAll('circle').data(est, d => d.id)
    .join('circle')
      .attr('class', 'estacion')
      .attr('fill', d => color(d.rec))
      .on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); })
      .on('mousemove', (ev, d) => tooltip(
        `<b>${d.n}</b><br>${d.b}<br>
         recuperación ${(d.rec*100).toFixed(0)} %<br>
         ${d3.format(',')(Math.round(estado.rango ? estado.volumen(d) : d.d24))} entradas/día
         ${estado.rango ? `(${estado.rango[0]} a ${estado.rango[1]})` : 'en 2024'}`, ev))
      .on('mouseleave', () => tooltip(null));

  svg.on('click', () => estado.limpiarSeleccion());

  // zoom y paneo; el radio se compensa para que los puntos no engorden al acercar
  svg.call(d3.zoom().scaleExtent([1, 9]).on('zoom', ev => {
    zk = ev.transform.k;
    g.attr('transform', ev.transform);
    puntos.attr('r', d => rad(d) / Math.sqrt(zk));
  }));

  leyenda(color, radio, M);

  function colocar(){
    medir();
    puntos.attr('cx', d => x(d.lon)).attr('cy', d => y(d.lat));
  }
  colocar();
  addEventListener('resize', colocar);

  return {
    update(){
      const sel = estado.seleccion;
      puntos
        .attr('r', d => rad(d) / Math.sqrt(zk))
        .classed('sel',     d => d.id === sel)
        .classed('apagada', d => !estado.esVisible(d) || (sel !== null && d.id !== sel));
    }
  };
}

function leyenda(color, radio, M){
  const cont = d3.select('#legend-mapa').html('');

  // --- barra de color ---
  const b1 = cont.append('div').attr('class','bloque');
  b1.append('span').attr('class','titulo').text('RECUPERACIÓN 2024 / PREPANDEMIA');
  const W = 150, H = 11;
  const s1 = b1.append('svg').attr('width', W).attr('height', H + 16);
  const gid = 'grad-rec';
  const def = s1.append('defs').append('linearGradient').attr('id', gid);
  d3.range(0, 1.001, 0.05).forEach(t => {
    def.append('stop')
      .attr('offset', (t*100) + '%')
      .attr('stop-color', color(M.recP10 + t * (M.recP90 - M.recP10)));
  });
  s1.append('rect').attr('width', W).attr('height', H).attr('fill', `url(#${gid})`);
  const et = [
    [0,    `${Math.round(M.recP10*100)} %`, 'start'],
    [W/2,  `${Math.round(M.recMed*100)} %`, 'middle'],
    [W,    `${Math.round(M.recP90*100)} %`, 'end']
  ];
  et.forEach(([px,txt,anc]) => {
    s1.append('text').attr('x', px).attr('y', H + 12).attr('text-anchor', anc)
      .attr('font-size', 9.5).attr('fill', '#6b7785').text(txt);
  });
  b1.append('div').attr('class','nota').text('p10 · mediana · p90 · valores extremos recortados');

  // --- tamano ---
  const b2 = cont.append('div').attr('class','bloque');
  b2.append('span').attr('class','titulo').text('ENTRADAS / DÍA');
  const rMax = radio(60000);
  const s2 = b2.append('svg').attr('width', 170).attr('height', 2*rMax + 16);
  [[2000,'2 k'],[20000,'20 k'],[60000,'60 k']].forEach(([v,txt],i) => {
    const cx = 16 + i*54, r = radio(v);
    // alineados por la base, que es como se comparan circulos sin engañar al ojo
    s2.append('circle').attr('cx',cx).attr('cy', 2*rMax - r).attr('r', r)
      .attr('fill','none').attr('stroke','#aab3bd');
    s2.append('text').attr('x',cx).attr('y', 2*rMax + 12).attr('text-anchor','middle')
      .attr('font-size',9.5).attr('fill','#6b7785').text(txt);
  });
}
