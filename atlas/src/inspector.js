import {state,esc,fmt,signed,profile,measures,hellinger,deltaColor,shareColor,cellValue,showTooltip,hideTooltip,dayShort,relevantEvents} from './model.js';

export function renderInspector(app){
  const host=document.querySelector('#inspector'),s=app.station(state.selected);
  host.hidden=!s;if(!s)return;
  const a=profile(s,2020),b=profile(s),m=measures(s),tabs={fingerprint:'Huella',compare:'Comparar',evolution:'Evolución',source:'Fuente'};
  const events=relevantEvents(app.data,s);
  host.innerHTML=`<button class="close" id="close-inspector" aria-label="Cerrar detalle">×</button><div class="eyebrow">COMPLEJO ${s.id} / ${esc(s.borough)}</div><h2>${esc(s.name.replace(/ \(.*/,''))}</h2><div class="sub">Enero–febrero · 2020 frente a ${state.year}<br>${s.routes.map(r=>`<span class="route">${esc(r)}</span>`).join('')} <span style="font-size:9px">rutas del catálogo actual</span></div>
  ${events.length?`<details class="method-note service-context"><summary>Contexto de servicio que revisar (${events.length})</summary>${events.map(e=>`<p><b>${esc(e.title)}</b><br>${esc(e.description)}<br><a href="${esc(e.url)}" target="_blank" rel="noopener">Fuente MTA · ${esc(e.source_date)} ↗</a></p>`).join('')}</details>`:''}
  <div class="inspector-controls"><button id="pin-station">${state.pins.includes(s.id)?'◆ Quitar de comparación':'◇ Fijar comparación'}</button><button id="find-neighbors">Buscar similares ↗</button></div>
  <nav class="inspector-tabs" aria-label="Detalle de la estación">${Object.entries(tabs).map(([k,v])=>`<button id="inspect-tab-${k}" data-tab="${k}" class="${k===state.inspectorTab?'active':''}">${v}</button>`).join('')}</nav>
  <div id="detail-body"></div>
  <div class="metric-grid"><div class="metric-tile"><span>CAMBIO DE FORMA · TV</span><strong>${fmt(m.change)} pp</strong></div><div class="metric-tile"><span>PESO AM · DIFERENCIA</span><strong>${signed(m.deltaAM)} pp</strong></div><div class="metric-tile"><span>FIN DE SEMANA · DIFERENCIA</span><strong>${signed(m.deltaWeekend)} pp</strong></div><div class="metric-tile"><span>ÍNDICE DE VOLUMEN · 2020 = 100</span><strong>${fmt(m.recovery)} %</strong></div></div>
  <p class="method-note">El peso AM usa 06:00–10:00 de lunes a viernes. El fin de semana usa sábado + domingo sobre una semana comparable. Las proporciones describen entradas agregadas; no identifican personas ni motivos.</p>`;
  host.querySelector('#close-inspector').onclick=()=>app.set({selected:null});
  host.querySelector('#pin-station').onclick=()=>app.pin(s.id);
  host.querySelector('#find-neighbors').onclick=()=>app.similar(s.id);
  host.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>app.set({inspectorTab:btn.dataset.tab}));
  const body=host.querySelector('#detail-body');
  if(state.inspectorTab==='fingerprint')drawFingerprint(body,s,app);
  if(state.inspectorTab==='compare')drawComparison(body,s,app);
  if(state.inspectorTab==='evolution')drawEvolution(body,s,app);
  if(state.inspectorTab==='source')body.innerHTML=`<div class="source-row"><b>Unidad</b><br>ID ${s.id} · complejo de estación, no andén ni línea individual.<br>Lat ${s.lat} · lon ${s.lon}</div><div class="source-row"><b>Ventanas observadas</b><br>2020: ${a.observedCells}/168 celdas con entradas.<br>${state.year}: ${b.observedCells}/168 celdas con entradas.<br>Una celda ausente se representa como cero entradas registradas. No certifica que el servicio estuviera disponible.</div><div class="source-row"><b>Promedio diario estandarizado</b><br>2020: ${fmt(a.daily)} · ${state.year}: ${fmt(b.daily)} entradas/día.<br>Cada día de la semana tiene el mismo peso en los dos períodos.</div><div class="source-row"><b>Fuentes públicas</b><br><a href="https://data.ny.gov/d/wujg-7c2s" target="_blank" rel="noopener">Conteos horarios MTA ↗</a><br><a href="https://data.ny.gov/d/5f5g-n3cz" target="_blank" rel="noopener">Catálogo de complejos MTA ↗</a><br>Catálogo consultado: ${esc(app.data.meta.retrieved.slice(0,10))}; sus rutas no reconstruyen el servicio histórico.</div><p class="method-note">Estas medidas no permiten inferir origen–destino, causas, saturación de trenes ni frecuencias óptimas. Obras, cierres y calendario festivo pueden afectar la comparación.</p><a href="../redesign/03-datos-y-metodos.md">Fórmulas, auditoría y reproducción ↗</a>`;
}

function drawFingerprint(host,s,app){
  host.innerHTML=`<div class="segmented" id="shape-toggle"><button data-clock="true" class="${state.clock?'active':''}">Reloj semanal</button><button data-clock="false" class="${!state.clock?'active':''}">Matriz</button></div><div class="segmented" style="margin:10px 0" id="detail-mode"><button data-mode="delta" class="${state.mode==='delta'?'active':''}">Diferencia</button><button data-mode="current" class="${state.mode==='current'?'active':''}">${state.year}</button><button data-mode="base" class="${state.mode==='base'?'active':''}">2020</button></div><svg class="detail-viz" role="img" aria-label="Huella de 168 horas del complejo seleccionado"></svg><div class="detail-legend"><span class="color-key">${state.mode==='delta'?'−0,65 pp':'0 %'}<span class="gradient ${state.mode==='delta'?'':'seq'}"></span>${state.mode==='delta'?'+0,65 pp':'1,5 %'}</span></div><p class="sub">${state.clock?'Interior → exterior: Lun · Mar · Mié · Jue · Vie · Sáb · Dom. El ángulo es la hora; el color es el peso. Usa Matriz para comparar celdas sin distorsión radial.':'Cada fila es un día y cada columna una hora. Las escalas son las mismas que en el atlas.'} Valores extremos saturan el color; el tooltip muestra el valor exacto.</p>`;
  host.querySelectorAll('[data-clock]').forEach(btn=>btn.onclick=()=>app.set({clock:btn.dataset.clock==='true'}));
  host.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>app.set({mode:btn.dataset.mode}));
  const svg=d3.select(host.querySelector('svg')).attr('viewBox',state.clock?'0 0 360 355':'0 0 360 225');
  const cells=d3.range(168),fill=i=>state.mode==='delta'?deltaColor(cellValue(s,i)):shareColor(cellValue(s,i));
  let marks;
  if(state.clock){
    const g=svg.append('g').attr('transform','translate(180,175)'),arc=d3.arc();
    marks=g.selectAll('path').data(cells).join('path').attr('d',i=>arc({innerRadius:36+Math.floor(i/24)*15.5,outerRadius:50+Math.floor(i/24)*15.5,startAngle:(i%24)*Math.PI/12+.008,endAngle:(i%24+1)*Math.PI/12-.008})).attr('fill',fill);
    g.append('circle').attr('r',29).attr('fill','#f1f4ee');g.append('text').attr('text-anchor','middle').attr('y',4).attr('fill','#49636b').attr('font-size',14).text(state.mode==='delta'?'Δ':state.mode==='base'?'2020':state.year);
    for(const h of [0,3,6,9,12,15,18,21]){const angle=h*Math.PI/12,r=166;g.append('text').attr('x',Math.sin(angle)*r).attr('y',-Math.cos(angle)*r+4).attr('text-anchor','middle').attr('font-size',10).attr('fill','#60747b').text(`${String(h).padStart(2,'0')} h`);}
  }else{
    marks=svg.append('g').selectAll('rect').data(cells).join('rect').attr('x',i=>36+(i%24)*13).attr('y',i=>28+Math.floor(i/24)*24).attr('width',12).attr('height',22).attr('fill',fill);
    svg.append('g').selectAll('text').data(dayShort).join('text').attr('x',0).attr('y',(d,i)=>43+i*24).attr('fill','#60747b').attr('font-size',10).text(d=>d);
    for(const h of [0,6,12,18,23])svg.append('text').attr('x',36+h*13).attr('y',18).attr('fill','#60747b').attr('font-size',10).text(h);
  }
  marks.on('pointerenter',(e,i)=>{
    const a=profile(s,2020).p[i]*100,b=profile(s).p[i]*100;
    showTooltip(`<b>${dayShort[Math.floor(i/24)]} ${i%24}:00</b><br>2020: ${a.toFixed(3)} %<br>${state.year}: ${b.toFixed(3)} %<br>Diferencia: ${(b-a).toFixed(3)} pp`,e);
  }).on('pointerleave',hideTooltip);
  const neighbors=app.data.stations.filter(x=>x.id!==s.id&&profile(x)).map(x=>({s:x,d:hellinger(profile(s).p,profile(x).p)})).sort((a,b)=>a.d-b.d).slice(0,4);
  host.insertAdjacentHTML('beforeend',`<h3 class="detail-heading">Perfiles cercanos en ${state.year}</h3><div class="neighbors">${neighbors.map(n=>`<button data-neighbor="${n.s.id}"><span>${esc(n.s.name)}</span><small>H ${n.d.toFixed(3)}</small></button>`).join('')}</div><p class="sub">H: distancia de Hellinger, de 0 (igual) a 1 (sin solapamiento). Es proximidad de forma, no un grupo causal.</p>`);
  host.querySelectorAll('[data-neighbor]').forEach(btn=>btn.onclick=()=>app.select(btn.dataset.neighbor));
}

export function comparisonSeries(p,days){
  const hourly=d3.range(24).map(h=>d3.sum(days,d=>p[d*24+h]));
  const total=d3.sum(hourly);
  return {share:100*total,values:hourly.map(v=>total?100*v/total:0)};
}

function drawComparison(host,s,app){
  const rows=[{label:'2020 · selección',p:profile(s,2020).p,color:'#7c8c99',dash:'3,3'},{label:`${state.year} · selección`,p:profile(s).p,color:'#137b80'}];
  state.pins.filter(id=>id!==s.id).forEach((id,i)=>{const v=app.station(id);if(v&&profile(v))rows.push({label:`${state.year} · ${v.name}`,p:profile(v).p,color:['#c96035','#8960a2','#7c8738'][i%3]});});
  const groups=[{id:'week',title:'Lunes a domingo · perfil horario conjunto',days:[0,1,2,3,4,5,6]}];
  groups.forEach(g=>g.series=rows.map(r=>({...r,...comparisonSeries(r.p,g.days)})));
  const top=d3.max(groups,g=>d3.max(g.series,r=>d3.max(r.values)))||1;
  host.innerHTML=`<p class="sub">Una sola gráfica reúne los siete días. Cada curva muestra qué porcentaje de las entradas semanales corresponde a cada hora del día; sus 24 valores suman 100 %.</p>
    <div class="pair-list">${rows.map(r=>`<span style="color:${r.color}">${r.dash?'┄':'━'} ${esc(r.label)}</span>`).join('<br>')}</div>
    ${groups.map(g=>`<section class="comparison-panel" data-group="${g.id}"><h3>${g.title}</h3><svg class="detail-viz" viewBox="0 0 360 230" role="img" aria-label="Comparación horaria: ${g.title}"></svg></section>`).join('')}
    <p class="method-note">Esta curva resume horarios y puede ocultar cambios entre días. Para localizar las diferencias de las 168 horas que utiliza la distancia TV, abre el reloj semanal en modo Diferencia.</p><button class="text-button" id="compare-open-clock">Ver diferencias en el reloj semanal ↗</button><p class="sub">Pasa el cursor para leer cada hora. Las estaciones fijadas usan ${state.year}.</p>`;
  const x=d3.scaleLinear().domain([0,23]).range([40,346]),y=d3.scaleLinear().domain([0,top*1.1]).nice().range([192,17]);
  for(const g of groups){
    const node=host.querySelector(`[data-group="${g.id}"] svg`),svg=d3.select(node);
    svg.append('g').attr('class','chart-axis').attr('transform','translate(0,192)').call(d3.axisBottom(x).tickValues([0,6,12,18,23]).tickFormat(h=>`${h} h`));
    svg.append('g').attr('class','chart-axis').attr('transform','translate(40,0)').call(d3.axisLeft(y).ticks(4).tickFormat(v=>`${v} %`));
    const line=d3.line().x((v,i)=>x(i)).y(v=>y(v));
    g.series.forEach(r=>svg.append('path').attr('class','comparison-curve').attr('d',line(r.values)).attr('fill','none').attr('stroke',r.color).attr('stroke-width',2).attr('stroke-dasharray',r.dash||null));
    const cursor=svg.append('line').attr('y1',17).attr('y2',192).attr('stroke','#536d71').attr('stroke-dasharray','2,3').style('display','none');
    svg.on('pointermove',e=>{const [px]=d3.pointer(e,node),h=Math.max(0,Math.min(23,Math.round(x.invert(px))));cursor.attr('x1',x(h)).attr('x2',x(h)).style('display',null);showTooltip(`<b>${g.title} · ${h}:00–${h+1}:00</b><br>Porcentaje de las entradas de toda la semana<br>${g.series.map(r=>`${esc(r.label)}: ${r.values[h].toFixed(2)} %`).join('<br>')}`,e);}).on('pointerleave',()=>{cursor.style('display','none');hideTooltip();});
  }
  host.querySelector('#compare-open-clock').onclick=()=>app.set({inspectorTab:'fingerprint',clock:true,mode:'delta'});
}

function drawEvolution(host,s,app){
  host.innerHTML=`<p class="sub">Entradas por día, promediadas en cada mes de 2020–2024. Esta serie histórica da contexto; las huellas usan solo enero–febrero.</p><svg class="detail-viz" viewBox="0 0 360 230" role="img" aria-label="Evolución mensual de las entradas por día del complejo"></svg><p class="method-note">Los conteos mensuales provienen de los CSV conservados en Semana 6. Las huellas fueron consultadas nuevamente en la API. El histórico puede revisarse; no se mezclan ambos snapshots para calcular los cambios de forma.</p><div class="source-row"><b>Contexto documentado</b><br>La MTA reanudó el servicio nocturno de 24 horas el 17 de mayo de 2021. Esto no prueba el motivo de cada cambio de una estación.<br><a href="https://www.mta.info/press-release/mta-partners-dining-dignitaries-welcome-back-247-subway-service-and-100-percent" target="_blank" rel="noopener">Comunicado oficial MTA ↗</a></div>`;
  const svg=d3.select(host.querySelector('svg')),x=d3.scaleLinear().domain([0,59]).range([49,347]),y=d3.scaleLinear().domain([0,d3.max(s.series)*1.1]).nice().range([190,15]);
  svg.append('g').attr('class','chart-axis').attr('transform','translate(0,190)').call(d3.axisBottom(x).tickValues([0,12,24,36,48]).tickFormat(i=>2020+i/12));
  svg.append('g').attr('class','chart-axis').attr('transform','translate(49,0)').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')));
  svg.append('path').attr('d',d3.area().x((d,i)=>x(i)).y0(y(0)).y1(y)(s.series)).attr('fill','#e1eeea');
  svg.append('path').attr('d',d3.line().x((d,i)=>x(i)).y(y)(s.series)).attr('fill','none').attr('stroke','#137b80').attr('stroke-width',2);
  svg.append('rect').attr('x',49).attr('y',15).attr('width',298).attr('height',175).attr('fill','transparent').on('pointermove',e=>{const [px]=d3.pointer(e),i=Math.max(0,Math.min(59,Math.round(x.invert(px))));showTooltip(`${app.data.meta.months[i]}<br><b>${fmt(s.series[i])} entradas/día</b>`,e);}).on('pointerleave',hideTooltip);
}
