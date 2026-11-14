import {state,BASE,esc,fmt,signed,profile,metricValue,metricColor,showTooltip,hideTooltip,heading,stats,passesMetricRanges,cohortProfile} from './model.js?v=20261028-4';
import {RaebOverlay} from './raeb-overlay.mjs?v=flow-gray1';
import {setRaebStatus} from './raeb-cpu-overlay.mjs?v=flow-gray1';
import {FLOW_COLOR_MAX,FLOW_COLOR_STOPS} from './raeb-gpu-shaders.mjs?v=flow-gray1';
import {metersPerProjectedPixel} from './raeb-scale.mjs?v=free-years1';
import {activeODCompareBase} from './contrast-model.mjs?v=annual-od1';
import {updateClockTime} from './inspector.js?v=scatter-reading1';
let transform=d3.zoomIdentity;
const names={change:'Cambio de forma · distancia TV (pp)',deltaAM:'Cambio del peso AM · puntos porcentuales',deltaWeekend:'Cambio del peso de fin de semana · puntos porcentuales',recovery:'Índice de volumen · referencia = 100 %'};

const formulas=()=>({
  change:{formula:`TV = ½ × Σᵢ₌₁¹⁶⁸ |Sᵧ(i) − S₍base₎(i)|`,explanation:'Sᵧ(i) = 100 × Pᵧ(i): porcentaje de las entradas semanales en la combinación día–hora i. Se suman las 168 diferencias absolutas y se divide entre dos.',example:'Ejemplo: suma absoluta de 52,8 pp → TV de 26,4 pp.',unit:'Puntos porcentuales (pp), entre 0 y 100. Mide redistribución horaria; no variación del volumen.'},
  deltaAM:{formula:`AMᵧ = 100 × Σ Pᵧ(lun–vie, 06–09 h) / Σ Pᵧ(lun–vie, 00–23 h)
ΔAM = AMᵧ − AM₍base₎`,explanation:'Se divide el peso de las entradas de lunes a viernes entre 06:00 y 09:59 entre el peso de todas las entradas de esos cinco días. Luego se resta el porcentaje del año de referencia.',example:'Ejemplo: 22 % − 30 % = −8 pp.',unit:'Puntos porcentuales (pp). Negativo: la mañana pierde participación; positivo: gana.'},
  deltaWeekend:{formula:`FSᵧ = 100 × Σ Pᵧ(sáb–dom, 00–23 h)
ΔFS = FSᵧ − FS₍base₎`,explanation:'Se suma la participación de las 48 horas del sábado y domingo dentro de toda la semana y se resta el porcentaje del año de referencia.',example:'Ejemplo: 25 % − 20 % = +5 pp.',unit:'Puntos porcentuales (pp). Negativo: el fin de semana pierde participación; positivo: gana.'},
  recovery:{formula:`Vᵧ = (Σᵢ₌₁¹⁶⁸ Wᵧ(i)) / 7
Índice = 100 × Vᵧ / V₍base₎`,explanation:'V es el promedio diario de entradas de una semana comparable. El índice divide el volumen del año elegido entre el del año de referencia y multiplica por 100.',example:'Ejemplo: 7.000 / 10.000 × 100 = 70 %.',unit:'Porcentaje (%). 100 %: mismo volumen; 70 %: 30 % menos; 120 %: 20 % más.'}
});

const ampm=h=>h===0?'12 am':h<12?`${h} am`:h===12?'12 pm':`${h-12} pm`;
const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],DAYS_LONG=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
// Rounded p95 of nonzero absolute rail-load changes across the six OD year pairs and 168 time slots.
const OD_CHANGE_LIMIT=1600;
const OD_CHANGE_COLORS={loss:'#176c91',gain:'#b6532c',neutral:'#aab3b7'};
const odLoss=d3.interpolateRgb(OD_CHANGE_COLORS.neutral,OD_CHANGE_COLORS.loss);
const odGain=d3.interpolateRgb(OD_CHANGE_COLORS.neutral,OD_CHANGE_COLORS.gain);
const stationMetricLabels={
  change:'Cambio de forma',
  deltaAM:'Cambio del peso AM',
  deltaWeekend:'Cambio del peso de fin de semana',
  recovery:'Volumen frente a'
};
export function renderMap(host,app,items){
  const {dataset}=app;
  const bart=dataset.id==='bart';
  const changeLimit=app.flows?.meta.change_limit??OD_CHANGE_LIMIT;
  const flujos=state.layer==='flows'&&!!app.flows&&!!app.flows.flows[String(state.year)];
  const paper=state.paperRAEB;
  const odBase=activeODCompareBase(state,app.flows);
  const cambio=odBase!==null;
  const focusOrigin=flujos&&!cambio?app.station(state.selected):null;
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
  const formula=formulas()[metric];
  host.innerHTML=`
  <div class="map-stage">
    <div class="map-sidebar" role="region" aria-label="Controles y leyenda del mapa">
    <div class="map-panel map-panel-controls">
      <div class="eyebrow">01 · CONEXIONES Y RITMOS</div>
      ${app.flows?`<div class="segmented map-layer" role="group" aria-label="Capa del mapa"><button data-layer="points" class="${!flujos?'active':''}">Cambio por complejo</button><button data-layer="flows" class="${flujos?'active':''}">Flujos por hora</button></div>`:''}
      ${flujos?`<div class="flow-controls">
        <div class="flow-hour-row"><span class="flow-day-current">${DAYS_LONG[state.flowDay]}</span><output id="flow-hour-label" class="flow-hour-label">${ampm(state.flowHour)}</output><div class="segmented flow-day">${DAYS.map((d,i)=>`<button data-flowday="${i}" class="${state.flowDay===i?'active':''}" title="${DAYS_LONG[i]}">${d.slice(0,2)}</button>`).join('')}</div></div>
        <svg id="flow-profile" class="flow-profile" aria-label="Distribución de viajes OD por hora en el año seleccionado"></svg>
        <input id="flow-hour" class="flow-slider" type="range" min="0" max="23" step="1" value="${state.flowHour}" aria-label="${dataset.hourLabel}">
        <div class="flow-ticks"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span><span>11 pm</span></div>
        ${cambio?'':`<div id="raeb-status" role="status" class="raeb-status">Procesando…</div>
        ${paper?`<div class="fidelity radius-control">
          <label for="bundling">Radio inicial de agrupamiento <output id="bundling-out" for="bundling">—</output></label>
          <input id="bundling" type="range" min="0" max="0" step="any" value="0" disabled>
          <div class="radius-actions"><button type="button" id="radius-auto" class="text-button" aria-pressed="true" disabled>Automático</button><small id="radius-reference">Calculando la referencia…</small></div>
        </div>`:`<label class="fidelity"><span>Agrupación <output id="bundling-out">${state.bundling.toFixed(2)}</output></span><input id="bundling" type="range" min="0" max="1" step="0.01" value="${state.bundling}" aria-label="Agrupación de recorridos"><small>0: sin atracción entre curvas · 1: agrupamiento con el radio estimado por RAEB. Actúa sobre todos los pares OD de esta hora.</small></label>`}
        ${paper?`<label class="fidelity"><span>Fidelidad a la red <output id="pra-out">${state.paperLevel} / 5</output></span><input id="pra" type="range" min="0" max="5" step="1" value="${state.paperLevel}" aria-label="Nivel de fidelidad a la red" title="0: agrupación libre. 5: toda la red guía los haces. Con radio 0, los flujos siguen la vía asignada."><small>0: agrupación libre · 5: toda la red guía los haces.</small></label>`:`
        <label class="fidelity"><span>Fidelidad geométrica <output id="fidelity-out">${state.fidelity.toFixed(2)}</output></span><input id="fidelity" type="range" min="0" max="1" step="0.01" value="${state.fidelity}" aria-label="Fidelidad geométrica de los trazos"><small>0: abstracción libre, puede cruzar el agua · 1: recorridos de referencia. Los trazos intermedios son una abstracción visual; los viajes OD no cambian.</small></label>`}
        <a class="text-button" id="raeb-mode" href="#" title="Abrir el mismo día y hora con el otro agrupamiento">${paper?'Volver al agrupamiento del Atlas':'Probar RAEB del paper'}</a>`}
      </div>`:''}
      <div class="points-controls"${flujos?' hidden':''}>
      <label class="map-field">Color de los puntos<select id="map-metric">${Object.entries(names).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="map-field">Entrada al análisis<select id="preset-select"><option value="">Todos los complejos</option><option value="morning"${state.preset==='morning'?' selected':''}>La mañana cambia (Δ AM &lt; −2 pp)</option><option value="weekend"${state.preset==='weekend'?' selected':''}>Otro fin de semana (Δ &gt; +2 pp)</option><option value="change"${state.preset==='change'?' selected':''}>Ritmos que se alejan</option><option value="decoupled"${state.preset==='decoupled'?' selected':''}>Volumen ≠ ritmo</option></select></label>
      <details class="map-filter"${activeRange?' open':''}><summary>Filtrar por ${title} <span class="map-filter-n">${items.length} de ${values.length}</span></summary>
        <div class="metric-formula-help"><button id="metric-formula-trigger" class="metric-formula-trigger" aria-expanded="false" aria-describedby="metric-formula-panel">Cómo se calcula <span aria-hidden="true">ⓘ</span></button><div id="metric-formula-panel" class="metric-formula-panel" role="tooltip" hidden><b>Cómo se calcula: ${title}</b><div class="metric-formula-equation">${esc(formula.formula)}</div><p>${esc(formula.explanation)}</p><p><b>Unidad e interpretación</b><br>${esc(formula.unit)}</p><p>${esc(formula.example)}</p><div class="metric-formula-base">Base de cálculo: el año completo, frente a ${BASE}.<br>Wᵧ(d,h) = entradas registradas / cantidad de días de ese tipo en el año.<br>Pᵧ(i) = Wᵧ(i) / Σ Wᵧ(i); los 168 valores de P suman 1.<br>y = año elegido; i = combinación día–hora.</div></div></div>
        <div class="tv-range-control"><div class="tv-range-values"><span>Mín. <output id="map-min-output">${fmt(lowerValue)} ${unit}</output></span><span>Máx. <output id="map-max-output">${fmt(upper)} ${unit}</output></span></div><div class="dual-range" role="group" aria-label="Rango de ${title}"><div class="dual-range-track"></div><div class="dual-range-selected"></div><input id="map-min-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${lowerValue}" aria-label="Mínimo de ${title}"><input id="map-max-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${upper}" aria-label="Máximo de ${title}"></div></div>
        <button id="map-range-reset" class="text-button">Quitar este filtro</button>
        ${filters.length?`<div class="metric-filter-chips">${filters.map(([key,label])=>`<button data-clear-metric="${key}" title="Quitar este filtro">${esc(label)} ×</button>`).join('')}</div>`:''}
      </details>
      </div>
      ${flujos?`<label class="flow-node-toggle" title="El área del círculo representa los viajes asociados a cada origen en la hora elegida."><input id="flow-nodes" type="checkbox"${state.showFlowNodes?' checked':''}> Círculos de afluencia</label>`:''}
      <div class="map-control"><button id="map-select">Seleccionar área</button><button id="map-center" title="Quitar la selección y mostrar toda la red">Vista general ↺</button></div>
    </div>
    <div class="map-panel map-legend" aria-label="Leyenda">
      ${flujos?`<div class="map-legend-title">${cambio?'Cambio por tramo':'Relaciones OD'} · <span id="flow-legend-hour">${ampm(state.flowHour)}</span> · ${DAYS_LONG[state.flowDay]}</div>
      <div class="map-legend-what">${cambio?`${odBase} → ${state.year} · Toda la red, ambos sentidos`:`${state.year} · Promedio por día, según ${dataset.hourLabel.toLowerCase()}.`}</div>
      <div id="map-key"></div>
      <div class="map-legend-marks" id="flow-node-key">${cambio?`Área del círculo = ${dataset.startsLabel.toLowerCase()} en ${state.year}.`:focusOrigin?'Flujos desde '+esc(focusOrigin.name)+'.':`Área del círculo = ${dataset.startsLabel.toLowerCase()}. Selecciona un punto para ver sus conexiones.`}</div>
      ${paper||cambio?`<div class="map-complex-key" hidden><i aria-hidden="true"></i> Parada del mismo complejo</div>
      <div class="map-track-key" hidden><i aria-hidden="true"></i> Vía de referencia sin color de flujo</div>`:''}
      <div class="map-legend-foot" id="flow-legend-foot">${cambio?'Recorridos asignados sobre la misma red GTFS. Pasa por un tramo para ver A, B y la diferencia.':paper?'RAEB (2019) aplicado a viajes OD. Las curvas son haces; pueden apartarse de la red.':'Las curvas agrupan relaciones OD; no muestran trenes ni rutas observadas.'}</div>`:`<div class="map-legend-title">${L.titulo}</div>
      <div class="map-legend-what">${L.que}</div>
      <div id="map-key"></div>
      <div class="map-legend-marks"><span><i class="lg-dot"></i> un punto = un complejo &nbsp;<i class="lg-ring"></i> seleccionado &nbsp;<i class="lg-ring pin"></i> fijado</span></div>
      <div class="map-legend-foot">${items.length} complejos · mediana ${fmt(d3.median(items,s=>metricValue(s,metric)))} ${unit}</div>`}
    </div>
    </div>
    <div class="map-viewport">
      <svg class="map-svg" role="img" aria-label="Mapa de estaciones · ${esc(dataset.name)}"${flujos&&!cambio?' aria-busy="true"':''}></svg>
      ${flujos&&!cambio?`<div class="map-loading" aria-hidden="true">
        <div class="map-loading-label"><span class="map-spinner"></span>Actualizando flujos…</div>
      </div>`:''}
      <div class="map-panel map-minimap" aria-label="Mapa de ubicación"><svg class="minimap-svg" viewBox="0 0 150 112"></svg><div class="minimap-counts"></div><div class="map-distance-scale" role="img" aria-label="Escala del mapa principal"><span></span><i aria-hidden="true"></i></div></div>
    </div>
    <div class="map-credit">${esc(dataset.credit)}</div>
  </div>`;
  const modeLink=host.querySelector('#raeb-mode');
  const modeHref=()=>{
    const url=new URL(location.href);
    url.searchParams.set('layer','flows');
    url.searchParams.set('hour',state.flowHour);
    url.searchParams.set('day',state.flowDay);
    url.searchParams.set('raeb',paper?'atlas':'paper');
    if(paper){
      for(const key of ['pra','paperBundling','paperRadius'])url.searchParams.delete(key);
    }else url.searchParams.set('pra','3');
    return url.href;
  };
  if(modeLink){modeLink.href=modeHref();modeLink.onclick=()=>{modeLink.href=modeHref();};}
  host.querySelector('.map-stage').classList.toggle('od-stage',flujos);
  host.querySelector('#bundling')?.closest('.fidelity')?.setAttribute('title',paper?'Distancia en línea recta que usa la primera iteración. Con 0 se muestran las curvas iniciales.':'Controla cuánto se aproximan las curvas.');
  host.querySelector('#fidelity')?.closest('label').setAttribute('title','0: geometría libre; 1: red de referencia. Intermedio: se conservan los tramos principales.');
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
  const extent=bart
    ? {type:'MultiLineString',coordinates:app.flows.links.map(link=>link.coords)}
    : {type:'FeatureCollection',features:cubiertos};
  const projection=d3.geoMercator().fitExtent([[12,12],[width-12,height-12]],extent);
  const metersPerPixel=metersPerProjectedPixel(projection,dataset.latitude);
  const mapScale=host.querySelector('.map-distance-scale');
  const formatDistance=meters=>meters>=1000?`${fmt(meters/1000)} km`:`${fmt(Math.round(meters))} m`;
  function updateScale(camera){
    const target=metersPerPixel*Math.min(128,mapScale.clientWidth||128)/camera.k;
    const magnitude=10**Math.floor(Math.log10(target));
    const distance=magnitude*[5,2,1].find(n=>n*magnitude<=target);
    mapScale.querySelector('i').style.width=`${distance*camera.k/metersPerPixel}px`;
    mapScale.querySelector('span').textContent=`Mapa principal · ${formatDistance(distance)}`;
    mapScale.setAttribute('aria-label',`Escala del mapa principal: ${formatDistance(distance)}`);
  }
  const flat=d3.geoTransform({point(lon,lat){const [x,y]=projection([lon,lat]);this.stream.point(x,y);}});
  const path=d3.geoPath(flat),g=svg.append('g');
  let baseG=g;
  if(flujos){
    const baseSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    baseSvg.setAttribute('viewBox',`0 0 ${width} ${height}`);baseSvg.setAttribute('aria-hidden','true');
    const mapRect=svgNode.getBoundingClientRect(),stage=svgNode.parentElement,stageRect=stage.getBoundingClientRect();
    baseSvg.style.cssText=`position:absolute;left:${mapRect.left-stageRect.left-stage.clientLeft}px;top:${mapRect.top-stageRect.top-stage.clientTop}px;width:${width}px;height:${height}px;pointer-events:none;z-index:0`;
    const loading = stage.querySelector('.map-loading');
    if(loading){
      loading.style.inset = `${mapRect.top - stageRect.top - stage.clientTop}px auto auto ${mapRect.left - stageRect.left - stage.clientLeft}px`;
      loading.style.width = `${width}px`;
      loading.style.height = `${height}px`;
    }
    svgNode.parentElement.insertBefore(baseSvg,svgNode);baseG=d3.select(baseSvg).append('g');
    svgNode.style.position='relative';svgNode.style.zIndex='2';svgNode.style.background='transparent';
  }
  baseG.selectAll('.map-bg').data(cubiertos).join('path').attr('class','map-bg').attr('fill-rule','evenodd').attr('vector-effect','non-scaling-stroke').attr('d',path);
  // Trazado del metro (GTFS de la MTA, simplificado): contexto recesivo en gris bajo los puntos.
  if(app.lineas&&!flujos)g.append('g').attr('class','map-lines').selectAll('path').data(app.lineas.features).join('path').attr('d',path).attr('fill','none').attr('vector-effect','non-scaling-stroke');
  // Every positive OD relation participates. Curves are calculated off the UI
  // thread; the camera and continuous slider preview are WebGL uniforms.
  let pintarFlujos=null,nodeR=null,stationStarts=null,updateRadiusGuide=null;
  let onTracks=false,updateComplexConnections=null,highlightComplexConnections=null;
  if(flujos){
    const F=app.flows,ni=new Map(F.nodes.map((n,i)=>[n.id,i]));
    if(!F._smax){let sx=0;for(const y of Object.values(F.starts))for(const n of y)for(const d of n)for(const v of d)if(v>sx)sx=v;F._smax=sx;}
    const rNode=d3.scaleSqrt().domain([0,F._smax]).range([0,13]);
    stationStarts=(s,h=state.flowHour,year=state.year)=>F.starts[year]?.[ni.get(s.id)]?.[state.flowDay]?.[h];
    nodeR=(s,h)=>{const v=stationStarts(s,h)??0;return v>0?Math.max(1.8,rNode(v)):1.6;};
    baseG.append('g').attr('class','rail-reference').selectAll('path').data(F.links).join('path')
      .attr('d',l=>d3.line()(l.coords.map(projection))).attr('fill','none')
      .attr('stroke',paper?'#929a9d':'#adb2b3').attr('stroke-width',paper?1:.65)
      .attr('vector-effect','non-scaling-stroke').attr('opacity',.5).style('pointer-events','none');
    const grouping=host.querySelector('#bundling');
    const groupingOut=host.querySelector('#bundling-out');
    const autoButton=host.querySelector('#radius-auto');
    const referenceText=host.querySelector('#radius-reference');
    const trackKey=host.querySelector('.map-track-key');
    const stage=svgNode.closest('.map-stage');
    function showTracks(show){
      onTracks=show;
      stage.classList.toggle('on-tracks',show);
      if(trackKey)trackKey.hidden=!show;
      updateComplexConnections?.();
    }
    let comparisonPaths=null;
    if(cambio){
      showTracks(true);
      const stations=new Map(F.nodes.map(station=>[station.id,station]));
      const name=id=>stations.get(id).name.replace(/ \([^)]*\)/g,'');
      comparisonPaths=g.append('g').attr('class','od-delta-links').selectAll('path')
        .data(F.links.map((link,index)=>({link,index})).filter(({link})=>link.kind==='rail')).join('path')
        .attr('d',({link})=>d3.line()(link.coords.map(projection)))
        .attr('vector-effect','non-scaling-stroke')
        .attr('fill','none')
        .on('pointerenter',(event,{link,index})=>{
          if(event.pointerType==='touch'||event.buttons)return;
          const [a,b]=comparisonLoads(index,state.flowHour);
          showTooltip(`<div class="station-tooltip">
            <strong class="station-tooltip-name">${esc(name(link.a))} ↔ ${esc(name(link.b))}</strong>
            <span class="station-tooltip-context">${odBase}: ${fmt(a)} · ${state.year}: ${fmt(b)}</span>
            <div class="station-tooltip-metric"><span>Cambio de viajes OD</span><strong>${signed(b-a)}</strong></div>
          </div>`,event);
        }).on('pointerleave',hideTooltip);
    }
    function comparisonLoads(index,hour){
      const a=F.flows[odBase][state.flowDay][hour];
      const b=F.flows[state.year][state.flowDay][hour];
      const forward=2*index;
      const reverse=forward+1;
      return [a[forward]+a[reverse],b[forward]+b[reverse]];
    }
    const radiusGuide=paper&&!cambio?svg.append('circle').attr('class','radius-guide').attr('display','none'):null;
    const selectedCenter=focusOrigin?projection([focusOrigin.lon,focusOrigin.lat]):null;
    let kernel=null,activeRadius=0,showRadius=false;
    const radiusLimit=()=>kernel?.radiusMeters??(bart?3000:0);
    if(radiusGuide)updateRadiusGuide=()=>{
      const [x,y]=selectedCenter?transform.apply(selectedCenter):[width/2,height/2];
      const px=activeRadius*transform.k/metersPerPixel;
      radiusGuide.attr('display',showRadius&&px>0?null:'none').attr('cx',x).attr('cy',y).attr('r',px);
    };
    function updateGrouping(){
      if(!paper){app.raeb?.parameters(state.fidelity,state.bundling);return;}
      if(!kernel)return;
      const reference=kernel.radiusMeters;
      const automatic=state.paperRadius===null&&state.paperBundling===null;
      const limit=radiusLimit();
      activeRadius=Math.min(state.paperRadius??(reference??0)*(state.paperBundling??1),limit);
      grouping.max=String(limit);
      grouping.value=String(activeRadius);
      groupingOut.value=`${fmt(Math.round(activeRadius))} m`;
      grouping.setAttribute('aria-valuetext',`${Math.round(activeRadius)} metros`);
      autoButton.setAttribute('aria-pressed',String(automatic));
      referenceText.textContent=reference===null
        ? limit>0?'Sin radio automático · ajuste manual':'Sin grupo para estimar el radio'
        : `Máximo RAEB: ${fmt(Math.round(reference))} m`;
      updateRadiusGuide();
      showTracks(state.paperLevel===5&&activeRadius===0);
      app.raeb?.parameters(state.paperLevel/5,activeRadius);
    }
    function receiveKernel(value){
      if(!paper)return;
      if(value===kernel&&value)return;
      kernel=value;
      const reference=kernel?.radiusMeters;
      grouping.disabled=!kernel||radiusLimit()===0;
      autoButton.disabled=!(reference>0);
      autoButton.hidden=bart&&!!kernel&&reference===null;
      if(kernel){
        const limit=radiusLimit();
        const capped=state.paperRadius!==null&&state.paperRadius>limit;
        if(capped)state.paperRadius=limit;
        updateGrouping();
        if(capped)app.syncURL?.();
        return;
      }
      activeRadius=0;
      showTracks(false);
      groupingOut.value='—';
      referenceText.textContent='Calculando la referencia…';
      updateRadiusGuide();
    }
    if(!cambio)try{
      app.raeb??=new RaebOverlay(F,{paper,dataURL:dataset.dataURL,latitude:dataset.latitude});
      app.raeb.attach(g.node(),width,height,projection,transform,receiveKernel);
      if(!paper)updateGrouping();
    }catch(error){setRaebStatus(error.message);console.error(error);}
    pintarFlujos=h=>{
      host.querySelector('#flow-hour-label').value=ampm(h);host.querySelector('#flow-legend-hour').textContent=ampm(h);
      app.updateODYearMaps?.(state.flowDay,h,`${DAYS_LONG[state.flowDay]} · ${ampm(h)}`);
      g.selectAll('.map-dot').attr('r',s=>rOf(s,h)/transform.k);
      updateComplexConnections?.();
      updateClockTime(state.flowDay,h);
      if(focusOrigin){
        const total=stationStarts(focusOrigin,h)||0;
        const key=host.querySelector('#map-key');
        key.querySelector('.map-key-bar').hidden=total===0;
        key.querySelector('.flow-color-ticks').hidden=total===0;
        key.querySelector('.flow-color-ticks').innerHTML=[0,total/4,total].map(value=>`<span>${fmt(value)}</span>`).join('');
        key.querySelector('.flow-selection-total').textContent=`${fmt(total)} viajes iniciados · escala de este complejo y hora`;
      }
      if(comparisonPaths){
        let gains=0,losses=0,unchanged=0;
        comparisonPaths.each(function({index}){
          const [a,b]=comparisonLoads(index,h);
          const delta=Math.round((b-a)*1000)/1000;
          if(delta>0)gains++;
          else if(delta<0)losses++;
          else unchanged++;
          const strength=Math.sqrt(Math.min(Math.abs(delta)/changeLimit,1));
          d3.select(this)
            .attr('stroke',delta>0?odGain(strength):odLoss(strength))
            .attr('stroke-width',1+3*strength);
        });
        host.querySelector('#od-change-counts').textContent=`${fmt(gains)} subieron · ${fmt(losses)} bajaron · ${fmt(unchanged)} sin cambio`;
      }else app.raeb?.frame(state.year,state.flowDay,h,state.selected);
      app.syncURL?.();
    };
    const profileStations=focusOrigin?[focusOrigin]:items;
    const porHora=d3.range(24).map(h=>d3.sum(profileStations,s=>stationStarts(s,h)));
    const profileNode=host.querySelector('#flow-profile');
    const svgP=d3.select(profileNode),PW=profileNode.clientWidth||222,PH=46;
    svgP.attr('viewBox',`0 0 ${PW} ${PH}`);
    const px=d3.scaleLinear().domain([0,23]).range([7,PW-7]),py=d3.scaleLinear().domain([0,d3.max(porHora)||1]).range([PH-2,12]);
    svgP.append('path').attr('d',d3.area().x((v,i)=>px(i)).y0(PH-2).y1(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','#1d6f8d').attr('opacity',.14);
    svgP.append('path').attr('d',d3.line().x((v,i)=>px(i)).y(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','none').attr('stroke','#1d6f8d').attr('stroke-width',1.2);
    const marca=svgP.append('g');marca.append('line').attr('y1',4).attr('y2',PH-2).attr('stroke','#1b2a33');marca.append('circle').attr('r',2.6).attr('fill','#1b2a33');
    const slider=host.querySelector('#flow-hour');
    const pintarBase=pintarFlujos;
    pintarFlujos=h=>{
      slider.value=h;
      marca.attr('transform',`translate(${px(h)},0)`);
      marca.select('circle').attr('cy',py(porHora[h]));
      pintarBase(h);
    };
    app.updateFlowHour=pintarFlujos;
    slider.oninput=()=>app.setFlowTime(state.flowDay,+slider.value);
    svgP.style('cursor','pointer').on('click',event=>{
      const [x]=d3.pointer(event,profileNode);
      const hour=Math.round(Math.max(0,Math.min(23,px.invert(x))));
      app.setFlowTime(state.flowDay,hour);
    });
    host.querySelectorAll('[data-flowday]').forEach(b=>b.onclick=()=>app.setFlowTime(+b.dataset.flowday,state.flowHour));
    if(!cambio&&paper){
      const reveal=visible=>{showRadius=visible;updateRadiusGuide();};
      grouping.onfocus=()=>reveal(true);
      grouping.onblur=()=>reveal(false);
      grouping.onpointerenter=()=>reveal(true);
      grouping.onpointerleave=()=>reveal(document.activeElement===grouping);
      autoButton.onclick=()=>{
        state.paperRadius=null;
        state.paperBundling=null;
        updateGrouping();
        app.syncURL?.();
      };
    }
    if(!cambio){
      grouping.oninput=()=>{
        if(paper){
          state.paperRadius=grouping.valueAsNumber;
          state.paperBundling=null;
        }else{
          state.bundling=grouping.valueAsNumber;
          groupingOut.value=state.bundling.toFixed(2);
        }
        updateGrouping();
      };
      grouping.onchange=()=>app.syncURL?.();
      const fidelity=host.querySelector(paper?'#pra':'#fidelity');
      fidelity.oninput=()=>{
        if(paper){
          state.paperLevel=fidelity.valueAsNumber;
          host.querySelector('#pra-out').value=`${state.paperLevel} / 5`;
        }else{
          state.fidelity=fidelity.valueAsNumber;
          host.querySelector('#fidelity-out').value=state.fidelity.toFixed(2);
        }
        updateGrouping();
      };
      fidelity.onchange=()=>app.syncURL?.();
      app._relane=()=>app.raeb?.transform(transform);
    }else app._relane=null;
  }else{app._relane=null;}
  host.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>app.set({layer:b.dataset.layer}));
  const labels=bart?[]:[['MANHATTAN',-74.003,40.789],['BROOKLYN',-73.987,40.635],['QUEENS',-73.817,40.740],['BRONX',-73.854,40.870]];
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
  const contextPoints=g.selectAll('.context-point').data(app.data.stations.filter(s=>!ids.has(s.id)&&profile(s)&&passesMetricRanges(s))).join('circle').attr('class','context-point').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',1.6).attr('fill','#b8c7c1').attr('opacity',.45);
  const R=flujos?2.4:5.2;
  const rOf=(s,h)=>focusOrigin&&s.id!==focusOrigin.id?1.7:flujos&&nodeR?nodeR(s,h):R;
  if(flujos&&(paper||cambio)){
    const complexes=new Map(items.map(station=>[station.id,station]));
    if(focusOrigin)complexes.set(focusOrigin.id,focusOrigin);
    const connections=new Map();
    const addConnection=(id,coords)=>{
      const station=complexes.get(id);
      if(!station||(focusOrigin&&id!==focusOrigin.id))return;
      const key=`${id}:${coords.join(',')}`;
      if(connections.has(key))return;
      const [x1,y1]=projection(coords);
      const [x2,y2]=projection([station.lon,station.lat]);
      const length=Math.hypot(x2-x1,y2-y1);
      if(length*12>=4)connections.set(key,{station,x1,y1,x2,y2,length});
    };
    // The displayed connector links two locations of the same complex.
    // Keep it separate from the GTFS polylines and from the flow renderer.
    for(const link of app.flows.links){
      if(link.kind!=='rail')continue;
      addConnection(link.a,link.coords[0]);
      addConnection(link.b,link.coords.at(-1));
    }
    const group=g.append('g').attr('class','map-complex-connections')
      .attr('aria-hidden','true').attr('display','none');
    const lines=group.selectAll('line').data(connections.values()).join('line')
      .attr('data-station-id',connection=>connection.station.id)
      .attr('vector-effect','non-scaling-stroke')
      .attr('x1',connection=>connection.x1).attr('y1',connection=>connection.y1)
      .attr('x2',connection=>connection.x2).attr('y2',connection=>connection.y2);
    const key=host.querySelector('.map-complex-key');
    const byComplex=d3.group(lines.nodes(),line=>line.dataset.stationId);
    let highlightedId=focusOrigin?.id;
    let highlighted=[];
    highlightComplexConnections=id=>{
      highlightedId=id??focusOrigin?.id;
      for(const line of highlighted)line.classList.remove('is-highlighted');
      highlighted=byComplex.get(highlightedId)??[];
      for(const line of highlighted)line.classList.add('is-highlighted');
      updateComplexConnections?.();
    };
    updateComplexConnections=()=>{
      let show=false;
      if(onTracks&&state.showFlowNodes){
        lines.attr('display',connection=>{
          const highlighted=connection.station.id===highlightedId;
          const visibleGap=connection.length*transform.k-rOf(connection.station);
          const visible=visibleGap>=(highlighted?2:4);
          show||=visible;
          return visible?null:'none';
        });
      }
      group.attr('display',show?null:'none');
      key.hidden=!show;
    };
    highlightComplexConnections();
  }
  const points=g.selectAll('.map-dot').data(items).join('circle').attr('class','map-dot'+(flujos?' quiet':'')).attr('data-station-id',s=>s.id).attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',s=>rOf(s)).attr('fill',s=>flujos?(focusOrigin&&s.id!==focusOrigin.id?'#87969d':'#1d6f8dcc'):color(metricValue(s,state.mapMetric)))
    .on('click',(event,station)=>{
      event.stopPropagation();
      if(event.shiftKey)app.pin(station.id);
      else app.select(state.selected===station.id?null:station.id);
    });
  const tooltip=document.querySelector('#tooltip');
  function showStationTooltip(event,station){
    if(event.pointerType==='touch'||event.buttons)return;
    highlightComplexConnections?.(station.id);
    const name=station.name.replace(/ \([^)]*\)/g,'');
    const context=[station.borough,station.routes.join(' · ')].filter(Boolean).join('  /  ');
    const value=flujos?stationStarts(station):metricValue(station,metric);
    const time=flujos?DAYS_LONG[state.flowDay]+' · '+ampm(state.flowHour):'';
    let label=stationMetricLabels[metric];
    let displayValue='Sin datos';
    if(flujos)label=cambio?`${dataset.startsLabel} · ${state.year}`:dataset.startsLabel;
    else if(metric==='recovery')label+=' '+BASE;
    if(Number.isFinite(value)){
      const formatValue=metric==='deltaAM'||metric==='deltaWeekend'?signed:fmt;
      displayValue=flujos?fmt(value):formatValue(value)+' '+unit;
    }
    showTooltip(`<div class="station-tooltip">
      <strong class="station-tooltip-name">${esc(name)}</strong>
      <span class="station-tooltip-context">${esc(context)}</span>
      <div class="station-tooltip-metric">
        <span>${label}${time?`<small>${esc(time)}</small>`:''}</span>
        <strong>${displayValue}</strong>
      </div>
    </div>`,event);
  }
  for(const stations of [points,contextPoints]){
    stations.on('pointerenter',showStationTooltip)
      .on('pointermove',(event,station)=>{if(tooltip.hidden)showStationTooltip(event,station);})
      .on('pointerleave',()=>{
        hideTooltip();
        highlightComplexConnections?.();
      });
  }
  // Entrada animada: al cambiar medida, filtro o año, los puntos aparecen en vez de saltar.
  points.attr('opacity',s=>focusOrigin&&s.id!==focusOrigin.id?.38:1);
  // Draw larger changes last so low values cannot cover them in dense areas.
  points.sort((a,b)=>Math.abs(metricValue(a,state.mapMetric))-Math.abs(metricValue(b,state.mapMetric)));
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
  const active=app.data.stations.filter(s=>s.id===state.selected||(!focusOrigin&&state.pins.includes(s.id)));
  const rings=g.selectAll('.selected-ring').data(active).join('circle').attr('class','selected-ring').attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',8.5).attr('fill','none').attr('stroke',s=>s.id===state.selected?'#102937':'#c96035').attr('stroke-width',2).style('pointer-events','none');
  if(flujos){
    const toggle=host.querySelector('#flow-nodes');
    const legend=host.querySelector('#flow-node-key');
    const setNodeVisibility=()=>{
      svg.classed('hide-flow-nodes',!state.showFlowNodes);
      legend.hidden=!state.showFlowNodes&&!focusOrigin;
      highlightComplexConnections?.();
    };
    toggle.onchange=()=>{
      state.showFlowNodes=toggle.checked;
      setNodeVisibility();
      hideTooltip();
      app.syncURL();
    };
    setNodeVisibility();
  }
  const boroughLabels=g.selectAll('.borough-name');
  let boroughsHidden=null;
  const zoom=d3.zoom().scaleExtent([1,12]).translateExtent([[0,0],[width,height]]).on('zoom',event=>{
    transform=event.transform;
    g.attr('transform',transform);
    if(baseG!==g)baseG.attr('transform',transform);
    points.attr('r',s=>rOf(s)/transform.k);
    if(app._relane)app._relane(transform.k);
    rings.attr('r',8.5/transform.k);
    contextPoints.attr('r',1.6/transform.k);
    const hideBoroughs=transform.k>3;
    if(hideBoroughs!==boroughsHidden){
      boroughLabels.attr('display',hideBoroughs?'none':null);
      boroughsHidden=hideBoroughs;
    }
    if(highlightComplexConnections)highlightComplexConnections();
    hideTooltip();
  });
  // Contexto al acercar: miniatura fija con los boroughs, los complejos del grupo y el rectángulo de lo
  // que se ve; debajo, cuántos complejos del grupo hay en cada borough.
  const mini=d3.select(host.querySelector('.minimap-svg')),miniProj=d3.geoMercator().fitExtent([[3,3],[147,109]],extent),miniPath=d3.geoPath(miniProj);
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
  host.querySelector('.minimap-counts').innerHTML=dataset.areas.map(b=>`<span>${b}<b>${porB.get(b)??0}</b></span>`).join('');
  zoom.on('zoom.mini',e=>{
    pintarMini(e.transform);
    updateScale(e.transform);
    updateRadiusGuide?.();
  });
  svg.call(zoom).call(zoom.transform,transform);
  host.querySelector('#map-center').onclick=()=>{transform=d3.zoomIdentity;if(state.selected){app.set({selected:null});return;}svg.transition().duration(250).call(zoom.transform,transform);};
  svg.on('click.clear-selection',event=>{if(state.selected&&!event.defaultPrevented)app.set({selected:null});});
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
    if(cambio){
      host.querySelector('#map-key').innerHTML=`
        <div class="map-key-note">Viajes OD por día (B − A)</div>
        <div class="map-key-bar" style="background:linear-gradient(90deg,${OD_CHANGE_COLORS.loss},${OD_CHANGE_COLORS.neutral},${OD_CHANGE_COLORS.gain})" aria-hidden="true"></div>
        <div class="flow-color-ticks"><span>≤ −${fmt(changeLimit)}</span><span>0</span><span>≥ +${fmt(changeLimit)}</span></div>
        <div class="map-key-words"><span>Bajó</span><span>Subió</span></div>
        <div id="od-change-counts" class="map-key-note"></div>`;
      pintarFlujos(state.flowHour);
      return;
    }
    const colors=FLOW_COLOR_STOPS.map(({color})=>color).join(',');
    const ticks=FLOW_COLOR_STOPS.map(({trips})=>`<span>${fmt(trips)}${trips===FLOW_COLOR_MAX?'+':''}</span>`).join('');
    host.querySelector('#map-key').innerHTML=`
      <div class="map-key-note">Viajes estimados en cada trazo durante esta hora</div>
      <div class="map-key-bar" style="background:linear-gradient(90deg,${colors})" aria-hidden="true"></div>
      <div class="flow-color-ticks">${ticks}</div>
      ${focusOrigin?'<div class="map-key-note flow-selection-total"></div>':''}`;
    pintarFlujos(state.flowHour);
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
