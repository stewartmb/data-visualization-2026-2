// Reloj de 24 horas: el perfil del día laborable en coordenadas polares. La
// medianoche arriba, las horas en el sentido del reloj, el radio es el share de
// la hora. Gris: enero–febrero 2020; color: 2024. Sirve como glifo (chico, sin
// etiquetas) o como gráfico (grande, con las horas y las ventanas de pico).

import { cssVar, colorTipo, fmt } from '../util.js';

export function reloj(cont, opts) {
  const o = Object.assign({ pre: null, cur: null, tipo: null, r: 80, maxV: null, etiquetas: true, titulo: null, ventanas: true }, opts);
  const el = typeof cont === 'string' ? document.querySelector(cont) : cont;
  const r = o.r, R = r + (o.etiquetas ? 34 : 2);
  const svg = d3.select(el).append('svg').attr('class', 'reloj').attr('width', R * 2).attr('height', R * 2 + (o.titulo ? 18 : 0)).attr('viewBox', `${-R} ${-R - (o.titulo ? 18 : 0)} ${R * 2} ${R * 2 + (o.titulo ? 18 : 0)}`);
  const maxV = o.maxV || Math.max(d3.max(o.pre), d3.max(o.cur)) * 1.05;
  const rad = d3.scaleLinear([0, maxV], [r * 0.12, r]);
  const ang = i => (i / 24) * 2 * Math.PI;
  const area = d3.areaRadial().angle((d, i) => ang(i)).innerRadius(rad(0)).outerRadius(d => rad(d)).curve(d3.curveCatmullRomClosed.alpha(0.5));
  const color = o.tipo ? colorTipo(o.tipo) : cssVar('--tinta');
  if (o.titulo) svg.append('text').attr('y', -R - 5).attr('text-anchor', 'middle').attr('class', 'reloj-titulo').text(o.titulo);
  if (o.ventanas) [[6, 10], [16, 20]].forEach(([a, b]) => svg.append('path').attr('d', d3.arc()({ innerRadius: rad(0), outerRadius: r + 2, startAngle: ang(a), endAngle: ang(b) })).attr('class', 'reloj-ventana'));
  svg.append('circle').attr('r', rad(0)).attr('class', 'reloj-centro');
  svg.append('path').attr('d', area(o.pre)).attr('class', 'reloj-antes');
  svg.append('path').attr('d', area(o.cur)).attr('fill', o.tipo ? color : cssVar('--superficie')).attr('fill-opacity', o.tipo ? 0.18 : 0.55).attr('stroke', color).attr('stroke-width', o.etiquetas ? 1.8 : 1.2);
  if (o.etiquetas) {
    [0, 6, 12, 18].forEach(h => {
      const a = ang(h) - Math.PI / 2;
      svg.append('line').attr('x1', Math.cos(a) * rad(0)).attr('y1', Math.sin(a) * rad(0)).attr('x2', Math.cos(a) * (r + 3)).attr('y2', Math.sin(a) * (r + 3)).attr('class', 'reloj-tick');
      svg.append('text').attr('x', Math.cos(a) * (r + 11)).attr('y', Math.sin(a) * (r + 11) + 3.5).attr('text-anchor', 'middle').attr('class', 'reloj-hora').text(h === 0 ? '0 h' : h);
    });
    const pA = o.pre.slice(6, 11), cA = o.cur.slice(6, 11);
    svg.append('text').attr('y', r + 30).attr('text-anchor', 'middle').attr('class', 'reloj-nota').text(`pico AM ${fmt.pct(d3.max(pA), 1)} → ${fmt.pct(d3.max(cA), 1)}`);
  }
  return { destruir() { svg.remove(); } };
}
