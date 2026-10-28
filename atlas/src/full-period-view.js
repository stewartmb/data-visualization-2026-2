import {esc,fmt,showTooltip,hideTooltip} from './model.js?v=20261027-4';

export function monthlyContext(host,app,items){
  const data=app.fullPeriod;if(!data||data.meta.status!=='COMPLETE')return;
  const ids=new Set(items.map(s=>s.id)),selected=data.stations.filter(s=>ids.has(s.id));
  const points=data.meta.months.map((month,i)=>{
    const available=selected.filter(s=>s.entries[i]!==null);
    const entries=d3.sum(available,s=>s.entries[i]);
    return {month,i,entries,daily:available.length?entries/data.meta.calendar_days[i]:null,available:available.length};
  });
  const wrapper=document.createElement('section');wrapper.className='full-period-context';
  wrapper.innerHTML=`<h3>Afluencia mensual · 2019–2024</h3><p class="sub">Base completa, todos los modos: ${data.meta.source_records.toLocaleString('es-PE')} registros originales · 72 meses · 12 campos.<br>Curva: ${items.length} ${items.length===1?'complejo de subway seleccionado':'complejos de subway seleccionados'}.</p><svg class="full-period-chart" viewBox="0 0 380 175" role="img" aria-label="Entradas diarias promedio por mes, enero de 2019 a diciembre de 2024"></svg><p class="sub">Promedio diario observado de cada mes, sin ajuste por composición semanal. Esta curva usa los 72 meses; la huella semanal usa la ventana comparable indicada arriba. Un mes sin registros para todo el sujeto deja un hueco.</p><p class="sub"><a href="data/full_period.json" download>Series completas y cobertura (JSON)</a> · <a href="https://data.ny.gov/d/t69i-h2me" target="_blank" rel="noopener">Fuente 2019 ↗</a> · <a href="https://data.ny.gov/d/wujg-7c2s" target="_blank" rel="noopener">Fuente 2020–2024 ↗</a></p>`;
  host.insertBefore(wrapper,host.querySelector('h3'));
  const svg=d3.select(wrapper.querySelector('svg')),x=d3.scaleLinear([0,71],[46,366]);
  const max=d3.max(points,d=>d.daily)||1,y=d3.scaleLinear([0,max*1.08],[139,13]).nice();
  svg.append('g').attr('class','chart-axis').attr('transform','translate(0,139)').call(d3.axisBottom(x).tickValues([0,12,24,36,48,60]).tickFormat(i=>data.meta.months[i].slice(0,4)));
  svg.append('g').attr('class','chart-axis').attr('transform','translate(46,0)').call(d3.axisLeft(y).ticks(3).tickFormat(d3.format('.2s')));
  svg.append('text').attr('x',46).attr('y',9).attr('font-size',8).attr('fill','#60747b').text('entradas/día');
  svg.append('path').datum(points).attr('fill','none').attr('stroke','#176c91').attr('stroke-width',1.8)
    .attr('d',d3.line().defined(d=>d.daily!==null).x(d=>x(d.i)).y(d=>y(d.daily)));
  svg.selectAll('circle').data(points.filter(d=>d.daily!==null)).join('circle').attr('cx',d=>x(d.i)).attr('cy',d=>y(d.daily)).attr('r',4).attr('fill','#176c91').attr('fill-opacity',.15)
    .on('pointerenter',(e,d)=>showTooltip(`<b>${esc(d.month)}</b><br>${fmt(d.entries,0)} entradas registradas<br>${fmt(d.daily,0)} entradas/día<br>${d.available}/${items.length} complejos con registros`,e))
    .on('pointermove',(e,d)=>showTooltip(`<b>${esc(d.month)}</b><br>${fmt(d.entries,0)} entradas registradas<br>${fmt(d.daily,0)} entradas/día<br>${d.available}/${items.length} complejos con registros`,e)).on('pointerleave',hideTooltip);
}
