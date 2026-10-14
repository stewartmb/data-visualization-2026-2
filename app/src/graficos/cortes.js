// Las estaciones con comparación poco confiable, una por fila, contra los 60
// meses: cada celda es cuánto de enero–febrero 2020 volvió ese mes. Las caídas
// anómalas detectadas quedan marcadas; la ventana de comparación, enmarcada.
// Es la evidencia de por qué cada una está marcada, sin texto.

import { estado } from '../estado.js';
import { fmt, tooltip, cssVar, colorConf, NOMBRE_CONF } from '../util.js';

export function cortes(cont, opts) {
  const o = Object.assign({ modelo: null, altoFila: null, margen: { t: 30, r: 118, b: 6, l: 262 } }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const M = o.modelo, meses = M.meta.meses;
  const iMes = new Map(meses.map((m, i) => [m, i]));
  const orden = { interrumpida: 0, estacional: 1, pequena: 2 };
  const filas = M.estaciones.filter(e => e.conf.nivel !== 'solida').sort((a, b) => orden[a.conf.nivel] - orden[b.conf.nivel] || Math.abs(b.dSeason) - Math.abs(a.dSeason));
  const root = d3.select(el); root.selectAll('svg.cortes').remove();
  const svg = root.append('svg').attr('class', 'cortes');
  const altoFila = () => o.altoFila || Math.max(13, Math.min(26, (el.getBoundingClientRect().height - o.margen.t - o.margen.b) / filas.length));
  let H = 0;
  const rampa = d3.interpolateRgbBasis([cssVar('--superficie'), cssVar('--azul-300'), cssVar('--azul-700')]);
  const color = d3.scaleSequential([0, 1.2], rampa).clamp(true);

  function pintar() {
    const W = el.getBoundingClientRect().width; if (W < 300) return;
    const AF = altoFila(); H = o.margen.t + filas.length * AF + o.margen.b;
    svg.attr('width', W).attr('height', H).selectAll('*').remove();
    const m = o.margen, x = d3.scaleLinear([0, meses.length], [m.l, W - m.r]), cw = x(1) - x(0);
    meses.forEach((mm, i) => { if (mm.endsWith('-01') && +mm.slice(0, 4) % 2 === 0) { svg.append('text').attr('x', x(i) + 2).attr('y', m.t - 8).attr('class', 'anio').text(mm.slice(0, 4)); svg.append('line').attr('x1', x(i)).attr('x2', x(i)).attr('y1', m.t - 4).attr('y2', H - m.b).attr('class', 'sep'); } });
    const [ca, cb] = M.meta.ventanaCmp;
    svg.append('rect').attr('x', x(iMes.get(ca))).attr('y', m.t - 2).attr('width', x(iMes.get(cb) + 1) - x(iMes.get(ca))).attr('height', H - m.t - m.b + 4).attr('class', 'ventana-cmp');
    let nivelPrev = null;
    filas.forEach((e, k) => {
      const y = m.t + k * AF, base = (e.ms[0] + e.ms[1]) / 2 || 1;
      if (e.conf.nivel !== nivelPrev) { nivelPrev = e.conf.nivel; svg.append('text').attr('x', 2).attr('y', y + AF / 2 + 3.5).attr('class', 'nivel').attr('fill', colorConf(e.conf.nivel)).text(NOMBRE_CONF[e.conf.nivel].replace('sensible a la estación del año', 'estacional').replace('ventana de comparación anómala', 'ventana anómala')); }
      const g = svg.append('g').attr('class', 'fila').style('cursor', 'pointer')
        .on('mousemove', ev => { const i = Math.floor(x.invert(d3.pointer(ev, svg.node())[0])); tooltip(`<b>${e.n}</b><div class="fila"><span>${e.b}</span></div><div>${NOMBRE_CONF[e.conf.nivel]}: ${e.conf.motivos[0]}</div>${i >= 0 && i < meses.length ? `<div class="fila"><span>${fmt.mes(meses[i])}</span><span>${fmt.pct(e.ms[i] / base)} de ene–feb 2020</span></div>` : ''}`, ev); })
        .on('mouseleave', () => tooltip(null)).on('click', ev => { ev.stopPropagation(); estado.seleccionar(e.id); });
      g.append('text').attr('x', m.l - 8).attr('y', y + AF / 2 + 3.5).attr('text-anchor', 'end').attr('class', 'nombre').text(e.n.length > 24 ? e.n.slice(0, 23) + '…' : e.n);
      g.selectAll('rect.c').data(e.ms).join('rect').attr('class', 'c').attr('x', (d, i) => x(i)).attr('y', y + 1).attr('width', cw + .3).attr('height', AF - 2).attr('fill', d => color(d / base));
      e.cortes.forEach(mm => g.append('rect').attr('x', x(iMes.get(mm))).attr('y', y + 1).attr('width', cw).attr('height', AF - 2).attr('class', 'corte'));
      g.append('text').attr('x', W - m.r + 6).attr('y', y + AF / 2 + 3.5).attr('class', 'dato').text(e.conf.nivel === 'estacional' ? `todo 2024 ${fmt.pp(e.dSeason)}` : e.conf.nivel === 'pequena' ? `${fmt.int(e.dPre)} /día en 2020` : (e.cortes.length > 2 ? `${e.cortes.length} meses, desde ${fmt.mes(e.cortes[0])}` : e.cortes.map(fmt.mes).join(', ')));
    });
  }
  function actualizar() { svg.selectAll('g.fila').classed('sel', function () { return false; }); }
  pintar();
  const ro = new ResizeObserver(pintar); ro.observe(el);
  return { update: actualizar, destruir() { ro.disconnect(); svg.remove(); } };
}
