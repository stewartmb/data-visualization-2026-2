import {state,BASE,esc,fmt,signed,profile,measures,hellinger,deltaColor,shareColor,cellValue,showTooltip,hideTooltip,dayShort,relevantEvents,cohortProfile} from './model.js?v=20261028-4';

export const BOROUGH_COLOR={Manhattan:'#1d6f8d',Brooklyn:'#b08a3e',Queens:'#7a5aa6',Bronx:'#5a8a4a'};

export function renderInspector(app){
  const host=document.querySelector('#inspector'),s=app.station(state.selected);
  host.hidden=false;
  if(!s){renderGroup(host,app);return;}
  const a=profile(s,BASE),b=profile(s),m=measures(s),tabs={fingerprint:'Reloj',compare:'Comparar',source:'Fuente'};
  const events=relevantEvents(app.data,s);
  host.innerHTML=`<button class="close" id="close-inspector" aria-label="Cerrar detalle">×</button><div class="eyebrow">COMPLEJO ${s.id} / ${esc(s.borough)}</div><h2>${esc(s.name.replace(/ \(.*/,''))}</h2><div class="sub">Año completo · ${BASE} frente a ${state.year}<br>${s.routes.map(r=>`<span class="route">${esc(r)}</span>`).join('')} <span style="font-size:9px">rutas del catálogo actual</span></div>
  <div id="scatter-host"></div>
  ${events.length?`<details class="method-note service-context"><summary>Contexto de servicio que revisar (${events.length})</summary>${events.map(e=>`<p><b>${esc(e.title)}</b><br>${esc(e.description)}<br><a href="${esc(e.url)}" target="_blank" rel="noopener">Fuente MTA · ${esc(e.source_date)} ↗</a></p>`).join('')}</details>`:''}
  <div class="inspector-controls"><button id="pin-station">${state.pins.includes(s.id)?'◆ Quitar de comparación':'◇ Fijar comparación'}</button><button id="find-neighbors">Buscar similares ↗</button></div>
  <nav class="inspector-tabs" aria-label="Detalle de la estación">${Object.entries(tabs).map(([k,v])=>`<button id="inspect-tab-${k}" data-tab="${k}" class="${k===state.inspectorTab?'active':''}">${v}</button>`).join('')}</nav>
  <div id="detail-body"></div>
  <div class="metric-grid"><div class="metric-tile"><span>CAMBIO DE FORMA · TV</span><strong>${fmt(m.change)} pp</strong></div><div class="metric-tile"><span>PESO AM · DIFERENCIA</span><strong>${signed(m.deltaAM)} pp</strong></div><div class="metric-tile"><span>FIN DE SEMANA · DIFERENCIA</span><strong>${signed(m.deltaWeekend)} pp</strong></div><div class="metric-tile"><span>ÍNDICE DE VOLUMEN · ${BASE} = 100</span><strong>${fmt(m.recovery)} %</strong></div></div>
  <p class="method-note">El peso AM usa 06:00–10:00 de lunes a viernes. El fin de semana usa sábado + domingo sobre una semana comparable. Las proporciones describen entradas agregadas; no identifican personas ni motivos.</p>`;
  drawScatter(host.querySelector('#scatter-host'),app);
  host.querySelector('#close-inspector').onclick=()=>app.set({selected:null});
  host.querySelector('#pin-station').onclick=()=>app.pin(s.id);
  host.querySelector('#find-neighbors').onclick=()=>app.similar(s.id);
  host.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>app.set({inspectorTab:btn.dataset.tab}));
  const body=host.querySelector('#detail-body');
  if(state.inspectorTab==='fingerprint'){drawFingerprint(body,s,app);drawTrajectory(body,s.profiles,app,s.name.replace(/ \(.*/,''));drawDestinations(body,s,app);}
  if(state.inspectorTab==='compare')drawComparison(body,s,app);
  if(state.inspectorTab==='evolution')drawEvolution(body,s,app);
  if(state.inspectorTab==='source')body.innerHTML=`<div class="source-row"><b>Unidad</b><br>ID ${s.id} · complejo de estación, no andén ni línea individual.<br>Lat ${s.lat} · lon ${s.lon}</div><div class="source-row"><b>Qué se mide</b><br>Viajes iniciados en el complejo por día de la semana y hora, en una semana representativa de cada año: promedio de los meses presentes del OD estimado de la MTA, ponderado por las veces que cada día de la semana ocurre en el mes.<br>${BASE}: ${a.observedCells}/168 celdas con viajes · ${state.year}: ${b.observedCells}/168.</div><div class="source-row"><b>Semana representativa</b><br>${BASE}: ${fmt(Math.round(a.weekly))} viajes · ${state.year}: ${fmt(Math.round(b.weekly))} viajes (${fmt(a.daily)} y ${fmt(b.daily)} por día).</div><div class="source-row"><b>Fuente y modelo</b><br><a href="https://data.ny.gov/d/jsu2-fbtj" target="_blank" rel="noopener">MTA Subway Origin-Destination Ridership Estimate ↗</a> (un dataset por año, 2021–2024): estimación de la MTA por encadenamiento de viajes; no son salidas observadas ni trayectorias.<br>Rutas asignadas por nuestro modelo (camino más corto sobre una red de referencia construida del trazado de rutas actual), constante para todos los años.<br>Meses presentes: ${esc(JSON.stringify(app.flows?.meta?.months_present??{}))}.</div><p class="method-note">Las medidas no describen ocupación, congestión ni horarios reales de trenes. Un cruce visual de trazos no es una conexión.</p>`;
}

// Sin selección, el panel no desaparece: muestra la huella del grupo activo (ponderada por entradas),
// con la misma leyenda. Así la leyenda del reloj está siempre a la vista y el detalle es un cambio de sujeto.
function renderGroup(host,app){
  const items=app.filtered(),y=state.year;
  const a=cohortProfile(items,BASE),b=cohortProfile(items,y);
  if(!a||!b){host.innerHTML=`<div class="eyebrow">GRUPO ACTIVO</div><h2>Sin datos</h2><p class="sub">No hay complejos en el grupo.</p>`;return;}
  const nombre=state.cohort?'Grupo seleccionado':state.preset?{morning:'La mañana cambia',weekend:'Otro fin de semana',change:'Ritmos que se alejan',decoupled:'Volumen ≠ ritmo'}[state.preset]:state.query?'Resultados de búsqueda':state.borough==='all'?'Todo el sistema':state.borough;
  const g={id:'__grupo',name:nombre,borough:`${items.length} complejos`,routes:[],profiles:{[String(BASE)]:{...a,observedCells:168},[String(y)]:{...b,observedCells:168}}};
  const m=measures(g);
  host.innerHTML=`<div class="eyebrow">GRUPO ACTIVO · ${items.length} COMPLEJOS</div><h2>${esc(nombre)}</h2><div class="sub">Año completo · ${BASE} frente a ${y} · perfil ponderado por entradas<br>Haz clic en un complejo del mapa o del gráfico para ver el suyo.</div>
  <div id="scatter-host"></div>
  <div id="detail-body" style="margin-top:14px"></div>
  <div class="metric-grid"><div class="metric-tile"><span>CAMBIO DE FORMA · TV</span><strong>${fmt(m.change)} pp</strong></div><div class="metric-tile"><span>PESO AM · DIFERENCIA</span><strong>${signed(m.deltaAM)} pp</strong></div><div class="metric-tile"><span>FIN DE SEMANA · DIFERENCIA</span><strong>${signed(m.deltaWeekend)} pp</strong></div><div class="metric-tile"><span>ÍNDICE DE VOLUMEN · ${BASE} = 100</span><strong>${fmt(m.recovery)} %</strong></div></div>`;
  drawScatter(host.querySelector('#scatter-host'),app);
  drawFingerprint(host.querySelector('#detail-body'),g,app,false);
  const traj={};for(const y of [2021,2022,2023,2024]){const c=cohortProfile(items,y);if(c)traj[y]=c;}
  drawTrajectory(host.querySelector('#detail-body'),traj,app,nombre);
}

// Trayectoria: el sujeto (complejo o grupo) recorre las cinco temporadas en el espacio peso AM × fin de semana,
// con todo el sistema como referencia. Reemplaza a la antigua vista de trayectorias dentro del panel.
function drawTrajectory(host,profiles,app,nombre){
  const years=[2021,2022,2023,2024].filter(y=>profiles[y]);
  if(years.length<2)return;
  const sys={};for(const y of [2021,2022,2023,2024]){const c=cohortProfile(app.data.stations.filter(x=>profile(x,y)),y);if(c)sys[y]=c;}
  const all=[...years.map(y=>profiles[y]),...Object.values(sys)];
  const W=380,H=200,M={t:14,r:14,b:30,l:38};
  const x=d3.scaleLinear([d3.min(all,d=>d.am)-1,d3.max(all,d=>d.am)+1],[M.l,W-M.r]).nice(),y=d3.scaleLinear([d3.min(all,d=>d.weekend)-1,d3.max(all,d=>d.weekend)+1],[H-M.b,M.t]).nice();
  host.insertAdjacentHTML('beforeend',`<h3 class="detail-heading">Trayectoria ${BASE} → ${state.year}: peso de la mañana × peso del fin de semana</h3><svg class="detail-viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trayectoria del sujeto en el espacio peso AM por peso de fin de semana"></svg><p class="sub"><span style="color:#c96035">━</span> ${esc(nombre)} &nbsp; <span style="color:#9aa5a0">━</span> todo el sistema · cada punto es un año</p>`);
  const svg=d3.select(host.querySelector('svg:last-of-type'));
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(0,${H-M.b})`).call(d3.axisBottom(x).ticks(4).tickFormat(v=>`${v} %`));
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(${M.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(v=>`${v} %`));
  svg.append('text').attr('x',W-M.r).attr('y',H-4).attr('text-anchor','end').attr('font-size',8).attr('fill','#6f7d86').text('mañana laboral (6–10 am) →');
  svg.append('text').attr('x',M.l+2).attr('y',M.t-4).attr('font-size',8).attr('fill','#6f7d86').text('↑ fin de semana');
  const line=d3.line().x(d=>x(d.am)).y(d=>y(d.weekend));
  const sy=Object.keys(sys).map(Number).sort();
  svg.append('path').attr('d',line(sy.map(k=>sys[k]))).attr('fill','none').attr('stroke','#9aa5a0').attr('stroke-width',1.5);
  svg.selectAll('.sysdot').data(sy).join('circle').attr('cx',k=>x(sys[k].am)).attr('cy',k=>y(sys[k].weekend)).attr('r',2.2).attr('fill','#9aa5a0');
  svg.append('path').attr('d',line(years.map(k=>profiles[k]))).attr('fill','none').attr('stroke','#c96035').attr('stroke-width',2);
  svg.selectAll('.subdot').data(years).join('circle').attr('cx',k=>x(profiles[k].am)).attr('cy',k=>y(profiles[k].weekend)).attr('r',3.2).attr('fill',k=>k===state.year?'#1b2a33':'#c96035').attr('stroke','#fff').attr('stroke-width',1)
    .on('pointerenter',(e,k)=>showTooltip(`<b>${esc(nombre)} · ${k}</b><br>mañana ${profiles[k].am.toFixed(1)} % · fin de semana ${profiles[k].weekend.toFixed(1)} %`,e)).on('pointerleave',hideTooltip);
  svg.selectAll('.yl').data(years).join('text').attr('x',k=>x(profiles[k].am)+5).attr('y',k=>y(profiles[k].weekend)-5).attr('font-size',8.5).attr('fill','#1b2a33').attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',3).text(k=>k);
}

function drawFingerprint(host,s,app,conVecinos=true){
  host.innerHTML=`<div class="segmented" id="shape-toggle"><button data-clock="true" class="${state.clock?'active':''}">Reloj semanal</button><button data-clock="false" class="${!state.clock?'active':''}">Semana (matriz)</button></div><div class="segmented" style="margin:10px 0" id="detail-mode"><button data-mode="delta" class="${state.mode==='delta'?'active':''}">Diferencia</button><button data-mode="current" class="${state.mode==='current'?'active':''}">${state.year}</button><button data-mode="base" class="${state.mode==='base'?'active':''}">${BASE}</button></div><svg class="detail-viz" role="img" aria-label="Huella de 168 horas del complejo seleccionado"></svg><div class="detail-legend-block">
    <div class="detail-legend-title">${state.mode==='delta'?`Color: cuánto cambió el peso de cada hora, ${state.year} menos ${BASE}`:`Color: peso de cada hora en los viajes iniciados de la semana de ${state.mode==='base'?BASE:state.year}`}</div>
    <div class="detail-legend-scale"><span>${state.mode==='delta'?'−0,65 pp':'0 %'}</span><span class="gradient ${state.mode==='delta'?'':'seq'}"></span><span>${state.mode==='delta'?'+0,65 pp':'1,5 % o más'}</span></div>
    ${state.mode==='delta'?`<div class="detail-legend-row"><i style="background:#247b9b"></i> azul: la hora pesa <b>menos</b> que en ${BASE} <i style="background:#f5f5ef;border:1px solid #ccc"></i> igual <i style="background:#bd5c30"></i> naranja: pesa <b>más</b></div>`:`<div class="detail-legend-row"><i style="background:#f4f5ee;border:1px solid #ccc"></i> claro: casi sin viajes <i style="background:#0d6877"></i> oscuro: una de las horas más cargadas (la semana suma 100 %)</div>`}
    ${state.clock?`<div class="detail-legend-row"><b>Cómo leer el reloj.</b> Cada anillo es un día: <b>lunes en el centro, domingo en el borde</b> (Lun … Dom); la línea punteada separa lunes–viernes de sábado–domingo. Cada sector es una hora: <b>12 am arriba</b>, en el sentido del reloj; 6 am a la derecha, 12 pm abajo, 6 pm a la izquierda. Un sector oscuro a las 8 am en los anillos de lunes a viernes es el pico de la mañana laboral.</div>`:`<div class="detail-legend-row"><b>Cómo leer.</b> Arriba, la forma del día: qué porcentaje de las entradas de la semana entra a cada hora (gris ${BASE}, negro ${state.year}); si el pico negro queda por debajo del gris, el pico se aplanó. En medio, cada fila es un día (lunes arriba, domingo abajo) y cada columna una hora, de 12 am a 11 pm; la franja punteada es la mañana laboral (6–10 am). A la derecha, el peso de cada día en la semana (gris 2020, negro ${state.year}).</div>`}
    <div class="detail-legend-row muted">Valores fuera de la escala saturan el color; pasa el cursor por una celda para ver el valor exacto.</div>
  </div>`;
  host.querySelectorAll('[data-clock]').forEach(btn=>btn.onclick=()=>app.set({clock:btn.dataset.clock==='true'}));
  host.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>app.set({mode:btn.dataset.mode}));
  const svg=d3.select(host.querySelector('svg')).attr('viewBox',state.clock?'0 0 360 362':'0 0 404 318');
  const cells=d3.range(168),fill=i=>state.mode==='delta'?deltaColor(cellValue(s,i)):shareColor(cellValue(s,i));
  let marks;
  if(state.clock){
    const g=svg.append('g').attr('transform','translate(180,175)'),arc=d3.arc();
    // Separación entre lunes–viernes (cinco anillos interiores) y sábado–domingo (dos exteriores).
    const GAP=7,rIn=d=>36+d*15.5+(d>=5?GAP:0),rOut=d=>50+d*15.5+(d>=5?GAP:0);
    marks=g.selectAll('path').data(cells).join('path').attr('d',i=>arc({innerRadius:rIn(Math.floor(i/24)),outerRadius:rOut(Math.floor(i/24)),startAngle:(i%24)*Math.PI/12+.008,endAngle:(i%24+1)*Math.PI/12-.008})).attr('fill',fill);
    g.append('circle').attr('r',(rOut(4)+rIn(5))/2).attr('fill','none').attr('stroke','#1b2a33').attr('stroke-width',.8).attr('stroke-dasharray','3,3').attr('opacity',.45);
    g.append('circle').attr('r',29).attr('fill','#f1f4ee');g.append('text').attr('text-anchor','middle').attr('y',4).attr('fill','#49636b').attr('font-size',14).text(state.mode==='delta'?'Δ':state.mode==='base'?BASE:state.year);
    const letras=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    g.selectAll('.ring-label').data(letras).join('text').attr('class','ring-label').attr('x',(d,k)=>Math.sin(-0.5*Math.PI/12)*((rIn(k)+rOut(k))/2)).attr('y',(d,k)=>-Math.cos(-0.5*Math.PI/12)*((rIn(k)+rOut(k))/2)+2.8).attr('text-anchor','middle').attr('font-size',7).attr('font-weight','700').attr('fill','#102937').attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',2.5).style('pointer-events','none').text(d=>d);
    for(const h of [0,3,6,9,12,15,18,21]){const angle=h*Math.PI/12,r=168;g.append('text').attr('x',Math.sin(angle)*r).attr('y',-Math.cos(angle)*r+4).attr('text-anchor','middle').attr('font-size',10).attr('fill','#60747b').text(h===0?'12 am':h<12?`${h} am`:h===12?'12 pm':`${h-12} pm`);}
  }else{
    // Huella rectilínea: arriba, el perfil de 24 h de la semana entera (año base gris, año elegido en tinta);
    // en medio, la matriz día × hora; a la derecha, el peso de cada día. Posición en escala común
    // para las curvas y las barras; el color solo en la matriz.
    const a=profile(s,BASE).p,b=profile(s).p,X0=36,CW=12,RH=20,Y0=108;
    const ampm=h=>h===0?'12 am':h<12?`${h} am`:h===12?'12 pm':`${h-12} pm`;
    const porHora=p=>d3.range(24).map(h=>100*d3.sum(d3.range(7),d=>p[d*24+h]));
    const ha=porHora(a),hb=porHora(b),top=Math.max(d3.max(ha),d3.max(hb))*1.08;
    const x=h=>X0+h*CW+CW/2,yC=d3.scaleLinear([0,top],[86,24]);
    const area=d3.area().x((v,i)=>x(i)).y0(86).y1(v=>yC(v)).curve(d3.curveMonotoneX),line=d3.line().x((v,i)=>x(i)).y(v=>yC(v)).curve(d3.curveMonotoneX);
    svg.append('path').attr('d',area(ha)).attr('fill','#dfe3dd');
    svg.append('path').attr('d',line(ha)).attr('fill','none').attr('stroke','#9aa5a0').attr('stroke-width',1);
    svg.append('path').attr('d',line(hb)).attr('fill','none').attr('stroke','#1b2a33').attr('stroke-width',2);
    const ia=d3.maxIndex(ha),ib=d3.maxIndex(hb);
    svg.append('text').attr('x',X0).attr('y',9).attr('font-size',8.5).attr('fill','#6f7d86').text('% de las entradas de la semana en cada hora · gris '+BASE+' · negro '+state.year);
    svg.append('text').attr('x',Math.min(x(ib),X0+18*CW)).attr('y',yC(hb[ib])-4).attr('font-size',8.5).attr('text-anchor','middle').attr('fill','#1b2a33').text(`pico ${ampm(ib)} · ${hb[ib].toFixed(1)} %`);
    svg.append('g').attr('class','chart-axis').attr('transform',`translate(${X0},0)`).call(d3.axisLeft(yC).ticks(3).tickFormat(v=>`${v} %`).tickSize(2));
    marks=svg.append('g').selectAll('rect').data(cells).join('rect').attr('x',i=>X0+(i%24)*CW).attr('y',i=>Y0+Math.floor(i/24)*RH).attr('width',CW-1).attr('height',RH-1).attr('fill',fill);
    svg.append('g').selectAll('text').data(dayShort).join('text').attr('x',X0-6).attr('y',(d,i)=>Y0+i*RH+RH/2+3.5).attr('text-anchor','end').attr('fill','#1b2a33').attr('font-size',9.5).attr('font-weight',(d,i)=>i>=5?'700':'400').text(d=>d);
    for(const h of [0,3,6,9,12,15,18,21,23])svg.append('text').attr('x',x(h)).attr('y',Y0+7*RH+12).attr('text-anchor','middle').attr('fill','#6f7d86').attr('font-size',8.5).text(ampm(h));
    svg.append('line').attr('x1',X0+6*CW).attr('x2',X0+6*CW).attr('y1',Y0-3).attr('y2',Y0+7*RH).attr('stroke','#1b2a33').attr('stroke-dasharray','2,3').attr('opacity',.5);
    svg.append('line').attr('x1',X0+10*CW).attr('x2',X0+10*CW).attr('y1',Y0-3).attr('y2',Y0+7*RH).attr('stroke','#1b2a33').attr('stroke-dasharray','2,3').attr('opacity',.5);
    svg.append('text').attr('x',X0+8*CW).attr('y',Y0-5).attr('text-anchor','middle').attr('font-size',8).attr('fill','#6f7d86').text('mañana laboral · 6–10 am');
    // peso de cada día: barras del año base (gris) y año elegido (tinta)
    const porDia=p=>d3.range(7).map(d=>100*d3.sum(p.slice(d*24,d*24+24)));
    const da=porDia(a),db=porDia(b),bx=d3.scaleLinear([0,Math.max(d3.max(da),d3.max(db))],[0,44]),BX=X0+24*CW+10;
    svg.append('text').attr('x',BX).attr('y',Y0-5).attr('font-size',8).attr('fill','#6f7d86').text('% del día');
    svg.append('g').selectAll('rect.a').data(da).join('rect').attr('x',BX).attr('y',(v,i)=>Y0+i*RH+2).attr('width',v=>bx(v)).attr('height',7).attr('fill','#c9cfca');
    svg.append('g').selectAll('rect.b').data(db).join('rect').attr('x',BX).attr('y',(v,i)=>Y0+i*RH+10).attr('width',v=>bx(v)).attr('height',7).attr('fill','#1b2a33');
    svg.append('g').selectAll('text.v').data(db).join('text').attr('x',(v)=>BX+bx(v)+3).attr('y',(v,i)=>Y0+i*RH+17).attr('font-size',7.5).attr('fill','#1b2a33').text((v,i)=>`${v.toFixed(0)}`);
    svg.append('text').attr('x',X0).attr('y',Y0+7*RH+28).attr('font-size',8.5).attr('fill','#6f7d86').text(`Peso AM lun–vie: ${profile(s,BASE).am.toFixed(1)} % → ${profile(s).am.toFixed(1)} % · fin de semana: ${profile(s,BASE).weekend.toFixed(1)} % → ${profile(s).weekend.toFixed(1)} %`);
  }
  // Clic en una celda fija el día y la hora del mapa; la celda activa se marca con contorno (no con color).
  marks.style('cursor','pointer').on('click',(e,i)=>app.set({flowDay:Math.floor(i/24),flowHour:i%24}));
  const activa=state.flowDay*24+state.flowHour;
  marks.filter(i=>i===activa).attr('stroke','#102937').attr('stroke-width',1.6).raise();
  marks.on('pointerenter',(e,i)=>{
    const a=profile(s,BASE).p[i]*100,b=profile(s).p[i]*100;
    showTooltip(`<b>${dayShort[Math.floor(i/24)]} · ${(i%24)===0?'12 am':(i%24)<12?(i%24)+' am':(i%24)===12?'12 pm':((i%24)-12)+' pm'}</b><br>${BASE}: ${fmt(Math.round(profile(s,BASE).p[i]*profile(s,BASE).weekly))} viajes · ${a.toFixed(3)} % de la semana<br>${state.year}: ${fmt(Math.round(profile(s).p[i]*profile(s).weekly))} viajes · ${b.toFixed(3)} %<br>Diferencia: ${(b-a).toFixed(3)} pp<br><small>Clic: fijar este día y hora en el mapa</small>`,e);
  }).on('pointerleave',hideTooltip);
  if(!conVecinos)return;
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
  const rows=[{label:BASE+' · selección',p:profile(s,BASE).p,color:'#7c8c99',dash:'3,3'},{label:`${state.year} · selección`,p:profile(s).p,color:'#137b80'}];
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
  host.innerHTML=`<p class="sub">Entradas por día, promediadas en cada mes de 2021–2024.</p><svg class="detail-viz" viewBox="0 0 360 230" role="img" aria-label="Evolución mensual de las entradas por día del complejo"></svg><p class="method-note">Los conteos mensuales provienen de los CSV conservados en Semana 6. Las huellas fueron consultadas nuevamente en la API. El histórico puede revisarse; no se mezclan ambos snapshots para calcular los cambios de forma.</p><div class="source-row"><b>Contexto documentado</b><br>La MTA reanudó el servicio nocturno de 24 horas el 17 de mayo de 2021. Esto no prueba el motivo de cada cambio de una estación.<br><a href="https://www.mta.info/press-release/mta-partners-dining-dignitaries-welcome-back-247-subway-service-and-100-percent" target="_blank" rel="noopener">Comunicado oficial MTA ↗</a></div>`;
  const svg=d3.select(host.querySelector('svg')),x=d3.scaleLinear().domain([0,59]).range([49,347]),y=d3.scaleLinear().domain([0,d3.max(s.series)*1.1]).nice().range([190,15]);
  svg.append('g').attr('class','chart-axis').attr('transform','translate(0,190)').call(d3.axisBottom(x).tickValues([0,12,24,36]).tickFormat(i=>2021+i/12));
  svg.append('g').attr('class','chart-axis').attr('transform','translate(49,0)').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')));
  svg.append('path').attr('d',d3.area().x((d,i)=>x(i)).y0(y(0)).y1(y)(s.series)).attr('fill','#e1eeea');
  svg.append('path').attr('d',d3.line().x((d,i)=>x(i)).y(y)(s.series)).attr('fill','none').attr('stroke','#137b80').attr('stroke-width',2);
  svg.append('rect').attr('x',49).attr('y',15).attr('width',298).attr('height',175).attr('fill','transparent').on('pointermove',e=>{const [px]=d3.pointer(e),i=Math.max(0,Math.min(59,Math.round(x.invert(px))));showTooltip(`${app.data.meta.months[i]}<br><b>${fmt(s.series[i])} entradas/día</b>`,e);}).on('pointerleave',hideTooltip);
}

// A dónde van las entradas de la mañana (6–10 am, lun–vie), según la estimación O-D de la MTA.
// Barras horizontales (posición en escala común), no sectores; el año es el del contexto.
function drawDestinations(host,s,app){
  const F=app.flows;if(!F)return;
  const y=String(state.year),top=F.origins[s.id]?.[y];
  const years=F.meta.years.map(String).filter(k=>F.manhattanShare[s.id]?.[k]!=null);
  const wrap=document.createElement('div');wrap.className='destinations';
  if(!top){wrap.innerHTML=`<div class="detail-heading">A dónde va la mañana</div><p class="method-note">Sin estimación origen–destino para ${esc(y)}; existe desde 2021.</p>`;host.appendChild(wrap);return;}
  const total=d3.sum(top,d=>d[1]),max=top[0][1],lista=top.slice(0,6);
  const nombre=id=>{const t=app.station(id);return t?t.name.replace(/ \(.*/,''):id;};
  wrap.innerHTML=`<div class="detail-heading">A dónde va la mañana · 6–10 am, lun–vie, ${esc(y)}</div>
  <div class="dest-list">${lista.map(([id,v])=>`<button data-dest="${esc(id)}" title="Ver ${esc(nombre(id))}"><span class="dest-name">${esc(nombre(id))}</span><span class="dest-bar"><i style="width:${(100*v/max).toFixed(1)}%"></i></span><span class="dest-val">${fmt(100*v/total)} %</span></button>`).join('')}</div>
  <div class="dest-share">Hacia Manhattan: ${years.map(k=>`<b>${fmt(F.manhattanShare[s.id][k])} %</b> <small>${k}</small>`).join(' <span class="dest-arrow">→</span> ')}</div>
  <div class="detail-legend"><span>% de los viajes AM que salen de este complejo; estimación O-D de la MTA</span></div>`;
  wrap.querySelectorAll('[data-dest]').forEach(b=>b.onclick=()=>app.select(b.dataset.dest));
  host.appendChild(wrap);
}

// 02 · Volumen × forma: cada complejo es un punto; x = índice de volumen (año base = 100), y = cambio de
// forma (TV). Posición para las dos medidas (el canal más efectivo), color categórico para el borough,
// el grupo activo en color pleno y el resto atenuado; el seleccionado con anillo. Clic en un punto lo selecciona.
function drawScatter(host,app){
  if(!host)return;
  const all=app.data.stations.filter(s=>measures(s)),items=new Set(app.filtered().map(s=>s.id));
  const W=360,H=232,M={t:22,r:14,b:34,l:40};
  const vals=all.map(s=>measures(s));
  const xMax=Math.ceil(d3.quantile(vals.map(m=>m.recovery).sort(d3.ascending),0.99)/50)*50,yMax=Math.ceil(d3.quantile(vals.map(m=>m.change).sort(d3.ascending),0.99)/5)*5;
  const x=d3.scaleLinear().domain([Math.min(100,Math.floor(d3.min(vals,m=>m.recovery)/10)*10),xMax]).range([M.l,W-M.r]).clamp(true),y=d3.scaleLinear().domain([0,yMax]).range([H-M.b,M.t]).clamp(true);
    host.innerHTML=`<div class="scatter-block"><div class="eyebrow">02 · VOLUMEN × FORMA</div><h3 class="scatter-title">Crecer y cambiar de forma son dos cosas distintas.</h3>
  <svg class="detail-viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Volumen frente a cambio de forma, un punto por complejo"></svg>
  <div class="scatter-key"><span>x: 100 % = mismo volumen de viajes iniciados que en ${BASE}</span><span>y: cuánto cambió el reparto entre días y horas; 0 = mismo patrón</span><span>${all.length} complejos comparables · ${app.data.stations.length-all.length} sin comparación válida</span></div></div>`;
  const svg=d3.select(host.querySelector('svg'));
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(0,${H-M.b})`).call(d3.axisBottom(x).ticks(5).tickFormat(v=>v+' %').tickSize(3));
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(${M.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(3));
  svg.append('line').attr('x1',x(100)).attr('x2',x(100)).attr('y1',M.t).attr('y2',H-M.b).attr('stroke','#9aa6a1').attr('stroke-dasharray','3 3');
  svg.append('text').attr('x',x(100)+4).attr('y',H-M.b-5).attr('font-size',8.5).attr('fill','#6f7d86').text(`base ${BASE} = 100`);
  svg.append('text').attr('x',W-M.r).attr('y',H-8).attr('text-anchor','end').attr('font-size',8.5).attr('fill','#6f7d86').text(`volumen · ${state.year} frente a ${BASE} →`);
  svg.append('text').attr('x',M.l).attr('y',M.t-9).attr('font-size',8.5).attr('fill','#6f7d86').text('↑ cambio de forma · TV (pp)');
  const ordered=[...all].sort((a,b)=>(items.has(a.id)?1:0)-(items.has(b.id)?1:0));
  svg.append('g').selectAll('circle').data(ordered,s=>s.id).join('circle')
    .attr('cx',s=>x(measures(s).recovery)).attr('cy',s=>y(measures(s).change)).attr('r',s=>items.has(s.id)?3:2.2)
    .attr('fill','#1d6f8d').attr('opacity',s=>items.has(s.id)?.55:.1).style('cursor','pointer')
    .on('pointerenter',(e,s)=>{const m=measures(s);showTooltip(`<b>${esc(s.name.replace(/ \(.*/,''))}</b><br>${esc(s.borough)}<br>volumen ${fmt(m.recovery)} % · TV ${fmt(m.change)} pp`,e);}).on('pointermove',(e,s)=>{const m=measures(s);showTooltip(`<b>${esc(s.name.replace(/ \(.*/,''))}</b><br>volumen ${fmt(m.recovery)} % · TV ${fmt(m.change)} pp`,e);}).on('pointerleave',hideTooltip)
    .on('click',(e,s)=>app.select(s.id));
  const sel=app.station(state.selected);
  if(sel&&measures(sel)){const m=measures(sel);svg.append('circle').attr('cx',x(m.recovery)).attr('cy',y(m.change)).attr('r',6.5).attr('fill','none').attr('stroke','#102937').attr('stroke-width',1.8).style('pointer-events','none');
    svg.append('text').attr('x',x(m.recovery)+9).attr('y',y(m.change)+3).attr('font-size',9).attr('fill','#102937').attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',3).text(sel.name.replace(/ \(.*/,''));}
}
