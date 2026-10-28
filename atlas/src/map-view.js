import {state,BASE,esc,fmt,signed,profile,metricValue,metricColor,showTooltip,hideTooltip,heading,stats,passesMetricRanges,cohortProfile} from './model.js?v=20261028-4';
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
const EPS_MAX=150; // m: tolerancia máxima de simplificación con fidelidad 0
let playTimer=null;
export function renderMap(host,app,items){
  if(playTimer){clearInterval(playTimer);playTimer=null;}
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
      <div class="eyebrow">02 · GEOGRAFÍA</div>
      ${app.flows?`<div class="segmented map-layer" role="group" aria-label="Capa del mapa"><button data-layer="points" class="${!flujos?'active':''}">Cambio por complejo</button><button data-layer="flows" class="${flujos?'active':''}">Flujos por hora</button></div>`:''}
      ${flujos?`<div class="flow-controls">
        <div class="flow-hour-row"><button id="flow-play" class="flow-play" aria-label="Reproducir el día">▶</button><output id="flow-hour-label" class="flow-hour-label">${ampm(state.flowHour)}</output><div class="segmented flow-day">${DAYS.map((d,i)=>`<button data-flowday="${i}" class="${state.flowDay===i?'active':''}" title="${DAYS_LONG[i]}">${d.slice(0,2)}</button>`).join('')}</div></div>
        <svg id="flow-profile" class="flow-profile" aria-label="Entradas del sistema por hora"></svg>
        <input id="flow-hour" class="flow-slider" type="range" min="0" max="23" step="1" value="${state.flowHour}" aria-label="Hora de entrada">
        <div class="flow-ticks"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span><span>11 pm</span></div>
        <div class="segmented flow-show"><button data-flowshow="volume" class="${state.flowShow!=='change'?'active':''}">Viajes ${state.year}</button><button data-flowshow="change" class="${state.flowShow==='change'?'active':''}"${state.year===BASE?' disabled':''}>Cambio frente a ${BASE}</button></div>
        <div class="eyebrow" style="margin-top:10px">AGRUPACIÓN DE RECORRIDOS</div>
        <label class="fidelity"><span>Agrupación <output id="bundling-out">${state.bundling.toFixed(2)}</output></span><input id="bundling" type="range" min="0" max="1" step="0.05" value="${state.bundling}" aria-label="Agrupación de recorridos"><small>0: cada recorrido del complejo seleccionado va por su propio carril, sin desplazarse hacia los demás · 1: los recorridos que comparten tramo y sentido se agrupan en un solo haz. El conjunto del sistema ya está agregado por corredor y sentido (equivale a 1).</small></label>
        <label class="fidelity"><span>Fidelidad geométrica <output id="fidelity-out">${state.fidelity.toFixed(2)}</output></span><input id="fidelity" type="range" min="0" max="1" step="0.05" value="${state.fidelity}" aria-label="Fidelidad geométrica de los trazos"><small>1: eje sobre el trazado de referencia · 0: simplificado hasta ${EPS_MAX} m (Douglas–Peucker sobre los vértices del tramo; nunca cambia conexiones ni valores)</small></label>
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
      ${flujos?`<div class="map-legend-title">${cambio?`Cambio del tráfico ${BASE} → ${state.year}`:'Viajes por tramo'} · <span id="flow-legend-hour">${ampm(state.flowHour)}</span> · ${DAYS_LONG[state.flowDay]}</div>
      <div class="map-legend-what">${cambio?`Grosor: viajes ${state.year}. Color: crecimiento del tramo frente a ${BASE}, relativo al sistema.`:`Viajes que empiezan a esa hora, por su camino asignado · ${state.year}.`}</div>
      <div id="map-key"></div>
      <div class="map-legend-marks"><span><i class="lg-flow"></i> un carril por sentido (a su derecha) &nbsp;<i class="lg-node"></i> nodo = viajes iniciados &nbsp;<i class="lg-flow sel"></i> salientes del seleccionado (×6)</span></div>
      <div class="map-legend-foot" id="flow-legend-foot"></div>`:`<div class="map-legend-title">${L.titulo}</div>
      <div class="map-legend-what">${L.que}</div>
      <div id="map-key"></div>
      <div class="map-legend-marks"><span><i class="lg-dot"></i> un punto = un complejo &nbsp;<i class="lg-ring"></i> seleccionado &nbsp;<i class="lg-ring pin"></i> fijado</span></div>
      <div class="map-legend-foot">${items.length} complejos · mediana ${fmt(d3.median(items,s=>metricValue(s,metric)))} ${unit}</div>`}
    </div>
    <div class="map-panel map-minimap" aria-label="Contexto al acercar"><div class="eyebrow">CONTEXTO AL ACERCAR</div><svg class="minimap-svg" viewBox="0 0 150 112"></svg><div class="minimap-counts"></div></div>
    <div class="map-credit">OD estimado MTA · rutas modeladas sobre red de referencia · Plano: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · Contornos: NYC DCP · catálogo MTA actual</div>
  </div>`;
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
  // Plano de calles (teselas OpenStreetMap/CARTO vía d3-tile) debajo de los contornos. Se calcula con la
  // proyección compuesta (encuadre × zoom) y fuera del <g> transformado, para pedir el nivel de detalle
  // que corresponde. Si no hay red o d3-tile, quedan los contornos de boroughs como antes.
  const usaCalles=typeof d3.tile==='function';let callesFallaron=false;
  const gTiles=svg.append('g').attr('class','map-tiles');
  // Plano estándar de OpenStreetMap (sin clave de API). Atribución obligatoria en el mapa.
  const urlTesela=([x,y,z])=>`https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  function pintarTeselas(tr){
    if(!usaCalles||callesFallaron)return;
    const k=projection.scale()*2*Math.PI*tr.k,tx=projection.translate()[0]*tr.k+tr.x,ty=projection.translate()[1]*tr.k+tr.y;
    const teselas=d3.tile().size([width,height]).scale(k).translate([tx,ty]).tileSize(256).clampX(false)();
    gTiles.selectAll('image').data(teselas,d=>d.join('/')).join(enter=>enter.append('image').attr('href',urlTesela)
      .on('error',()=>{callesFallaron=true;gTiles.remove();svg.classed('sin-calles',true);}))
      .attr('x',([x])=>Math.round((x+teselas.translate[0])*teselas.scale)).attr('y',([,y])=>Math.round((y+teselas.translate[1])*teselas.scale)).attr('width',Math.ceil(teselas.scale)).attr('height',Math.ceil(teselas.scale));
  }
  svg.classed('con-calles',usaCalles);
  const path=d3.geoPath(flat),g=svg.append('g');
  // El plano se recorta a los boroughs cubiertos; fuera de ellos queda el fondo liso.
  // En vez de recortar el plano con un borde duro, una máscara con el borde difuminado: dentro del área
  // cubierta el plano se ve completo; fuera (Nueva Jersey, Staten Island, el agua) queda atenuado pero
  // presente, para que la ciudad no parezca recortada.
  const maskId='map-mask-'+Math.random().toString(36).slice(2,8);
  const defs=svg.append('defs');
  defs.append('filter').attr('id',maskId+'-blur').attr('x','-10%').attr('y','-10%').attr('width','120%').attr('height','120%').append('feGaussianBlur').attr('stdDeviation',14);
  const mask=defs.append('mask').attr('id',maskId).attr('maskUnits','userSpaceOnUse').attr('x',0).attr('y',0).attr('width',width).attr('height',height);
  mask.append('rect').attr('width',width).attr('height',height).attr('fill','#6a6a6a');
  const clipPath=mask.append('g').attr('filter',`url(#${maskId}-blur)`).selectAll('path').data(cubiertos).join('path').attr('d',path).attr('fill','#fff');
  gTiles.attr('mask',`url(#${maskId})`);
  g.selectAll('.map-bg').data(cubiertos).join('path').attr('class','map-bg').attr('fill-rule','evenodd').attr('vector-effect','non-scaling-stroke').attr('d',path);
  // Trazado del metro (GTFS de la MTA, simplificado): contexto recesivo en gris bajo los puntos.
  if(app.lineas&&!flujos)g.append('g').attr('class','map-lines').selectAll('path').data(app.lineas.features).join('path').attr('d',path).attr('fill','none').attr('vector-effect','non-scaling-stroke');
  // Capa de flujos O-D: cada tramo entre estaciones adyacentes lleva los viajes (estimación oficial de la
  // MTA, asignados al camino más corto en la red) de la hora de entrada elegida; el grosor es la única
  // codificación. La animación recorre las 24 horas (overview); un complejo seleccionado muestra a dónde
  // van sus entradas de la mañana (details on demand).
  let pintarFlujos=null,nodeR=null;
  if(flujos){
    const F=app.flows,FY=F.flows[String(state.year)][state.flowDay],ni=new Map(F.nodes.map((n,i)=>[n.id,i]));
    if(!F._max){let mx=0,sx=0;for(const y of Object.values(F.flows))for(const d of y)for(const h of d)for(const v of h)if(v>mx)mx=v;for(const y of Object.values(F.starts))for(const n of y)for(const d of n)for(const v of d)if(v>sx)sx=v;F._max=mx;F._smax=sx;}
    const ancho=d3.scaleSqrt().domain([0,F._max]).range([0,14]);
    // Área del nodo proporcional a los viajes iniciados (r ∝ √v); escala fija entre años y horas.
    const rNode=d3.scaleSqrt().domain([0,F._smax]).range([0,13]);
    nodeR=(s,h=state.flowHour)=>{const i=ni.get(s.id),v=F.starts[String(state.year)]?.[i]?.[state.flowDay]?.[h]??0;return v>0?Math.max(1.8,rNode(v)):1.6;};
    // Fidelidad geométrica: simplificación Douglas–Peucker de los vértices del tramo, con tolerancia
    // epsilon(f) = (1−f)·EPS_MAX metros; los extremos se conservan, así que la conectividad no cambia.
    const toM=([lon,lat])=>[(lon+73.95)*111320*Math.cos(40.73*Math.PI/180),(lat-40.73)*111320];
    function rdp(pts,eps){if(pts.length<3||eps<=0)return pts;const P=pts.map(toM);let imax=0,dmax=0;const [ax,ay]=P[0],[bx,by]=P[P.length-1],L=Math.hypot(bx-ax,by-ay)||1;for(let i=1;i<P.length-1;i++){const d=Math.abs((bx-ax)*(ay-P[i][1])-(ax-P[i][0])*(by-ay))/L;if(d>dmax){dmax=d;imax=i;}}if(dmax<=eps)return [pts[0],pts[pts.length-1]];return rdp(pts.slice(0,imax+1),eps).slice(0,-1).concat(rdp(pts.slice(imax),eps));}
    let geoms=F.links.map(l=>rdp(l.coords,(1-state.fidelity)*EPS_MAX));
    // Dos carriles por tramo (ida y vuelta), desplazados a la derecha de su sentido; el desplazamiento
    // es en píxeles de pantalla, así que se recalcula con el zoom.
    const LANE=2.4;
    function laneD(li,dir,k,extra=0){
      const pts=geoms[li].map(c=>projection(c));const src=dir===0?pts:[...pts].reverse();const out=[];const off=-(LANE+extra)/k;
      for(let i=0;i<src.length;i++){const p0=src[Math.max(0,i-1)],p1=src[Math.min(src.length-1,i+1)];const dx=p1[0]-p0[0],dy=p1[1]-p0[1],L=Math.hypot(dx,dy)||1;out.push([src[i][0]+(-dy/L)*off,src[i][1]+(dx/L)*off]);}
      return 'M'+out.map(p=>p[0].toFixed(2)+','+p[1].toFixed(2)).join('L');
    }
    const lanes=F.links.flatMap((l,li)=>[{l,li,dir:0,id:2*li},{l,li,dir:1,id:2*li+1}]);
    const gFlow=g.append('g').attr('class','map-flow');
    const nombre=id=>{const s=app.station(id);return s?s.name.replace(/ \(.*/,''):id;};
    const tramos=gFlow.selectAll('path').data(lanes).join('path').attr('d',d=>laneD(d.li,d.dir,transform.k)).attr('fill','none').attr('vector-effect','non-scaling-stroke').attr('stroke-linecap','round').attr('stroke-linejoin','round')
      .on('pointerenter',(e,d)=>{const v=FY[state.flowHour][d.id],b=cambio?F.flows[String(BASE)][state.flowDay][state.flowHour][d.id]:null,from=d.dir===0?d.l.a:d.l.b,to=d.dir===0?d.l.b:d.l.a;showTooltip(`<b>${esc(nombre(from))} → ${esc(nombre(to))}</b><br>${DAYS_LONG[state.flowDay]} ${ampm(state.flowHour)}: <b>${fmt(v)}</b> viajes/día${b!=null?`<br>${BASE}: ${fmt(b)} · ×${b>0?(v/b).toFixed(2):'—'}`:''}<br><small>Rutas asignadas de viajes que comienzan a esta hora (semana representativa ${state.year}). OD estimado MTA; camino más corto sobre la red de referencia.</small>`,e);}).on('pointermove',(e,d)=>{const v=FY[state.flowHour][d.id],from=d.dir===0?d.l.a:d.l.b,to=d.dir===0?d.l.b:d.l.a;showTooltip(`<b>${esc(nombre(from))} → ${esc(nombre(to))}</b><br>${ampm(state.flowHour)}: ${fmt(v)} viajes/día`,e);}).on('pointerleave',hideTooltip);
    // Conexiones salientes del complejo seleccionado (semana representativa completa): Dijkstra en el cliente
    // sobre la misma red; se dibujan como carriles de ida desde el origen.
    const gSel=g.append('g').attr('class','map-flow-sel').style('pointer-events','none');
    let selLanes=null;
    if(state.selected&&F.origins[state.selected]?.[String(state.year)]){
      const adj=new Map();F.links.forEach((l,i)=>{(adj.get(l.a)??adj.set(l.a,[]).get(l.a)).push([l.b,i,0,l.len+150]);(adj.get(l.b)??adj.set(l.b,[]).get(l.b)).push([l.a,i,1,l.len+150]);});
      const dist=new Map([[state.selected,0]]),prev=new Map(),todo=[[0,state.selected]];
      while(todo.length){todo.sort((a,b)=>a[0]-b[0]);const [d,u]=todo.shift();if(d>dist.get(u))continue;for(const [v,i,dir,w] of adj.get(u)??[]){const nd=d+w;if(nd<(dist.get(v)??Infinity)){dist.set(v,nd);prev.set(v,[u,2*i+dir]);todo.push([nd,v]);}}}
      // Cada recorrido origen→destino se conserva como entidad (camino asignado, sin cambios): la barra
      // de agrupación solo decide cuánto se desplazan lateralmente los recorridos que comparten tramo y
      // sentido (0: cada uno en su carril; 1: superpuestos en un haz cuyo grosor es la suma).
      const porCarril=new Map();let total=0;const recorridos=[];
      for(const [dest,v] of F.origins[state.selected][String(state.year)]){total+=v;const ids=[];let cur=dest;while(cur!==state.selected&&prev.has(cur)){const [u,id]=prev.get(cur);ids.push(id);cur=u;}if(!ids.length)continue;const ri=recorridos.length;recorridos.push({dest,v,ids});for(const id of ids)(porCarril.get(id)??porCarril.set(id,[]).get(id)).push(ri);}
      const segs=[];
      for(const [id,ris] of porCarril){ris.sort((a,b)=>recorridos[b].v-recorridos[a].v);const suma=d3.sum(ris,r=>recorridos[r].v),n=ris.length,gap=Math.min(5,22/Math.max(1,n));ris.forEach((r,k)=>segs.push({lane:lanes[id],r,k,n,gap,suma}));}
      const anchoSel=(seg,b)=>{const w=ancho(recorridos[seg.r].v*6/7),ws=ancho(seg.suma*6/7);return Math.max(1.1,w+b*(ws-w)*(seg.k===0?1:0));};
      const extraDe=(seg,b)=>(seg.k-(seg.n-1)/2)*seg.gap*(1-b);
      selLanes=gSel.selectAll('path').data(segs).join('path').attr('d',d=>laneD(d.lane.li,d.lane.dir,transform.k,extraDe(d,state.bundling))).attr('fill','none').attr('vector-effect','non-scaling-stroke').attr('stroke-linecap','round').attr('stroke-linejoin','round').attr('stroke-width',d=>anchoSel(d,state.bundling)).attr('opacity',d=>d.k===0?.95:.75)
        .style('pointer-events','stroke').on('pointerenter',(e,d)=>{const rc=recorridos[d.r];showTooltip(`<b>${esc(nombre(state.selected))} → ${esc(nombre(rc.dest))}</b><br>${fmt(Math.round(rc.v))} viajes/semana por este camino asignado<br><small>${d.n} recorridos comparten este tramo y sentido</small>`,e);}).on('pointerleave',hideTooltip);
      app._rebundle=b=>{selLanes.attr('d',d=>laneD(d.lane.li,d.lane.dir,transform.k,extraDe(d,b))).attr('stroke-width',d=>anchoSel(d,b));};
      app._relaneSel=k=>selLanes.attr('d',d=>laneD(d.lane.li,d.lane.dir,k,extraDe(d,state.bundling)));
      const ms=F.manhattanShare[state.selected]?.[String(state.year)];
      const sel=app.station(state.selected);
      host.querySelector('#flow-legend-foot').innerHTML=`<b>${esc(sel.name.replace(/ \(.*/,''))}</b> · ${fmt(Math.round(total))} viajes/semana a 40 destinos${ms!=null?` · <b>${fmt(ms)} %</b> a Manhattan`:''}`;
      gFlow.classed('dim',true);
    }
    const FB=cambio?F.flows[String(BASE)][state.flowDay]:null;
    const colorCambio=d3.scaleDiverging([-1,0,1],t=>t<=.5?d3.interpolateRgb('#176c91','#e9e9e2')(2*t):d3.interpolateRgb('#e9e9e2','#c2561f')(2*t-1)).clamp(true);
    const relativo=(h,i)=>{const b=FB[h][i],v=FY[h][i];if(b<1||v<1)return null;const sys=d3.sum(FY[h])/Math.max(1,d3.sum(FB[h]));return Math.log2((v/b)/sys);};
    pintarFlujos=(h,animar=true)=>{
      const fila=FY[h];
      const t=(animar?tramos.transition().duration(320).ease(d3.easeCubicOut):tramos).attr('stroke-width',(d)=>Math.max(fila[d.id]>0?.35:0,ancho(fila[d.id])));
      if(cambio){t.style('stroke',(d)=>{const r=relativo(h,d.id);return r===null?'#b8c0bc':colorCambio(r);});const sys=d3.sum(fila)/Math.max(1,d3.sum(FB[h]));const sl=host.querySelector('#flow-sys-ratio');if(sl)sl.textContent=`×${sys.toFixed(1)}`;}
      const lbl=host.querySelector('#flow-hour-label');if(lbl)lbl.value=ampm(h);
      const lh=host.querySelector('#flow-legend-hour');if(lh)lh.textContent=ampm(h);
      if(!state.selected)host.querySelector('#flow-legend-foot').innerHTML=`OD estimado MTA · rutas modeladas · un viaje cuenta en cada tramo que recorre`;
      (animar?g.selectAll('.map-dot').transition().duration(320):g.selectAll('.map-dot')).attr('r',s=>nodeR(s,h)/transform.k);
    };
    // Perfil del día (viajes iniciados en el sistema por hora, del día elegido): sitúa la hora y marca los picos.
    const perfil=cohortProfile(app.data.stations,state.year);
    const dias=[state.flowDay];
    const porHora=d3.range(24).map(h=>100*d3.mean(dias,d=>perfil.p[d*24+h]));
    const svgP=d3.select(host.querySelector('#flow-profile')),PW=host.querySelector('#flow-profile').clientWidth||222,PH=46;
    svgP.attr('viewBox',`0 0 ${PW} ${PH}`);
    const px=d3.scaleLinear().domain([0,23]).range([7,PW-7]),py=d3.scaleLinear().domain([0,d3.max(porHora)]).range([PH-2,16]);
    const perfilBase=state.year!==BASE?cohortProfile(app.data.stations,BASE):null;
    svgP.append('path').attr('d',d3.area().x((v,i)=>px(i)).y0(PH-2).y1(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','#1d6f8d').attr('opacity',.14);
    if(perfilBase){const pb=d3.range(24).map(h=>100*d3.mean(dias,d=>perfilBase.p[d*24+h]));svgP.append('path').attr('d',d3.line().x((v,i)=>px(i)).y(v=>py(v)).curve(d3.curveMonotoneX)(pb)).attr('fill','none').attr('stroke','#9aa6a1').attr('stroke-width',1).attr('stroke-dasharray','2 2');}
    svgP.append('path').attr('d',d3.line().x((v,i)=>px(i)).y(v=>py(v)).curve(d3.curveMonotoneX)(porHora)).attr('fill','none').attr('stroke','#1d6f8d').attr('stroke-width',1.2);
    const picos=state.flowDay<5?[d3.maxIndex(porHora.slice(5,12))+5,d3.maxIndex(porHora.slice(14,21))+14]:[d3.maxIndex(porHora)];
    svgP.selectAll('.pico').data(picos).join('text').attr('class','pico').attr('x',h=>px(h)).attr('y',h=>py(porHora[h])-3).attr('text-anchor','middle').attr('font-size',8).attr('fill','#1b2a33').text(h=>`pico ${ampm(h)}`);
    const marca=svgP.append('g');marca.append('line').attr('y1',4).attr('y2',PH-2).attr('stroke','#1b2a33').attr('stroke-width',1);marca.append('circle').attr('r',2.6).attr('fill','#1b2a33');
    const moverMarca=h=>{marca.attr('transform',`translate(${px(h)},0)`);marca.select('circle').attr('cy',py(porHora[h]));};
    const pintarBase=pintarFlujos;pintarFlujos=(h,animar)=>{pintarBase(h,animar);moverMarca(h);};
    const slider=host.querySelector('#flow-hour');
    slider.oninput=()=>{state.flowHour=+slider.value;pintarFlujos(state.flowHour);};
    const play=host.querySelector('#flow-play'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    play.onclick=()=>{if(playTimer){clearInterval(playTimer);playTimer=null;play.textContent='▶';play.classList.remove('active');return;}play.textContent='❚❚';play.classList.add('active');playTimer=setInterval(()=>{state.flowHour=(state.flowHour+1)%24;slider.value=state.flowHour;pintarFlujos(state.flowHour,!reduced);},reduced?1100:700);};
    host.querySelectorAll('[data-flowday]').forEach(b=>b.onclick=()=>app.set({flowDay:+b.dataset.flowday}));
    host.querySelectorAll('[data-flowshow]').forEach(b=>b.onclick=()=>app.set({flowShow:b.dataset.flowshow}));
    const fid=host.querySelector('#fidelity');
    fid.oninput=()=>{state.fidelity=+fid.value;host.querySelector('#fidelity-out').value=state.fidelity.toFixed(2);geoms=F.links.map(l=>rdp(l.coords,(1-state.fidelity)*EPS_MAX));tramos.attr('d',d=>laneD(d.li,d.dir,transform.k));if(app._relaneSel)app._relaneSel(transform.k);};
    const bun=host.querySelector('#bundling');
    bun.oninput=()=>{state.bundling=+bun.value;host.querySelector('#bundling-out').value=state.bundling.toFixed(2);if(app._rebundle)app._rebundle(state.bundling);};
    // al hacer zoom, los carriles conservan su separación en pantalla
    svg.on('zoom.lanes',null);
    app._relane=k=>{tramos.attr('d',d=>laneD(d.li,d.dir,k));if(app._relaneSel)app._relaneSel(k);};
    if(!selLanes){app._rebundle=null;app._relaneSel=null;}
  } else {app._relane=null;app._rebundle=null;app._relaneSel=null;}
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
  const points=g.selectAll('.map-dot').data(items).join('circle').attr('class','map-dot'+(flujos?' quiet':'')).attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',s=>rOf(s)).attr('fill',s=>flujos?'#1d6f8dcc':color(metricValue(s,state.mapMetric)))
    .on('pointerenter',function(e,s){d3.select(this).raise().transition().duration(120).attr('r',(flujos?rOf(s)+3:8)/transform.k);showTooltip(flujos?`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${DAYS_LONG[state.flowDay]} ${ampm(state.flowHour)}: ${fmt(Math.round(app.flows.starts[String(state.year)][app.flows.nodes.findIndex(n=>n.id===s.id)][state.flowDay][state.flowHour]))} viajes iniciados<br><small>Clic: sus conexiones salientes</small>`:`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}<br><small>Clic para abrir huella y evidencia</small>`,e);}).on('pointermove',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}`,e)).on('pointerleave',function(e,s){d3.select(this).transition().duration(160).attr('r',rOf(s)/transform.k);hideTooltip();}).on('click',(e,s)=>{e.stopPropagation();e.shiftKey?app.pin(s.id):app.select(s.id);});
  // Entrada animada: al cambiar medida, filtro o año, los puntos aparecen en vez de saltar.
  points.attr('opacity',0).transition().duration(380).delay((d,i)=>Math.min(i,300)*0.6).attr('opacity',1);
  // Draw larger changes last so low values cannot cover them in dense areas.
  points.sort((a,b)=>Math.abs(metricValue(a,state.mapMetric))-Math.abs(metricValue(b,state.mapMetric)));
  // Zoom semántico: al acercar aparecen los nombres de los complejos y, más cerca, su valor.
  // Lejos, solo los puntos; a medio zoom, los nombres de los complejos con mayor cambio; cerca, todos.
  const medAbs=d3.median(items,s=>Math.abs(metricValue(s,state.mapMetric)))||0;
  const gLabels=g.append('g').attr('class','map-labels').style('pointer-events','none');
  const etiquetas=gLabels.selectAll('text').data(items,s=>s.id).join('text').attr('class','map-label')
    .attr('x',s=>projection([s.lon,s.lat])[0]).attr('y',s=>projection([s.lon,s.lat])[1]).attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-linejoin','round').attr('fill','#1b2a33');
  function pintarEtiquetas(k){
    const nivel=k<2.4?0:k<4.5?1:2;
    etiquetas.attr('display',s=>nivel===0||(nivel===1&&Math.abs(metricValue(s,state.mapMetric))<medAbs)||s.id===state.selected?'none':null)
      .attr('font-size',10/k).attr('stroke-width',3/k).attr('dx',7/k).attr('dy',3.5/k)
      .text(s=>nivel===2&&!flujos?`${s.name.replace(/ \(.*/,'')} · ${fmt(metricValue(s,state.mapMetric))} ${unit}`:s.name.replace(/ \(.*/,''));
    g.selectAll('.borough-name').attr('display',k>3?'none':null);
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
  const zoom=d3.zoom().scaleExtent([1,12]).translateExtent([[0,0],[width,height]]).on('zoom',e=>{transform=e.transform;g.attr('transform',transform);clipPath.attr('transform',transform);pintarTeselas(transform);points.attr('r',s=>rOf(s)/transform.k);if(app._relane)app._relane(transform.k);rings.attr('r',8.5/transform.k);g.selectAll('.context-point').attr('r',1.6/transform.k);pintarEtiquetas(transform.k);if(label)label.attr('font-size',11/transform.k).attr('stroke-width',4/transform.k).attr('x',labelPos[0]+12/transform.k).attr('y',labelPos[1]-8/transform.k);hideTooltip();});
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
    const F=app.flows,ancho=d3.scaleSqrt().domain([0,F._max]).range([0,16]);
    const muestras=[2000,10000,30000,60000].filter(v=>v<=F._max*1.05);
    host.querySelector('#map-key').innerHTML=`<div class="flow-key">${muestras.map(v=>`<span><i style="height:${Math.max(1,ancho(v)).toFixed(1)}px"></i>${v>=1000?fmt(v/1000)+' mil':v}</span>`).join('')}<small>viajes/día en el tramo</small></div>`+(cambio?`<div class="map-key-bar" style="margin-top:8px;background:linear-gradient(90deg,#176c91,#e9e9e2,#c2561f)"></div><div class="map-key-words"><span>la mitad</span><span>como el sistema (<b id="flow-sys-ratio">${(()=>{const FB=F.flows[String(BASE)][state.flowDay][state.flowHour],FYh=F.flows[String(state.year)][state.flowDay][state.flowHour];return '×'+(d3.sum(FYh)/Math.max(1,d3.sum(FB))).toFixed(1);})()}</b>)</span><span>el doble</span></div><div class="map-key-note">Gris: sin viajes en uno de los dos años.</div>`:'');
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
