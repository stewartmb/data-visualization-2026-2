// La forma del día — punto de entrada.
// Carga el modelo y la geografía, construye la narrativa a partir de los
// capítulos, monta el explorador enlazado y el panel de evidencia.

import { estado } from './estado.js';
import { capitulos } from './capitulos.js';
import { fmt, NOMBRE_CONF } from './util.js';
import { mapa } from './graficos/mapa.js';
import { dispersion } from './graficos/dispersion.js';
import { multiples } from './graficos/multiples.js';
import { serieMensual } from './graficos/serie.js';
import { panelEstacion } from './panel-estacion.js';

const ETIQUETA_TIPO = { positivo: 'hallazgo', negativo: 'lo que no se sostiene', limite: 'límite' };

Promise.all([d3.json('data/model.json'), d3.json('data/geo.json')]).then(([M, G]) => {
  estado.init(M, G);
  construirNarrativa(M, G);
  montarExplorador(M, G);
  montarClave();
  montarTema();
  document.querySelector('#cargando').remove();
}).catch(err => {
  document.querySelector('#cargando').textContent = 'No se pudieron cargar los datos. Hay que servir la carpeta por HTTP (python3 -m http.server).';
  console.error(err);
});

// ============================================================ narrativa
function construirNarrativa(M, G) {
  const caps = capitulos(M, G);
  const cont = d3.select('#narrativa');
  const prog = d3.select('#progreso');

  caps.forEach(c => {
    const sec = cont.append('section').attr('class', 'capitulo' + (c.hero ? ' hero' : '')).attr('id', c.id);
    const i = sec.append('div').attr('class', 'interior');
    if (c.hero) {
      i.append('h1').attr('class', 'pregunta').text(c.pregunta);
      i.append('p').attr('class', 'sub').text(c.sub);
      const fig = i.append('div').attr('class', 'figura');
      c.render(fig.node());
      const cl = i.append('div').attr('class', 'claves');
      c.claves.forEach(([b, s]) => { const k = cl.append('div').attr('class', 'clave'); k.append('b').text(b); k.append('span').text(s); });
      i.append('div').attr('class', 'acciones').html(`<a class="boton primario" href="#volumen">Empezar a leer</a><a class="boton" href="#explorador">Ir al explorador</a><button class="boton" id="abrir-clave">Qué significa cada marca</button>`);
    } else {
      i.append('div').attr('class', 'numero').text(`Capítulo ${c.numero} de ${caps.length - 1}`);
      i.append('h2').attr('class', 'pregunta').text(c.pregunta);
      const h = c.hallazgo;
      i.append('p').attr('class', 'hallazgo').html(`<span class="tipo ${h.tipo}">${ETIQUETA_TIPO[h.tipo]}</span>${h.titulo}`);
      i.append('p').attr('class', 'cuerpo').text(c.cuerpo || h.cuerpo);
      if (c.cuerpo) i.append('p').attr('class', 'cuerpo').style('margin-top', '8px').style('color', 'var(--tinta-3)').style('font-size', 'var(--t-m)').text(h.cuerpo);
      const fig = i.append('div').attr('class', 'figura');
      c.render(fig.node());
      if (c.pie) {
        const p = i.append('div').attr('class', 'pie');
        c.pie.forEach(([t, x]) => p.append('div').html(`<b>${t}</b>${x}`));
      }
      const acc = i.append('div').attr('class', 'acciones');
      if (c.preset) acc.append('button').attr('class', 'boton').text('Ver estas estaciones en el explorador').on('click', () => {
        estado.aplicarPreset(c.preset);
        document.querySelector('#explorador').scrollIntoView({ behavior: 'smooth' });
      });
      const sig = caps[caps.indexOf(c) + 1];
      if (sig) acc.append('a').attr('class', 'boton').attr('href', '#' + sig.id).text(`Capítulo ${sig.numero}: ${sig.pregunta}`);
      else acc.append('a').attr('class', 'boton primario').attr('href', '#explorador').text('Explorar los datos');
    }
    prog.append('a').attr('href', '#' + c.id).attr('title', c.hero ? 'Inicio' : `${c.numero} · ${c.pregunta}`).attr('aria-label', c.hero ? 'Inicio' : c.pregunta);
  });
  prog.append('a').attr('href', '#explorador').attr('title', 'Explorador').attr('aria-label', 'Explorador');

  // progreso: qué sección está a la vista
  const secciones = [...document.querySelectorAll('section.capitulo, section.explorador')];
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { const id = en.target.id; prog.selectAll('a').classed('actual', function () { return this.getAttribute('href') === '#' + id; }); } });
  }, { rootMargin: '-45% 0px -45% 0px' });
  secciones.forEach(s => io.observe(s));

  // teclado: ← → entre capítulos
  document.addEventListener('keydown', ev => {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const ids = secciones.map(s => s.id);
    const actual = prog.select('a.actual').attr('href')?.slice(1) || ids[0];
    const i = Math.max(0, ids.indexOf(actual));
    const j = ev.key === 'ArrowRight' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
    document.getElementById(ids[j]).scrollIntoView({ behavior: 'smooth' });
  });
}

// ============================================================ explorador
function montarExplorador(M, G) {
  const vistas = [];
  const vMapa = mapa('#mapa-expl', { modelo: M, geo: G, radioMax: 14 });
  const vDisp = dispersion('#dispersion-expl', { modelo: M, brush: true });
  const vMult = multiples('#multiples-expl', { modelo: M, contador: '#contador-multiples', selOrden: '#orden-multiples' });
  const vSerie = serieMensual('#serie-expl', { serie: M.sistema.serie, base: M.meta.base, alto: 210, brush: true, onRango: r => estado.fijarRango(r) });
  const panel = panelEstacion('#panel-estacion');
  vistas.push(vMapa, vDisp, vMult, panel);

  // lentes del mapa
  d3.selectAll('#lentes button').on('click', function () { estado.fijarLente(this.dataset.lente); });
  // filtros de la barra
  d3.select('#filtro-borough').on('change', function () { estado.fijarBoroughs(this.value ? new Set([this.value]) : null); });
  d3.select('#filtro-tipo').on('change', function () { estado.fijarTipos(this.value ? new Set([this.value]) : null); });
  d3.select('#filtro-conf').on('change', function () { estado.fijarSoloConfiables(this.checked); });
  d3.select('#limpiar-todo').on('click', () => { estado.limpiarTodo(); vDisp.limpiarBrush(); vSerie.moverBrush(null); });

  function pintarBarra() {
    const vis = estado.visibles(), tot = M.estaciones.length;
    const chips = [];
    if (estado.origen) chips.push(`<span class="chip">desde ${estado.origen}</span>`);
    if (estado.boroughs) chips.push(`<span class="chip">${[...estado.boroughs].join(', ')} <button data-q="boroughs" aria-label="quitar">×</button></span>`);
    if (estado.tipos) chips.push(`<span class="chip">${[...estado.tipos].join(', ')} <button data-q="tipos" aria-label="quitar">×</button></span>`);
    if (estado.filtro) chips.push(`<span class="chip">selección en la dispersión <button data-q="filtro" aria-label="quitar">×</button></span>`);
    if (estado.rango) chips.push(`<span class="chip">${fmt.mes(estado.rango[0])} – ${fmt.mes(estado.rango[1])} <button data-q="rango" aria-label="quitar">×</button></span>`);
    if (estado.soloConfiables) chips.push(`<span class="chip">solo comparaciones sólidas <button data-q="conf" aria-label="quitar">×</button></span>`);
    const sel = estado.seleccion ? estado.estacion(estado.seleccion) : null;
    const share = estado.hayFiltro() ? ` · ${fmt.pct(d3.sum(vis, e => e.d24) / d3.sum(M.estaciones, e => e.d24))} de las entradas` : '';
    d3.select('#estado-bar').html(`<span><b>${vis.length}</b> de ${tot} estaciones${share}</span>${chips.join('')}${sel ? `<span class="chip"><b>${sel.n}</b> <button data-q="sel" aria-label="quitar">×</button></span>` : ''}${chips.length || sel ? '' : '<span class="vacio">Sin filtros. Haz clic en una estación, arrastra en la dispersión o en la serie temporal.</span>'}`);
    d3.selectAll('#estado-bar button').on('click', function () {
      const q = this.dataset.q;
      if (q === 'boroughs') { estado.fijarBoroughs(null); d3.select('#filtro-borough').property('value', ''); }
      if (q === 'tipos') { estado.fijarTipos(null); d3.select('#filtro-tipo').property('value', ''); }
      if (q === 'filtro') { estado.fijarFiltro(null); vDisp.limpiarBrush(); }
      if (q === 'rango') { estado.fijarRango(null); vSerie.moverBrush(null); }
      if (q === 'conf') { estado.fijarSoloConfiables(false); d3.select('#filtro-conf').property('checked', false); }
      if (q === 'sel') estado.limpiarSeleccion();
    });
    d3.selectAll('#lentes button').classed('activo', function () { return this.dataset.lente === estado.lente; });
    d3.select('#filtro-borough').property('value', estado.boroughs ? [...estado.boroughs][0] : '');
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
    // los gráficos leen los colores al dibujar: se recarga la página para repintar todo
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
