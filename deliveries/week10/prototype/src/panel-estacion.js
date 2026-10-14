// Panel de evidencia de una estación: los números crudos detrás de cada
// afirmación, el perfil antes/después, su serie mensual y, si la comparación es
// poco confiable, por qué. Es el "candado" del proyecto: todo lo que se dice de
// una estación se puede verificar acá.

import { estado } from './estado.js';
import { fmt, cssVar, colorTipo, colorConf, NOMBRE_CONF, DESC_TIPO } from './util.js';
import { perfil24 } from './graficos/perfil.js';

function laborable24(p168) {
  const L = d3.range(24).map(h => d3.sum(d3.range(1, 6), d => p168[d * 24 + h]));
  const t = d3.sum(L) || 1; return L.map(v => v / t);
}

export function panelEstacion(cont) {
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const root = d3.select(el);
  let perfil = null, idActual = null;

  root.html(`<button class="cerrar" aria-label="Cerrar panel">×</button><div class="contenido"></div>`);
  root.select('.cerrar').on('click', () => estado.limpiarSeleccion());
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && estado.seleccion) estado.limpiarSeleccion(); });

  function render() {
    const id = estado.seleccion;
    root.classed('abierto', !!id);
    document.body.classList.toggle('con-panel', !!id);
    if (!id) { idActual = null; return; }
    if (id === idActual) return;
    idActual = id;
    const e = estado.estacion(id), M = estado.modelo, meses = M.meta.meses;
    const c = root.select('.contenido');
    const vPre = e.dPre * 60, vCmp = e.rec != null ? e.rec * e.dPre * 60 : null, v24 = e.d24 * 366;
    const avisoCls = e.conf.nivel;
    c.html(`
      <h3>${e.n}</h3>
      <div class="meta"><span>${e.b}</span>
        <span class="tipo-chip"><i style="background:${colorTipo(e.tipo)}"></i>${e.tipo}</span>
        <span>${DESC_TIPO[e.tipo]}</span></div>
      ${e.conf.nivel !== 'solida' ? `<div class="bloque"><div class="aviso ${avisoCls}"><b>${NOMBRE_CONF[e.conf.nivel]}.</b> La comparación de esta estación se muestra, pero no sostiene conclusiones por sí sola.<ul>${e.conf.motivos.map(m => `<li>${m}</li>`).join('')}</ul></div></div>` : ''}
      <div class="bloque"><h4>Cifras</h4><div class="cifras">
        <div class="cifra"><b>${fmt.pct(e.rec)}</b><span>recuperación, enero–febrero 2024 frente a enero–febrero 2020</span></div>
        <div class="cifra"><b>${fmt.pct(e.recFY)}</b><span>recuperación con todo 2024 (${fmt.pp(e.dSeason)} de diferencia)</span></div>
        <div class="cifra"><b>${fmt.razon(e.pvA)} → ${fmt.razon(e.pvB)}</b><span>razón pico/valle del día laborable (${fmt.cambio(e.aplan)})</span></div>
        <div class="cifra"><b>${e.asymPre > 0 ? '+' : ''}${e.asymPre.toFixed(2)} → ${e.asymCur > 0 ? '+' : ''}${e.asymCur.toFixed(2)}</b><span>asimetría mañana/tarde (+1 residencial, −1 laboral)</span></div>
      </div></div>
      <div class="bloque"><h4>Forma del día laborable</h4><div class="perfil-panel"></div>
        <div class="leyenda"><span class="item"><i class="muestra" style="background:${cssVar('--antes')}"></i>enero–febrero 2020</span><span class="item"><i class="muestra linea" style="background:${colorTipo(e.tipo)}"></i>2024</span></div></div>
      <div class="bloque"><h4>Entradas por mes, 2020–2024</h4><div class="serie-panel"></div></div>
      <div class="bloque"><h4>Los números detrás</h4><table>
        <tr><th>ventana</th><th>días</th><th>entradas</th><th>por día</th></tr>
        <tr><td>enero–febrero 2020 (línea base)</td><td>60</td><td>${fmt.int(vPre)}</td><td>${fmt.int(e.dPre)}</td></tr>
        <tr><td>enero–febrero 2024</td><td>60</td><td>${fmt.int(vCmp)}</td><td>${fmt.int(vCmp / 60)}</td></tr>
        <tr><td>2024 completo</td><td>366</td><td>${fmt.int(v24)}</td><td>${fmt.int(e.d24)}</td></tr>
        <tr><td>share del fin de semana, 2020</td><td></td><td></td><td>${fmt.pct(e.wk)}</td></tr>
      </table>
      ${e.cortes.length ? `<p style="margin-top:8px;font-size:11.5px;color:var(--tinta-3)">Meses con caída anómala de entradas (por debajo de la mitad de su entorno): ${e.cortes.map(fmt.mes).join(', ')}. Detectado en los datos; no verificado contra avisos de servicio de la MTA.</p>` : ''}
      </div>
      <div class="acciones"><button class="boton chico" data-accion="borough">Ver solo ${e.b}</button><button class="boton chico" data-accion="limpiar">Quitar selección</button></div>
    `);
    perfil = perfil24(c.select('.perfil-panel').node(), { pre: laborable24(e.pre), cur: laborable24(e.cur), tipo: e.tipo, alto: 170, compacto: true, margen: { t: 10, r: 10, b: 24, l: 34 }, etiquetaPre: 'ene–feb 2020' });
    serieEstacion(c.select('.serie-panel').node(), e, meses, M.meta.msEsc);
    c.select('[data-accion=borough]').on('click', () => estado.fijarBoroughs(new Set([e.b])));
    c.select('[data-accion=limpiar]').on('click', () => estado.limpiarSeleccion());
  }
  return { update: render };
}

function serieEstacion(el, e, meses, esc) {
  const W = el.getBoundingClientRect().width || 380, H = 110, m = { t: 8, r: 8, b: 20, l: 34 };
  const svg = d3.select(el).html('').append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  const w = W - m.l - m.r, h = H - m.t - m.b;
  const x = d3.scalePoint().domain(meses).range([0, w]);
  const vals = e.ms.map(v => v * esc);
  const y = d3.scaleLinear().domain([0, d3.max(vals) * 1.05]).range([h, 0]);
  g.append('g').attr('class', 'eje').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).tickValues(meses.filter(d => d.endsWith('-01'))).tickFormat(s => s.slice(0, 4)).tickSize(3));
  g.append('g').attr('class', 'eje').call(d3.axisLeft(y).ticks(3).tickFormat(v => fmt.miles(v)).tickSize(0));
  const cortes = new Set(e.cortes);
  g.selectAll('rect.corte').data(meses.filter(mm => cortes.has(mm))).join('rect').attr('class', 'corte')
    .attr('x', d => x(d) - w / meses.length / 2).attr('width', w / meses.length).attr('y', 0).attr('height', h).attr('fill', cssVar('--interrumpida')).attr('opacity', .25);
  g.append('path').attr('d', d3.line().x((_, i) => x(meses[i])).y(v => y(v))(vals)).attr('fill', 'none').attr('stroke', colorTipo(e.tipo)).attr('stroke-width', 1.6);
  const ref = e.dPre * 30.44;
  g.append('line').attr('class', 'referencia').attr('x1', 0).attr('x2', w).attr('y1', y(ref)).attr('y2', y(ref));
  g.append('text').attr('class', 'etiqueta suave').attr('x', w).attr('y', y(ref) - 4).attr('text-anchor', 'end').text('nivel de la línea base');
}
