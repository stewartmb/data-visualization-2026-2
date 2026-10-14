// La forma del día — punto de entrada.
// Carga el modelo y la geografía, construye la narrativa a partir de los
// capítulos, monta el explorador enlazado y el panel de evidencia.

import { estado } from './estado.js';
import { capitulos } from './capitulos.js';
import { fmt, NOMBRE_CONF } from './util.js';
import { mapa } from './graficos/mapa.js';
import { multiples } from './graficos/multiples.js';
import { panelEstacion } from './panel-estacion.js';
import { matriz } from './graficos/matriz.js';

const ETIQUETA_TIPO = { positivo: 'hallazgo', negativo: 'lo que no se sostiene', limite: 'límite' };

Promise.all([d3.json('data/model.json'), d3.json('data/geo.json')]).then(([M, G]) => {
  estado.init(M, G);
  document.body.classList.add('app');
  const caps = capitulos(M, G);
  construirHallazgos(M, caps);
  construirPerfiles(M);
  construirRecorrido(caps);
  montarExplorador(M, G);
  montarPestanas();
  montarClave();
  montarTema();
  document.querySelector('#cargando').remove();
  const h = location.hash.slice(1);
  if (['perfiles', 'recorrido', 'explorador'].includes(h)) irA(h);
}).catch(err => {
  document.querySelector('#cargando').textContent = 'No se pudieron cargar los datos. Hay que servir la carpeta por HTTP (python3 -m http.server).';
  console.error(err);
});

// ============================================================ pestañas
function irA(vista) {
  d3.selectAll('.vista').classed('oculta', function () { return this.dataset.vista !== vista; });
  d3.selectAll('#pestanas button').classed('activa', function () { return this.dataset.vista === vista; });
  history.replaceState(null, '', '#' + vista);
  // los gráficos miden su contenedor al dibujar: avisar que cambió el tamaño visible
  requestAnimationFrame(() => dispatchEvent(new Event('resize')));
}
function montarPestanas() {
  d3.selectAll('#pestanas button').on('click', function () { irA(this.dataset.vista); });
}

// ============================================================ vista 1 · hallazgos + perfiles
function construirHallazgos(M, caps) {
  const cont = d3.select('#hallazgos');
  M.hallazgos.forEach(h => {
    const cap = caps.find(c => (c.hallazgo && c.hallazgo.id === h.id) || (c.hallazgo2 && c.hallazgo2.id === h.id));
    const b = cont.append('button').attr('class', 'hallazgo-card').attr('title', 'Abrir en el recorrido');
    b.classed(h.tipo, true).attr('title', h.tipo === 'negativo' ? 'Lo que no se sostiene · abrir en el recorrido' : h.tipo === 'limite' ? 'Límite · abrir en el recorrido' : 'Abrir en el recorrido');
    b.append('div').attr('class', 'n').html(`<span>${h.numero}</span><span class="tipo ${h.tipo}">${ETIQUETA_TIPO[h.tipo]}</span>`);
    b.append('div').attr('class', 't').text(h.titulo);
    b.on('click', () => { irA('recorrido'); if (cap) mostrarCapitulo(caps.indexOf(cap)); });
  });
}

let vMatriz = null;
function construirPerfiles(M) {
  vMatriz = matriz('#matriz-expl', { modelo: M, lente: 'forma', orden: 'asym' });
  const leyenda = () => {
    const l = vMatriz.leyenda();
    d3.select('#matriz-leyenda').html(`<b>${l.titulo}</b><span>${l.ext[0]}</span><i class="barra-color" style="background:linear-gradient(90deg,${l.grad.join(',')})"></i><span>${l.ext[l.ext.length - 1]}</span>`);
  };
  d3.selectAll('#lentes-matriz button').on('click', function () {
    d3.selectAll('#lentes-matriz button').classed('activo', b => b === this);
    const l = this.dataset.lente;
    if (l === 'meses' && d3.select('#orden-matriz').property('value') === 'asym') { d3.select('#orden-matriz').property('value', 'rec'); vMatriz.orden('rec'); }
    vMatriz.lente(l); leyenda();
  });
  d3.select('#orden-matriz').on('change', function () { vMatriz.orden(this.value); });
  d3.selectAll('#submodo button').on('click', function () {
    d3.selectAll('#submodo button').classed('activo', b => b === this);
    const m = this.dataset.modo;
    d3.select('#tarjeta-matriz').classed('oculta', m !== 'matriz');
    d3.select('#tarjeta-multiples-p').classed('oculta', m !== 'rejilla');
    requestAnimationFrame(() => dispatchEvent(new Event('resize')));
  });
  leyenda();
  // filtros (escriben en el estado compartido)
  d3.select('#filtro-borough-p').on('change', function () { estado.fijarBoroughs(this.value ? new Set([this.value]) : null); });
  d3.select('#filtro-tipo-p').on('change', function () { estado.fijarTipos(this.value ? new Set([this.value]) : null); });
}

// ============================================================ vista 2 · recorrido
let capActual = 0, capsRef = null, playTimer = null;
function construirRecorrido(caps) {
  capsRef = caps;
  const barra = d3.select('#capitulos-barra');
  caps.forEach((c, i) => barra.append('button').attr('role', 'tab').text(c.hero ? 'Inicio' : `${c.numero} · ${c.etiqueta || c.pregunta}`).on('click', () => mostrarCapitulo(i)));
  d3.select('#cap-prev').on('click', () => mostrarCapitulo(Math.max(0, capActual - 1)));
  d3.select('#cap-next').on('click', () => mostrarCapitulo(Math.min(caps.length - 1, capActual + 1)));
  d3.select('#cap-play').on('click', function () {
    if (playTimer) { clearInterval(playTimer); playTimer = null; d3.select(this).text('Play'); return; }
    d3.select(this).text('Pausa');
    playTimer = setInterval(() => { if (capActual >= caps.length - 1) { clearInterval(playTimer); playTimer = null; d3.select('#cap-play').text('Play'); return; } mostrarCapitulo(capActual + 1); }, 9000);
  });
  document.addEventListener('keydown', ev => {
    if (document.querySelector('#recorrido').classList.contains('oculta')) return;
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
    if (ev.key === 'ArrowRight') mostrarCapitulo(Math.min(caps.length - 1, capActual + 1));
    if (ev.key === 'ArrowLeft') mostrarCapitulo(Math.max(0, capActual - 1));
  });
  mostrarCapitulo(0);
}
function mostrarCapitulo(i) {
  const caps = capsRef, c = caps[i]; capActual = i;
  d3.selectAll('#capitulos-barra button').classed('activa', (_, j) => j === i);
  const t = d3.select('#recorrido-texto').html('');
  const lienzo = d3.select('#recorrido-lienzo').html('');
  t.append('div').attr('class', 'numero').text(c.hero ? 'Inicio' : `Capítulo ${c.numero} de ${caps.length - 1}`);
  t.append('h2').attr('class', 'pregunta').text(c.pregunta);
  [c.hallazgo, c.hallazgo2].filter(Boolean).forEach(h => t.append('p').attr('class', 'hallazgo').html(`<span class="tipo ${h.tipo}">${ETIQUETA_TIPO[h.tipo]}</span>${h.titulo}`));
  if (c.hero && c.claves) {
    const cl = t.append('div').attr('class', 'claves');
    c.claves.forEach(([b, s]) => { const k = cl.append('div').attr('class', 'clave'); k.append('b').text(b); k.append('span').text(s); });
  }
  if (c.marcas) {
    t.append('div').attr('class', 'marcas-titulo').text('Qué significa cada marca');
    const m = t.append('ul').attr('class', 'marcas');
    c.marcas.forEach(x => m.append('li').html(x));
  }
  const acc = t.append('div').attr('class', 'acciones');
  if (c.notas) {
    const btn = acc.append('button').attr('class', 'boton chico').text('Notas: cómo se mide, qué no demuestra');
    const notas = t.append('div').attr('class', 'notas oculta');
    c.notas.forEach(([tt, x]) => { notas.append('b').text(tt); notas.append('p').text(x); });
    btn.on('click', () => { const ab = notas.classed('oculta'); notas.classed('oculta', !ab); btn.classed('activo', ab); });
  }
  if (c.preset) acc.append('button').attr('class', 'boton chico').text('Ver estas estaciones en el mapa').on('click', () => { estado.aplicarPreset(c.preset); irA('explorador'); });
  const fig = lienzo.append('div').attr('class', 'figura');
  c.render(fig.node());
  requestAnimationFrame(() => dispatchEvent(new Event('resize')));
}

// ============================================================ vista 3 · mapa
function montarExplorador(M, G) {
  const vMapa = mapa('#mapa-expl', { modelo: M, geo: G, radioMax: 16, tamanoPorRango: false });
  const vMult = multiples('#multiples-expl', { modelo: M, contador: '#contador-multiples', selOrden: '#orden-multiples' });
  const panel = panelEstacion('#panel-estacion');
  const vistas = [vMapa, vMult, panel, vMatriz];
  estado.lente = 'forma';

  d3.selectAll('#lentes button').on('click', function () { estado.fijarLente(this.dataset.lente); });
  d3.select('#filtro-borough').on('change', function () { estado.fijarBoroughs(this.value ? new Set([this.value]) : null); });
  d3.select('#filtro-tipo').on('change', function () { estado.fijarTipos(this.value ? new Set([this.value]) : null); });
  d3.select('#filtro-conf').on('change', function () { estado.fijarSoloConfiables(this.checked); });
  d3.select('#limpiar-todo').on('click', () => estado.limpiarTodo());

  function pintarBarra() {
    const vis = estado.visibles(), tot = M.estaciones.length;
    const sel = estado.seleccion ? estado.estacion(estado.seleccion) : null;
    d3.select('#estado-bar').html(`<b>${vis.length}</b> de ${tot} estaciones${estado.origen ? ` · desde ${estado.origen}` : ''}${sel ? ` · <b>${sel.n}</b>` : ''}`);
    d3.selectAll('#lentes button').classed('activo', function () { return this.dataset.lente === estado.lente; });
    d3.select('#filtro-borough').property('value', estado.boroughs ? [...estado.boroughs][0] : '');
    d3.select('#filtro-borough-p').property('value', estado.boroughs ? [...estado.boroughs][0] : '');
    d3.select('#filtro-tipo-p').property('value', estado.tipos ? [...estado.tipos][0] : '');
    d3.select('#filtro-tipo').property('value', estado.tipos ? [...estado.tipos][0] : '');
    d3.select('#filtro-conf').property('checked', estado.soloConfiables);
  }
  const redibujar = () => { vistas.forEach(v => v.update()); pintarBarra(); };
  estado.onChange(redibujar);
  redibujar();
}

// ============================================================ tema
// Sigue el modo del sistema salvo que el lector elija uno; la elección se recuerda.
function montarTema() {
  const boton = d3.select('#tema');
  const esOscuro = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const pintar = () => boton.text(esOscuro() ? 'Modo claro' : 'Modo oscuro');
  boton.on('click', () => {
    const nuevo = esOscuro() ? 'light' : 'dark';
    document.documentElement.dataset.theme = nuevo;
    try { localStorage.setItem('tema', nuevo); } catch (e) {}
    pintar();
    location.reload();
  });
  pintar();
}

// ============================================================ clave visual
function montarClave() {
  const clave = d3.select('#clave-visual');
  const abrir = () => clave.classed('abierta', true);
  const cerrar = () => clave.classed('abierta', false);
  d3.select('#abrir-clave').on('click', abrir);
  d3.select('#abrir-clave-barra').on('click', () => clave.classed('abierta', !clave.classed('abierta')));
  clave.select('.cerrar').on('click', cerrar);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrar(); });
}
