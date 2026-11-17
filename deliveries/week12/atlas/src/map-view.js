import {bindMapLasso} from './map-lasso.js?v=shared-map1';
import {bindFlowScale,bindCircleScale} from './flow-scale.js?v=grouped-circle-key1';
import {odLoads,odStarts,odIncoming,odPeriodLabel} from './od-period.mjs';
import {state,BASE,esc,fmt,signed,profile,metricValue,metricColor,showTooltip,hideTooltip,heading,stats,passesMetricRanges,cohortProfile} from './model.js?v=20261028-4';
import {RaebOverlay} from './raeb-overlay.mjs?v=crisp-raeb2';
import {setRaebStatus} from './raeb-cpu-overlay.mjs?v=crisp-raeb2';
import {FLOW_COLOR_MAX,FLOW_COLOR_STOPS,RAEB_OVERVIEW_COLOR_STOPS,flowColor} from './raeb-gpu-shaders.mjs?v=crisp-raeb2';
import {metersPerProjectedPixel} from './raeb-scale.mjs?v=rail-reading1';
import {activeODCompareBase} from './contrast-model.mjs?v=od-only1';
import {OD_CHANGE_LIMIT,OD_CHANGE_COLORS,OD_RAIL_MIN_WIDTH,OD_RAIL_MAX_WIDTH,railChange,railFlowWidth,zoomStrokeScale,flowStrength,flowCount,odDelta} from './od-encoding.mjs?v=rail-width65';
import {originBranches,bundleAt,distanceToLines} from './od-routing.mjs?v=annual-overview1';
import {updateClockTime} from './inspector.js?v=station-highlight1';
let transform=d3.zoomIdentity, previousFrame, pendingFidelity=null, pendingGrouping;
let legendPreference=null;
let legendPosition={x:0,y:0};

function bindLegendPosition(panel){
  const frame=panel.parentElement;
  const handle=panel.querySelector('.map-legend-move');
  const gap=10;
  function move(x,y){
    legendPosition={x,y};
    panel.style.setProperty('--legend-x',String(x*100)+'%');
    panel.style.setProperty('--legend-y',String(y*100)+'%');
    panel.style.setProperty('--legend-inset-x',String(gap*(1-2*x))+'px');
    panel.style.setProperty('--legend-inset-y',String(gap*(1-2*y))+'px');
  }
  move(legendPosition.x,legendPosition.y);

  let drag, moved=false;
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const box=panel.getBoundingClientRect();
    drag={x:event.clientX,y:event.clientY,offsetX:event.clientX-box.left,offsetY:event.clientY-box.top};
    moved=false;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<4&&!moved)return;
    moved=true;
    const bounds=frame.getBoundingClientRect();
    const fraction=(position,available)=>Math.max(0,Math.min(1,position/Math.max(1,available)));
    move(
      fraction(event.clientX-bounds.left-drag.offsetX-gap,bounds.width-panel.offsetWidth-2*gap),
      fraction(event.clientY-bounds.top-drag.offsetY-gap,bounds.height-panel.offsetHeight-2*gap)
    );
  });
  handle.addEventListener('lostpointercapture',()=>{drag=null;});
  handle.addEventListener('click',event=>{
    if(moved&&event.detail){moved=false;return;}
    const {x,y}=legendPosition;
    const next=x<.5?(y<.5?[1,0]:[0,0]):(y<.5?[1,1]:[0,1]);
    move(...next);
  });
}
const mapZoomLimits=[1,32];
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
  const annual=state.flowDay===null;
  const volumeLimit=annual?app.flows.annual.volume_limit:FLOW_COLOR_MAX;
  const changeLimit=app.flows?.meta.change_limit??OD_CHANGE_LIMIT;
  const flujos=state.layer==='flows'&&!!app.flows&&!!app.flows.flows[String(state.year)];
  const routeNodes=flujos?app.flows.meta.network?.route_nodes:null;
  const stopsByComplex=d3.group(Object.values(routeNodes??{}),stop=>stop.complex);
  const anchors=new Map();
  for(const station of app.data.stations){
    const stops=stopsByComplex.get(station.id);
    if(!stops?.length)continue;
    const origin=[station.lon,station.lat];
    anchors.set(station.id,d3.least(stops,stop=>d3.geoDistance(origin,stop.coords)).coords);
  }
  const stationCoords=station=>anchors.get(station.id)??[station.lon,station.lat];
  const paper=state.paperRAEB;
  const fidelityKey=paper?'paperLevel':'fidelity';
  const formatFidelity=value=>paper?`${value} / 5`:value.toFixed(2);
  const odBase=activeODCompareBase(state,app.flows);
  const cambio=odBase!==null;
  const displayGrouping=cambio?0:state.bundling;
  const displayFidelity=cambio?1:state.fidelity;
  const displayLevel=cambio?5:state.paperLevel;
  let onTracks=flujos&&!cambio&&(paper
    ? state.paperLevel===5&&(state.paperRadius===0||state.paperBundling===0)
    : state.fidelity===1);
  let originData=null, originBase=null, originRequest=0;
  const focusOrigin=flujos?app.station(state.selected):null;
  const scope=app.odScope;
  const between=flujos&&scope.zones;
  const drawnZones=between?state.odZones:null;
  const circleLabel=cambio?(focusOrigin?'Círculos de cambio por destino':'Círculos de cambio')
    :focusOrigin?'Círculos de destino':'Círculos de afluencia';
  const zoneOf=station=>drawnZones?.a.has(station.id)?'a':drawnZones?.b.has(station.id)?'b':null;
  let zoneStats=null;
  const scopedGroup=flujos&&!focusOrigin&&scope.origins!==null;
  let scopeLoads=null,scopeRequest=0;
  let comparisonFrame=null,comparisonRequest=0;
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
  let legendOpen=legendPreference??matchMedia('(min-width: 1200px)').matches;
  const legendTitle=flujos
    ?cambio?'Cambio de viajes':focusOrigin?'Salidas del complejo':between?scope.label:scopedGroup?'Salidas del grupo':onTracks?'Flujo por tramo':'Flujo en los haces'
    :L.titulo;
  const circleSamples=(sign='')=>Array.from({length:3},()=>`
    <span class="map-circle-sample" role="img" tabindex="0"${sign?` data-change-sign="${sign}"`:''}>
      <span aria-hidden="true"${sign?` style="background:${OD_CHANGE_COLORS[sign]}"`:''}></span>
    </span>`).join('');
  host.innerHTML=`
  <div class="map-stage">
    <div class="map-sidebar" role="region" aria-label="Controles del mapa">
    <div class="map-panel map-panel-controls">
      ${flujos?'':'<div class="eyebrow">01 · CONEXIONES Y RITMOS</div>'}
      ${app.flows?`<div class="segmented map-layer" role="group" aria-label="Capa del mapa"><button data-layer="points" class="${!flujos?'active':''}">Cambio por complejo</button><button data-layer="flows" class="${flujos?'active':''}">Flujos de la red</button></div>`:''}
      ${flujos?`<div class="flow-controls">
        <section class="flow-control-group flow-control-navigation" aria-labelledby="map-navigation-heading">
          <h3 id="map-navigation-heading">Explorar</h3>
          <div class="map-selection-tools">
            <button id="map-select" type="button" aria-pressed="false">Dibujar área</button>
            <button id="map-select-pair" type="button" aria-pressed="false">Entre dos zonas</button>
          </div>
          <p id="map-selection-hint" class="map-selection-hint" role="status" hidden></p>
          ${between?'':`<label class="flow-node-toggle">
            <span>${circleLabel}</span>
            <input id="flow-nodes" type="checkbox" role="switch"${state.showFlowNodes?' checked':''}>
            <span class="flow-node-switch" aria-hidden="true"></span>
          </label>`}
        </section>
        <section id="map-grouping" class="flow-control-group" aria-labelledby="map-grouping-title">
          <div class="grouping-heading">
            <h3 id="map-grouping-title">Agrupamiento y fidelidad</h3>
            <small id="applied-fidelity" role="status"></small>
          </div>
          <div class="flow-control-grouping">
          ${paper?`<div class="fidelity radius-control">
            <div class="radius-heading">
              <label for="bundling">Radio inicial</label>
              <output id="bundling-out" for="bundling">${cambio?'0 m':'—'}</output>
            </div>
            <input id="bundling" type="range" min="0" max="0" step="any" value="0" disabled>
          </div>`:`<label class="fidelity"><span>Agrupación <output id="bundling-out">${displayGrouping.toFixed(2)}</output></span><input id="bundling" type="range" min="0" max="1" step="0.01" value="${displayGrouping}" aria-label="Agrupación de recorridos"${cambio?' disabled':''}><small>0: sin atracción entre curvas · 1: agrupamiento con el radio estimado por RAEB. Actúa sobre todos los pares OD del período activo.</small></label>`}
          ${paper?`<label class="fidelity"><span>Fidelidad a la red <output id="pra-out">${displayLevel} / 5</output></span><input id="pra" type="range" min="0" max="5" step="1" value="${displayLevel}"${cambio?' disabled':''} aria-label="Nivel de fidelidad a la red" title="0: agrupación libre. 5: toda la red guía los haces. Con radio 0, los flujos siguen la vía asignada."><small>0: agrupación libre · 5: toda la red guía los haces.</small></label>`:`
          <label class="fidelity"><span>Fidelidad geométrica <output id="fidelity-out">${displayFidelity.toFixed(2)}</output></span><input id="fidelity" type="range" min="0" max="1" step="0.01" value="${displayFidelity}"${cambio?' disabled':''} aria-label="Fidelidad geométrica de los trazos"><small>0: abstracción libre, puede cruzar el agua · 1: recorridos de referencia. Los trazos intermedios son una abstracción visual; los viajes OD no cambian.</small></label>`}
          <div class="grouping-actions">
            ${cambio?'':'<div id="raeb-status" role="status" class="raeb-status"></div>'}
            <div class="map-control fidelity-actions">
              <button type="button" id="calculate-fidelity" aria-label="Calcular agrupamiento y fidelidad"
                ${cambio?'title="La comparación usa la red de referencia con radio cero."':''} disabled>Calcular</button>
            </div>
            <button id="inspect-bundle" type="button" class="text-button" aria-pressed="false" hidden>Explorar un haz</button>
            <div id="bundle-evidence" class="bundle-evidence" aria-live="polite" hidden></div>
          </div>
          </div>
        </section>
        ${bart?`<section class="flow-control-group flow-control-time" aria-labelledby="map-time-heading">
          <h3 id="map-time-heading">Día y hora</h3>
          <div class="flow-hour-row"><span class="flow-day-current">${DAYS_LONG[state.flowDay]}</span><output id="flow-hour-label" class="flow-hour-label">${ampm(state.flowHour)}</output><div class="segmented flow-day">${DAYS.map((d,i)=>`<button data-flowday="${i}" aria-pressed="${state.flowDay===i}" class="${state.flowDay===i?'active':''}" title="${DAYS_LONG[i]}">${d.slice(0,2)}</button>`).join('')}</div></div>
          <svg id="flow-profile" class="flow-profile"${between?' style="display:none"':''} aria-label="Distribución de viajes OD por hora en el año seleccionado"></svg>
          <input id="flow-hour" class="flow-slider" type="range" min="0" max="23" step="1" value="${state.flowHour}" aria-label="${dataset.hourLabel}">
          <div class="flow-ticks"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span><span>11 pm</span></div>
        </section>` :''}
        <section id="map-clock" class="flow-control-group clock-panel" aria-label="Reloj semanal de la selección" hidden><div id="detail-body"></div></section>
        <div id="map-scatter" class="flow-control-group"></div>
      </div>`:''}
      <div class="points-controls"${flujos?' hidden':''}>
      <label class="map-field">Color de los puntos<select id="map-metric">${Object.entries(names).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="map-field">Entrada al análisis<select id="preset-select"><option value="">Todos los complejos</option><option value="morning"${state.preset==='morning'?' selected':''}>La mañana cambia (Δ AM &lt; −2 pp)</option><option value="weekend"${state.preset==='weekend'?' selected':''}>Otro fin de semana (Δ &gt; +2 pp)</option><option value="change"${state.preset==='change'?' selected':''}>Ritmos que se alejan (TV ≥ 10 pp)</option><option value="decoupled"${state.preset==='decoupled'?' selected':''}>Volumen ≠ ritmo</option></select></label>
      <details class="map-filter"${activeRange?' open':''}><summary>Filtrar por ${title} <span class="map-filter-n">${items.length} de ${values.length}</span></summary>
        <div class="metric-formula-help"><button id="metric-formula-trigger" class="metric-formula-trigger" aria-expanded="false" aria-describedby="metric-formula-panel">Cómo se calcula <span aria-hidden="true">ⓘ</span></button><div id="metric-formula-panel" class="metric-formula-panel" role="tooltip" hidden><b>Cómo se calcula: ${title}</b><div class="metric-formula-equation">${esc(formula.formula)}</div><p>${esc(formula.explanation)}</p><p><b>Unidad e interpretación</b><br>${esc(formula.unit)}</p><p>${esc(formula.example)}</p><div class="metric-formula-base">Base de cálculo: el año completo, frente a ${BASE}.<br>Wᵧ(d,h) = entradas registradas / cantidad de días de ese tipo en el año.<br>Pᵧ(i) = Wᵧ(i) / Σ Wᵧ(i); los 168 valores de P suman 1.<br>y = año elegido; i = combinación día–hora.</div></div></div>
        <div class="tv-range-control"><div class="tv-range-values"><span>Mín. <output id="map-min-output">${fmt(lowerValue)} ${unit}</output></span><span>Máx. <output id="map-max-output">${fmt(upper)} ${unit}</output></span></div><div class="dual-range" role="group" aria-label="Rango de ${title}"><div class="dual-range-track"></div><div class="dual-range-selected"></div><input id="map-min-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${lowerValue}" aria-label="Mínimo de ${title}"><input id="map-max-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${upper}" aria-label="Máximo de ${title}"></div></div>
        <button id="map-range-reset" class="text-button">Quitar este filtro</button>
        ${filters.length?`<div class="metric-filter-chips">${filters.map(([key,label])=>`<button data-clear-metric="${key}" title="Quitar este filtro">${esc(label)} ×</button>`).join('')}</div>`:''}
      </details>
      </div>
      ${flujos?'':`<div class="map-control"><button id="map-select" type="button" aria-pressed="false">Dibujar área</button></div>`}
      ${flujos?'':'<p id="map-selection-hint" class="map-selection-hint" role="status" hidden></p>'}
    </div>
    </div>
    <div class="map-viewport">
      <svg class="map-svg" role="img" aria-label="Mapa de estaciones · ${esc(dataset.name)}"${flujos&&!cambio?' aria-busy="true"':''}></svg>
      ${flujos&&!cambio?`<div class="map-loading" aria-hidden="true"${onTracks?' hidden':''}>
        <div class="map-loading-label"><span class="map-spinner"></span></div>
      </div>`:''}
      <div class="map-panel map-minimap" aria-label="Mapa de ubicación"><svg class="minimap-svg" viewBox="0 0 150 112"></svg><div class="minimap-counts"></div><div class="map-distance-scale" role="img" aria-label="Escala del mapa principal"><span></span><i aria-hidden="true"></i></div></div>
    <div class="map-legend-position">
    <button type="button" class="map-legend-move" aria-label="Mover leyenda" title="Arrastra para mover la leyenda o pulsa para cambiar de esquina">⤢</button>
    <details class="map-panel map-legend${cambio?' comparison-key':''}" aria-label="Leyenda"${legendOpen?' open':''}>
      <summary id="flow-legend-title" class="map-legend-title">${legendTitle}</summary>
      ${flujos?`<div class="map-legend-what">${cambio?'Viajes por día · B − A':annual?'Promedio diario':'Promedio diario en esta franja'}</div>
      <div id="map-key"></div>
      ${between?`<div class="map-legend-marks map-zone-summary"><span class="zone-label-a">Zona A · ${drawnZones.a.size}</span><span class="zone-label-b">Zona B · ${drawnZones.b.size}</span></div><div id="zone-flow-summary" class="map-key-note" role="status"></div>`:''}
      ${between?'':`<div class="map-legend-marks" id="flow-node-key"${state.showFlowNodes?'':' hidden'}>
        ${cambio?`<div class="comparison-key-heading"><strong>${focusOrigin?'Destinos':'Complejos'}</strong><span>Área del círculo</span></div>
          <div>El área indica cuánto cambiaron los viajes ${focusOrigin?'a cada destino':'en cada complejo'}.</div>`
          :`<div>${focusOrigin?'El área indica cuántos viajes del origen seleccionado llegan a cada destino.'
            :`El área indica cuántos viajes ${app.flows.incoming?'empiezan o terminan':'empiezan'} en cada complejo.`}</div>`}
        <div id="flow-circle-scale" hidden>
          ${cambio?`<div class="comparison-circle-groups">
            <div class="comparison-circle-group">
              <div class="map-circle-samples">${circleSamples('loss')}</div><span>Bajó</span>
            </div>
            <div class="comparison-circle-group">
              <div class="map-circle-samples">${circleSamples('gain')}</div><span>Subió</span>
            </div>
          </div>`:`<div class="map-circle-samples">${circleSamples()}</div>
          <div class="map-key-words"><span>Menos actividad</span><span>Más actividad</span></div>`}
        </div>
      </div>`}
      ${routeNodes?`<div class="map-footprint-key" hidden><i aria-hidden="true"></i> Estaciones del mismo complejo · área esquemática</div>
      <div class="map-complex-key" hidden><i aria-hidden="true"></i> Transbordo entre complejos · esquema</div>`:''}
      <div class="map-track-key"${paper&&!cambio?' hidden':''}><i aria-hidden="true"></i> Vía de referencia</div>
      <details class="map-legend-help">
        <summary>Cómo leer el mapa</summary>
        <p id="flow-legend-foot">${paper?'RAEB (2019) aplicado a viajes OD. Las curvas son haces; pueden apartarse de la red.':'Las curvas agrupan relaciones OD; no muestran trenes ni rutas observadas.'}</p>
        ${cambio?`<p>Pasa por un tramo o un círculo para ver los valores de cada año y su diferencia.</p><p id="od-change-counts"></p>`:''}
      </details>`:`<div class="map-legend-what">${L.que}</div>
      <div id="map-key"></div>
      <div class="map-legend-marks"><span><i class="lg-dot"></i> un punto = un complejo &nbsp;<i class="lg-ring"></i> seleccionado &nbsp;<i class="lg-ring pin"></i> fijado</span></div>
      <div class="map-legend-foot">${items.length} complejos · mediana ${fmt(d3.median(items,s=>metricValue(s,metric)))} ${unit}</div>`}
    </details>
    </div>
    </div>
  </div>`;
  host.querySelector('.map-stage').classList.toggle('od-stage',flujos);
  const legendPanel=host.querySelector('.map-legend');
  bindLegendPosition(legendPanel.parentElement);
  legendPanel.ontoggle=()=>{
    if(legendPanel.isConnected&&legendPanel.open!==legendOpen)legendPreference=legendOpen=legendPanel.open;
  };
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
    mapScale.querySelector('span').textContent=formatDistance(distance);
    mapScale.setAttribute('aria-label',`Escala del mapa principal: ${formatDistance(distance)}`);
  }
  const flat=d3.geoTransform({point(lon,lat){const [x,y]=projection([lon,lat]);this.stream.point(x,y);}});
  const path=d3.geoPath(flat),g=svg.append('g');
  const borough=cubiertos.find(feature=>feature.properties.name===state.borough);
  const frame=borough?`${dataset.id}/${state.borough}/${width}/${height}`:`${dataset.id}/all`;
  let panExtent=[[0,0],[width,height]];
  let districtCamera=d3.zoomIdentity;
  if(borough){
    const [[left,top],[right,bottom]]=path.bounds(borough);
    const padding=Math.min(32,width*.08,height*.08);
    const scale=Math.min(mapZoomLimits[1],(width-2*padding)/(right-left),(height-2*padding)/(bottom-top));
    const x=width/2-scale*(left+right)/2,y=height/2-scale*(top+bottom)/2;
    districtCamera=d3.zoomIdentity.translate(x,y).scale(scale);
    const [x0,y0]=districtCamera.invert([0,0]),[x1,y1]=districtCamera.invert([width,height]);
    panExtent=[[Math.min(0,x0),Math.min(0,y0)],[Math.max(width,x1),Math.max(height,y1)]];
  }
  if(frame!==previousFrame)transform=districtCamera;
  previousFrame=frame;
  let baseG=g;
  if(flujos){
    const baseSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    baseSvg.classList.add('map-base-svg');
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
  baseG.selectAll('.map-bg').data(cubiertos).join('path')
    .attr('class','map-bg').attr('data-borough',feature=>feature.properties.name)
    .classed('borough-context',feature=>!!borough&&feature!==borough)
    .attr('fill-rule','evenodd').attr('vector-effect','non-scaling-stroke').attr('d',path);
  const footprintLayer=routeNodes?baseG.append('g').attr('class','map-base-decoration').attr('aria-hidden','true'):null;
  const zoneLayer=baseG.append('g').attr('class','map-base-decoration').attr('aria-hidden','true').attr('pointer-events','none');
  const stationPosition=station=>projection(stationCoords(station));
  // Trazado del metro (GTFS de la MTA, simplificado): contexto recesivo en gris bajo los puntos.
  if(app.lineas&&!flujos)g.append('g').attr('class','map-lines').selectAll('path').data(app.lineas.features).join('path').attr('d',path).attr('fill','none').attr('vector-effect','non-scaling-stroke');
  // Every positive OD relation participates. Curves are calculated off the UI
  // thread; the camera and continuous slider preview are WebGL uniforms.
  let pintarFlujos=null,stationStarts=null,stationUse=null,updateRadiusGuide=null;
  let setFlowScale;
  const flowGradient = onNetwork => {
    const stops = paper&&!onNetwork&&!focusOrigin&&!between ? RAEB_OVERVIEW_COLOR_STOPS : FLOW_COLOR_STOPS;
    return `linear-gradient(90deg,${stops.map(({color})=>color).join(',')})`;
  };
  let nodeVolumeMax=1,nodeChangeMax=1;
  let updateComplexContext=null,hoveredComplex=null,inspectCorridor=null,resizeScenarioStops=null;
  if(flujos){
    const F=app.flows,ni=new Map(F.nodes.map((n,i)=>[n.id,i]));
    stationStarts=(s,h=state.flowHour,year=state.year,day=state.flowDay)=>odStarts(F,year,day,h,ni.get(s.id));
    stationUse=(s,h=state.flowHour,year=state.year,day=state.flowDay)=>(stationStarts(s,h,year,day)??0)+(odIncoming(F,year,day,h,ni.get(s.id))??0);
    if(!F._smax){
      let maximum=0;
      for(const year of F.meta.years)for(let i=0;i<F.nodes.length;i++){
        for(let day=0;day<7;day++)for(let h=0;h<24;h++){
          maximum=Math.max(maximum,F.starts[year][i][day][h]+(F.incoming?.[year]?.[day][h][i]??0));
        }
      }
      F._smax=maximum;
    }
    const annualNodeMax=annual?d3.max(F.meta.years,year=>d3.max(F.nodes,station=>stationUse(station,null,year))):null;
    nodeVolumeMax=annualNodeMax??F._smax;
    if(cambio&&!focusOrigin){
      // Keep the scale stable while changing hours or filtering complexes.
      const pairKey=[odBase,state.year].sort().join('-')+(annual?'/annual':'');
      const pairScales=F._nodeChangeScales??=new Map();
      if(!pairScales.has(pairKey)){
        let maximum=1;
        for(const station of F.nodes){
          if(annual){
            maximum=Math.max(maximum,Math.abs(stationUse(station,null,state.year)-stationUse(station,null,odBase)));
          }else for(let day=0;day<7;day++)for(let hour=0;hour<24;hour++){
            const before=stationUse(station,hour,odBase,day);
            const after=stationUse(station,hour,state.year,day);
            maximum=Math.max(maximum,Math.abs(after-before));
          }
        }
        pairScales.set(pairKey,maximum);
      }
      nodeChangeMax=pairScales.get(pairKey);
    }
    const rail=F.links.flatMap((link,index)=>link.kind==='rail'?[{link,index}]:[]);
    baseG.append('g').attr('class','rail-reference').selectAll('path').data(rail).join('path')
      .attr('d',({link})=>d3.line()(link.coords.map(projection))).attr('fill','none')
      .attr('stroke',paper?'#929a9d':'#adb2b3').attr('stroke-width',paper?.8:.65)
      .attr('vector-effect','non-scaling-stroke').attr('opacity',.5).style('pointer-events','none');
    const grouping=host.querySelector('#bundling');
    const groupingOut=host.querySelector('#bundling-out');
    const fidelity=host.querySelector(paper?'#pra':'#fidelity');
    const fidelityOut=host.querySelector(paper?'#pra-out':'#fidelity-out');
    const calculate=host.querySelector('#calculate-fidelity');
    const applied=host.querySelector('#applied-fidelity');
    const stage=svgNode.closest('.map-stage');
    stage.style.setProperty('--rail-flow-width-min',OD_RAIL_MIN_WIDTH+'px');
    const stationNames=new Map(F.nodes.map(station=>[station.id,station.name.replace(/ \([^)]*\)/g,'')]));
    const drawRail=d3.line();
    const railGeometry=rail.map(({link})=>link.coords.map(projection));
    const railPaths=g.append('g').attr('class',cambio?'od-delta-links':'od-exact-links').selectAll('path')
      .data(rail).join('path')
      .attr('d',(_,i)=>drawRail(railGeometry[i]))
      .attr('vector-effect','non-scaling-stroke')
      .attr('stroke-linecap','round').attr('stroke-linejoin','round').attr('fill','none')
      .on('pointerenter',(event,{link,index})=>{
        if(event.pointerType==='touch'||event.buttons)return;
        const [a,b]=comparisonLoads(index,state.flowHour);
        const trips=focusOrigin?(originData?.links[index]??0):b;
        const share=focusOrigin&&originData?.total?100*trips/originData.total:0;
        showTooltip(`<div class="station-tooltip">
          <strong class="station-tooltip-name">${esc(stationNames.get(link.a))} ↔ ${esc(stationNames.get(link.b))}</strong>
          <span class="station-tooltip-context">${esc(link.routes.join(' · '))}${cambio?` · ${odBase}: ${fmt(a)} · ${state.year}: ${fmt(b)}`:''}</span>
          <div class="station-tooltip-metric"><span>${cambio?'Cambio de viajes por día':'Viajes por día en el tramo'}</span><strong>${cambio?signed(b-a):esc(flowCount(trips,fmt))}</strong></div>
          ${focusOrigin&&!cambio?`<div class="station-tooltip-context">${esc(flowCount(share,fmt))} % de las salidas del origen</div>`:''}
        </div>`,event);
      }).on('pointerleave',hideTooltip);
    const inspectButton=host.querySelector('#inspect-bundle');
    const bundleEvidence=host.querySelector('#bundle-evidence');
    let inspecting=false, evidenceSerial=0, pendingConnection=null;
    let connectionStops;
    const scenarioChanges=g.append('g').attr('class','scenario-changes').attr('display','none');
    const candidate=g.append('path').attr('class','bundle-candidate')
      .attr('fill','none').attr('vector-effect','non-scaling-stroke').attr('display','none');
    const scenarioLine=g.append('path').attr('class','bundle-candidate scenario-line')
      .attr('fill','none').attr('vector-effect','non-scaling-stroke').attr('display','none');
    const clearCandidate=()=>{
      evidenceSerial++;
      pendingConnection=null;
      connectionStops?.attr('display','none');
      candidate.attr('display','none');
      scenarioLine.attr('display','none');
      scenarioChanges.attr('display','none');
      if(bundleEvidence)bundleEvidence.hidden=true;
      if(inspectButton){inspecting=false;inspectButton.setAttribute('aria-pressed','false');}
    };
    if(inspectButton){
      inspectButton.onclick=()=>{
        if(inspecting){clearCandidate();return;}
        inspecting=true;
        inspectButton.setAttribute('aria-pressed','true');
        bundleEvidence.hidden=false;
        bundleEvidence.textContent='Haz clic sobre una curva fuera de la red.';
      };
      inspectButton.onkeydown=event=>{if(event.key==='Escape')clearCandidate();};
    }
    const routeNodes=F.meta.network?.route_nodes;
    const physicalStops=Object.entries(routeNodes??{}).map(([id,stop])=>({id,...stop,point:projection(stop.coords)}));
    connectionStops=g.append('g').attr('class','scenario-stops').attr('display','none');
    connectionStops.selectAll('circle').data(physicalStops).join('circle')
      .attr('cx',stop=>stop.point[0]).attr('cy',stop=>stop.point[1]).attr('r',2)
      .attr('vector-effect','non-scaling-stroke');
    resizeScenarioStops=()=>{if(pendingConnection)connectionStops.selectAll('circle').attr('r',2.1/transform.k);};
    svg.on('keydown.scenario',event=>{
      if(event.key==='Escape'&&inspecting){clearCandidate();inspectButton.focus();}
    });
    function pickConnectionEndpoint(x,y){
      const [stop,gap]=physicalStops.reduce(([nearest,best],stop)=>{
        const distance=Math.hypot(stop.point[0]-x,stop.point[1]-y);
        return distance<best?[stop,distance]:[nearest,best];
      },[null,Infinity]);
      const setup=pendingConnection;
      const instructions=bundleEvidence.querySelector('.scenario-result');
      if(!stop||gap*transform.k>12){
        instructions.textContent='Acércate y pulsa sobre una parada de la red gris.';
        return;
      }
      if(!setup.from){
        setup.from=stop;
        instructions.textContent=`A · ${stationNames.get(stop.complex)} (${stop.id}). Elige la segunda parada.`;
        return;
      }
      if(stop.id===setup.from.id||stop.complex===setup.from.complex){
        instructions.textContent='Elige una parada de otro complejo.';
        return;
      }
      const from=setup.from,to=stop,request=++evidenceSerial;
      pendingConnection=null;
      connectionStops.attr('display','none');
      scenarioLine.attr('d',drawRail([from.point,to.point])).attr('display',null);
      instructions.textContent='Reasignando los viajes con el enlace hipotético…';
      const length=d3.geoDistance(from.coords,to.coords)*6371008.8;
      app.routing.scenario(state.year,state.flowDay,state.flowHour,{connection:{from:from.id,to:to.id,length,origins:scope.origins,zones:scope.zones}}).then(result=>{
        if(request!==evidenceSerial||!svgNode.isConnected)return;
        let relief=-1;
        for(const {index} of rail)if(result.changes[index]<0&&(relief<0||result.changes[index]<result.changes[relief]))relief=index;
        const leg=F.links[relief];
        const changed=rail.filter(({index})=>Math.abs(result.changes[index])>=.001)
          .sort((a,b)=>Math.abs(result.changes[a.index])-Math.abs(result.changes[b.index]));
        scenarioChanges.attr('display',changed.length?null:'none').selectAll('path').data(changed).join('path')
          .attr('d',({link})=>drawRail(link.coords.map(projection)))
          .attr('vector-effect','non-scaling-stroke')
          .attr('stroke',({index})=>{
            const delta=result.changes[index],strength=railChange(delta,changeLimit);
            return delta<0?odLoss(strength):odGain(strength);
          })
          .style('--flow-variation',({index})=>`${2.5*railChange(result.changes[index],changeLimit)}px`);
        instructions.innerHTML=`<strong>${esc(stationNames.get(from.complex))} ↔ ${esc(stationNames.get(to.complex))}</strong>
          <span>${esc(flowCount(result.redirected,fmt))} viajes reasignados · ${result.pairs} pares OD</span>
          ${result.redirected?`<span>Reducción media del costo modelado · ${fmt(result.meanSaving/1000)} km equivalentes</span>`:''}
          ${leg?`<span>Mayor baja de carga · ${esc(stationNames.get(leg.a))} ↔ ${esc(stationNames.get(leg.b))} · ${signed(result.changes[relief])} viajes</span>`:''}
          <small>Enlace bidireccional de ${fmt(length/1000)} km en línea recta. Demanda fija.</small>
          ${changed.length?'<small>Azul · baja de carga. Terracota · aumento.</small>':''}`;
      }).catch(()=>{if(request===evidenceSerial&&svgNode.isConnected)instructions.textContent='No se pudo simular el enlace.';});
    }
    inspectCorridor=event=>{
      if(!inspecting)return false;
      const [x,y]=transform.invert(d3.pointer(event,svgNode));
      if(pendingConnection){pickConnectionEndpoint(x,y);return true;}
      const request=++evidenceSerial;
      const gap=distanceToLines(x,y,railGeometry);
      scenarioLine.attr('display','none');
      scenarioChanges.attr('display','none');
      candidate.attr('display','none');
      if(gap*transform.k<7){
        bundleEvidence.textContent='Ese punto está sobre la red. Prueba sobre una curva que se aparte de las vías.';
        return true;
      }
      bundleEvidence.textContent='Buscando viajes que pasan por este haz…';
      Promise.all([app.raeb?.inspectLayout(),app.routing.network()]).then(([layout,network])=>{
        if(request!==evidenceSerial||!svgNode.isConnected)return;
        if(!layout){bundleEvidence.textContent='Espera a que termine el cálculo del agrupamiento.';return;}
        const {contributors,representative}=bundleAt(layout,x,y,6/transform.k);
        if(!representative){bundleEvidence.textContent='No encontré curvas aquí. Acerca el mapa o pulsa sobre un haz visible.';return;}
        const points=Array.from({length:representative.length/2},(_,i)=>[representative[i*2],representative[i*2+1]]);
        const pairs=contributors.sort((a,b)=>b.trips-a.trips);
        const total=d3.sum(pairs,pair=>pair.trips);
        const leg=pairs[0],a=F.nodes[leg.origin],b=F.nodes[leg.destination];
        const path=network.paths[leg.origin*F.nodes.length+leg.destination];
        const metres=d3.sum(path,arc=>F.links[arc>>1].len);
        const direct=d3.geoDistance([a.lon,a.lat],[b.lon,b.lat])*6371008.8;
        candidate.attr('d',drawRail(points)).attr('display',null);
        bundleEvidence.innerHTML=`<b>Corredor para estudiar</b>
          <span>${fmt(total)} viajes estimados · ${pairs.length} pares OD cerca del punto</span>
          <span><b>Mayor aporte:</b> ${esc(stationNames.get(a.id))} → ${esc(stationNames.get(b.id))} · ${esc(flowCount(leg.trips,fmt))}</span>
          <span>${fmt(metres/1000)} km en la red de referencia · ${fmt(direct/1000)} km en línea recta</span>
          <small>La curva representa un haz visual. El ejemplo de distancia corresponde al par de mayor aporte.</small>
          ${routeNodes?'<button class="text-button try-connection" type="button">Probar enlace hipotético</button><div class="scenario-result" aria-live="polite"></div>':''}`;
        const test=bundleEvidence.querySelector('.try-connection');
        if(test)test.onclick=()=>{
          evidenceSerial++;
          pendingConnection={from:null};
          connectionStops.attr('display',null).selectAll('circle').attr('r',2.1/transform.k);
          scenarioLine.attr('display','none');
          scenarioChanges.attr('display','none');
          bundleEvidence.querySelector('.scenario-result').textContent='Elige las dos paradas que conectaría el escenario.';
        };
      }).catch(()=>{if(request===evidenceSerial&&svgNode.isConnected)bundleEvidence.textContent='No se pudo leer el haz.';});
      return true;
    };
    const trackKey=host.querySelector('.map-track-key');
    function showTracks(show){
      onTracks=show;
      stage.classList.toggle('on-tracks',show||cambio);
      stage.classList.toggle('svg-exact-rails',show);
      railPaths.attr('display',show||cambio?null:'none');
      if(trackKey)trackKey.hidden=!(show||cambio);
      if(inspectButton)inspectButton.hidden=show||!!focusOrigin;
      if(show)setRaebStatus('');
      host.querySelector('#flow-legend-foot').textContent=show
        ? 'Tramos de referencia GTFS. Pasa por la vía para ver la carga estimada.'
        : cambio?'Ambos años se asignan a la misma red GTFS de referencia.'
        : 'Los haces RAEB agrupan viajes y pueden apartarse de la red.';
      const bar=host.querySelector('#od-volume-scale .map-key-bar');
      if(bar)bar.style.background=flowGradient(show);
      const note=host.querySelector('#map-flow-unit');
      if(note)note.textContent=show?'Ramas · porcentaje de las salidas':'Haces · intensidad de las salidas';
      if(!cambio&&!focusOrigin&&!scopedGroup)host.querySelector('#flow-legend-title').textContent=show?'Flujo por tramo':'Flujo en los haces';
      clearCandidate();
      updateComplexContext?.();
    }
    showTracks(onTracks);
    function paintExact(hour){
      if(!onTracks&&!cambio)return;
      if(cambio?!comparisonFrame:scopedGroup&&!scopeLoads){
        railPaths.attr('display','none');
        return;
      }
      const deltaLimit=comparisonFrame?.limit;
      let gains=0,losses=0,unchanged=0;
      const order=new Map();
      railPaths.each(function({index}){
        const [a,b]=comparisonLoads(index,hour);
        const path=d3.select(this);
        if(cambio){
          const delta=odDelta(a,b);
          if((focusOrigin||scopedGroup)&&!a&&!b){path.attr('display','none');order.set(index,0);return;}
          if(delta>0)gains++;
          else if(delta<0)losses++;
          else unchanged++;
          const strength=railChange(delta,deltaLimit);
          path.attr('display',null);
          order.set(index,strength);
          path.attr('stroke',delta>0?odGain(strength):odLoss(strength))
            .style('--flow-variation',`${(OD_RAIL_MAX_WIDTH-1)*strength}px`);
          return;
        }
        const trips=focusOrigin?(originData?.links[index]??0):b;
        const maximum=between?Math.max(1,zoneStats?.trips??0):focusOrigin?originData?.total||1:volumeLimit;
        order.set(index,trips);
        path.attr('display',trips>0?null:'none')
          .attr('stroke',flowColor(trips,maximum)).style('--flow-variation',`${railFlowWidth(trips,maximum)-OD_RAIL_MIN_WIDTH}px`);
      });
      railPaths.sort((a,b)=>order.get(a.index)-order.get(b.index));
      if(cambio){
        const scale=host.querySelector('#od-track-scale');
        setFlowScale(deltaLimit);
        scale.hidden=false;
        host.querySelector('#od-change-status').textContent='';
        host.querySelector('#od-change-counts').textContent=`Tramos · ${fmt(gains)} subieron · ${fmt(losses)} bajaron · ${fmt(unchanged)} sin cambio.`;
      }
    }
    function comparisonLoads(index,hour){
      const comparisonLoadsByYear=comparisonFrame?.loadsByYear;
      const a=comparisonLoadsByYear?.get(odBase);
      const b=cambio?comparisonLoadsByYear?.get(state.year):scopedGroup?scopeLoads:odLoads(F,state.year,state.flowDay,hour);
      const forward=2*index;
      const reverse=forward+1;
      return [a?a[forward]+a[reverse]:0,b?b[forward]+b[reverse]:0];
    }
    const radiusGuide=paper&&!cambio?svg.append('circle').attr('class','radius-guide').attr('display','none'):null;
    const selectedCenter=focusOrigin?stationPosition(focusOrigin):null;
    let kernel=null,activeRadius=state.paperRadius??0,showRadius=false;
    const radiusLimit=()=>kernel?.radiusMeters??(bart?3000:0);
    const formatGrouping=value=>paper?`${fmt(Math.round(value))} m`:value.toFixed(2);
    if(radiusGuide)updateRadiusGuide=()=>{
      const [x,y]=selectedCenter?transform.apply(selectedCenter):[width/2,height/2];
      const px=activeRadius*transform.k/metersPerPixel;
      radiusGuide.attr('display',showRadius&&px>0?null:'none').attr('cx',x).attr('cy',y).attr('r',px);
    };
    const updateApplied=()=>{
      const currentGrouping=paper?activeRadius:state.bundling;
      applied.textContent=cambio
        ? (paper?'En el mapa: 0 m · 5 / 5':'En el mapa: 0.00 · 1.00')
        : `En el mapa: ${formatGrouping(currentGrouping)} · ${formatFidelity(state[fidelityKey])}`;
    };
    updateApplied();
    function updateGroupingControls(){
      updateApplied();
      const hasDraft=pendingGrouping!==undefined||pendingFidelity!==null;
      calculate.disabled=!hasDraft||(paper&&!kernel);
      fidelityOut.value=formatFidelity(pendingFidelity??state[fidelityKey]);
      if(!paper){
        grouping.value=String(pendingGrouping??state.bundling);
        groupingOut.value=formatGrouping(grouping.valueAsNumber);
        return;
      }
      grouping.max=String(Math.max(radiusLimit(),activeRadius));
      grouping.value=String(pendingGrouping??activeRadius);
      groupingOut.value=kernel?formatGrouping(grouping.valueAsNumber):'—';
      grouping.setAttribute('aria-valuetext',kernel?`${Math.round(grouping.valueAsNumber)} metros`:'Calculando la referencia');
      updateRadiusGuide?.();
    }
    function updateGrouping(){
      if(!paper){
        showTracks(state.fidelity===1);
        paintExact(state.flowHour);
        app.raeb?.parameters(state.fidelity,state.bundling);
        return;
      }
      if(!kernel)return;
      if(state.paperRadius===null){
        // Resolve older links that store a relative or automatic radius once.
        state.paperRadius=Math.min((kernel.radiusMeters??0)*(state.paperBundling??1),radiusLimit());
        state.paperBundling=null;
        app.syncURL?.();
      }
      activeRadius=state.paperRadius;
      updateGroupingControls();
      showTracks(state.paperLevel===5&&activeRadius===0);
      paintExact(state.flowHour);
      app.raeb?.parameters(state.paperLevel/5,activeRadius);
    }
    function receiveKernel(value){
      if(!paper||!svgNode.isConnected)return;
      if(value===kernel&&value)return;
      kernel=value;
      const limit=radiusLimit();
      grouping.disabled=!kernel||Math.max(limit,activeRadius)===0;
      if(!kernel){
        updateGroupingControls();
        return;
      }
      updateGrouping();
    }
    if(!cambio)try{
      app.raeb??=new RaebOverlay({
        ...F,nodes:F.nodes.map(node=>{
          const [lon,lat]=stationCoords(node);
          return {...node,lon,lat};
        })
      },{paper,dataURL:dataset.dataURL,latitude:dataset.latitude});
      app.raeb.attach(g.node(),width,height,projection,transform,receiveKernel);
      if(!paper)updateGrouping();
    }catch(error){setRaebStatus(error.message);console.error(error);}
    pintarFlujos=h=>{
      if(bart)host.querySelector('#flow-hour-label').value=ampm(h);
      const period=document.querySelector('#flow-period');
      if(period)period.value=odPeriodLabel(state.flowDay,h);
      hideTooltip();
      const year=state.year,day=state.flowDay;
      if(between){
        zoneStats=null;
        scopeLoads=null;
        const summary=host.querySelector('#zone-flow-summary');
        summary.textContent='Calculando viajes entre zonas…';
        if(!cambio)host.querySelector('#od-volume-scale').hidden=true;
        const current=()=>svgNode.isConnected&&state.flowHour===h&&state.flowDay===day;
        const report=app.routing.zoneFlow(year,day,h,between);
        Promise.all([report,cambio?app.routing.zoneFlow(odBase,day,h,between):null]).then(([target,base])=>{
          if(!current())return;
          zoneStats=target;
          if(!cambio){
            scopeLoads=target.loads;
            setFlowScale(Math.max(1,target.trips));
            host.querySelector('#od-volume-scale').hidden=target.trips===0;
            paintExact(h);
          }
          const trips=base?`${fmt(base.trips)} → ${fmt(target.trips)} viajes · ${signed(target.trips-base.trips)}`:`${fmt(target.trips)} viajes por día entre ambas zonas`;
          const distances=target.trips?`<br>${fmt(target.routeKm)} km por la red · ${fmt(target.directKm)} km en línea recta (por viaje en ${year}).`:'';
          summary.innerHTML=trips+distances;
        }).catch(()=>{if(current())summary.textContent='No se pudieron cargar los viajes entre zonas.';});
      }
      const yearMaps=app.updateODYearMaps(state.flowDay,h,app.odPreviewBase,scope,cambio);
      if(cambio){
        const request=++comparisonRequest;
        comparisonFrame=null;
        const status=host.querySelector('#od-change-status');
        host.querySelector('#od-change-counts').textContent='';
        host.querySelector('#od-track-scale').hidden=true;
        status.textContent='Calculando cambios por tramo…';
        yearMaps.then(frame=>{
          if(request!==comparisonRequest||!svgNode.isConnected)return;
          if(!frame){
            status.textContent='No se pudo calcular el cambio por tramo.';
            return;
          }
          comparisonFrame=frame;
          paintExact(h);
        });
      }else if(scopedGroup&&!between){
        const request=++scopeRequest;
        scopeLoads=null;
        const status=host.querySelector('#od-scope-status');
        status.textContent=scope.origins.length?'Cargando salidas…':'Sin complejos en este grupo.';
        app.routing.loads(state.year,state.flowDay,h,scope.origins).then(loads=>{
          if(request!==scopeRequest||!svgNode.isConnected)return;
          scopeLoads=loads;
          if(scope.origins.length)status.textContent='';
          paintExact(h);
        }).catch(()=>{
          if(request===scopeRequest&&svgNode.isConnected)status.textContent='No se pudieron cargar las salidas del grupo.';
        });
      }
      clearCandidate();
      if(!focusOrigin)paintFlowNodes();
      updateClockTime(state.flowDay,h);
      if(focusOrigin){
        const request=++originRequest;
        originData=null;originBase=null;
        const total=stationStarts(focusOrigin,h)||0;
        const key=host.querySelector('#map-key');
        const summary=key.querySelector('.flow-selection-total');
        if(!cambio){
          key.querySelector('#od-volume-scale').hidden=total===0;
          summary.textContent=`${fmt(total)} viajes iniciados por día`;
        }
        paintFlowNodes();
        Promise.all([app.routing.network(),app.routing.frame(state.year,state.flowDay,h),
          cambio?app.routing.frame(odBase,state.flowDay,h):null]).then(([network,matrix,reference])=>{
          if(request!==originRequest||!svgNode.isConnected)return;
          const origin=ni.get(focusOrigin.id);
          originData=originBranches(network.paths,matrix,origin,F.links.length);
          if(reference)originBase=originBranches(network.paths,reference,origin,F.links.length);
          const count=originData.destinations.filter(v=>v>0).length;
          if(summary)summary.textContent=`${fmt(total)} viajes iniciados por día · ${count} destinos con ruta`;
          if(!cambio)paintExact(h);
          paintFlowNodes();
        }).catch(()=>{
          if(request!==originRequest||!svgNode.isConnected)return;
          if(summary)summary.textContent='No se pudieron cargar los viajes del complejo.';
        });
      }
      paintExact(h);
      if(!cambio)app.raeb?.frame(state.year,state.flowDay,h,state.selected,scope.origins,scope.zones);
      app.syncURL?.();
    };
    if(bart){
      const profileStations=between?[]:focusOrigin?[focusOrigin]:items;
      const series=year=>d3.range(24).map(h=>d3.sum(profileStations,s=>stationStarts(s,h,year)));
      const porHora=series(state.year), porHoraBase=cambio?series(odBase):[];
      const profileNode=host.querySelector('#flow-profile');
      const svgP=d3.select(profileNode),PW=profileNode.clientWidth||222,PH=46;
      svgP.attr('viewBox',`0 0 ${PW} ${PH}`);
      const px=d3.scaleLinear().domain([0,23]).range([7,PW-7]),py=d3.scaleLinear().domain([0,d3.max([...porHora,...porHoraBase])||1]).range([PH-2,12]);
      svgP.append('path').attr('d',d3.area().x((v,i)=>px(i)).y0(PH-2).y1(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','#1d6f8d').attr('opacity',.14);
      svgP.append('path').attr('d',d3.line().x((v,i)=>px(i)).y(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','none').attr('stroke','#1d6f8d').attr('stroke-width',1.2);
      if(cambio)profileNode.setAttribute('aria-label',`Distribución por hora. A ${odBase}, línea discontinua. B ${state.year}, línea continua.`);
      if(cambio)svgP.append('path').attr('d',d3.line().x((v,i)=>px(i)).y(v=>py(v)).curve(d3.curveMonotoneX)(porHoraBase))
        .attr('fill','none').attr('stroke','#64747c').attr('stroke-width',1.1).attr('stroke-dasharray','3 2')
        .append('title').text(`A · ${odBase}`);
      const marca=svgP.append('g');marca.append('line').attr('y1',4).attr('y2',PH-2).attr('stroke','#1b2a33');marca.append('circle').attr('r',2.6).attr('fill','#1b2a33');
      const slider=host.querySelector('#flow-hour');
      const pintarBase=pintarFlujos;
      pintarFlujos=h=>{
        slider.value=h;
        marca.attr('transform',`translate(${px(h)},0)`);
        marca.select('circle').attr('cy',py(porHora[h]));
        pintarBase(h);
      };
      slider.oninput=()=>app.setFlowTime(state.flowDay,+slider.value);
      svgP.style('cursor','pointer').on('click',event=>{
        const [x]=d3.pointer(event,profileNode);
        const hour=Math.round(Math.max(0,Math.min(23,px.invert(x))));
        app.setFlowTime(state.flowDay,hour);
      });
      host.querySelectorAll('[data-flowday]').forEach(b=>b.onclick=()=>app.setFlowTime(+b.dataset.flowday,state.flowHour));
    }
    app.updateFlowHour=pintarFlujos;
    if(!cambio&&paper){
      const reveal=visible=>{showRadius=visible;updateRadiusGuide();};
      grouping.onfocus=()=>reveal(true);
      grouping.onblur=()=>reveal(false);
      grouping.onpointerenter=()=>reveal(true);
      grouping.onpointerleave=()=>reveal(document.activeElement===grouping);
    }
    if(!cambio){
      fidelity.value=String(pendingFidelity??state[fidelityKey]);
      updateGroupingControls();
      grouping.oninput=()=>{
        const draft=grouping.valueAsNumber;
        const appliedGrouping=paper?activeRadius:state.bundling;
        pendingGrouping=draft===appliedGrouping?undefined:draft;
        updateGroupingControls();
      };
      fidelity.oninput=()=>{
        const value=fidelity.valueAsNumber;
        pendingFidelity=value===state[fidelityKey]?null:value;
        updateGroupingControls();
      };
      calculate.onclick=()=>{
        if(pendingGrouping!==undefined){
          if(paper){
            state.paperRadius=grouping.valueAsNumber;
            state.paperBundling=null;
          }else state.bundling=pendingGrouping;
        }
        if(pendingFidelity!==null)state[fidelityKey]=pendingFidelity;
        pendingGrouping=undefined;
        pendingFidelity=null;
        updateGrouping();
        updateGroupingControls();
        app.syncURL?.();
      };
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
  const contextPoints=g.selectAll('.context-point').data(app.data.stations.filter(s=>!ids.has(s.id)&&profile(s)&&passesMetricRanges(s))).join('circle').attr('class','context-point').attr('data-context-station-id',s=>s.id).attr('cx',s=>stationPosition(s)[0]).attr('cy',s=>stationPosition(s)[1]).attr('r',1.6).attr('fill','#b8c7c1').attr('opacity',.45);
  const R=flujos?2.4:5.2;
  const destinationIndex=new Map(app.flows?.nodes.map((station,i)=>[station.id,i]));
  const isDestination=station=>!!focusOrigin&&station.id!==focusOrigin.id;
  const destinationTrips=(station,data=originData)=>data?.destinations[destinationIndex.get(station.id)]??0;
  const nodeChange=station=>{
    const destination=isDestination(station);
    if(destination&&(!originData||!originBase))return null;
    const totals=year=>focusOrigin?stationStarts(station,state.flowHour,year)??0:stationUse(station,state.flowHour,year);
    const before=destination?destinationTrips(station,originBase):totals(odBase);
    const after=destination?destinationTrips(station):totals(state.year);
    return {before,after,delta:odDelta(before,after)};
  };
  let nodeChanges=new Map(),destinationMax=1;
  const volumeRadius=trips=>Math.max(2.3,13*flowStrength(trips,nodeVolumeMax));
  const destinationRadius=trips=>trips>0?.85+7.5*flowStrength(trips,destinationMax):1.35;
  function changeRadius(delta,destination){
    const limit=destination?destinationMax:nodeChangeMax;
    const min=destination?1.35:2.3,max=destination?8.35:13;
    return Math.sqrt(min**2+(max**2-min**2)*railChange(delta,limit)**2);
  }
  const setCircleScale=flujos&&!between?bindCircleScale(host.querySelector('#flow-circle-scale')):null;
  const rOf=(station,h)=>{
    if(between)return zoneOf(station)?3.8:1.5;
    if(flujos&&!state.showFlowNodes)return R;
    if(cambio){
      if(focusOrigin?.id===station.id)return 4;
      return changeRadius(nodeChanges.get(station.id)?.delta??0,isDestination(station));
    }
    if(isDestination(station))return destinationRadius(destinationTrips(station));
    return flujos?volumeRadius(stationUse(station,h)):R;
  };
  const paintFlowNodes=()=>{
    let peak=0;
    if(cambio){
      nodeChanges=new Map(points.data().map(station=>[station.id,nodeChange(station)]));
      if(focusOrigin){
        peak=d3.max(points.data(),station=>isDestination(station)?Math.abs(nodeChanges.get(station.id)?.delta??0):0)||0;
        destinationMax=peak||1;
      }
      points.attr('r',station=>rOf(station)/transform.k)
        .attr('fill',station=>{
          if(station.id===focusOrigin?.id)return '#093f53';
          const delta=nodeChanges.get(station.id)?.delta??0;
          return OD_CHANGE_COLORS[!state.showFlowNodes||delta===0?'neutral':delta<0?'loss':'gain'];
        })
        .attr('opacity',station=>{
          const values=nodeChanges.get(station.id);
          return !isDestination(station)||values?.before||values?.after?1:.35;
        });
      points.sort((a,b)=>Math.abs(nodeChanges.get(a.id)?.delta??0)-Math.abs(nodeChanges.get(b.id)?.delta??0));
    }else{
      peak=d3.max(originData?.destinations??[])||0;
      destinationMax=peak||1;
      points.attr('r',station=>rOf(station)/transform.k);
      if(focusOrigin){
        points.classed('destination-mark',station=>destinationTrips(station)>0)
          .attr('fill',station=>{
            if(station.id===focusOrigin.id)return '#093f53';
            return state.showFlowNodes&&destinationTrips(station)>0?flowColor(destinationTrips(station),destinationMax):'#85979c';
          })
          .attr('opacity',station=>station.id===focusOrigin.id||destinationTrips(station)>0?1:.35);
        points.sort((a,b)=>destinationTrips(a)-destinationTrips(b));
      }
    }
    if(state.selected)points.filter(station=>station.id===state.selected).raise();
    updateComplexContext?.();
    const limit=focusOrigin?peak:cambio?nodeChangeMax:nodeVolumeMax;
    const radius=cambio?delta=>changeRadius(delta,!!focusOrigin):focusOrigin?destinationRadius:volumeRadius;
    const fill=focusOrigin?trips=>flowColor(trips,destinationMax):()=>'#1d6f8dcc';
    setCircleScale?.(limit,radius,fill);
  };
  const dotItems=focusOrigin?app.data.stations:items;
  if(footprintLayer){
    const visibleIds=new Set(dotItems.map(station=>station.id));
    const footprints=dotItems.flatMap(station=>{
      const stops=stopsByComplex.get(station.id);
      if(!stops||stops.length<2)return [];
      const points=stops.map(stop=>projection(stop.coords));
      const hull=d3.polygonHull(points);
      const [left,right]=d3.extent(points,p=>p[0]);
      const [top,bottom]=d3.extent(points,p=>p[1]);
      return [{station,stops,span:Math.hypot(right-left,bottom-top),outline:d3.line()(hull??points)+(hull?'Z':'')}];
    });
    const areas=footprintLayer.selectAll('path').data(footprints).join('path')
      .attr('class','map-complex-footprint')
      .attr('data-complex-id',area=>area.station.id)
      .attr('d',area=>area.outline)
      .attr('stroke-width',60/metersPerPixel);
    const secondaryStops=g.append('g').attr('aria-hidden','true').attr('pointer-events','none')
      .selectAll('circle').data(footprints.flatMap(({station,stops})=>{
        const anchor=anchors.get(station.id);
        const [x,y]=stationPosition(station);
        return stops.filter(stop=>stop.coords!==anchor).map(stop=>{
          const p=projection(stop.coords);
          return {id:station.id,p,gap:Math.hypot(p[0]-x,p[1]-y)};
        });
      })).join('circle')
      .attr('class','map-complex-stop').attr('data-complex-id',stop=>stop.id)
      .attr('vector-effect','non-scaling-stroke')
      .attr('cx',stop=>stop.p[0]).attr('cy',stop=>stop.p[1]);
    const externalTransfers=app.flows.links.filter(link=>link.kind==='declared_walk_transfer'&&link.a!==link.b&&
      (focusOrigin?[link.a,link.b].includes(focusOrigin.id):visibleIds.has(link.a)||visibleIds.has(link.b)));
    const transferLines=g.append('g').attr('class','map-complex-connections').attr('aria-hidden','true')
      .selectAll('line').data(externalTransfers.map(link=>{
        const [a,b]=link.coords.map(projection);
        return {a,b,span:Math.hypot(b[0]-a[0],b[1]-a[1])};
      })).join('line').attr('vector-effect','non-scaling-stroke')
      .attr('x1',link=>link.a[0]).attr('y1',link=>link.a[1])
      .attr('x2',link=>link.b[0]).attr('y2',link=>link.b[1]);
    const footprintKey=host.querySelector('.map-footprint-key');
    const transferKey=host.querySelector('.map-complex-key');
    updateComplexContext=()=>{
      const highlighted=id=>id===hoveredComplex||id===state.selected;
      let hasFootprints=false,hasTransfers=false;
      areas.attr('display',({station,span})=>{
        const visible=span*transform.k>=(highlighted(station.id)?10:24);
        hasFootprints||=visible;
        return visible?null:'none';
      });
      secondaryStops.attr('display',stop=>highlighted(stop.id)&&stop.gap*transform.k>=12?null:'none')
        .attr('r',3/transform.k);
      transferLines.attr('display',link=>{
        const visible=(onTracks||cambio)&&link.span*transform.k>=8;
        hasTransfers||=visible;
        return visible?null:'none';
      });
      footprintKey.hidden=!hasFootprints;
      transferKey.hidden=!hasTransfers;
    };
    updateComplexContext();
  }
  if(focusOrigin)contextPoints.remove();
  const points=g.selectAll('.map-dot').data(dotItems).join('circle').attr('class','map-dot'+(flujos?' quiet':'')).attr('data-station-id',s=>s.id).attr('vector-effect','non-scaling-stroke').attr('cx',s=>stationPosition(s)[0]).attr('cy',s=>stationPosition(s)[1]).attr('r',s=>rOf(s)).attr('fill',s=>flujos?(focusOrigin&&s.id!==focusOrigin.id?'#87969d':'#1d6f8dcc'):color(metricValue(s,state.mapMetric)))
    .classed('is-station-selected',s=>s.id===state.selected)
    .classed('station-highlight-outline',!!(cambio||between||!flujos))
    .classed('scatter-area-member',s=>state.cohortSource==='scatter'&&ids.has(s.id))
    .classed('map-zone-a',s=>zoneOf(s)==='a')
    .classed('map-zone-b',s=>zoneOf(s)==='b')
    .classed('map-zone-context',s=>!!between&&!zoneOf(s))
    .on('click',(event,station)=>{
      event.stopPropagation();
      if(inspectCorridor?.(event))return;
      if(event.shiftKey)app.pin(station.id);
      else app.toggleStation(station.id);
    });
  const tooltip=document.querySelector('#tooltip');
  function showStationTooltip(event,station){
    if(event.pointerType==='touch'||event.buttons)return;
    app.showStationPreview(station.id,event.currentTarget);
    hoveredComplex=station.id;
    updateComplexContext?.();
    const name=station.name.replace(/ \([^)]*\)/g,'');
    const context=[station.borough,station.routes.join(' · ')].filter(Boolean).join('  /  ');
    if(between){
      const zone=zoneOf(station);
      showTooltip(`<div class="station-tooltip"><strong class="station-tooltip-name">${esc(name)}</strong>
        <span class="station-tooltip-context">${zone?`Zona ${zone.toUpperCase()} · `:''}${esc(context)}</span></div>`,event);
      return;
    }
    const destination=isDestination(station);
    const time=flujos?odPeriodLabel(state.flowDay,state.flowHour)+(annual?' · promedio por día':''):'';
    if(cambio){
      const values=nodeChanges.get(station.id)??nodeChange(station);
      const label=destination?'Cambio de viajes hacia este destino':focusOrigin?'Cambio de viajes iniciados':'Cambio de afluencia del complejo';
      const delta=values?.delta;
      const change=delta===undefined?'Sin datos':delta!==0&&Math.abs(delta)<.1
        ?delta.toLocaleString('es-PE',{maximumFractionDigits:3,signDisplay:'exceptZero'})
        :signed(delta);
      showTooltip(`<div class="station-tooltip">
        <strong class="station-tooltip-name">${esc(name)}</strong>
        <span class="station-tooltip-context">${esc(context)}</span>
        <div class="station-tooltip-metric"><span>${esc(label)}<small>${esc(time)}</small></span><strong>${esc(change)}</strong></div>
        ${values?`<div class="station-tooltip-context">${odBase} · ${esc(flowCount(values.before,fmt))} &nbsp;→&nbsp; ${state.year} · ${esc(flowCount(values.after,fmt))}</div>`:''}
      </div>`,event);
      return;
    }
    const value=destination?destinationTrips(station):flujos?focusOrigin?stationStarts(station):stationUse(station):metricValue(station,metric);
    let label=stationMetricLabels[metric];
    let displayValue='Sin datos';
    if(destination)label='Viajes hacia este destino';
    else if(flujos){
      label=!focusOrigin&&app.flows.incoming?'Afluencia del complejo':dataset.startsLabel;
    }
    else if(metric==='recovery')label+=' '+BASE;
    if(Number.isFinite(value)){
      const formatValue=metric==='deltaAM'||metric==='deltaWeekend'?signed:fmt;
      displayValue=flujos?flowCount(value,fmt):formatValue(value)+' '+unit;
    }
    showTooltip(`<div class="station-tooltip">
      <strong class="station-tooltip-name">${esc(name)}</strong>
      <span class="station-tooltip-context">${esc(context)}</span>
      <div class="station-tooltip-metric">
        <span>${label}${time?`<small>${esc(time)}</small>`:''}</span>
        <strong>${esc(displayValue)}</strong>
      </div>
      ${destination&&originData?.total?`<div class="station-tooltip-context">${esc(flowCount(value*100/originData.total,fmt))} % de las salidas del origen</div>`:''}
    </div>`,event);
  }
  for(const stations of [points,contextPoints]){
    stations.on('pointerenter',showStationTooltip)
      .on('pointermove',(event,station)=>{if(tooltip.hidden)showStationTooltip(event,station);})
      .on('pointerleave',function(){
        app.showStationPreview(null,this);
        hideTooltip();
        hoveredComplex=null;
        updateComplexContext?.();
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
  const pinned=app.data.stations.filter(s=>!focusOrigin&&s.id!==state.selected&&state.pins.includes(s.id));
  const rings=g.selectAll('.selected-ring').data(pinned).join('circle').attr('class','selected-ring').attr('vector-effect','non-scaling-stroke').attr('cx',s=>stationPosition(s)[0]).attr('cy',s=>stationPosition(s)[1]).attr('r',8.5).attr('fill','none').attr('stroke','#c96035').attr('stroke-width',2).style('pointer-events','none');
  if(flujos){
    const toggle=host.querySelector('#flow-nodes');
    const legend=host.querySelector('#flow-node-key');
    const setNodeVisibility=()=>{
      paintFlowNodes();
      legend.hidden=!state.showFlowNodes;
    };
    if(toggle)toggle.onchange=()=>{
      state.showFlowNodes=toggle.checked;
      setNodeVisibility();
      hideTooltip();
      app.syncURL();
    };
    if(toggle)setNodeVisibility();
  }
  const boroughLabels=g.selectAll('.borough-name');
  let boroughsHidden=null;
  const zoom=d3.zoom().scaleExtent(borough?[Math.min(1,districtCamera.k),mapZoomLimits[1]]:mapZoomLimits).translateExtent(panExtent).on('zoom',event=>{
    transform=event.transform;
    if(flujos)svgNode.closest('.map-stage').style.setProperty('--flow-width-scale',zoomStrokeScale(transform.k));
    g.attr('transform',transform);
    resizeScenarioStops?.();
    if(baseG!==g)baseG.attr('transform',transform);
    points.attr('r',s=>rOf(s)/transform.k);
    if(app._relane)app._relane(transform.k);
    rings.attr('r',8.5/transform.k);
    contextPoints.attr('r',1.6/transform.k);
    app.spectralEvents?.updateZoom();
    const hideBoroughs=transform.k>3;
    if(hideBoroughs!==boroughsHidden){
      boroughLabels.attr('display',hideBoroughs?'none':null);
      boroughsHidden=hideBoroughs;
    }
    if(hoveredComplex!==null)app.showStationPreview(null);
    hoveredComplex=null;
    updateComplexContext?.();
    hideTooltip();
  });
  // Contexto al acercar: miniatura fija con los boroughs, los complejos del grupo y el rectángulo de lo
  // que se ve; debajo, cuántos complejos del grupo hay en cada borough.
  const mini=d3.select(host.querySelector('.minimap-svg')),miniProj=d3.geoMercator().fitExtent([[3,3],[147,109]],extent),miniPath=d3.geoPath(miniProj);
  mini.selectAll('.mini-bg').data(cubiertos).join('path').attr('class','mini-bg').attr('d',miniPath);
  mini.selectAll('.mini-dot').data(items).join('circle').attr('class','mini-dot').attr('cx',s=>miniProj(stationCoords(s))[0]).attr('cy',s=>miniProj(stationCoords(s))[1]).attr('r',1).attr('fill','#6f7d86');
  const miniRect=mini.append('rect').attr('class','mini-view').attr('fill','none').attr('stroke','#102937').attr('stroke-width',1);
  function pintarMini(tr){
    const [x0,y0]=tr.invert([0,0]),[x1,y1]=tr.invert([width,height]);
    const p0=miniProj(projection.invert([x0,y0])),p1=miniProj(projection.invert([x1,y1]));
    const vis=tr.k>1.05;
    host.querySelector('.map-minimap').classList.toggle('has-zoom',vis);
    miniRect.attr('display',vis?null:'none').attr('x',p0[0]).attr('y',p0[1]).attr('width',Math.max(2,p1[0]-p0[0])).attr('height',Math.max(2,p1[1]-p0[1]));
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
  svg.on('click.clear-selection',event=>{
    if(event.defaultPrevented)return;
    if(app.spectralEvents?.calendarActive){
      app.spectralEvents.clearComplex();
      return;
    }
    if(inspectCorridor?.(event))return;
    if(state.selected)app.set({selected:null});
  });
  const lassoStations=state.cohortSource==='scatter'?app.filtered(undefined,{ignoreCohort:true}):items;
  const cancelDrawing=bindMapLasso({svg,outlines:zoneLayer,zoom,width,height,projection,stations:lassoStations,
    position:stationPosition,app,twoZones:drawnZones});
  app.spectralEvents?.mount({
    stage:svgNode.closest('.map-stage'),svg,layer:g,position:stationPosition,scale:()=>transform.k,cancelDrawing
  });
  if(flujos){
    if(cambio){
      const {loss,neutral,gain}=OD_CHANGE_COLORS;
      const trackSamples=[[loss,1],[odLoss(.5),.5],[neutral,0],[odGain(.5),.5],[gain,1]];
      host.querySelector('#map-key').innerHTML=`
        <div id="od-track-scale" hidden>
          <div class="comparison-key-heading">
            <strong>Tramos</strong>
            <span>Intensidad y grosor</span>
          </div>
          <div class="comparison-track-samples" aria-hidden="true">
            ${trackSamples.map(([color,strength])=>`<i style="--sample-color:${color};--sample-width:${(OD_RAIL_MAX_WIDTH-1)*strength}px"></i>`).join('')}
          </div>
          <div class="map-key-bar" style="background:linear-gradient(90deg,${loss},${neutral},${gain})"></div>
          <div class="map-key-words"><span>Bajó</span><span>Sin cambio</span><span>Subió</span></div>
        </div>
        <p id="od-change-status" class="map-key-note" role="status"></p>`;
      setFlowScale=bindFlowScale(host.querySelector('#od-track-scale .map-key-bar'),{diverging:true});
      pintarFlujos(state.flowHour);
      return;
    }
    host.querySelector('#map-key').innerHTML=`
      ${focusOrigin?`<div class="map-key-note" id="map-flow-unit">${onTracks?'Ramas · porcentaje de las salidas':'Haces · intensidad de las salidas'}</div>`:''}
      <div id="od-volume-scale"${between?' hidden':''}>
        <div class="map-width-key${paper?' paper-width-key':''}" style="--rail-sample-width-range:${OD_RAIL_MAX_WIDTH-OD_RAIL_MIN_WIDTH}px" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="map-key-bar" style="background:${flowGradient(onTracks)}"></div>
        <div class="map-key-words"><span>Menos tránsito</span><span>Más tránsito</span></div>
      </div>
      ${focusOrigin?'<div class="map-key-note flow-selection-total"></div>':''}
      ${scopedGroup&&!between?'<div id="od-scope-status" class="map-key-note" role="status"></div>':''}`;
    setFlowScale=bindFlowScale(host.querySelector('#od-volume-scale .map-key-bar'),{
      unit:focusOrigin?'% de las salidas':'viajes por día',capped:!focusOrigin&&!between
    });
    if(!between)setFlowScale(focusOrigin?100:volumeLimit);
    pintarFlujos(state.flowHour);
    if(!items.length)app.toast('El grupo está vacío.');
    return;
  }
  const legend=host.querySelector('#map-key'),domain=color.domain(),min=domain[0],max=domain.at(-1);
  const ticks=d3.scaleLinear().domain([min,max]).ticks(5).filter(t=>t>=min&&t<=max);
  legend.innerHTML=`<div class="map-key-bar" style="background:linear-gradient(90deg,${d3.range(21).map(i=>color(min+(max-min)*i/20)).join(',')})"></div>
    <div class="map-key-ticks">${ticks.map(t=>`<span style="left:${100*(t-min)/(max-min)}%">${fmt(t)}</span>`).join('')}</div>
    <div class="map-key-words"><span>${L.bajo}</span><span>${unit==='%'?'%':'pp'}</span><span>${L.alto}</span></div>
    ${metric==='change'?`<div class="map-key-note">Satura en ${saturaEn} pp (percentil 95).</div>`:metric==='recovery'?`<div class="map-key-note">Punto medio = mediana del sistema (${medianaVol} %); ${BASE} = 100 %. Satura en los percentiles 5 y 95.</div>`:`<div class="map-key-note">Satura en ±${saturaEn} pp.</div>`}`;
  if(!items.length)app.toast('El grupo está vacío; los puntos grises conservan el contexto geográfico.');
}
