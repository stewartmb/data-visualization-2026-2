import {state,BASE,esc,fmt,signed,profile,metricValue,metricColor,showTooltip,hideTooltip,heading,stats,passesMetricRanges,cohortProfile} from './model.js?v=20261028-4';
import {RaebOverlay} from './raeb-overlay.mjs?v=bands1';
let transform=d3.zoomIdentity;
const names={change:'Cambio de forma · distancia TV (pp)',deltaAM:'Cambio del peso AM · puntos porcentuales',deltaWeekend:'Cambio del peso de fin de semana · puntos porcentuales',recovery:'Índice de volumen · '+BASE+' = 100 %'};

const formulas={
  change:{formula:`TV = ½ × Σᵢ₌₁¹⁶⁸ |Sᵧ(i) − S₍base₎(i)|`,explanation:'Sᵧ(i) = 100 × Pᵧ(i): porcentaje de las entradas semanales en la combinación día–hora i. Se suman las 168 diferencias absolutas y se divide entre dos.',example:'Ejemplo: suma absoluta de 52,8 pp → TV de 26,4 pp.',unit:'Puntos porcentuales (pp), entre 0 y 100. Mide redistribución horaria; no variación del volumen.'},
  deltaAM:{formula:`AMᵧ = 100 × Σ Pᵧ(lun–vie, 06–09 h) / Σ Pᵧ(lun–vie, 00–23 h)
ΔAM = AMᵧ − AM₍base₎`,explanation:'Se divide el peso de las entradas de lunes a viernes entre 06:00 y 09:59 entre el peso de todas las entradas de esos cinco días. Luego se resta el porcentaje del año base (2021).',example:'Ejemplo: 22 % − 30 % = −8 pp.',unit:'Puntos porcentuales (pp). Negativo: la mañana pierde participación; positivo: gana.'},
  deltaWeekend:{formula:`FSᵧ = 100 × Σ Pᵧ(sáb–dom, 00–23 h)
ΔFS = FSᵧ − FS₍base₎`,explanation:'Se suma la participación de las 48 horas del sábado y domingo dentro de toda la semana y se resta el porcentaje del año base (2021).',example:'Ejemplo: 25 % − 20 % = +5 pp.',unit:'Puntos porcentuales (pp). Negativo: el fin de semana pierde participación; positivo: gana.'},
  recovery:{formula:`Vᵧ = (Σᵢ₌₁¹⁶⁸ Wᵧ(i)) / 7
Índice = 100 × Vᵧ / V₍base₎`,explanation:'V es el promedio diario de entradas de una semana comparable. El índice divide el volumen del año elegido entre el del año base (2021) y multiplica por 100.',example:'Ejemplo: 7.000 / 10.000 × 100 = 70 %.',unit:'Porcentaje (%). 100 %: mismo volumen; 70 %: 30 % menos; 120 %: 20 % más.'}
};

const ampm=h=>h===0?'12 am':h<12?`${h} am`:h===12?'12 pm':`${h-12} pm`;
const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],DAYS_LONG=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
export function renderMap(host,app,items){
  const flujos=state.layer==='flows'&&!!app.flows&&!!app.flows.flows[String(state.year)];
  const cambio=flujos&&state.flowShow==='change'&&state.year!==BASE&&!!app.flows.flows[String(BASE)];
  const metric=state.mapMetric,unit=metric==='recovery'?'%':'pp',title={change:'distancia TV',deltaAM:'cambio del peso AM',deltaWeekend:'cambio del peso de fin de semana',recovery:'índice de volumen'}[metric];
  const values=app.data.stations.filter(s=>profile(s)).map(s=>metricValue(s,metric));
  const activeRange=metric==='change'?(state.tvMin>0||state.tvMax<100?[state.tvMin,state.tvMax<100?state.tvMax:Math.max(state.tvMin,Math.ceil(d3.max(values)))]:null):state.ranges[metric];
  const rangeStart=Math.min(0,Math.floor(d3.min(values)),activeRange?.[0]??0),rangeLimit=Math.max(1,Math.ceil(d3.max(values)),activeRange?.[1]??0);
  const lowerValue=activeRange?.[0]??rangeStart,upper=activeRange?.[1]??rangeLimit;
  const filters=[...(state.tvMin>0||state.tvMax<100?[['change',`TV: ${fmt(state.tvMin)}–${state.tvMax===100?'sin límite':fmt(state.tvMax)} pp`]]:[]),...Object.entries(state.ranges).filter(([,r])=>r).map(([k,r])=>[k,`${{deltaAM:'AM',deltaWeekend:'Fin de semana',recovery:'Volumen'}[k]}: ${fmt(r[0])}–${fmt(r[1])} ${k==='recovery'?'%':'pp'}`])];

  const leyendas={
    change:{titulo:'Cambio de forma del ritmo semanal',que:`Distancia TV: cuánto del ritmo semanal cambió de lugar entre ${BASE} y ${state.year}.`,bajo:`igual a ${BASE}`,alto:'muy distinto'},
    deltaAM:{titulo:'Cambio del peso de la mañana',que:`Franja 6–10 am de lunes a viernes, ${state.year} menos ${BASE}.`,bajo:'menos mañana',alto:'más mañana'},
    deltaWeekend:{titulo:'Cambio del peso del fin de semana',que:`Sábado + domingo en la semana, ${state.year} menos ${BASE}.`,bajo:'menos fin de semana',alto:'más fin de semana'},
    recovery:{titulo:`Volumen frente a ${BASE}`,que:`Entradas por día de ${state.year} como % de ${BASE}.`,bajo:'creció menos que el sistema',alto:'creció más'}
  };
  const L=leyendas[metric];
  host.innerHTML=`
  <div class="map-stage">
    <svg class="map-svg" role="img" aria-label="Mapa de los complejos de estación de subway de Nueva York"></svg>
    <div class="map-panel map-panel-controls">
      <div class="eyebrow">01 · CONEXIONES Y RITMOS</div>
      ${app.flows?`<div class="segmented map-layer" role="group" aria-label="Capa del mapa"><button data-layer="points" class="${!flujos?'active':''}">Cambio por complejo</button><button data-layer="flows" class="${flujos?'active':''}">Flujos por hora</button></div>`:''}
      ${flujos?`<div class="flow-controls">
        <div class="flow-hour-row"><span class="flow-day-current">${DAYS_LONG[state.flowDay]}</span><output id="flow-hour-label" class="flow-hour-label">${ampm(state.flowHour)}</output><div class="segmented flow-day">${DAYS.map((d,i)=>`<button data-flowday="${i}" class="${state.flowDay===i?'active':''}" title="${DAYS_LONG[i]}">${d.slice(0,2)}</button>`).join('')}</div></div>
        <svg id="flow-profile" class="flow-profile" aria-label="Entradas del sistema por hora"></svg>
        <input id="flow-hour" class="flow-slider" type="range" min="0" max="23" step="1" value="${state.flowHour}" aria-label="Hora de entrada">
        <div class="flow-ticks"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span><span>11 pm</span></div>
        <div id="raeb-status" role="status" class="raeb-status">Preparando relaciones OD…</div>
        <div class="eyebrow" style="margin-top:10px">AGRUPACIÓN DE RECORRIDOS</div>
        <label class="fidelity"><span>Agrupación <output id="bundling-out">${state.bundling.toFixed(2)}</output></span><input id="bundling" type="range" min="0" max="1" step="0.01" value="${state.bundling}" aria-label="Agrupación de recorridos"><small>0: sin atracción entre curvas · 1: agrupamiento con el radio estimado por RAEB. Actúa sobre todos los pares OD de esta hora.</small></label>
        <label class="fidelity"><span>Fidelidad geométrica <output id="fidelity-out">${state.fidelity.toFixed(2)}</output></span><input id="fidelity" type="range" min="0" max="1" step="0.01" value="${state.fidelity}" aria-label="Fidelidad geométrica de los trazos"><small>0: abstracción libre, puede cruzar el agua · 1: recorridos de referencia. Los trazos intermedios son una abstracción visual; los viajes OD no cambian.</small></label>
      </div>`:''}
      <div class="points-controls"${flujos?' hidden':''}>
      <label class="map-field">Color de los puntos<select id="map-metric">${Object.entries(names).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="map-field">Entrada al análisis<select id="preset-select"><option value="">Todos los complejos</option><option value="morning"${state.preset==='morning'?' selected':''}>La mañana cambia (Δ AM &lt; −2 pp)</option><option value="weekend"${state.preset==='weekend'?' selected':''}>Otro fin de semana (Δ &gt; +2 pp)</option><option value="change"${state.preset==='change'?' selected':''}>Ritmos que se alejan</option><option value="decoupled"${state.preset==='decoupled'?' selected':''}>Volumen ≠ ritmo</option></select></label>
      <details class="map-filter"${activeRange?' open':''}><summary>Filtrar por ${title} <span class="map-filter-n">${items.length} de ${values.length}</span></summary>
        <div class="metric-formula-help"><button id="metric-formula-trigger" class="metric-formula-trigger" aria-expanded="false" aria-describedby="metric-formula-panel">Cómo se calcula <span aria-hidden="true">ⓘ</span></button><div id="metric-formula-panel" class="metric-formula-panel" role="tooltip" hidden><b>Cómo se calcula: ${title}</b><div class="metric-formula-equation">${esc(formulas[metric].formula)}</div><p>${esc(formulas[metric].explanation)}</p><p><b>Unidad e interpretación</b><br>${esc(formulas[metric].unit)}</p><p>${esc(formulas[metric].example)}</p><div class="metric-formula-base">Base de cálculo: el año completo, frente a 2021.<br>Wᵧ(d,h) = entradas registradas / cantidad de días de ese tipo en el año.<br>Pᵧ(i) = Wᵧ(i) / Σ Wᵧ(i); los 168 valores de P suman 1.<br>y = año elegido; i = combinación día–hora.</div></div></div>
        <div class="tv-range-control"><div class="tv-range-values"><span>Mín. <output id="map-min-output">${fmt(lowerValue)} ${unit}</output></span><span>Máx. <output id="map-max-output">${fmt(upper)} ${unit}</output></span></div><div class="dual-range" role="group" aria-label="Rango de ${title}"><div class="dual-range-track"></div><div class="dual-range-selected"></div><input id="map-min-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${lowerValue}" aria-label="Mínimo de ${title}"><input id="map-max-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${upper}" aria-label="Máximo de ${title}"></div></div>
        <button id="map-range-reset" class="text-button">Quitar este filtro</button>
        ${filters.length?`<div class="metric-filter-chips">${filters.map(([key,label])=>`<button data-clear-metric="${key}" title="Quitar este filtro">${esc(label)} ×</button>`).join('')}</div>`:''}
      </details>
      </div>
      <div class="map-control"><button id="map-select">Seleccionar área</button><button id="map-center">Ver toda la red ↺</button></div>
    </div>
    <div class="map-panel map-legend" aria-label="Leyenda">
      ${flujos?`<div class="map-legend-title">Relaciones OD · <span id="flow-legend-hour">${ampm(state.flowHour)}</span> · ${DAYS_LONG[state.flowDay]}</div>
      <div class="map-legend-what">${state.year} · Promedio por día de los doce meses, según hora de entrada.</div>
      <div id="map-key"></div>
      <div class="map-legend-marks">Área del nodo = viajes iniciados · naranja = OD salientes de la selección.</div>
      <div class="map-legend-foot" id="flow-legend-foot">Las curvas agrupan relaciones OD; no muestran trenes ni rutas observadas.</div>`:`<div class="map-legend-title">${L.titulo}</div>
      <div class="map-legend-what">${L.que}</div>
      <div id="map-key"></div>
      <div class="map-legend-marks"><span><i class="lg-dot"></i> un punto = un complejo &nbsp;<i class="lg-ring"></i> seleccionado &nbsp;<i class="lg-ring pin"></i> fijado</span></div>
      <div class="map-legend-foot">${items.length} complejos · mediana ${fmt(d3.median(items,s=>metricValue(s,metric)))} ${unit}</div>`}
    </div>
    <div class="map-panel map-minimap" aria-label="Contexto al acercar"><div class="eyebrow">CONTEXTO AL ACERCAR</div><svg class="minimap-svg" viewBox="0 0 150 112"></svg><div class="minimap-counts"></div></div>
    <div class="map-credit">OD estimado MTA 2021–2024 · recorridos modelados · red de referencia GTFS 2026 · contornos NYC DCP</div>
  </div>`;
  host.querySelector('.map-stage').classList.toggle('od-stage',flujos);
  host.querySelector('#bundling')?.closest('label').setAttribute('title','Multiplica el radio de agrupamiento estimado por RAEB. No cambia los valores OD.');
  host.querySelector('#fidelity')?.closest('label').setAttribute('title','0: geometría libre; 1: red de referencia. Intermedio: jerarquía de tramos conservados según RAEB.');
  const help=host.querySelector('.metric-formula-help'),trigger=host.querySelector('#metric-formula-trigger'),panel=host.querySelector('#metric-formula-panel');
  let pinnedFormula=false;
  const showFormula=open=>{panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));};
  help.addEventListener('pointerenter',()=>showFormula(true));
  help.addEventListener('pointerleave',()=>{if(!pinnedFormula&&!help.contains(document.activeElement))showFormula(false);});
  trigger.addEventListener('focus',()=>showFormula(true));
  help.addEventListener('focusout',e=>{if(!pinnedFormula&&!help.contains(e.relatedTarget))showFormula(false);});
  trigger.addEventListener('click',()=>{pinnedFormula=!pinnedFormula;showFormula(pinnedFormula);});
  help.addEventListener('keydown',e=>{if(e.key==='Escape'){pinnedFormula=false;showFormula(false);e.stopPropagation();}});
  host.addEventListener('pointerdown',e=>{if(!help.contains(e.target)){pinnedFormula=false;showFormula(false);}});
  const select=host.querySelector('#map-metric');select.value=state.mapMetric;select.onchange=()=>app.set({mapMetric:select.value});
  const svgNode=host.querySelector('.map-svg');
  // El mapa es lo principal de esta vista: ocupa todo el alto disponible de la ventana.
  svgNode.style.height=`${Math.max(520,innerHeight-svgNode.getBoundingClientRect().top-12)}px`;
  const svg=d3.select(svgNode),width=svgNode.clientWidth,height=svgNode.clientHeight;svg.attr('viewBox',`0 0 ${width} ${height}`);
  // Área cubierta: los cuatro boroughs con metro. Staten Island (sin complejos de subway) no entra ni en
  // el encuadre ni en el plano: el mapa muestra solo lo que el atlas cubre.
  const cubiertos=app.geo.features.filter(f=>f.properties.name!=='Staten Island');
  const projection=d3.geoMercator().fitExtent([[12,12],[width-12,height-12]],{type:'FeatureCollection',features:cubiertos});
  const flat=d3.geoTransform({point(lon,lat){const [x,y]=projection([lon,lat]);this.stream.point(x,y);}});
  const path=d3.geoPath(flat),g=svg.append('g');
  let baseG=g;
  if(flujos){
    const baseSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    baseSvg.setAttribute('viewBox',`0 0 ${width} ${height}`);baseSvg.setAttribute('aria-hidden','true');
    baseSvg.style.cssText=`position:absolute;left:0;top:0;width:${width}px;height:${height}px;pointer-events:none;z-index:0`;
    svgNode.parentElement.insertBefore(baseSvg,svgNode);baseG=d3.select(baseSvg).append('g');
    svgNode.style.position='relative';svgNode.style.zIndex='2';svgNode.style.background='transparent';
  }
  baseG.selectAll('.map-bg').data(cubiertos).join('path').attr('class','map-bg').attr('fill-rule','evenodd').attr('vector-effect','non-scaling-stroke').attr('d',path);
  // Trazado del metro (GTFS de la MTA, simplificado): contexto recesivo en gris bajo los puntos.
  if(app.lineas&&!flujos)g.append('g').attr('class','map-lines').selectAll('path').data(app.lineas.features).join('path').attr('d',path).attr('fill','none').attr('vector-effect','non-scaling-stroke');
  // Every positive OD relation participates. Curves are calculated off the UI
  // thread; the camera and continuous slider preview are WebGL uniforms.
  let pintarFlujos=null,nodeR=null;
  if(flujos){
    const F=app.flows,ni=new Map(F.nodes.map((n,i)=>[n.id,i]));
    if(!F._smax){let sx=0;for(const y of Object.values(F.starts))for(const n of y)for(const d of n)for(const v of d)if(v>sx)sx=v;F._smax=sx;}
    const rNode=d3.scaleSqrt().domain([0,F._smax]).range([0,13]);
    nodeR=(s,h=state.flowHour)=>{const v=F.starts[String(state.year)]?.[ni.get(s.id)]?.[state.flowDay]?.[h]??0;return v>0?Math.max(1.8,rNode(v)):1.6;};
    baseG.append('g').attr('class','rail-reference').selectAll('path').data(F.links).join('path')
      .attr('d',l=>d3.line()(l.coords.map(projection))).attr('fill','none').attr('stroke','#adb2b3').attr('stroke-width',.65).attr('vector-effect','non-scaling-stroke').attr('opacity',.5).style('pointer-events','none');
    try{
      app.raeb??=new RaebOverlay(F);
      app.raeb.attach(g.node(),width,height,projection,transform);
      app.raeb.parameters(state.fidelity,state.bundling);
    }catch(error){host.querySelector('#raeb-status').textContent=error.message;console.error(error);}
    pintarFlujos=h=>{
      host.querySelector('#flow-hour-label').value=ampm(h);host.querySelector('#flow-legend-hour').textContent=ampm(h);
      g.selectAll('.map-dot').attr('r',s=>nodeR(s,h)/transform.k);
      d3.selectAll('#inspector [data-clock-cell]').attr('stroke',i=>i===state.flowDay*24+h?'#102937':null).attr('stroke-width',i=>i===state.flowDay*24+h?1.6:null).attr('aria-pressed',i=>String(i===state.flowDay*24+h));
      app.raeb?.frame(state.year,state.flowDay,h,state.selected);app.syncURL?.();
    };
    const porHora=d3.range(24).map(h=>d3.sum(F.starts[String(state.year)],n=>n[state.flowDay][h]));
    const baseHora=d3.range(24).map(h=>d3.sum(F.starts[String(BASE)],n=>n[state.flowDay][h]));
    const svgP=d3.select(host.querySelector('#flow-profile')),PW=host.querySelector('#flow-profile').clientWidth||222,PH=46;
    svgP.attr('viewBox',`0 0 ${PW} ${PH}`);
    const px=d3.scaleLinear().domain([0,23]).range([7,PW-7]),py=d3.scaleLinear().domain([0,Math.max(...porHora,...baseHora)]).range([PH-2,12]);
    svgP.append('path').attr('d',d3.area().x((v,i)=>px(i)).y0(PH-2).y1(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','#1d6f8d').attr('opacity',.14);
    svgP.append('path').attr('d',d3.line().x((v,i)=>px(i)).y(v=>py(v)).curve(d3.curveMonotoneX)(baseHora)).attr('fill','none').attr('stroke','#909798').attr('stroke-width',1).attr('stroke-dasharray','2 2');
    svgP.append('path').attr('d',d3.line().x((v,i)=>px(i)).y(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','none').attr('stroke','#1d6f8d').attr('stroke-width',1.2);
    const marca=svgP.append('g');marca.append('line').attr('y1',4).attr('y2',PH-2).attr('stroke','#1b2a33');marca.append('circle').attr('r',2.6).attr('fill','#1b2a33');
    const pintarBase=pintarFlujos;pintarFlujos=h=>{pintarBase(h);marca.attr('transform',`translate(${px(h)},0)`);marca.select('circle').attr('cy',py(porHora[h]));};
    const slider=host.querySelector('#flow-hour');slider.oninput=()=>{state.flowHour=+slider.value;pintarFlujos(state.flowHour);};
    host.querySelectorAll('[data-flowday]').forEach(b=>b.onclick=()=>app.set({flowDay:+b.dataset.flowday}));
    for(const key of ['fidelity','bundling']){
      const input=host.querySelector('#'+key);
      input.oninput=()=>{state[key]=+input.value;host.querySelector('#'+key+'-out').value=state[key].toFixed(2);app.raeb?.parameters(state.fidelity,state.bundling);};
      input.onchange=()=>app.syncURL?.();
    }
    app._relane=()=>app.raeb?.transform(transform);
  }else{app._relane=null;}
  host.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>app.set({layer:b.dataset.layer}));
  const labels=[['MANHATTAN',-74.003,40.789],['BROOKLYN',-73.987,40.635],['QUEENS',-73.817,40.740],['BRONX',-73.854,40.870]];
  g.selectAll('.borough-name').data(labels).join('text').attr('class','borough-name').attr('x',d=>projection(d.slice(1))[0]).attr('y',d=>projection(d.slice(1))[1]).attr('text-anchor','middle').text(d=>d[0]);
  const ids=new Set(items.map(s=>s.id));
  // Para las dos medidas divergentes, la escala llega al percentil 95 del valor absoluto y satura
  // más allá (se declara en la leyenda): si llegara al máximo, el 90 % de los puntos quedaría pálido.
  let color=metricColor(state.mapMetric,app.data.stations.filter(s=>profile(s)));
  let saturaEn=null;
  if(metric==='deltaAM'||metric==='deltaWeekend'){saturaEn=Math.ceil(d3.quantile(values.map(Math.abs).sort(d3.ascending),0.95));color=d3.scaleDiverging([-saturaEn,0,saturaEn],t=>t<=.5?d3.interpolateRgb('#176c91','#f5f5ef')(2*t):d3.interpolateRgb('#f5f5ef','#b6532c')(2*t-1)).clamp(true);}
  // Secuencial hasta el percentil 95 (un par de complejos cerrados en el año base disparan el máximo).
  if(metric==='change'){saturaEn=Math.ceil(d3.quantile(values.slice().sort(d3.ascending),0.95));color=d3.scaleSequential(d3.interpolateViridis).domain([0,saturaEn]).clamp(true);}
  // Volumen: divergente alrededor de la mediana del sistema (todos crecieron frente a 2021; lo informativo es quién creció más o menos que el conjunto).
  let medianaVol=null;
  if(metric==='recovery'){const ord=values.slice().sort(d3.ascending);medianaVol=Math.round(d3.median(ord));const lo=Math.floor(d3.quantile(ord,0.05)),hi=Math.ceil(d3.quantile(ord,0.95));color=d3.scaleDiverging([lo,medianaVol,hi],t=>t<=.5?d3.interpolateRgb('#176c91','#f5f5ef')(2*t):d3.interpolateRgb('#f5f5ef','#b6532c')(2*t-1)).clamp(true);}
  g.selectAll('.context-point').data(app.data.stations.filter(s=>!ids.has(s.id)&&profile(s)&&passesMetricRanges(s))).join('circle').attr('class','context-point').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',1.6).attr('fill','#b8c7c1').attr('opacity',.45);
  const R=flujos?2.4:5.2;const rOf=s=>flujos&&nodeR?nodeR(s):R;
  const points=g.selectAll('.map-dot').data(items).join('circle').attr('class','map-dot'+(flujos?' quiet':'')).attr('data-station-id',s=>s.id).attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',s=>rOf(s)).attr('fill',s=>flujos?'#1d6f8dcc':color(metricValue(s,state.mapMetric)))
    .on('pointerenter',function(e,s){d3.select(this).raise().transition().duration(120).attr('r',(flujos?rOf(s)+3:8)/transform.k);showTooltip(flujos?`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${DAYS_LONG[state.flowDay]} ${ampm(state.flowHour)}: ${fmt(Math.round(app.flows.starts[String(state.year)][app.flows.nodes.findIndex(n=>n.id===s.id)][state.flowDay][state.flowHour]))} viajes iniciados<br><small>Clic: sus conexiones salientes</small>`:`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}<br><small>Clic para abrir huella y evidencia</small>`,e);}).on('pointermove',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}`,e)).on('pointerleave',function(e,s){d3.select(this).transition().duration(160).attr('r',rOf(s)/transform.k);hideTooltip();}).on('click',(e,s)=>{e.stopPropagation();e.shiftKey?app.pin(s.id):app.select(s.id);});
  // Entrada animada: al cambiar medida, filtro o año, los puntos aparecen en vez de saltar.
  points.attr('opacity',1);
  // Draw larger changes last so low values cannot cover them in dense areas.
  points.sort((a,b)=>Math.abs(metricValue(a,state.mapMetric))-Math.abs(metricValue(b,state.mapMetric)));
  // Zoom semántico: al acercar aparecen los nombres de los complejos y, más cerca, su valor.
  // Lejos, solo los puntos; a medio zoom, los nombres de los complejos con mayor cambio; cerca, todos.
  const medAbs=d3.median(items,s=>Math.abs(metricValue(s,state.mapMetric)))||0;
  const gLabels=g.append('g').attr('class','map-labels').style('pointer-events','none');
  const etiquetas=gLabels.selectAll('text').data(items,s=>s.id).join('text').attr('class','map-label')
    .attr('x',s=>projection([s.lon,s.lat])[0]).attr('y',s=>projection([s.lon,s.lat])[1]).attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-linejoin','round').attr('fill','#1b2a33');
  let lastLabelLevel=-1,lastBoroughHidden=null;
  function pintarEtiquetas(k){
    const nivel=k<2.4?0:k<4.5?1:2;
    // Shared text styling changes once per camera frame, instead of thousands
    // of per-station attributes. Rebuild content only at semantic thresholds.
    gLabels.attr('font-size',10/k).attr('stroke-width',3/k).attr('transform',`translate(${7/k},${3.5/k})`);
    if(nivel!==lastLabelLevel){
      etiquetas.attr('display',s=>nivel===0||(nivel===1&&Math.abs(metricValue(s,state.mapMetric))<medAbs)||s.id===state.selected?'none':null)
        .text(s=>nivel===2&&!flujos?`${s.name.replace(/ \(.*/,'')} · ${fmt(metricValue(s,state.mapMetric))} ${unit}`:s.name.replace(/ \(.*/,''));
      lastLabelLevel=nivel;
    }
    const hidden=k>3;if(hidden!==lastBoroughHidden){g.selectAll('.borough-name').attr('display',hidden?'none':null);lastBoroughHidden=hidden;}
  }
  pintarEtiquetas(transform.k);
  if(pintarFlujos)pintarFlujos(state.flowHour,false);
  {
    const lower=host.querySelector('#map-min-tv'),higher=host.querySelector('#map-max-tv');
    lower.oninput=()=>{if(+lower.value>+higher.value)lower.value=higher.value;preview();};
    higher.oninput=()=>{if(+higher.value<+lower.value)higher.value=lower.value;preview();};
    function preview(){
      host.querySelector('#map-min-output').textContent=`${fmt(+lower.value)} ${unit}`;host.querySelector('#map-max-output').textContent=`${fmt(+higher.value)} ${unit}`;
      const track=host.querySelector('.dual-range-selected');track.style.left=`${100*(lower.value-rangeStart)/(rangeLimit-rangeStart)}%`;track.style.width=`${100*(higher.value-lower.value)/(rangeLimit-rangeStart)}%`;
      lower.setAttribute('aria-valuemax',higher.value);higher.setAttribute('aria-valuemin',lower.value);
      lower.setAttribute('aria-valuetext',`${fmt(+lower.value)} ${unit}`);higher.setAttribute('aria-valuetext',`${fmt(+higher.value)} ${unit}`);
      lower.style.zIndex=+lower.value===rangeLimit?'4':'2';
    }
    preview();
    host.querySelector('.dual-range').addEventListener('pointerdown',e=>{
      if(e.target.tagName==='INPUT')return;
      const rect=e.currentTarget.getBoundingClientRect(),value=Math.max(rangeStart,Math.min(rangeLimit,Math.round((rangeStart+(e.clientX-rect.left)/rect.width*(rangeLimit-rangeStart))*2)/2));
      const handle=Math.abs(value-lower.value)<Math.abs(value-higher.value)?lower:higher;
      handle.value=value;handle.dispatchEvent(new Event('input'));handle.focus();handle.dispatchEvent(new Event('change'));
    });
    const apply=()=>metric==='change'?app.set({tvMin:+lower.value,tvMax:+higher.value===rangeLimit?100:+higher.value}):app.set({ranges:{...state.ranges,[metric]:+lower.value===rangeStart&&+higher.value===rangeLimit?null:[+lower.value,+higher.value]}});
    lower.onchange=apply;higher.onchange=apply;host.querySelector('#map-range-reset').onclick=()=>clear(metric);
  }
  function clear(key){if(key==='change')app.set({tvMin:0,tvMax:100});else app.set({ranges:{...state.ranges,[key]:null}});}
  host.querySelectorAll('[data-clear-metric]').forEach(b=>b.onclick=()=>clear(b.dataset.clearMetric));
  const active=app.data.stations.filter(s=>s.id===state.selected||state.pins.includes(s.id));
  const rings=g.selectAll('.selected-ring').data(active).join('circle').attr('class','selected-ring').attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',8.5).attr('fill','none').attr('stroke',s=>s.id===state.selected?'#102937':'#c96035').attr('stroke-width',2).style('pointer-events','none');
  const selected=app.station(state.selected);
  let label=null,labelPos=null;
  if(selected){labelPos=projection([selected.lon,selected.lat]);label=g.append('text').attr('class','selected-label').attr('x',labelPos[0]+12).attr('y',labelPos[1]-8).attr('font-size',11).attr('fill','#102937').attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',4).attr('stroke-linejoin','round').style('pointer-events','none').text(selected.name.replace(/ \(.*/,''));}
  const zoom=d3.zoom().scaleExtent([1,12]).translateExtent([[0,0],[width,height]]).on('zoom',e=>{transform=e.transform;g.attr('transform',transform);if(baseG!==g)baseG.attr('transform',transform);points.attr('r',s=>rOf(s)/transform.k);if(app._relane)app._relane(transform.k);rings.attr('r',8.5/transform.k);g.selectAll('.context-point').attr('r',1.6/transform.k);pintarEtiquetas(transform.k);if(label)label.attr('font-size',11/transform.k).attr('stroke-width',4/transform.k).attr('x',labelPos[0]+12/transform.k).attr('y',labelPos[1]-8/transform.k);hideTooltip();});
  // Contexto al acercar: miniatura fija con los boroughs, los complejos del grupo y el rectángulo de lo
  // que se ve; debajo, cuántos complejos del grupo hay en cada borough.
  const mini=d3.select(host.querySelector('.minimap-svg')),miniProj=d3.geoMercator().fitExtent([[3,3],[147,109]],{type:'FeatureCollection',features:cubiertos}),miniPath=d3.geoPath(miniProj);
  mini.selectAll('.mini-bg').data(cubiertos).join('path').attr('class','mini-bg').attr('d',miniPath);
  mini.selectAll('.mini-dot').data(items).join('circle').attr('class','mini-dot').attr('cx',s=>miniProj([s.lon,s.lat])[0]).attr('cy',s=>miniProj([s.lon,s.lat])[1]).attr('r',1).attr('fill','#6f7d86');
  const miniRect=mini.append('rect').attr('class','mini-view').attr('fill','none').attr('stroke','#102937').attr('stroke-width',1);
  function pintarMini(tr){
    const [x0,y0]=tr.invert([0,0]),[x1,y1]=tr.invert([width,height]);
    const p0=miniProj(projection.invert([x0,y0])),p1=miniProj(projection.invert([x1,y1]));
    const vis=tr.k>1.05;miniRect.attr('display',vis?null:'none').attr('x',p0[0]).attr('y',p0[1]).attr('width',Math.max(2,p1[0]-p0[0])).attr('height',Math.max(2,p1[1]-p0[1]));
  }
  pintarMini(transform);
  const porB=d3.rollup(items,v=>v.length,s=>s.borough);
  host.querySelector('.minimap-counts').innerHTML=['Manhattan','Bronx','Brooklyn','Queens'].map(b=>`<span>${b}<b>${porB.get(b)??0}</b></span>`).join('');
  zoom.on('zoom.mini',e=>pintarMini(e.transform));
  svg.call(zoom).call(zoom.transform,transform);
  host.querySelector('#map-center').onclick=()=>{transform=d3.zoomIdentity;svg.transition().duration(250).call(zoom.transform,transform);};
  let brushLayer=null;
  host.querySelector('#map-select').onclick=e=>{
    const b=e.currentTarget;
    if(brushLayer){brushLayer.remove();brushLayer=null;b.classList.remove('active');b.textContent='Seleccionar área';svg.call(zoom);return;}
    svg.on('.zoom',null);b.classList.add('active');b.textContent='Cancelar selección';
    const brush=d3.brush().extent([[0,0],[width,height]]).on('end',event=>{
      if(!event.sourceEvent||!event.selection)return;
      const [[x0,y0],[x1,y1]]=event.selection;
      const cohort=new Set(items.filter(s=>{const [x,y]=transform.apply(projection([s.lon,s.lat]));return x>=x0&&x<=x1&&y>=y0&&y<=y1;}).map(s=>s.id));
      app.set({cohort,preset:null});
    });
    brushLayer=svg.append('g').attr('class','map-brush').call(brush);
  };
  if(flujos){
    host.querySelector('#map-key').innerHTML='<svg viewBox="0 0 240 28" style="width:100%;height:28px" role="img" aria-label="Los haces se ensanchan al acumular más viajes OD"><path d="M8 14H56" stroke="#0e546d" stroke-width="1.5" stroke-linecap="round"/><path d="M88 14H144" stroke="#0e546d" stroke-width="4" stroke-linecap="round"/><path d="M176 14H232" stroke="#0e546d" stroke-width="9" stroke-linecap="round"/></svg><div class="map-key-words"><span>menos flujo</span><span>más flujo acumulado</span></div><div class="map-key-note">En WebGPU, los trazos próximos forman una banda continua. Más flujo local: mayor ancho (escala raíz, hasta 9 px). Escala fija entre horas y años. Los cruces visuales no implican transbordos.</div>';
    if(!items.length)app.toast('El grupo está vacío.');return;
  }
  const legend=host.querySelector('#map-key'),domain=color.domain(),min=domain[0],max=domain.at(-1);
  const ticks=d3.scaleLinear().domain([min,max]).ticks(5).filter(t=>t>=min&&t<=max);
  legend.innerHTML=`<div class="map-key-bar" style="background:linear-gradient(90deg,${d3.range(21).map(i=>color(min+(max-min)*i/20)).join(',')})"></div>
    <div class="map-key-ticks">${ticks.map(t=>`<span style="left:${100*(t-min)/(max-min)}%">${fmt(t)}</span>`).join('')}</div>
    <div class="map-key-words"><span>${L.bajo}</span><span>${unit==='%'?'%':'pp'}</span><span>${L.alto}</span></div>
    ${metric==='change'?`<div class="map-key-note">Satura en ${saturaEn} pp (percentil 95).</div>`:metric==='recovery'?`<div class="map-key-note">Punto medio = mediana del sistema (${medianaVol} %); ${BASE} = 100 %. Satura en los percentiles 5 y 95.</div>`:`<div class="map-key-note">Satura en ±${saturaEn} pp.</div>`}`;
  if(!items.length)app.toast('El grupo está vacío; los puntos grises conservan el contexto geográfico.');
}
