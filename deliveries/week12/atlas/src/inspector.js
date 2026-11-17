import {state,BASE as MAP_BASE,esc,fmt,signed,profile,deltaColor,shareColor,showTooltip,hideTooltip,dayShort,cohortProfile} from './model.js?v=20261028-4';

import {scatterDomain,comparisonContext} from './scatter-domain.mjs';
import {odPeriodLabel} from './od-period.mjs';
import {activeODCompareBase,activeContrastBase,inspectorContrast,contrastMeasures,contrastCell,annualMeasures,isODMap} from './contrast-model.mjs?v=od-only1';
let BASE=2021;
const measures=(s,y=state.year)=>contrastMeasures(s,BASE,y);
const cellValue=(s,i,mode=state.mode)=>contrastCell(s,i,mode,BASE,state.year);
const hourLabel=h=>h===0?'12 am':h<12?`${h} am`:h===12?'12 pm':`${h-12} pm`;
const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

export function updateClockTime(day,hour){
  const active=day===null?null:day*24+hour;
  d3.selectAll('#detail-body [data-clock-cell]')
    .attr('stroke',i=>i===active?'#102937':null)
    .attr('stroke-width',i=>i===active?1.6:null)
    .attr('aria-pressed',i=>String(i===active))
    .filter(i=>i===active).raise();
  document.querySelector('#clock-annual')?.setAttribute('aria-pressed',String(day===null));
}

export const BOROUGH_COLOR={Manhattan:'#1d6f8d',Brooklyn:'#b08a3e',Queens:'#7a5aa6',Bronx:'#5a8a4a'};

function coverageLabel(app){
  const months=app.contrast?.meta?.months_present||app.flows?.meta?.months_present||{};
  const describe=y=>{const m=months[String(y)]||[];return m.length===12?'enero–diciembre':m.join(',')==='1,2'?'enero–febrero':m.length?`${m.length} meses`:'cobertura sin verificar';};
  const b=describe(state.year);
  if(app.contrast?.base===null)return `${b} · ${state.year}`;
  const a=describe(BASE);
  return a===b?`${a} · ${BASE} → ${state.year}`:`${BASE}: ${a} · ${state.year}: ${b}`;
}

let scatterResizeObserver;

export function renderInspector(mapApp){
  scatterResizeObserver?.disconnect();
  const paired=activeODCompareBase(state,mapApp.flows)!==null;
  const annual=isODMap(state)&&!paired;
  const dataset=mapApp.dataset;
  BASE=annual?null:activeContrastBase(state,mapApp.flows,MAP_BASE,dataset);
  const app=inspectorContrast(mapApp,BASE,state.year);
  const fallback=document.querySelector('#inspector');
  const mapClock=document.querySelector('#map-clock');
  const mapSummary=document.querySelector('#atlas-view-summary');
  const mapSubject=state.view==='map'?mapSummary.querySelector('#map-subject'):null;
  const mapControls=document.querySelector('.map-sidebar > .map-panel-controls');
  mapSummary.hidden=!mapSubject;
  const host=mapSubject??fallback;
  fallback.hidden=host!==fallback;
  if(fallback.hidden)fallback.replaceChildren();
  const selected=app.station(state.selected);
  const mapScatter=document.querySelector('#map-scatter');
  mapScatter?.replaceChildren();
  const evidenceSlot=document.querySelector('#atlas-evidence');
  evidenceSlot.replaceChildren();
  if(mapClock)mapClock.hidden=true;
  const items=app.filtered(),a=annual?null:cohortProfile(items,BASE),b=cohortProfile(items,state.year);
  host.hidden=false;state.clock=true;
  const selectedValid=selected&&(annual?annualMeasures(selected,state.year):measures(selected));
  const groupHasData=!!b&&(annual||!!a);
  const filtered=state.preset||state.tvMin>0||state.tvMax<100||Object.values(state.ranges).some(Boolean);
  const nombre=selected?selected.name.replace(/ \(.*/,''):state.cohort?(state.cohortSource==='scatter'?'Área en la dispersión':'Grupo seleccionado'):state.query?'Resultados de búsqueda':state.borough!=='all'?state.borough:filtered?'Grupo filtrado':'Todo el sistema';
  const profiles=annual?{[state.year]:b}:{[BASE]:a,[state.year]:b};
  const subject=selected??{profiles,name:nombre==='Todo el sistema'?'todo el sistema':nombre};
  const contrastControl=annual||paired?''
    : `<label for="contrast-base" style="font-weight:700">Año de referencia</label><select id="contrast-base" aria-label="Año de contraste de los gráficos" style="font:inherit;padding:2px 5px;width:auto">${dataset.years.filter(y=>y!==state.year).map(y=>`<option value="${y}"${y===BASE?' selected':''}>${y}</option>`).join('')}</select><span>→ ${state.year}</span>`;
  const scope=mapApp.odScope;
  const scopeTitle=mapSubject&&scope.zones?'Zona A ↔ Zona B':nombre;
  const scopeSize=mapSubject&&!selected
    ? scope.zones?`${scope.zones[0].length} en A · ${scope.zones[1].length} en B`
    : scope.origins!==null||state.cohort?`${scope.origins?.length??items.length} ${dataset.stationLabel}`:''
    : '';
  const stationNote=selected?`${dataset.id==='bart'?'Estación':'Complejo'} ${selected.id} · ${selected.borough}`:'';
  const scopeNotes=mapSubject?[stationNote,scopeSize,...scope.notes].filter(Boolean).join(' · '):'';
  const timeSummary=mapSubject
    ? `<div class="map-scope-period"><strong id="map-context-year">${BASE!==null?`${BASE} → ${state.year}`:state.year}</strong>${mapClock?`<span aria-hidden="true">·</span><output id="flow-period">${odPeriodLabel(state.flowDay,state.flowHour)}</output>`:''}</div>`
    : '';
  const header=`<header class="linked-heading">
    ${selected&&!mapSubject?`<div class="eyebrow">${dataset.id==='bart'?'ESTACIÓN':'COMPLEJO'} ${esc(selected.id)} · ${esc(selected.borough)}</div>`:''}
    <h2${mapSubject?` title="${esc(scopeTitle)}"`:''}>${esc(scopeTitle)}</h2>
    ${timeSummary}
    ${scopeNotes?`<p class="map-scope-notes" title="${esc(scopeNotes)}">${esc(scopeNotes)}</p>`:mapSubject&&!groupHasData&&!selected?'<p class="map-scope-notes">Sin datos para la selección</p>':''}
    ${contrastControl?`<div class="contrast-context">${contrastControl}</div><p id="contrast-source">${esc(app.contrast.label)} · ${esc(coverageLabel(app))}</p>`:''}
    ${selected?'<button class="close" id="clear-subject" aria-label="Quitar selección">×</button>':''}
  </header>`;
  if(!mapSubject&&!selected&&!groupHasData){
    host.innerHTML='<h2>Sin datos para la selección</h2><button id="clear-empty">Ver todo el sistema</button>';
    host.querySelector('#clear-empty').onclick=()=>app.resetScope();
    return;
  }
  host.innerHTML=`${header}
  <section id="scatter-host" aria-label="${annual?'Afluencia y concentración horaria':'Volumen frente a forma semanal'}"></section>
  ${mapClock?'':'<section class="clock-panel" aria-label="Reloj semanal de la selección"><div id="detail-body"></div></section>'}
  <details id="atlas-evidence-content" class="inline-evidence"><summary>Fuentes y método</summary><div><b>${esc(coverageLabel(app))}</b><p>El mapa muestra el promedio diario anual o los viajes que comienzan en la hora seleccionada. La dispersión y el reloj resumen la semana representativa del período disponible.</p><p>Origen–destino estimado por MTA; los recorridos son asignados por un modelo sobre una red de referencia, no trayectorias observadas. Se utilizan los doce meses completos de cada año, ponderados por la cantidad de cada día de la semana.</p><p>Origen–destino MTA, 2021–2025.</p><p>Volumen: ${esc(app.contrast.unit)}. Forma: redistribución de sus 168 pesos semanales; TV=0 significa mismo patrón. Un grupo se calcula sumando cantidades antes de normalizar.</p><p>La referencia GTFS corresponde a 2026; no representa el servicio histórico. Las curvas libres son abstracciones visuales, no nuevas vías. El modelo minimiza un costo basado en longitud de vía y transbordos GTFS declarados. Usa una red fija a todas las horas. El balance conserva aparte 0,1333 viajes semanales representativos no mapeados en 2023.</p></div></details>`;
  if(dataset.id==='bart'){
    const description=annual?'La dispersión muestra el promedio diario y el peso de la hora pico de cada estación.':'La dispersión compara volumen y forma. Si una estación carece de viajes en uno de los años, queda fuera de esa comparación.';
    host.querySelector('#atlas-evidence-content > div').innerHTML=`<p>${esc(dataset.evidence)}</p><p>El reloj muestra el peso de cada hora en la semana. ${description}</p>`;
  }
  if(annual&&dataset.id==='nyc'){
    host.querySelector('#atlas-evidence-content > div').innerHTML=`<p>${esc(coverageLabel(app))}. Distribución de los viajes OD estimados por la MTA, ponderada por el calendario. El reloj del sistema suma los viajes por franja antes de calcular su porcentaje semanal.</p><p>La dispersión muestra el promedio diario y la proporción que concentra la franja de mayor demanda de cada complejo. Los recorridos del mapa se asignan sobre la red GTFS de referencia. El grafo usa paradas y transbordos declarados, con las entradas y salidas agrupadas por complejo.</p>`;
  }
  if(!annual&&selectedValid&&dataset.id==='nyc'){
    const context=comparisonContext(selected.id,BASE,state.year);
    if(context)host.querySelector('#atlas-evidence-content > div').insertAdjacentHTML('afterbegin',`<p class="comparison-closure-note"><b>${context.label}</b><br>${esc(context.explanation)}<br>${context.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)} ↗</a>`).join(' · ')}</p>`);
  }
  host.querySelector('#contrast-base')?.addEventListener('change',event=>{
    mapApp.setContrastBase(+event.currentTarget.value);
  });
  if(dataset.id==='nyc'&&(state.year===2025||BASE===2025)){
    host.querySelector('#atlas-evidence-content > div').insertAdjacentHTML('beforeend',
      `<p><strong>Cobertura de 2025.</strong> Algunos complejos de Rockaways carecen de registros publicados entre febrero y abril, durante las obras de la línea A. Los recorridos del Atlas se asignan sobre la red GTFS de referencia de 2026. Se contabilizaron por separado cuatro registros de Staten Island Railway, fuera de la red de subway analizada. <a href="https://data.ny.gov/d/y2qv-fytt" target="_blank" rel="noopener">Fuente OD 2025</a> · <a href="https://www.mta.info/document/150141" target="_blank" rel="noopener">Obras de Rockaways</a></p>`);
  }
  const evidence=host.querySelector('#atlas-evidence-content');
  evidence.querySelector('div').insertAdjacentHTML('beforeend',
    `<p><strong>Reloj semanal.</strong> Cada anillo es un día, de lunes en el centro a domingo en el exterior. Selecciona una celda para ver esa hora.${mapClock&&mapApp.flows.annual?' Vuelve a pulsarla o elige el centro del reloj para ver todo el año.':''}</p>
    <p><strong>Fuentes.</strong> ${esc(dataset.credit)}</p>`);
  evidenceSlot.append(evidence);
  const detail=(mapClock??host).querySelector('#detail-body');
  if(mapClock)mapClock.hidden=false;
  else mapControls?.append(detail.closest('.clock-panel'));
  drawFingerprint(detail,subject,app,annual,selected?!!selectedValid:groupHasData);
  const scatter=host.querySelector('#scatter-host');
  if(mapScatter)mapScatter.append(scatter);
  else mapControls?.append(scatter);
  drawScatter(scatter,app,annual);
  host.querySelector('#clear-subject')?.addEventListener('click',()=>app.set({selected:null}));
}

// Trayectoria: el sujeto (complejo o grupo) recorre las cinco temporadas en el espacio peso AM × fin de semana,
// con todo el sistema como referencia. Reemplaza a la antigua vista de trayectorias dentro del panel.
function drawTrajectory(host,profiles,app,nombre){
  const years=app.flows.meta.years.filter(y=>profiles[y]);
  if(years.length<2)return;
  const sys={};for(const y of years){const c=cohortProfile(app.data.stations.filter(x=>profile(x,y)),y);if(c)sys[y]=c;}
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

function drawFingerprint(host,s,app,annual,hasData){
  const unit=app.contrast.unit;
  const mode=annual?'current':state.mode;
  const delta=mode==='delta';
  const shownYear=mode==='base'?BASE:state.year;
  const annualMap=!!app.flows?.annual;
  const current=profile(s);
  const reference=annual?null:profile(s,BASE);
  const controls=annual?'':`<div class="segmented" id="detail-mode"><button data-mode="delta" class="${delta?'active':''}">Δ</button><button data-mode="current" class="${mode==='current'?'active':''}">${state.year}</button><button data-mode="base" class="${mode==='base'?'active':''}">${BASE}</button></div>`;
  host.innerHTML=`<div class="clock-toolbar"><h3>Ritmo semanal</h3>${controls}</div>
    <svg class="detail-viz clock-viz" viewBox="0 0 360 362" role="group" aria-label="Reloj de siete días y veinticuatro horas"></svg>
    <div class="detail-legend-block">
      <div class="detail-legend-title">${delta?'Cambio del peso semanal':'% de la semana'}</div>
      <div class="detail-legend-scale" style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px">
        <span class="gradient ${delta?'':'seq'}" style="grid-column:1/-1;width:100%;height:9px" role="img"
          aria-label="${delta?'Cambio de −0,65 a +0,65 puntos porcentuales.':'Peso de 0 a 1,5 % del total semanal.'}"></span>
        <span>${delta?'Perdió peso':'Menor peso'}</span><span style="text-align:right">${delta?'Ganó peso':'Mayor peso'}</span>
      </div>
    </div>`;
  host.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>app.set({mode:btn.dataset.mode}));
  const g=d3.select(host.querySelector('svg')).append('g').attr('transform','translate(180,175)');
  const arc=d3.arc(),cells=d3.range(168);
  const rIn=d=>36+d*15.5+(d>=5?7:0),rOut=d=>50+d*15.5+(d>=5?7:0);
  const fill=i=>!hasData?'#f0f2f1':delta?deltaColor(cellValue(s,i,mode)):shareColor(100*(mode==='base'?reference:current).p[i]);
  const marks=g.selectAll('path').data(cells).join('path')
    .attr('d',i=>arc({innerRadius:rIn(Math.floor(i/24)),outerRadius:rOut(Math.floor(i/24)),startAngle:(i%24)*Math.PI/12+.008,endAngle:(i%24+1)*Math.PI/12-.008}))
    .attr('fill',fill);
  g.append('circle').attr('r',(rOut(4)+rIn(5))/2).attr('fill','none').attr('stroke','#1b2a33').attr('stroke-width',.8).attr('stroke-dasharray','3,3').attr('opacity',.45);
  const center=g.append('g');
  center.append('circle').attr('r',29).attr('fill','#f1f4ee');
  const text=center.append('text').attr('text-anchor','middle').attr('fill','#49636b');
  if(!hasData){
    text.attr('font-size',11).attr('y',4).text('Sin datos');
    center.append('title').text('Sin datos para el ritmo semanal de esta selección.');
  }else if(annualMap){
    const selectYear=()=>app.setFlowTime(null,null);
    center.attr('id','clock-annual').attr('tabindex',0).attr('role','button').attr('aria-label','Todo el año')
      .on('click',selectYear)
      .on('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();selectYear();}
      });
    text.attr('font-size',11);
    text.append('tspan').attr('x',0).attr('y',-3).text('Todo');
    text.append('tspan').attr('x',0).attr('y',10).text('el año');
  }else text.attr('y',4).attr('font-size',14).text(delta?'Δ':shownYear);
  g.selectAll('.ring-label').data(dayShort).join('text').attr('class','ring-label')
    .attr('x',(d,k)=>Math.sin(-0.5*Math.PI/12)*((rIn(k)+rOut(k))/2))
    .attr('y',(d,k)=>-Math.cos(-0.5*Math.PI/12)*((rIn(k)+rOut(k))/2)+2.8)
    .attr('text-anchor','middle').attr('font-size',10).attr('font-weight','700').attr('fill','#102937')
    .attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',2.5).style('pointer-events','none').text(d=>d);
  for(const h of [0,3,6,9,12,15,18,21]){
    const angle=h*Math.PI/12,r=168;
    g.append('text').attr('x',Math.sin(angle)*r).attr('y',-Math.cos(angle)*r+4)
      .attr('text-anchor','middle').attr('font-size',12).attr('fill','#60747b').text(hourLabel(h));
  }
  if(!hasData)return;
  const setTime=i=>{
    const day=Math.floor(i/24),hour=i%24;
    if(annualMap&&day===state.flowDay&&hour===state.flowHour)app.setFlowTime(null,null);
    else app.setFlowTime(day,hour);
  };
  marks.attr('data-clock-cell',i=>i).attr('id',i=>`clock-cell-${i}`).attr('tabindex',0).attr('role','button')
    .attr('aria-label',i=>odPeriodLabel(Math.floor(i/24),i%24))
    .style('cursor','pointer').on('click',(e,i)=>setTime(i))
    .on('keydown',(e,i)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setTime(i);}});
  updateClockTime(state.flowDay,state.flowHour);
  marks.on('pointerenter',(e,i)=>{
    const heading=`<b>${days[Math.floor(i/24)]} · ${hourLabel(i%24)}</b>`;
    const line=(p,year)=>`${year} · ${fmt(p.p[i]*p.weekly)} ${esc(unit)} · ${(100*p.p[i]).toFixed(3)} % semanal`;
    const values=reference
      ? `${line(reference,BASE)}<br>${line(current,state.year)}<br>Cambio de volumen: ${signed(current.p[i]*current.weekly-reference.p[i]*reference.weekly)} ${esc(unit)}<br>Cambio de peso semanal: ${(100*(current.p[i]-reference.p[i])).toFixed(3)} pp`
      : line(current,state.year);
    showTooltip(`${heading}<br>${values}`,e);
  }).on('pointerleave',hideTooltip);
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
  host.innerHTML=`<p class="sub">Entradas por día, promediadas en cada mes del período de estudio.</p><svg class="detail-viz" viewBox="0 0 360 230" role="img" aria-label="Evolución mensual de las entradas por día del complejo"></svg><p class="method-note">Los conteos mensuales provienen de los CSV conservados en Semana 6. Las huellas fueron consultadas nuevamente en la API. El histórico puede revisarse; no se mezclan ambos snapshots para calcular los cambios de forma.</p><div class="source-row"><b>Contexto documentado</b><br>La MTA reanudó el servicio nocturno de 24 horas el 17 de mayo de 2021. Esto no prueba el motivo de cada cambio de una estación.<br><a href="https://www.mta.info/press-release/mta-partners-dining-dignitaries-welcome-back-247-subway-service-and-100-percent" target="_blank" rel="noopener">Comunicado oficial MTA ↗</a></div>`;
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
function drawScatter(host,app,annual){
  if(!host)return;
  scatterResizeObserver?.disconnect();
  const stations=app.data.stations;
  const items=new Set(app.filtered().map(s=>s.id));
  const scatterArea=state.cohortSource==='scatter'&&!!state.cohort;
  const rows=stations.flatMap(station=>{
    const m=annual?annualMeasures(station,state.year):measures(station);
    if(!m)return [];
    return [{station,id:station.id,recovery:annual?m.daily:m.recovery,
      change:annual?m.peakShare:m.change,peak:m.peak}];
  });
  const domain=annual?null:scatterDomain(rows,BASE,state.year);
  const contextual=new Set(domain?.context.map(r=>r.id));
  const plotted=rows.filter(s=>!contextual.has(s.id));
  const xMax=domain?.xMax??(d3.max(rows,r=>r.recovery)||1);
  const yMax=domain?.yMax??(d3.max(rows,r=>r.change)||1);
  const title=annual?'Afluencia y concentración horaria':'Más viajes, ¿otra semana?';
  const xLabel=annual?'Viajes por día':`Volumen · ${state.year} frente a ${BASE}`;
  const yLabel=annual?'% semanal en la hora pico':'Cambio de forma · TV (pp)';
  const unit=app.dataset.id==='bart'?'estación':'complejo';
  const through=annual?app.flows.through:null;
  const indices=new Map(app.flows.nodes.map((station,i)=>[station.id,i]));
  const key=annual
    ? `La hora pico es la franja de una hora con más viajes en la semana de cada ${unit}.`
    : `100 % = volumen de ${BASE} · TV = cambio del reparto semanal`;
  const missing=stations.length-rows.length;
  host.innerHTML=`<div class="scatter-block">
    <div class="scatter-heading">
      <h3 id="scatter-title" class="scatter-title">${title}</h3>
      <div class="scatter-area-actions">
        <button id="scatter-draw-area" type="button" class="text-button" aria-pressed="false" aria-controls="scatter-plot" title="Rodea los puntos y suelta.">Dibujar área</button>
        ${scatterArea?'<button id="scatter-clear-area" type="button" class="text-button">Quitar área</button>':''}
      </div>
    </div>
    <svg id="scatter-plot" class="detail-viz" role="group" aria-labelledby="scatter-title"
      data-x-max="${xMax}" data-y-max="${yMax}" data-plotted-count="${plotted.length}"></svg>
  </div>`;
  const plot=host.querySelector('#scatter-plot');
  const W=plot.clientWidth||360, H=plot.clientHeight||232;
  const M={t:23,r:13,b:49,l:40};
  const x=d3.scaleLinear().domain([0,xMax]).range([M.l,W-M.r]);
  const y=d3.scaleLinear().domain([0,yMax]).range([H-M.b,M.t]);
  const svg=d3.select(plot).attr('viewBox',`0 0 ${W} ${H}`);
  scatterResizeObserver=new ResizeObserver(()=>{
    const width=plot.clientWidth,height=plot.clientHeight;
    if(plot.isConnected&&width>0&&height>0&&(width!==W||height!==H))drawScatter(host,app,annual);
  });
  scatterResizeObserver.observe(plot);
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(0,${H-M.b})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(v=>annual?fmt(v):v+' %').tickSize(3));
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(${M.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(3));
  if(!annual){
    svg.append('line').attr('x1',x(100)).attr('x2',x(100)).attr('y1',M.t).attr('y2',H-M.b).attr('stroke','#9aa6a1').attr('stroke-dasharray','3 3');
    svg.append('text').attr('x',x(100)+4).attr('y',H-M.b-5).attr('font-size',8.5).attr('fill','#6f7d86').text(`base ${BASE} = 100`);
  }
  const selected=plotted.find(row=>row.id===state.selected);
  const pointDetails=row=>{
    if(!annual)return `Volumen ${fmt(row.recovery)} % · TV ${fmt(row.change)} pp`;
    const hour=row.peak%24,hh=h=>String(h).padStart(2,'0')+':00';
    const slot=`${dayShort[Math.floor(row.peak/24)]} ${hh(hour)}–${hh((hour+1)%24)}`;
    const value=`${fmt(row.recovery)} viajes/día · ${slot} · ${fmt(row.change)} %`;
    if(!through)return value;
    const i=indices.get(row.id);
    const passing=d3.sum(through[state.year].flat(),frame=>frame[i])/7;
    return `${value} · ${fmt(passing)} viajes/día pasan por aquí`;
  };
  const showPoint=(row,event)=>{
    const name=row.station.name.replace(/ \(.*/,'');
    showTooltip(`<b>${esc(name)}</b><br>${esc(pointDetails(row))}`,event);
  };
  const coverage=[
    contextual.size?`${contextual.size} con cierre documentado`:'',
    missing?`${missing} ${annual?'sin viajes':'sin comparación válida'}`:''
  ].filter(Boolean);
  const axisHelp=[key,...coverage].join('. ');
  svg.append('text').attr('class','scatter-axis-label')
    .attr('x',W-M.r).attr('y',H-8).attr('text-anchor','end').text(xLabel+' →');
  svg.append('text').attr('class','scatter-axis-label scatter-axis-help')
    .attr('x',M.l).attr('y',M.t-10).attr('tabindex',0).attr('aria-label',`${yLabel}. ${axisHelp}`)
    .text('↑ '+yLabel+' ⓘ')
    .on('pointerenter',event=>showTooltip(esc(axisHelp),event))
    .on('pointerleave',hideTooltip)
    .on('focus',function(){
      const box=this.getBoundingClientRect();
      showTooltip(esc(axisHelp),{clientX:box.left,clientY:box.bottom});
    }).on('blur',hideTooltip);
  const ordered=[...plotted].sort((a,b)=>(items.has(a.id)?1:0)-(items.has(b.id)?1:0));
  const marks=svg.append('g').selectAll('circle').data(ordered,s=>s.id).join('circle')
    .attr('data-scatter-station',s=>s.id)
    .attr('id',s=>`scatter-station-${s.id}`)
    .attr('tabindex',0).attr('role','button')
    .attr('aria-pressed',s=>String(s.id===state.selected))
    .attr('aria-label',s=>s.station.name.replace(/ \(.*/,''))
    .attr('cx',s=>x(s.recovery)).attr('cy',s=>y(s.change)).attr('r',s=>items.has(s.id)?3:2.2)
    .classed('scatter-area-member',s=>scatterArea&&items.has(s.id))
    .attr('fill','#1d6f8d').attr('opacity',s=>items.has(s.id)?(scatterArea?1:.55):.1).style('cursor','pointer')
    .on('pointerenter',function(event,row){
      app.showStationPreview(row.id,this);
      showPoint(row,event);
    })
    .on('pointerleave',function(){
      if(!this.matches(':focus-visible'))app.showStationPreview(null,this);
      hideTooltip();
    })
    .on('focus',function(_,row){
      const box=this.getBoundingClientRect();
      if(this.matches(':focus-visible'))app.showStationPreview(row.id,this);
      showPoint(row,{clientX:box.right,clientY:box.top});
    })
    .on('blur',function(){
      app.showStationPreview(null,this);
      hideTooltip();
    })
    .on('click',(_,row)=>app.toggleStation(row.id))
    .on('keydown',(event,row)=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        app.toggleStation(row.id);
      }
    });
  if(selected){
    marks.filter(row=>row.id===selected.id).raise();
    const cx=x(selected.recovery),cy=y(selected.change),alignRight=cx>W*.7;
    svg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',6.5).attr('fill','none').attr('stroke','#102937').attr('stroke-width',1.8).style('pointer-events','none');
    svg.append('text').attr('x',cx+(alignRight?-9:9)).attr('y',cy+3).attr('text-anchor',alignRight?'end':'start')
      .attr('font-size',9).attr('fill','#102937').attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',3)
      .style('pointer-events','none').text(selected.station.name.replace(/ \(.*/,''));
  }
  const candidates=new Set(app.filtered(undefined,{ignoreCohort:true}).map(station=>station.id));
  bindScatterArea(host,svg,{left:M.l,top:M.t,right:W-M.r,bottom:H-M.b},
    plotted.filter(row=>candidates.has(row.id)),row=>[x(row.recovery),y(row.change)],app);
}


function bindScatterArea(host,svg,{left,top,right,bottom},rows,position,app){
  const draw=host.querySelector('#scatter-draw-area');
  const clear=host.querySelector('#scatter-clear-area');
  const node=svg.node();
  const line=d3.line();
  let overlay;

  function stop(){
    overlay.remove();
    overlay=null;
    svg.classed('is-scatter-lasso-active',false);
    draw.setAttribute('aria-pressed','false');
  }

  draw.onclick=()=>{
    if(overlay){stop();return;}
    draw.setAttribute('aria-pressed','true');
    svg.classed('is-scatter-lasso-active',true);
    overlay=svg.append('g').attr('class','scatter-lasso');
    const surface=overlay.append('rect').attr('class','map-lasso-surface')
      .attr('x',left).attr('y',top).attr('width',right-left).attr('height',bottom-top);
    const trace=overlay.append('path').attr('class','map-lasso-trace');
    const point=event=>{
      const [x,y]=d3.pointer(event,node);
      return [Math.min(right,Math.max(left,x)),Math.min(bottom,Math.max(top,y))];
    };
    let pointer=null,points=[];
    surface.on('pointerdown',function(event){
      if(event.button!==0||pointer!==null)return;
      event.preventDefault();
      this.setPointerCapture(event.pointerId);
      pointer=event.pointerId;
      points=[point(event)];
    }).on('pointermove',event=>{
      if(event.pointerId!==pointer)return;
      const next=point(event);
      const last=points.at(-1);
      if(Math.hypot(next[0]-last[0],next[1]-last[1])<1.5)return;
      points.push(next);
      trace.attr('d',line(points)+'Z');
    }).on('pointerup',event=>{
      if(event.pointerId!==pointer)return;
      pointer=null;
      points.push(point(event));
      trace.attr('d',null);
      const ids=new Set(points.length>=3
        ? rows.filter(row=>d3.polygonContains(points,position(row))).map(row=>row.id)
        : []);
      if(!ids.size){
        app.toast('El área no incluye puntos. Vuelve a dibujar.');
        return;
      }
      stop();
      app.set({cohort:ids,cohortSource:'scatter',selected:null});
    }).on('pointercancel lostpointercapture',event=>{
      if(event.pointerId===pointer)stop();
    });
  };

  if(clear)clear.onclick=()=>{
    draw.focus({preventScroll:true});
    app.set({cohort:null});
  };
  host.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!overlay)return;
    event.stopPropagation();
    stop();
    draw.focus({preventScroll:true});
  });
}
