// Los capítulos de la narrativa. Cada uno: una pregunta, el hallazgo que la
// responde (sale del modelo, no se escribe a mano), su gráfico, y dos notas:
// cómo se mide y qué no demuestra. El botón final manda al explorador con el
// estado ya configurado en lo que el lector acaba de ver.

import { estado } from './estado.js';
import { fmt, cssVar, colorTipo, colorConf, NOMBRE_CONF, BOROUGHS } from './util.js';
import { perfil24 } from './graficos/perfil.js';
import { serieMensual } from './graficos/serie.js';
import { mapa } from './graficos/mapa.js';
import { dispersion } from './graficos/dispersion.js';
import { tarifas } from './graficos/tarifas.js';

const ETIQUETA_TIPO = { positivo: 'hallazgo', negativo: 'lo que no se sostiene', limite: 'límite' };

/** "entre X y Y", o solo "X" si coinciden al redondear. */
function rango(vals, f, invertir = false) {
  const lo = d3.min(vals), hi = d3.max(vals);
  if (f(lo) === f(hi)) return f(lo);
  return invertir ? `entre ${f(hi)} y ${f(lo)}` : `entre ${f(lo)} y ${f(hi)}`;
}

export function capitulos(M, G) {
  const H = Object.fromEntries(M.hallazgos.map(h => [h.id, h]));
  const bx = M.boroughs.Bronx;
  const grandes = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx'];
  const otros = grandes.filter(b => b !== 'Bronx').map(b => M.boroughs[b]);
  const S = M.stats;

  return [
    // ------------------------------------------------------------- 0 · hero
    {
      id: 'inicio', hero: true,
      pregunta: 'La forma del día',
      sub: `El metro de Nueva York se programa alrededor del doble pico del día laborable: la salida de casa por la mañana y la salida del trabajo por la tarde. Entre 2020 y 2024 esa forma cambió, y la recuperación se cuenta casi siempre con un solo número que no dice a qué hora volvió la gente ni en qué barrios. Esto es lo que dicen 120 millones de registros de torniquete, estación por estación.`,
      claves: [[fmt.int(M.stats.n), 'complejos de estación'], [M.meta.meses.length, 'meses, enero 2020 a diciembre 2024'], ['24 × 7', 'horas de la semana por estación'], ['120 855 568', 'registros horarios agregados']],
      render(fig) {
        perfil24(fig, { pre: M.sistema.perfilPre, cur: M.sistema.perfilCur, alto: 320, animar: true, anotaciones: true, margen: { t: 22, r: 24, b: 30, l: 44 } });
        leyendaAntesAhora(fig, 'todo el sistema, día laborable');
      },
    },
    // ----------------------------------------------- 1 · cuánta gente volvió
    {
      id: 'volumen', numero: 1, etiqueta: 'Volumen',
      pregunta: '¿Cuánta gente volvió?',
      hallazgo: H.estanco,
      render(fig) { serieMensual(fig, { serie: M.sistema.serie, base: M.meta.base, alto: 300, anotaciones: true }); },
      pie: [
        ['Cómo se mide', 'Suma de entradas por mes en las 428 estaciones. La referencia es enero de 2020, el último mes completo antes de la pandemia.'],
        ['Qué no demuestra', 'Son entradas a estaciones, no viajes: no hay origen–destino en esta fuente. Y una caída de entradas puede ser menos demanda o menos servicio; esta serie no lo distingue.'],
      ],
      preset: { lente: 'rec', origen: 'capítulo 1' },
    },
    // ------------------------------------------- 2 · sigue el doble pico
    {
      id: 'forma', numero: 2, etiqueta: 'El doble pico',
      pregunta: '¿Sigue existiendo el doble pico?',
      hallazgo: H.aplano,
      cuerpo: `Sí, pero más bajo y más tarde. El pico de la mañana perdió peso en tres de los cuatro boroughs grandes y el mediodía lo ganó. El cuarto es la excepción, y es el capítulo 5.`,
      render(fig) {
        const fila = d3.select(fig).append('div').attr('class', 'fila-paneles');
        const maxY = d3.max(grandes, b => Math.max(d3.max(M.boroughs[b].perfilPre), d3.max(M.boroughs[b].perfilCur))) * 1.1;
        grandes.forEach(b => {
          const v = M.boroughs[b];
          const t = fila.append('div').attr('class', 'tarjeta');
          t.append('div').attr('class', 'titulo').text(b === 'Bronx' ? 'Bronx: la excepción' : b);
          t.append('div').attr('class', 'subtitulo').text(`${v.n} estaciones · pico/valle ${fmt.razon(v.pvPre)} → ${fmt.razon(v.pvCur)} · 7–9 h: ${fmt.pct(v.share79Pre, 1)} → ${fmt.pct(v.share79Cur, 1)} del día`);
          perfil24(t.append('div').node(), { pre: v.perfilPre, cur: v.perfilCur, alto: 250, compacto: true, maxY, margen: { t: 12, r: 10, b: 26, l: 36 } });
        });
        leyendaAntesAhora(fig, 'día laborable, share por hora');
      },
      pie: [
        ['Cómo se mide', `Razón pico/valle: el máximo entre las 6 y las 10 h dividido por el mínimo entre las 11 y las 15 h, sobre el perfil del día laborable. Se cuenta como aplanamiento una caída mayor del ${M.meta.umbrales.aplana * 100}\u00a0%; con cualquier margen serían más.`],
        ['Qué no demuestra', 'El índice mide forma, no volumen: una estación puede aplanarse y recuperar mucho, o al revés. Tampoco dice por qué se aplanó.'],
      ],
      preset: { lente: 'aplan', origen: 'capítulo 2' },
    },
    // --------------------------------------------- 3 · para qué se usa
    {
      id: 'tipos', numero: 3, etiqueta: 'Tipos',
      pregunta: '¿Para qué se usa cada estación?',
      hallazgo: H['una-direccion'],
      cuerpo: `Las entradas de la mañana son gente saliendo de casa; las de la tarde, gente saliendo del trabajo. Esa asimetría separa la ciudad sin ningún dato externo: ${M.tipos.residencial.n} estaciones residenciales, ${M.tipos.laboral.n} laborales (${M.boroughs.Manhattan.tipos.laboral} de ellas en Manhattan) y ${M.tipos.mixta.n} mixtas.`,
      render(fig) {
        const w = d3.select(fig).append('div').attr('class', 'dos-col ancha-izq');
        const tm = w.append('div').attr('class', 'tarjeta').style('height', 'clamp(400px, 64vh, 760px)').style('display', 'flex').style('flex-direction', 'column');
        tm.append('div').attr('class', 'titulo').text('Tipo de cada estación, según su asimetría mañana/tarde en 2020');
        const cm = tm.append('div').attr('class', 'cuerpo-grafico');
        mapa(cm.node(), { modelo: M, geo: G, lente: 'tipo', interactivo: true, zoom: true, visible: () => true, tamanoPorRango: false, radioMax: 9 });
        const col = w.append('div').attr('class', 'tres-filas');
        const maxY = d3.max(['residencial', 'mixta', 'laboral'], t => Math.max(d3.max(M.tipos[t].perfilPre), d3.max(M.tipos[t].perfilCur))) * 1.1;
        ['residencial', 'mixta', 'laboral'].forEach(t => {
          const v = M.tipos[t];
          const c = col.append('div').attr('class', 'tarjeta');
          c.append('div').attr('class', 'titulo').html(`<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${colorTipo(t)};margin-right:7px;vertical-align:middle"></i>${t} · ${v.n} estaciones`);
          c.append('div').attr('class', 'subtitulo').text(`recuperación ${fmt.pct(v.rec)} · pico ${fmt.cambio(v.aplan)} · asimetría ${v.asymPre > 0 ? '+' : ''}${v.asymPre.toFixed(2)} → ${v.asymCur > 0 ? '+' : ''}${v.asymCur.toFixed(2)}`);
          perfil24(c.append('div').node(), { pre: v.perfilPre, cur: v.perfilCur, tipo: t, alto: 112, compacto: true, ejeY: false, maxY, margen: { t: 8, r: 8, b: 22, l: 8 } });
        });
      },
      pie: [
        ['Cómo se mide', `Asimetría = (entradas de 6 a 10 h − entradas de 16 a 20 h) / (suma de ambas), sobre el día laborable de enero–febrero de 2020. Por encima de +${M.meta.umbrales.tipo} es residencial; por debajo de −${M.meta.umbrales.tipo}, laboral.`],
        ['Qué no demuestra', 'Es un proxy derivado del mismo torniquete, no una medida de uso del suelo. Una estación "laboral" puede ser también comercial o turística; el índice solo ve a qué hora entra la gente.'],
      ],
      preset: { lente: 'tipo', origen: 'capítulo 3' },
    },
    // ------------------------------------------ 4 · cuánto o cómo
    {
      id: 'ejes', numero: 4, etiqueta: 'Cuánto o cómo',
      pregunta: '¿Qué cambió más: cuánto o cómo?',
      hallazgo: H.independientes,
      cuerpo: `Cada punto es una estación. A la derecha, volvió más gente; abajo, el pico se aplanó más. La nube no es una diagonal: saber una cosa no dice la otra.`,
      render(fig) {
        const t = d3.select(fig).append('div').attr('class', 'tarjeta').style('height', 'clamp(400px, 64vh, 760px)').style('display', 'flex').style('flex-direction', 'column');
        t.append('div').attr('class', 'titulo').text('Recuperación frente a cambio del pico, una estación por punto, color por tipo');
        const c = t.append('div').attr('class', 'cuerpo-grafico');
        dispersion(c.node(), { modelo: M, brush: false, interactivo: true, visible: () => true });
        leyendaTipos(t);
      },
      pie: [
        ['Cómo se mide', `Correlación de rango de Spearman entre las dos variables, dentro de cada borough: ${grandes.map(b => `${b} ${S.rho_rec_aplan_borough[b] > 0 ? '+' : ''}${S.rho_rec_aplan_borough[b].toFixed(2)}`).join(', ')}.`],
        ['Qué no demuestra', 'Independencia estadística no es ausencia de causa común. Las dos cosas pueden tener el mismo origen y aun así no moverse juntas estación por estación.'],
      ],
      preset: { lente: 'aplan', origen: 'capítulo 4' },
    },
    // -------------------------------------------- 5 · por qué el Bronx
    {
      id: 'bronx', numero: 5, etiqueta: 'El Bronx',
      pregunta: '¿Por qué el Bronx?',
      hallazgo: H.bronx,
      cuerpo: `Aplanar el pico es lo que hace el trabajo híbrido: se deja de viajar algunos días y el resto del día gana peso. Donde la gente no puede quedarse en casa, el pico se queda igual y solo baja el volumen. El Bronx recuperó el ${fmt.pct(bx.rec)} y su pico cambió ${fmt.cambio(bx.aplan)}; Manhattan, Brooklyn y Queens recuperaron ${rango(otros.map(o => o.rec), fmt.pct)} y su pico cambió ${rango(otros.map(o => o.aplan), fmt.cambio, true)}.`,
      render(fig) {
        const w = d3.select(fig).append('div').attr('class', 'dos-col');
        const t1 = w.append('div').attr('class', 'tarjeta').style('height', 'clamp(400px, 64vh, 760px)').style('display', 'flex').style('flex-direction', 'column');
        t1.append('div').attr('class', 'titulo').text('Las estaciones del Bronx en negro; el resto de la ciudad en gris');
        dispersion(t1.append('div').attr('class', 'cuerpo-grafico').node(), { modelo: M, brush: false, interactivo: true, visible: () => true, resaltar: e => e.b === 'Bronx', etiquetaResaltado: 'Bronx, mediana', cuadrantes: false });
        const t2 = w.append('div').attr('class', 'tarjeta').style('height', 'clamp(400px, 64vh, 760px)').style('display', 'flex').style('flex-direction', 'column');
        t2.append('div').attr('class', 'titulo').text('Cambio del pico, estación por estación');
        mapa(t2.append('div').attr('class', 'cuerpo-grafico').node(), { modelo: M, geo: G, lente: 'aplan', interactivo: true, zoom: true, visible: () => true, enfoqueBorough: 'Bronx', tamanoPorRango: false, radioMax: 10 });
        const tabla = d3.select(fig).append('div').attr('class', 'tarjeta').style('margin-top', '14px');
        tabla.append('div').attr('class', 'titulo').text('Por borough, mediana de sus estaciones con comparación sólida');
        const tb = tabla.append('div').style('overflow-x', 'auto').append('table').style('width', '100%').style('margin-top', '8px').style('border-collapse', 'collapse').style('font-size', '13px').style('font-variant-numeric', 'tabular-nums');
        tb.append('tr').html('<th style="text-align:left;font-weight:500;color:var(--tinta-3);padding:4px 0;border-bottom:1px solid var(--regla)">borough</th><th style="text-align:right;font-weight:500;color:var(--tinta-3);border-bottom:1px solid var(--regla)">estaciones</th><th style="text-align:right;font-weight:500;color:var(--tinta-3);border-bottom:1px solid var(--regla)">recuperación</th><th style="text-align:right;font-weight:500;color:var(--tinta-3);border-bottom:1px solid var(--regla)">cambio del pico</th><th style="text-align:right;font-weight:500;color:var(--tinta-3);border-bottom:1px solid var(--regla)">aplanaron más de 5 %</th><th style="text-align:right;font-weight:500;color:var(--tinta-3);border-bottom:1px solid var(--regla)">7–9 h en el día</th>');
        ['Bronx', 'Brooklyn', 'Queens', 'Manhattan'].forEach(b => {
          const v = M.boroughs[b];
          tb.append('tr').style('font-weight', b === 'Bronx' ? '600' : '400').style('color', b === 'Bronx' ? 'var(--tinta)' : 'var(--tinta-2)')
            .html(`<td style="padding:5px 0;border-bottom:1px solid var(--regla)">${b}</td><td style="text-align:right;border-bottom:1px solid var(--regla)">${v.n}</td><td style="text-align:right;border-bottom:1px solid var(--regla)">${fmt.pct(v.rec)}</td><td style="text-align:right;border-bottom:1px solid var(--regla)">${fmt.cambio(v.aplan)}</td><td style="text-align:right;border-bottom:1px solid var(--regla)">${fmt.pct(v.pctAplan)}</td><td style="text-align:right;border-bottom:1px solid var(--regla)">${fmt.pct(v.share79Pre, 1)} → ${fmt.pct(v.share79Cur, 1)}</td>`);
        });
      },
      pie: [
        ['Cómo se mide', `Aguanta tres pruebas: con el umbral del 5\u00a0%, con todo 2024 en vez de enero–febrero (${fmt.pct(bx.recFY)}), y restringido a estaciones de más de 2 000 entradas por día.`],
        ['Qué no demuestra', 'Los datos del torniquete no dicen por qué. La explicación del teletrabajo es una hipótesis consistente con los datos, no una medición: se contrasta con el share de trabajo desde casa del Census por área de influencia de cada estación en la siguiente versión.'],
      ],
      preset: { lente: 'aplan', boroughs: ['Bronx'], origen: 'capítulo 5: el Bronx' },
    },
    // ------------------------------------------------- 6 · el abono
    {
      id: 'abono', numero: 6, etiqueta: 'El abono',
      pregunta: '¿Quién dejó de comprar el abono?',
      hallazgo: H.abono,
      cuerpo: `La composición por clase de pago es la evidencia indirecta del mecanismo. El pase ilimitado de 30 días solo conviene si se viaja casi todos los días; su desplome es lo que se espera si una parte de la ciudad pasó a viajar dos o tres días por semana.`,
      render(fig) {
        const t = d3.select(fig).append('div').attr('class', 'tarjeta');
        t.append('div').attr('class', 'titulo').text('Share de cada clase de pago en las entradas del mes, con la ilimitada de 30 días resaltada');
        tarifas(t.append('div').node(), { modelo: M, alto: 320, resaltar: 'Metrocard - Unlimited 30-Day' });
      },
      pie: [
        ['Cómo se mide', 'Entradas por mes, borough, método de pago y clase tarifaria, apiladas al 100 %. Las clases menores se agrupan en "otras".'],
        ['Qué no demuestra', 'La migración de MetroCard a OMNY es adopción tecnológica, no cambio de demanda: una caída de MetroCard no es una caída de pasajeros. Por eso el hallazgo es sobre el abono de 30 días, que cae en términos absolutos, y no sobre el cruce de OMNY.'],
      ],
    },
    // ------------------------------------- 7 · qué no podemos afirmar
    {
      id: 'limites', numero: 7, etiqueta: 'Límites',
      pregunta: '¿Qué no podemos afirmar?',
      hallazgo: H['linea-base'],
      cuerpo: `La línea base disponible son dos meses de invierno de 2020: este dataset no tiene 2019. Comparar contra ellos es correcto para la mayoría de las estaciones y engañoso para algunas: las de playa y estadio, las que tuvieron un corte de servicio en la ventana de comparación, las muy pequeñas. Esas están marcadas con anillo punteado en toda la aplicación, y las medianas por borough y por tipo se calculan sin ellas.`,
      render(fig) {
        const w = d3.select(fig).append('div').attr('class', 'dos-col ancha-izq');
        const tm = w.append('div').attr('class', 'tarjeta').style('height', 'clamp(400px, 64vh, 760px)').style('display', 'flex').style('flex-direction', 'column');
        tm.append('div').attr('class', 'titulo').text('Confiabilidad de la comparación, estación por estación');
        mapa(tm.append('div').attr('class', 'cuerpo-grafico').node(), { modelo: M, geo: G, lente: 'conf', interactivo: true, zoom: true, visible: () => true, tamanoPorRango: false, radioMax: 9 });
        const lista = w.append('div').attr('class', 'tarjeta').style('overflow-y', 'auto').style('height', 'clamp(400px, 64vh, 760px)');
        lista.append('div').attr('class', 'titulo').text('Las estaciones marcadas y por qué');
        ['interrumpida', 'estacional', 'pequena'].forEach(nivel => {
          const g = M.estaciones.filter(e => e.conf.nivel === nivel).sort((a, b) => Math.abs(b.dSeason) - Math.abs(a.dSeason));
          if (!g.length) return;
          lista.append('div').style('margin-top', '12px').style('font-size', '12px').style('font-weight', '600').style('color', 'var(--tinta)')
            .html(`<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${colorConf(nivel)};margin-right:7px;vertical-align:middle"></i>${NOMBRE_CONF[nivel]} · ${g.length}`);
          const ul = lista.append('ul').style('margin', '6px 0 0').style('padding-left', '18px').style('font-size', '12px').style('color', 'var(--tinta-2)').style('line-height', '1.45');
          g.forEach(e => ul.append('li').html(`<span style="cursor:pointer;text-decoration:underline dotted" data-id="${e.id}">${e.n}</span> <span style="color:var(--tinta-3)">— ${e.conf.motivos[0]}</span>`));
        });
        lista.selectAll('[data-id]').on('click', function () { estado.enfocar(this.dataset.id); });
        const cortes = M.estaciones.filter(e => e.cortes.length).map(e => ({ n: e.n, m: e.cortes }));
        const g2 = d3.select(fig).append('div').attr('class', 'tarjeta').style('margin-top', '14px');
        g2.append('div').attr('class', 'titulo').text('Caídas anómalas de entradas detectadas en los datos');
        g2.append('div').attr('class', 'subtitulo').text('Un mes por debajo de la mitad de la mediana de sus ±6 meses vecinos. Detectado en los datos, sin usar avisos de servicio; varios coinciden con cierres conocidos: la línea G en julio–agosto de 2024, 21 St-Queensbridge entre septiembre de 2023 y marzo de 2024.');
        const p = g2.append('p').style('margin-top', '8px').style('font-size', '12px').style('color', 'var(--tinta-2)').style('line-height', '1.5');
        p.html(cortes.map(c => `<b style="color:var(--tinta);font-weight:500">${c.n}</b> ${c.m.map(fmt.mes).join(', ')}`).join(' · '));
      },
      pie: [
        ['Cómo se mide', `Sensibilidad estacional: la diferencia entre la recuperación con todo 2024 y con enero–febrero de 2024 se desvía más de ${M.meta.umbrales.estacional * 100} puntos de la del sistema. Ventana anómala: un mes de la comparación cae por debajo de la mitad de su entorno. Línea base pequeña: menos de ${M.meta.umbrales.pequena} entradas por día en 2020.`],
        ['Lo que vale para todo el proyecto', 'Son entradas, no viajes. Es el complejo de estación, no la estación individual. Son estimaciones de la MTA, dentro del 1 % de sus cifras oficiales. Y los cambios de servicio son un factor que estos datos no controlan.'],
      ],
      preset: { lente: 'conf', origen: 'capítulo 7' },
    },
  ];
}

function leyendaAntesAhora(fig, nota) {
  const l = d3.select(fig).append('div').attr('class', 'leyenda');
  l.append('span').attr('class', 'item').html(`<i class="muestra" style="background:${cssVar('--antes')};border:1px solid ${cssVar('--antes-borde')}"></i>enero–febrero de 2020, la línea base`);
  l.append('span').attr('class', 'item').html(`<i class="muestra linea" style="background:${cssVar('--tinta')}"></i>2024`);
  if (nota) l.append('span').attr('class', 'item').style('color', 'var(--tinta-4)').text(nota);
}
function leyendaTipos(cont) {
  const l = cont.append('div').attr('class', 'leyenda');
  ['residencial', 'mixta', 'laboral'].forEach(t => l.append('span').attr('class', 'item').html(`<i class="muestra punto" style="background:${colorTipo(t)}"></i>${t}`));
  l.append('span').attr('class', 'item').html(`<i class="muestra anillo"></i>comparación poco confiable`);
}
