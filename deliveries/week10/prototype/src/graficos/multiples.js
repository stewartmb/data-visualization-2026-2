// Rejilla de perfiles semanales (168 h) — small multiples con escala vertical
// común, para comparar formas y no tamaños. El color de la línea es el tipo de
// la estación, el mismo que lleva en el mapa y en la dispersión.

import { estado } from '../estado.js';
import { tooltip, ttEstacion, colorTipo, fmt } from '../util.js';
import { perfil168 } from './perfil.js';

const TOPE = 120;
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];   // dow 0 = domingo (verificado en los datos)

export function multiples(cont, opts) {
  const o = Object.assign({ modelo: null, contador: null, selOrden: null }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const M = o.modelo, est = M.estaciones;
  const cuerpo = d3.select(el);
  const maxY = d3.max(est, e => Math.max(d3.max(e.pre), d3.max(e.cur)));
  const dist = e => Math.hypot(...e.cur.map((v, i) => v - e.pre[i]));
  let orden = 'aplan';
  if (o.selOrden) d3.select(o.selOrden).on('change', function () { orden = this.value; render(); });

  function comparar(a, b) {
    if (orden === 'rec') return a.rec - b.rec;
    if (orden === 'vol') return estado.volumen(b) - estado.volumen(a);
    if (orden === 'nom') return a.n.localeCompare(b.n);
    if (orden === 'chg') return dist(b) - dist(a);
    return (a.aplan ?? 0) - (b.aplan ?? 0);          // 'aplan': los que más se aplanaron primero
  }

  function render() {
    const sel = estado.seleccion;
    const universo = estado.visibles();
    let lista = universo.slice().sort(comparar).slice(0, TOPE);
    if (sel) {
      const e = estado.estacion(sel);
      if (e) lista = [e, ...lista.filter(x => x.id !== sel)].slice(0, TOPE);
    }
    if (o.contador) d3.select(o.contador).text(universo.length > TOPE ? `${TOPE} de ${universo.length}` : `${universo.length}`);

    if (!lista.length) { cuerpo.html('<div class="sm-vacio">Ninguna estación pasa el filtro. Doble clic en la dispersión o quita los filtros de la barra.</div>'); return; }
    let grid = cuerpo.select('.sm-grid');
    if (grid.empty()) grid = cuerpo.html('').append('div').attr('class', 'sm-grid');

    const celdas = grid.selectAll('.sm').data(lista, d => d.id)
      .join(enter => {
        const c = enter.append('div').attr('class', 'sm').attr('tabindex', 0).attr('role', 'button');
        c.append('div').attr('class', 'nom');
        const met = c.append('div').attr('class', 'met'); met.append('i').attr('class', 'punto'); met.append('span');
        c.append('svg');
        const d = c.append('div').attr('class', 'dias'); DIAS.forEach(t => d.append('span').text(t));
        return c;
      })
      .order()
      .on('click', (ev, d) => { ev.stopPropagation(); estado.seleccionar(d.id); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); estado.seleccionar(d.id); } })
      .on('mousemove', (ev, d) => tooltip(ttEstacion(d), ev))
      .on('mouseleave', () => tooltip(null));

    celdas.classed('sel', d => d.id === sel);
    celdas.select('.nom').text(d => d.n);
    celdas.select('.met i').style('background', d => colorTipo(d.tipo));
    celdas.select('.met span').text(d => `${fmt.pct(d.rec)} · pico ${fmt.cambio(d.aplan)}${d.conf.nivel !== 'solida' ? ' · ⚠' : ''}`);
    celdas.select('svg').each(function (d) { perfil168(this, d.pre, d.cur, d.tipo, maxY); });
    if (sel) el.scrollTop = 0;
  }
  return { update: render };
}
