// Los capítulos del recorrido. Cada uno es una pregunta, el hallazgo que la
// responde (sale del modelo, no se escribe a mano), una composición de gráficos
// a pantalla completa y, plegadas, dos notas: cómo se mide y qué no demuestra.
// El panel de la izquierda solo lleva la pregunta, el hallazgo y qué significa
// cada marca; el argumento lo hace el gráfico.

import { estado } from './estado.js';
import { fmt, cssVar, colorTipo, colorConf, NOMBRE_CONF } from './util.js';
import { perfil24 } from './graficos/perfil.js';
import { mapa } from './graficos/mapa.js';
import { dispersion } from './graficos/dispersion.js';
import { tarifas } from './graficos/tarifas.js';
import { pendiente } from './graficos/pendiente.js';
import { reloj } from './graficos/reloj.js';
import { semana, perfil168 } from './graficos/semana.js';
import { tiras } from './graficos/tiras.js';
import { cinta } from './graficos/cinta.js';
import { cortes } from './graficos/cortes.js';

const ALTO = 'calc(100vh - 150px)';

/** tarjeta de gráfico que ocupa toda la altura disponible */
function tarjeta(padre, titulo, sub, alta = true) {
  const t = d3.select(padre).append('div').attr('class', 'tarjeta tarjeta-cap').style('height', alta ? ALTO : null);
  if (titulo) t.append('div').attr('class', 'titulo').text(titulo);
  if (sub) t.append('div').attr('class', 'subtitulo').text(sub);
  return t.append('div').attr('class', 'cuerpo-grafico');
}
const sw = (color, forma = 'punto') => `<i class="muestra ${forma}" style="background:${color}"></i>`;

export function capitulos(M, G) {
  const H = Object.fromEntries(M.hallazgos.map(h => [h.id, h]));
  const grandes = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx'];
  const antes = `${sw(cssVar('--antes'))} gris: enero–febrero 2020, la línea base`;
  const ahora = `${sw(cssVar('--tinta'), 'linea')} negro: 2024`;
  const tipos = ['residencial', 'mixta', 'laboral'].map(t => `${sw(colorTipo(t))} ${t}`);
  const anillo = `<i class="muestra anillo"></i> comparación poco confiable`;

  return [
    // ------------------------------------------------------------- 0 · inicio
    {
      id: 'inicio', hero: true, etiqueta: 'Inicio',
      pregunta: 'La forma del día',
      claves: [[fmt.int(M.stats.n), 'complejos de estación'], [M.meta.meses.length, 'meses, enero 2020 a diciembre 2024'], ['24 × 7', 'horas de la semana por estación'], ['120 855 568', 'registros horarios agregados']],
      marcas: [antes, ahora, `${sw(cssVar('--tinta'), 'ventana')} franjas: ventanas 6–10 h y 16–20 h`],
      render(fig) {
        const w = d3.select(fig).append('div').attr('class', 'hero-dos');
        const c1 = tarjeta(w.node(), 'El día laborable de todo el sistema, como reloj', 'medianoche arriba · el radio es el share de la hora', false);
        c1.classed('centrado', true);
        reloj(c1.node(), { pre: M.sistema.perfilPre, cur: M.sistema.perfilCur, r: 190 });
        const c2 = tarjeta(w.node(), 'El mismo día, desplegado', 'share de cada hora en el total del día laborable', false);
        perfil24(c2.node(), { pre: M.sistema.perfilPre, cur: M.sistema.perfilCur, alto: 440, animar: true, anotaciones: true, margen: { t: 22, r: 24, b: 30, l: 44 } });
      },
    },
    // ----------------------------------------------- 1 · cuánta gente volvió
    {
      id: 'volumen', numero: 1, etiqueta: 'Volumen',
      pregunta: '¿Cuánta gente volvió?',
      hallazgo: H.estanco,
      marcas: [`${sw(cssVar('--tinta'), 'linea')} sistema`, `${sw(cssVar('--pos'), 'linea')} Bronx`, `${sw(cssVar('--tinta-3'), 'linea')} Manhattan, Brooklyn, Queens`, `${sw(cssVar('--azul-100'))} banda: del 10 % al 90 % de las 428 estaciones`],
      render(fig) {
        const c = tarjeta(fig, 'Entradas de cada mes sobre enero–febrero de 2020', 'el sistema, cada borough y la banda de todas las estaciones');
        cinta(c.node(), { modelo: M });
      },
      notas: [
        ['Cómo se mide', 'Suma de entradas por mes dividida por el promedio mensual de enero–febrero de 2020, el último período completo antes de la pandemia. La banda son los percentiles 10 y 90 de las 428 estaciones, cada una sobre su propia línea base.'],
        ['Qué no demuestra', 'Son entradas a estaciones, no viajes. Y una caída de entradas puede ser menos demanda o menos servicio; esta serie no lo distingue.'],
      ],
      preset: { lente: 'rec', origen: 'capítulo 1' },
    },
    // ------------------------------------------- 2 · sigue el doble pico
    {
      id: 'forma', numero: 2, etiqueta: 'El doble pico',
      pregunta: '¿Sigue existiendo el doble pico?',
      hallazgo: H.aplano,
      marcas: [antes, ahora, `${sw(cssVar('--tinta'), 'ventana')} franjas del reloj: 6–10 h y 16–20 h`, ...tipos, `${sw(cssVar('--tinta'), 'linea')} línea negra en las tiras: mediana del borough`],
      render(fig) {
        const fila = d3.select(fig).append('div').attr('class', 'fila-paneles cuatro');
        const maxV = d3.max(grandes, b => Math.max(d3.max(M.boroughs[b].perfilPre), d3.max(M.boroughs[b].perfilCur))) * 1.05;
        grandes.forEach(b => {
          const v = M.boroughs[b];
          const t = fila.append('div').attr('class', 'tarjeta tarjeta-reloj');
          t.append('div').attr('class', 'titulo').text(b === 'Bronx' ? 'Bronx: la excepción' : b);
          t.append('div').attr('class', 'subtitulo').text(`${v.n} estaciones · pico/valle ${fmt.razon(v.pvPre)} → ${fmt.razon(v.pvCur)} · pico ${fmt.cambio(v.aplan)}`);
          reloj(t.append('div').attr('class', 'reloj-cont').node(), { pre: v.perfilPre, cur: v.perfilCur, r: 92, maxV });
          perfil24(t.append('div').attr('class', 'reloj-perfil').node(), { pre: v.perfilPre, cur: v.perfilCur, alto: 84, compacto: true, ejeY: false, maxY: maxV, margen: { t: 6, r: 8, b: 20, l: 8 } });
        });
        const c = tarjeta(fig, 'Cuánto cambió el pico de cada estación, por borough: una estación por punto', `a la izquierda del umbral, el pico se aplanó más del ${M.meta.umbrales.aplana * 100} % · color = tipo`);
        c.style('margin-top', '12px');
        tiras(c.node(), { modelo: M, grupos: grandes.map(b => ({ nombre: b, fuerte: b === 'Bronx', estaciones: M.estaciones.filter(e => e.b === b) })), valor: e => e.aplan, dominio: [-0.6, 0.3], umbral: -M.meta.umbrales.aplana, etiquetaUmbral: 'umbral −5 %', ejeTitulo: 'cambio de la razón pico/valle del día laborable, 2024 frente a enero–febrero 2020', visible: () => true, altoFila: 78 });
      },
      notas: [
        ['Cómo se mide', `Razón pico/valle: el máximo entre las 6 y las 10 h dividido por el mínimo entre las 11 y las 15 h, sobre el perfil del día laborable. Se cuenta como aplanamiento una caída mayor del ${M.meta.umbrales.aplana * 100} %.`],
        ['Qué no demuestra', 'El índice mide forma, no volumen: una estación puede aplanarse y recuperar mucho, o al revés. Tampoco dice por qué se aplanó.'],
      ],
      preset: { lente: 'aplan', origen: 'capítulo 2' },
    },
    // ------------------------------------------------- 3 · la semana
    {
      id: 'semana', numero: 3, etiqueta: 'La semana',
      pregunta: '¿Qué días de la semana cambiaron?',
      hallazgo: H.viernes,
      marcas: [`${sw(cssVar('--neg'))} azul: la hora perdió peso en la semana`, `${sw(cssVar('--pos'))} rojo: lo ganó`, `${sw(cssVar('--tinta'), 'ventana')} franjas: 6–10 h y 16–20 h`, antes, ahora],
      render(fig) {
        const grupos = [{ nombre: 'Todo el sistema', fuerte: true, ...perfil168(M.estaciones) },
          ...grandes.map(b => ({ nombre: b, fuerte: b === 'Bronx', ...perfil168(M.estaciones.filter(e => e.b === b)) })),
          ...['residencial', 'mixta', 'laboral'].map(t => ({ nombre: 'estaciones ' + (t === 'mixta' ? 'mixtas' : t === 'laboral' ? 'laborales' : 'residenciales'), ...perfil168(M.estaciones.filter(e => e.tipo === t)) }))];
        const c = tarjeta(fig, 'Share de cada una de las 168 horas de la semana: 2024 menos 2020, por grupo', 'escala común en todas las filas');
        const alto = Math.max(64, (fig.getBoundingClientRect().height - 120) / grupos.length);
        semana(c.node(), { grupos, resaltar: 'Bronx', altoFila: alto, margen: { t: 30, r: 16, b: 10, l: 170 } });
      },
      notas: [
        ['Cómo se mide', 'Perfil de 168 horas de cada grupo, ponderado por el volumen de cada estación, normalizado al total de la semana. Se resta el de enero–febrero de 2020 al de 2024 completo.'],
        ['Qué no demuestra', '2024 completo incluye feriados y verano; enero–febrero de 2020 incluye dos lunes feriados. La comparación día a día se afina con la ventana calendario comparable (pasada D del notebook).'],
      ],
      preset: { lente: 'forma', origen: 'capítulo 3' },
    },
    // --------------------------------------------- 4 · para qué se usa
    {
      id: 'tipos', numero: 4, etiqueta: 'Tipos',
      pregunta: '¿Para qué se usa cada estación?',
      hallazgo: H['una-direccion'],
      marcas: [`${sw(cssVar('--antes'))} reloj: medianoche arriba, el radio es el share de la hora; gris 2020, color 2024`, ...tipos, anillo, `${sw(cssVar('--tinta'), 'linea')} en las pendientes, la línea gruesa es la mediana del tipo`],
      render(fig) {
        const w = d3.select(fig).append('div').attr('class', 'dos-col ancha-izq');
        const c1 = tarjeta(w.node(), 'La forma del día de las 428 estaciones, sobre el mapa', 'una punta hacia las 8 es el pico de la mañana (residencial); hacia las 17, el de la tarde (laboral) · acerca para leer Manhattan');
        mapa(c1.node(), { modelo: M, geo: G, lente: 'forma', interactivo: true, zoom: true, visible: () => true, tamanoPorRango: false, radioMax: 11, escalaGlifo: 1.25, leyenda: false });
        const c2 = tarjeta(w.node(), 'La asimetría de cada estación, 2020 → 2024', `${M.stats.cambioTipo} cruzan una banda; ${M.stats.cambioTipoHaciaTarde} hacia la tarde`);
        pendiente(c2.node(), { modelo: M, interactivo: true, visible: () => true, margen: { t: 34, r: 150, b: 34, l: 90 } });
      },
      notas: [
        ['Cómo se mide', `Asimetría = (entradas de 6 a 10 h − entradas de 16 a 20 h) / (suma de ambas), sobre el día laborable de enero–febrero de 2020. Por encima de +${M.meta.umbrales.tipo} es residencial; por debajo de −${M.meta.umbrales.tipo}, laboral.`],
        ['Qué no demuestra', 'Es un proxy derivado del mismo torniquete, no una medida de uso del suelo. Una estación "laboral" puede ser también comercial o turística; el índice solo ve a qué hora entra la gente.'],
      ],
      preset: { lente: 'tipo', origen: 'capítulo 4' },
    },
    // -------------------------------------------- 5 · por qué el Bronx
    {
      id: 'bronx', numero: 5, etiqueta: 'El Bronx',
      pregunta: '¿Por qué el Bronx?',
      hallazgo: H.bronx,
      hallazgo2: H.independientes,
      marcas: [`${sw(cssVar('--tinta'))} Bronx`, `${sw(cssVar('--tinta-4'))} resto de la ciudad`, `${sw(cssVar('--antes'))} reloj: gris 2020, color 2024`, ...tipos, anillo],
      render(fig) {
        const w = d3.select(fig).append('div').attr('class', 'dos-col');
        const c1 = tarjeta(w.node(), 'Recuperación frente a cambio del pico, una estación por punto', 'a la derecha, volvió más gente; abajo, el pico se aplanó más · el Bronx en negro');
        dispersion(c1.node(), { modelo: M, brush: false, interactivo: true, visible: () => true, resaltar: e => e.b === 'Bronx', etiquetaResaltado: 'Bronx, mediana', cuadrantes: false });
        const c2 = tarjeta(w.node(), 'La forma del día de cada estación del Bronx: el pico de la mañana sigue ahí', 'cada marca es un reloj de 24 h; una punta hacia las 8 es el pico de la mañana');
        mapa(c2.node(), { modelo: M, geo: G, lente: 'forma', interactivo: true, zoom: true, visible: e => e.b === 'Bronx', enfoqueBorough: 'Bronx', tamanoPorRango: false, radioMax: 15, escalaGlifo: 2.4, leyenda: false });
      },
      notas: [
        ['Cómo se mide', `Medianas por borough sobre las estaciones con comparación sólida. Aguanta tres pruebas: con el umbral del 5 %, con todo 2024 en vez de enero–febrero (${fmt.pct(M.boroughs.Bronx.recFY)}), y restringido a estaciones de más de 2 000 entradas por día. Dentro de cada borough, la correlación de rango entre recuperación y aplanamiento va de ${d3.min(Object.values(M.stats.rho_rec_aplan_borough)).toFixed(2)} a ${d3.max(Object.values(M.stats.rho_rec_aplan_borough)).toFixed(2)}.`],
        ['Qué no demuestra', 'Los datos del torniquete no dicen por qué. La explicación del teletrabajo es una hipótesis consistente con los datos, no una medición: se contrasta con el share de trabajo desde casa del Census por área de influencia de cada estación en la siguiente versión.'],
      ],
      preset: { lente: 'aplan', boroughs: ['Bronx'], origen: 'capítulo 5: el Bronx' },
    },
    // ------------------------------------------------- 6 · el abono
    {
      id: 'abono', numero: 6, etiqueta: 'El abono',
      pregunta: '¿Quién dejó de comprar el abono?',
      hallazgo: H.abono,
      marcas: [`${sw(cssVar('--residencial'))} MetroCard ilimitada de 30 días, resaltada`, `${sw(cssVar('--azul-500'))} OMNY, tarifa completa`, `${sw(cssVar('--tinta-4'))} otras clases`],
      render(fig) {
        const c = tarjeta(fig, 'Share de cada clase de pago en las entradas del mes, apilado al 100 %', 'la ilimitada de 30 días es la evidencia del uso intermitente; el cruce MetroCard → OMNY es adopción tecnológica');
        tarifas(c.node(), { modelo: M, alto: Math.max(360, innerHeight - 260), resaltar: 'Metrocard - Unlimited 30-Day' });
      },
      notas: [
        ['Cómo se mide', 'Entradas por mes, borough, método de pago y clase tarifaria, apiladas al 100 %. Las clases menores se agrupan en "otras".'],
        ['Qué no demuestra', 'La migración de MetroCard a OMNY es adopción tecnológica, no cambio de demanda: una caída de MetroCard no es una caída de pasajeros. Por eso el hallazgo es sobre el abono de 30 días, que cae en términos absolutos, y no sobre el cruce de OMNY.'],
      ],
    },
    // ------------------------------------- 7 · qué no podemos afirmar
    {
      id: 'limites', numero: 7, etiqueta: 'Límites',
      pregunta: '¿Qué no podemos afirmar?',
      hallazgo: H['linea-base'],
      marcas: [`${sw(colorConf('estacional'))} ${NOMBRE_CONF.estacional}`, `${sw(colorConf('interrumpida'))} ${NOMBRE_CONF.interrumpida}`, `${sw(colorConf('pequena'))} ${NOMBRE_CONF.pequena}`, `${sw(cssVar('--azul-500'))} azul en la matriz: entradas del mes sobre ene–feb 2020`, `${sw(cssVar('--interrumpida'))} naranja: caída anómala detectada en los datos`],
      render(fig) {
        const w = d3.select(fig).append('div').attr('class', 'dos-col');
        const c1 = tarjeta(w.node(), 'Confiabilidad de la comparación, estación por estación', 'las marcadas llevan anillo punteado en toda la aplicación y no entran en las medianas');
        mapa(c1.node(), { modelo: M, geo: G, lente: 'conf', interactivo: true, zoom: true, visible: () => true, tamanoPorRango: false, radioMax: 9 });
        const c2 = tarjeta(w.node(), 'Las estaciones marcadas, mes a mes: por qué cada una', 'detectado en los datos, sin usar avisos de servicio; varios cortes coinciden con cierres conocidos (línea G, 2024; 21 St-Queensbridge, 2023–24)');
        c2.style('overflow-y', 'auto');
        cortes(c2.node(), { modelo: M });
      },
      notas: [
        ['Cómo se mide', `Sensibilidad estacional: la diferencia entre la recuperación con todo 2024 y con enero–febrero de 2024 se desvía más de ${M.meta.umbrales.estacional * 100} puntos de la del sistema. Ventana anómala: un mes de la comparación cae por debajo de la mitad de su entorno. Línea base pequeña: menos de ${M.meta.umbrales.pequena} entradas por día en 2020.`],
        ['Lo que vale para todo el proyecto', 'Son entradas, no viajes. Es el complejo de estación, no la estación individual. Son estimaciones de la MTA, dentro del 1 % de sus cifras oficiales. Y los cambios de servicio son un factor que estos datos no controlan.'],
      ],
      preset: { lente: 'conf', origen: 'capítulo 7' },
    },
  ];
}
