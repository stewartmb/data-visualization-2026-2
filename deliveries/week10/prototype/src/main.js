// La forma del dia — prototipo funcional (Semana 10)
//
// Cuatro vistas enlazadas por un estado compartido:
//   A mapa · B perfiles semanales · C serie temporal · D dispersion pico/valle
// Toda interaccion escribe en estado.js y estado.js redibuja todas las vistas.

import { estado }         from './estado.js';
import { initMapa }       from './vista-mapa.js';
import { initPerfiles }   from './vista-perfiles.js';
import { initSerie }      from './vista-serie.js';
import { initDispersion } from './vista-dispersion.js';

const tt = d3.select('#tt');
export function tooltip(html, ev){
  if (!html) { tt.style('opacity', 0); return; }
  tt.html(html)
    .style('left', Math.min(ev.clientX + 14, innerWidth - 270) + 'px')
    .style('top',  (ev.clientY + 14) + 'px')
    .style('opacity', 1);
}

d3.json('data/app.json').then(datos => {
  estado.init(datos);

  const vistas = [
    initMapa(datos),
    initPerfiles(datos),
    initSerie(datos),
    initDispersion(datos)
  ];

  const redibujar = () => { vistas.forEach(v => v.update()); pintarEstado(datos); };
  estado.onChange(redibujar);
  redibujar();
}).catch(err => {
  d3.select('#status').html('<b>error al cargar los datos</b>');
  console.error(err);
});

function pintarEstado(datos){
  const vis = estado.visibles();
  const tot = datos.estaciones.length;
  const sel = estado.seleccion;
  const r   = estado.rango;

  const partes = [`${vis.length} de ${tot} estaciones`];

  if (estado.filtro){
    const sh = d3.sum(vis, e => e.d24) / d3.sum(datos.estaciones, e => e.d24);
    partes.push(`${(sh*100).toFixed(0)} % de las entradas`);
  }
  if (r){
    const [a,b] = estado.indicesRango();
    const v = d3.mean(datos.serie.slice(a, b+1), d => d.v);
    partes.push(`${r[0]} a ${r[1]} · ${(100*v/datos.meta.base).toFixed(0)} % del nivel de enero 2020`);
  }
  if (sel){
    const e = datos.estaciones.find(x => x.id === sel);
    if (e) partes.push(`<b>${e.n}</b>`);
  }

  d3.select('#status').html(partes.join(' · '));
}
