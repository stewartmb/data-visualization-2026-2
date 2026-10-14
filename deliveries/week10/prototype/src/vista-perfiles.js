// Vista B · Perfiles semanales (small multiples)
// Cada estacion es un vector de 168 valores (24 h x 7 dias) normalizado por su
// propio total, para compararlas por forma y no por tamano. La escala vertical
// es comun a todos los multiplos: sin eso las formas no serian comparables.

import { estado } from './estado.js';
import { tooltip } from './main.js';

const W = 124, H = 42, TOPE = 120;   // TOPE: cuantos multiplos se dibujan a la vez
const DIAS = ['D','L','M','M','J','V','S'];   // dow 0 = domingo (verificado en los datos)

export function initPerfiles(datos){
  const cont = d3.select('#perfiles');
  const est  = datos.estaciones;

  let orden = 'rec', modo = 'ambos';
  d3.select('#orden').on('change', function(){ orden = this.value; render(); });
  d3.select('#modo').on('change',  function(){ modo  = this.value; render(); });

  const maxY = d3.max(est, e => Math.max(d3.max(e.pre), d3.max(e.cur)));
  const sx = d3.scaleLinear().domain([0,167]).range([0, W]);
  const sy = d3.scaleLinear().domain([0, maxY]).range([H, 1]);
  // El perfil prepandemia va como area gris y el de 2024 como linea azul encima.
  // Con dos lineas superpuestas el gris queda tapado casi por completo, y la
  // comparacion antes/despues es justamente lo que esta vista tiene que mostrar.
  const linea = d3.line().x((_,i) => sx(i)).y(v => sy(v)).curve(d3.curveMonotoneX);
  const area  = d3.area().x((_,i) => sx(i)).y0(H).y1(v => sy(v)).curve(d3.curveMonotoneX);
  const dist  = e => Math.hypot(...e.cur.map((v,i) => v - e.pre[i]));

  function ordenar(a, b){
    if (orden === 'rec') return a.rec - b.rec;
    if (orden === 'vol') return estado.volumen(b) - estado.volumen(a);
    if (orden === 'nom') return a.n.localeCompare(b.n);
    return dist(b) - dist(a);                       // 'chg'
  }

  function render(){
    const sel = estado.seleccion;

    // el filtro de la dispersion recorta el conjunto; la seleccion no lo recorta,
    // solo sube la estacion al primer lugar y la resalta
    const universo = estado.visibles();
    let lista = universo.slice().sort(ordenar).slice(0, TOPE);

    d3.select('#cuenta-perfiles').text(
      universo.length > TOPE ? `${TOPE} de ${universo.length}` : `${universo.length}`);

    if (sel && !lista.some(e => e.id === sel)){
      const e = est.find(x => x.id === sel);
      if (e) lista = [e, ...lista.slice(0, TOPE - 1)];
    } else if (sel){
      lista = [lista.find(e => e.id === sel), ...lista.filter(e => e.id !== sel)];
    }

    if (!lista.length){
      cont.html('<div class="vacio">ninguna estación pasa el filtro · doble clic en la dispersión para limpiarlo</div>');
      return;
    }

    let grid = cont.select('.sm-grid');
    if (grid.empty()) grid = cont.html('').append('div').attr('class','sm-grid');

    const celdas = grid.selectAll('.sm').data(lista, d => d.id)
      .join(enter => {
        const c = enter.append('div').attr('class','sm');
        c.append('div').attr('class','nom');
        c.append('div').attr('class','met');
        c.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio','none');
        const dias = c.append('div').attr('class','dias');
        DIAS.forEach(t => dias.append('span').text(t));
        return c;
      })
      .order()
      .on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); })
      .on('mousemove', (ev, d) => tooltip(
        `<b>${d.n}</b><br>${d.b}<br>
         recuperación ${(d.rec*100).toFixed(0)} %<br>
         pico/valle ${d.pvA ? d.pvA.toFixed(2) : '—'} → ${d.pvB ? d.pvB.toFixed(2) : '—'}`, ev))
      .on('mouseleave', () => tooltip(null));

    celdas.classed('sel', d => d.id === sel);
    celdas.select('.nom').text(d => d.n);
    celdas.select('.met').text(d => `${(d.rec*100).toFixed(0)} %  ·  ${d.b}`);

    celdas.select('svg').each(function(d){
      const s = d3.select(this);
      s.selectAll('*').remove();

      for (let k = 1; k < 7; k++)
        s.append('line')
          .attr('x1', sx(k*24)).attr('x2', sx(k*24)).attr('y1', 0).attr('y2', H)
          .attr('stroke', '#eef1f4').attr('stroke-width', .7);

      if (modo === 'dif'){
        const dif = d.cur.map((v,i) => v - d.pre[i]);
        const m   = d3.max(dif, Math.abs) || 1;
        const sd  = d3.scaleLinear().domain([-m, m]).range([H, 0]);
        s.append('line').attr('x1',0).attr('x2',W).attr('y1',sd(0)).attr('y2',sd(0))
          .attr('stroke','#cfd6de').attr('stroke-width',.8);
        s.append('path')
          .attr('d', d3.line().x((_,i)=>sx(i)).y(v=>sd(v)).curve(d3.curveMonotoneX)(dif))
          .attr('fill','none').attr('stroke','#e07a16').attr('stroke-width',1.1);
      } else {
        if (modo !== 'cur')
          s.append('path').attr('d', area(d.pre))
            .attr('fill','#ccd3db').attr('stroke','#aab3bd').attr('stroke-width',.6);
        if (modo !== 'pre')
          s.append('path').attr('d', linea(d.cur))
            .attr('fill','none').attr('stroke','#1b4f8c').attr('stroke-width',1.3);
      }
    });

    // deja la estacion seleccionada a la vista
    if (sel){
      const n = grid.selectAll('.sm').nodes()[0];
      if (n && n.__data__ && n.__data__.id === sel) cont.node().scrollTop = 0;
    }
  }

  return { update: render };
}
