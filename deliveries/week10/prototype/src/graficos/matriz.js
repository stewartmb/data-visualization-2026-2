// Matriz estaciones × tiempo: la vista principal. Cada fila es un complejo de
// estación (428), agrupadas por borough; cada columna, una hora de la semana
// (168) o un mes (60). Tres lentes:
//   forma    share de cada hora en 2024 (secuencial)
//   cambio   share 2024 − share 2020, en puntos (divergente: azul perdió, rojo ganó)
//   meses    entradas de cada mes sobre enero–febrero 2020 (secuencial)
// Debajo, dos tiras sincronizadas con las columnas: la forma del sistema y, según
// la lente, dónde se movió el día o la composición tarifaria.
// Las celdas van en canvas; ejes, bandas y resaltes en SVG encima.

import { estado } from '../estado.js';
import { fmt, tooltip, cssVar, colorTipo, BOROUGHS, NOMBRE_CONF } from '../util.js';

const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const FASES = [
  ['Antes', '2020-01', '2020-02'],
  ['Cierre', '2020-03', '2020-06'],
  ['Recuperación', '2020-07', '2022-12'],
  ['Meseta', '2023-01', '2024-12'],
];

export function matriz(cont, opts) {
  const o = Object.assign({ modelo: null, lente: 'forma', orden: 'asym', onLente: null }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const M = o.modelo, est = M.estaciones, meses = M.meta.meses;
  const iMes = new Map(meses.map((m, i) => [m, i]));
  const ANCHO_ETQ = 150, ALTO_CAB = 54, ALTO_TIRA1 = 92, ALTO_TIRA2 = 70, GAP_GRUPO = 7;

  const root = d3.select(el).classed('matriz', true).html('');
  const capa = root.append('div').attr('class', 'matriz-capa');
  const canvas = capa.append('canvas');
  const ctx = canvas.node().getContext('2d');
  const svg = capa.append('svg').attr('class', 'matriz-svg');
  const gBandas = svg.append('g');
  const gCab = svg.append('g');
  const gGrupos = svg.append('g');
  const gTiras = svg.append('g');
  const gRes = svg.append('g').attr('class', 'resalte');
  const etiquetaFila = capa.append('div').attr('class', 'matriz-etq').style('display', 'none');

  // perfil 168 h del sistema, ponderado por volumen (el modelo trae solo el de 24 h)
  const sis168 = { pre: new Array(168).fill(0), cur: new Array(168).fill(0) };
  { let wp = 0, wc = 0; est.forEach(e => { for (let i = 0; i < 168; i++) { sis168.pre[i] += e.pre[i] * e.dPre; sis168.cur[i] += e.cur[i] * e.d24; } wp += e.dPre; wc += e.d24; });
    for (let i = 0; i < 168; i++) { sis168.pre[i] /= wp; sis168.cur[i] /= wc; } }
  const baseEst = new Map(est.map(e => [e.id, (e.ms[0] + e.ms[1]) / 2 || 1]));
  const indiceSis = M.sistema.serie.map(s => s.v / M.meta.base);

  // escalas de color
  const p98 = (arr) => d3.quantile(arr.slice().sort(d3.ascending), 0.98);
  const maxForma = p98(est.flatMap(e => e.cur));
  const maxCambio = p98(est.flatMap(e => e.cur.map((v, i) => Math.abs(v - e.pre[i]))));
  const rampa = d3.interpolateRgbBasis([cssVar('--superficie'), cssVar('--azul-300'), cssVar('--azul-700')]);
  const colForma = d3.scaleSequential([0, maxForma], rampa).clamp(true);
  const colCambio = d3.scaleDiverging([-maxCambio, 0, maxCambio], t => t < .5 ? d3.interpolateRgb(cssVar('--neg'), cssVar('--cero'))(t * 2) : d3.interpolateRgb(cssVar('--cero'), cssVar('--pos'))((t - .5) * 2)).clamp(true);
  const colMeses = d3.scaleSequential([0, 1], rampa).clamp(true);

  let lente = o.lente, orden = o.orden, enfoque = null, filas = [], grupos = [], W, H, altoMat, xs, hover = null;
  const nCols = () => lente === 'meses' ? meses.length : 168;
  const valor = (e, j) => lente === 'forma' ? e.cur[j] : lente === 'cambio' ? e.cur[j] - e.pre[j] : e.ms[j] / baseEst.get(e.id);
  const color = (v) => lente === 'forma' ? colForma(v) : lente === 'cambio' ? colCambio(v) : colMeses(v);

  const CLAVES = {
    asym: (a, b) => d3.descending(a.asymPre, b.asymPre),
    aplan: (a, b) => d3.ascending(a.aplan ?? 1, b.aplan ?? 1),
    rec: (a, b) => d3.descending(a.rec ?? -1, b.rec ?? -1),
    vol: (a, b) => d3.descending(a.d24, b.d24),
    nom: (a, b) => d3.ascending(a.n, b.n),
  };

  function ordenar() {
    const bs = enfoque ? [enfoque] : BOROUGHS;
    grupos = []; filas = [];
    bs.forEach(b => {
      const es = est.filter(e => e.b === b).sort(CLAVES[orden]);
      if (!es.length) return;
      grupos.push({ b, desde: filas.length, n: es.length });
      filas.push(...es);
    });
  }

  function medir() {
    const r = el.getBoundingClientRect();
    W = r.width; H = r.height;
    altoMat = Math.max(120, H - ALTO_CAB - ALTO_TIRA1 - ALTO_TIRA2 - 16);
    xs = d3.scaleLinear().domain([0, nCols()]).range([ANCHO_ETQ, W - 8]);
    const dpr = devicePixelRatio || 1;
    canvas.attr('width', W * dpr).attr('height', H * dpr).style('width', W + 'px').style('height', H + 'px');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    svg.attr('width', W).attr('height', H);
  }

  const altoFila = () => (altoMat - GAP_GRUPO * (grupos.length - 1)) / filas.length;
  function yFila(i) {
    const h = altoFila();
    let g = 0; for (let k = 0; k < grupos.length; k++) if (i >= grupos[k].desde) g = k;
    return ALTO_CAB + i * h + g * GAP_GRUPO;
  }

  function pintarCeldas() {
    ctx.clearRect(0, 0, W, altoMat + ALTO_CAB);
    const h = altoFila(), n = nCols(), cw = xs(1) - xs(0);
    filas.forEach((e, i) => {
      const y = yFila(i), vis = estado.esVisible(e);
      ctx.globalAlpha = vis ? 1 : 0.12;
      for (let j = 0; j < n; j++) { ctx.fillStyle = color(valor(e, j)); ctx.fillRect(xs(j), y, cw + 0.4, h + 0.4); }
      // franja de tipo a la izquierda de la fila
      ctx.fillStyle = colorTipo(e.tipo); ctx.fillRect(ANCHO_ETQ - 6, y, 4, h + 0.4);
      if (e.conf.nivel !== 'solida') { ctx.fillStyle = cssVar('--' + e.conf.nivel); ctx.fillRect(ANCHO_ETQ - 11, y, 3, h + 0.4); }
    });
    ctx.globalAlpha = 1;
  }

  function pintarCabecera() {
    gCab.selectAll('*').remove(); gBandas.selectAll('*').remove();
    const y0 = ALTO_CAB, y1 = ALTO_CAB + altoMat;
    if (lente !== 'meses') {
      // bandas de día, ventanas de pico (6–10, 16–20) en días laborables
      for (let d = 0; d < 7; d++) {
        const x0 = xs(d * 24), x1 = xs(d * 24 + 24);
        gCab.append('rect').attr('x', x0 + 1).attr('y', 4).attr('width', x1 - x0 - 2).attr('height', 16).attr('class', d === 0 || d === 6 ? 'banda-fin' : 'banda-lab');
        gCab.append('text').attr('x', (x0 + x1) / 2).attr('y', 16).attr('text-anchor', 'middle').attr('class', 'cab-dia').text(DIAS_LARGO[d]);
        [0, 6, 12, 18].forEach(hh => gCab.append('text').attr('x', xs(d * 24 + hh) + 1).attr('y', 36).attr('class', 'cab-hora').text(hh));
        if (d > 0 && d < 6) [[6, 10, 'AM'], [16, 20, 'PM']].forEach(([a, b]) => gBandas.append('rect').attr('x', xs(d * 24 + a)).attr('y', y0).attr('width', xs(b) - xs(0)).attr('height', y1 - y0).attr('class', 'ventana'));
        if (d > 0) gBandas.append('line').attr('x1', x0).attr('x2', x0).attr('y1', y0 - 6).attr('y2', y1 + ALTO_TIRA1 + ALTO_TIRA2 + 8).attr('class', 'sep-dia');
      }
      gCab.append('text').attr('x', xs(24 + 8)).attr('y', 49).attr('class', 'cab-nota').attr('text-anchor', 'middle').text('6–10 h');
      gCab.append('text').attr('x', xs(24 + 18)).attr('y', 49).attr('class', 'cab-nota').attr('text-anchor', 'middle').text('16–20 h');
    } else {
      FASES.forEach(([nom, a, b]) => {
        const x0 = xs(iMes.get(a)), x1 = xs(iMes.get(b) + 1);
        gCab.append('rect').attr('x', x0 + 1).attr('y', 4).attr('width', x1 - x0 - 2).attr('height', 16).attr('class', 'banda-fase fase-' + nom.toLowerCase().replace('ó', 'o'));
        gCab.append('text').attr('x', (x0 + x1) / 2).attr('y', 16).attr('text-anchor', 'middle').attr('class', 'cab-dia').text(nom);
        gBandas.append('line').attr('x1', x0).attr('x2', x0).attr('y1', y0 - 6).attr('y2', y1 + ALTO_TIRA1 + ALTO_TIRA2 + 8).attr('class', 'sep-dia');
      });
      meses.forEach((m, i) => { if (m.endsWith('-01')) gCab.append('text').attr('x', xs(i) + 2).attr('y', 36).attr('class', 'cab-hora').text(m.slice(0, 4)); });
      // ventana de comparación y cruce de OMNY
      const [ca, cb] = M.meta.ventanaCmp;
      gBandas.append('rect').attr('x', xs(iMes.get(ca))).attr('y', y0).attr('width', xs(iMes.get(cb) + 1) - xs(iMes.get(ca))).attr('height', y1 - y0).attr('class', 'ventana-cmp');
      gCab.append('text').attr('x', xs(iMes.get(ca))).attr('y', 49).attr('class', 'cab-nota').attr('text-anchor', 'end').text('ventana de comparación ▸');
      if (M.tarifas.cruceOmny50) {
        const xo = xs(iMes.get(M.tarifas.cruceOmny50));
        gBandas.append('line').attr('x1', xo).attr('x2', xo).attr('y1', y0).attr('y2', y1 + ALTO_TIRA1 + ALTO_TIRA2 + 8).attr('class', 'marca-evento');
      }
    }
  }

  function pintarGrupos() {
    gGrupos.selectAll('*').remove();
    const h = altoFila();
    grupos.forEach(g => {
      const y0 = yFila(g.desde), y1 = y0 + g.n * h;
      const t = gGrupos.append('g').attr('class', 'grupo').style('cursor', 'pointer')
        .on('click', () => { enfoque = enfoque === g.b ? null : g.b; redibujar(); });
      t.append('rect').attr('x', 0).attr('y', y0).attr('width', ANCHO_ETQ - 14).attr('height', y1 - y0).attr('fill', 'transparent');
      t.append('text').attr('x', 2).attr('y', y0 + Math.min(14, (y1 - y0) / 2 + 4)).attr('class', 'grupo-nombre').text(g.b);
      if (y1 - y0 > 26) t.append('text').attr('x', 2).attr('y', y0 + 28).attr('class', 'grupo-n').text(`${g.n} estaciones`);
      t.append('title').text(enfoque ? 'Volver a todos los boroughs' : `Ver solo ${g.b}`);
    });
    if (enfoque) gGrupos.append('text').attr('x', 2).attr('y', ALTO_CAB + altoMat - 4).attr('class', 'grupo-n').text('clic en el nombre para volver');
  }

  function pintarTiras() {
    gTiras.selectAll('*').remove();
    const yA = ALTO_CAB + altoMat + 8, yB = yA + ALTO_TIRA1 + 6;
    const n = nCols();
    const etq = (y, t) => gTiras.append('text').attr('x', 2).attr('y', y + 12).attr('class', 'tira-titulo').text(t);
    if (lente !== 'meses') {
      // tira 1: forma del sistema, 168 h, antes (área gris) y 2024 (línea)
      const y = d3.scaleLinear([0, d3.max(sis168.pre) * 1.05], [yA + ALTO_TIRA1 - 4, yA + 6]);
      const area = d3.area().x((d, i) => xs(i + .5)).y0(y(0)).y1(d => y(d)).curve(d3.curveMonotoneX);
      const linea = d3.line().x((d, i) => xs(i + .5)).y(d => y(d)).curve(d3.curveMonotoneX);
      gTiras.append('path').attr('d', area(sis168.pre)).attr('class', 'area-antes');
      gTiras.append('path').attr('d', linea(sis168.cur)).attr('class', 'linea-ahora');
      etq(yA, 'forma del sistema'); gTiras.append('text').attr('x', 2).attr('y', yA + 26).attr('class', 'tira-sub').text('gris 2020 · negro 2024');
      // tira 2: dónde se movió el día (2024 − 2020), barras divergentes
      const dif = sis168.cur.map((v, i) => v - sis168.pre[i]);
      const y2 = d3.scaleLinear([-d3.max(dif, Math.abs), d3.max(dif, Math.abs)], [yB + ALTO_TIRA2 - 4, yB + 4]);
      gTiras.append('line').attr('x1', xs(0)).attr('x2', xs(n)).attr('y1', y2(0)).attr('y2', y2(0)).attr('class', 'eje-cero');
      gTiras.selectAll('rect.dif').data(dif).join('rect').attr('class', 'dif').attr('x', (d, i) => xs(i) + .3).attr('width', xs(1) - xs(0) - .6)
        .attr('y', d => Math.min(y2(0), y2(d))).attr('height', d => Math.abs(y2(d) - y2(0))).attr('fill', d => d < 0 ? cssVar('--neg') : cssVar('--pos'));
      etq(yB, 'dónde se movió el día'); gTiras.append('text').attr('x', 2).attr('y', yB + 26).attr('class', 'tira-sub').text('azul perdió share · rojo ganó');
    } else {
      // tira 1: índice del sistema sobre enero–febrero 2020
      const y = d3.scaleLinear([0, 1.05], [yA + ALTO_TIRA1 - 4, yA + 6]);
      const area = d3.area().x((d, i) => xs(i + .5)).y0(y(0)).y1(d => y(d));
      gTiras.append('path').attr('d', area(indiceSis)).attr('class', 'area-indice');
      gTiras.append('path').attr('d', d3.line().x((d, i) => xs(i + .5)).y(d => y(d))(indiceSis)).attr('class', 'linea-ahora');
      [0.5, 1].forEach(v => { gTiras.append('line').attr('x1', xs(0)).attr('x2', xs(n)).attr('y1', y(v)).attr('y2', y(v)).attr('class', 'eje-cero'); gTiras.append('text').attr('x', xs(n) - 2).attr('y', y(v) - 2).attr('text-anchor', 'end').attr('class', 'tira-sub').text(fmt.pct(v)); });
      etq(yA, 'entradas del sistema'); gTiras.append('text').attr('x', 2).attr('y', yA + 26).attr('class', 'tira-sub').text('sobre enero–febrero 2020');
      // tira 2: cómo se paga — OMNY y abono de 30 días
      const T = M.tarifas, s30 = T.series['Metrocard - Unlimited 30-Day'], som = T.omny;
      const y2 = d3.scaleLinear([0, Math.max(d3.max(som), d3.max(s30)) * 1.05], [yB + ALTO_TIRA2 - 4, yB + 6]);
      const l2 = d3.line().x((d, i) => xs(i + .5)).y(d => y2(d));
      gTiras.append('path').attr('d', l2(som)).attr('class', 'linea-serie').attr('stroke', cssVar('--azul-500'));
      gTiras.append('path').attr('d', l2(s30)).attr('class', 'linea-serie').attr('stroke', cssVar('--residencial'));
      etq(yB, 'cómo se paga'); gTiras.append('text').attr('x', 2).attr('y', yB + 26).attr('class', 'tira-sub').html('');
      gTiras.append('text').attr('x', 2).attr('y', yB + 26).attr('class', 'tira-sub').attr('fill', cssVar('--azul-500')).text('OMNY');
      gTiras.append('text').attr('x', 40).attr('y', yB + 26).attr('class', 'tira-sub').attr('fill', cssVar('--residencial')).text('abono 30 días');
    }
    gTiras.append('text').attr('x', xs(n)).attr('y', yA + ALTO_TIRA1 + ALTO_TIRA2 + 12).attr('text-anchor', 'end').attr('class', 'tira-sub').text(lente !== 'meses' ? 'share del total de la semana, ponderado por volumen' : 'share del total de pagos del mes');
  }

  function pintarResalte() {
    gRes.selectAll('*').remove();
    etiquetaFila.style('display', 'none');
    const h = altoFila(), n = nCols();
    const marcar = (e, clase) => {
      const i = filas.indexOf(e); if (i < 0) return;
      const y = yFila(i);
      gRes.append('rect').attr('x', xs(0) - 1).attr('y', y - 1).attr('width', xs(n) - xs(0) + 2).attr('height', h + 2).attr('class', clase);
      return y;
    };
    if (estado.seleccion) {
      const e = estado.estacion(estado.seleccion), y = marcar(e, 'fila-sel');
      if (y != null) gRes.append('text').attr('x', ANCHO_ETQ - 16).attr('y', Math.max(ALTO_CAB + 10, Math.min(y + h / 2 + 4, ALTO_CAB + altoMat - 2))).attr('text-anchor', 'end').attr('class', 'fila-sel-etq').text(e.n.split('(')[0].trim());
    }
    if (hover) {
      const { e, j } = hover;
      const y = marcar(e, 'fila-hover');
      gRes.append('rect').attr('x', xs(j)).attr('y', ALTO_CAB).attr('width', xs(1) - xs(0)).attr('height', altoMat + ALTO_TIRA1 + ALTO_TIRA2 + 14).attr('class', 'col-hover');
      etiquetaFila.style('display', 'block').style('top', Math.max(ALTO_CAB, Math.min(y - 10, ALTO_CAB + altoMat - 24)) + 'px')
        .html(`<b>${e.n}</b><span>${e.b} · <i style="color:${colorTipo(e.tipo)}">${e.tipo}</i>${e.conf.nivel !== 'solida' ? ' · ' + NOMBRE_CONF[e.conf.nivel] : ''}</span>`);
    }
  }

  function redibujar() { if (el.getBoundingClientRect().width < 200 || el.getBoundingClientRect().height < 200) return; ordenar(); medir(); pintarCeldas(); pintarCabecera(); pintarGrupos(); pintarTiras(); pintarResalte(); }

  // interacción sobre el lienzo
  capa.on('mousemove', ev => {
    const [mx, my] = d3.pointer(ev, capa.node());
    const h = altoFila();
    if (mx < xs(0) || mx > xs(nCols()) || my < ALTO_CAB || my > ALTO_CAB + altoMat) { if (hover) { hover = null; pintarResalte(); tooltip(null); } return; }
    const j = Math.floor(xs.invert(mx));
    // fila: buscar por grupos (hay huecos entre ellos)
    let i = -1;
    for (const g of grupos) { const y0 = yFila(g.desde); if (my >= y0 && my < y0 + g.n * h) { i = g.desde + Math.floor((my - y0) / h); break; } }
    if (i < 0) { if (hover) { hover = null; pintarResalte(); tooltip(null); } return; }
    const e = filas[i];
    hover = { e, j }; pintarResalte();
    const v = valor(e, j);
    const que = lente === 'forma' ? `share de esta hora en 2024: <b>${fmt.pct(v, 2)}</b> (2020: ${fmt.pct(e.pre[j], 2)})`
      : lente === 'cambio' ? `cambio del share: <b>${(v * 100 > 0 ? '+' : '') + (v * 100).toFixed(2)} pp</b> (${fmt.pct(e.pre[j], 2)} → ${fmt.pct(e.cur[j], 2)})`
      : `entradas de ${fmt.mes(meses[j])} sobre ene–feb 2020: <b>${fmt.pct(v)}</b>`;
    const cuando = lente !== 'meses' ? `${DIAS_LARGO[Math.floor(j / 24)]}, ${j % 24} h` : fmt.mes(meses[j]);
    tooltip(`<b>${e.n}</b><div class="fila"><span>${e.b}</span><span style="color:${colorTipo(e.tipo)}">${e.tipo}</span></div>
      <div class="fila"><span>${cuando}</span></div><div>${que}</div>
      <div class="fila"><span>recuperación</span><span>${fmt.pct(e.rec)}</span></div><div class="fila"><span>pico de la mañana</span><span>${fmt.cambio(e.aplan)}</span></div>
      <div class="enc">clic: abrir la evidencia de la estación</div>`, ev);
  }).on('mouseleave', () => { hover = null; pintarResalte(); tooltip(null); })
    .on('click', () => { if (hover) estado.seleccionar(hover.e.id); });

  const ro = new ResizeObserver(() => redibujar()); ro.observe(el);
  redibujar();
  return {
    update() { pintarCeldas(); pintarResalte(); },
    lente(l) { if (l === lente) return; lente = l; redibujar(); },
    orden(k) { orden = k; redibujar(); },
    enfocar(b) { enfoque = b; redibujar(); },
    leyenda() {
      if (lente === 'forma') return { titulo: 'share de la hora, 2024', grad: [cssVar('--superficie'), cssVar('--azul-300'), cssVar('--azul-700')], ext: ['0', fmt.pct(maxForma, 1) + ' o más'] };
      if (lente === 'cambio') return { titulo: 'share 2024 − 2020', grad: [cssVar('--neg'), cssVar('--cero'), cssVar('--pos')], ext: ['perdió ' + (maxCambio * 100).toFixed(1) + ' pp', 'igual', 'ganó ' + (maxCambio * 100).toFixed(1) + ' pp'] };
      return { titulo: 'mes sobre ene–feb 2020', grad: [cssVar('--superficie'), cssVar('--azul-300'), cssVar('--azul-700')], ext: ['0', '100 % o más'] };
    },
    destruir() { ro.disconnect(); root.html(''); },
  };
}
