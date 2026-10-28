import {state,esc,fmt,signed,profile,metricValue,metricColor,showTooltip,hideTooltip,heading,stats,passesMetricRanges} from './model.js?v=20261027-4';
let transform=d3.zoomIdentity;
const names={change:'Cambio de forma · distancia TV (pp)',deltaAM:'Cambio del peso AM · puntos porcentuales',deltaWeekend:'Cambio del peso de fin de semana · puntos porcentuales',recovery:'Índice de volumen · 2020 = 100 %'};

const formulas={
  change:{formula:`TV = ½ × Σᵢ₌₁¹⁶⁸ |Sᵧ(i) − S₂₀₂₀(i)|`,explanation:'Sᵧ(i) = 100 × Pᵧ(i): porcentaje de las entradas semanales en la combinación día–hora i. Se suman las 168 diferencias absolutas y se divide entre dos.',example:'Ejemplo: suma absoluta de 52,8 pp → TV de 26,4 pp.',unit:'Puntos porcentuales (pp), entre 0 y 100. Mide redistribución horaria; no variación del volumen.'},
  deltaAM:{formula:`AMᵧ = 100 × Σ Pᵧ(lun–vie, 06–09 h) / Σ Pᵧ(lun–vie, 00–23 h)
ΔAM = AMᵧ − AM₂₀₂₀`,explanation:'Se divide el peso de las entradas de lunes a viernes entre 06:00 y 09:59 entre el peso de todas las entradas de esos cinco días. Luego se resta el porcentaje de 2020.',example:'Ejemplo: 22 % − 30 % = −8 pp.',unit:'Puntos porcentuales (pp). Negativo: la mañana pierde participación; positivo: gana.'},
  deltaWeekend:{formula:`FSᵧ = 100 × Σ Pᵧ(sáb–dom, 00–23 h)
ΔFS = FSᵧ − FS₂₀₂₀`,explanation:'Se suma la participación de las 48 horas del sábado y domingo dentro de toda la semana y se resta el porcentaje de 2020.',example:'Ejemplo: 25 % − 20 % = +5 pp.',unit:'Puntos porcentuales (pp). Negativo: el fin de semana pierde participación; positivo: gana.'},
  recovery:{formula:`Vᵧ = (Σᵢ₌₁¹⁶⁸ Wᵧ(i)) / 7
Índice = 100 × Vᵧ / V₂₀₂₀`,explanation:'V es el promedio diario de entradas de una semana comparable. El índice divide el volumen del año elegido entre el de 2020 y multiplica por 100.',example:'Ejemplo: 7.000 / 10.000 × 100 = 70 %.',unit:'Porcentaje (%). 100 %: mismo volumen; 70 %: 30 % menos; 120 %: 20 % más.'}
};

export function renderMap(host,app,items){
  const metric=state.mapMetric,unit=metric==='recovery'?'%':'pp',title={change:'distancia TV',deltaAM:'cambio del peso AM',deltaWeekend:'cambio del peso de fin de semana',recovery:'índice de volumen'}[metric];
  const values=app.data.stations.filter(s=>profile(s)).map(s=>metricValue(s,metric));
  const activeRange=metric==='change'?(state.tvMin>0||state.tvMax<100?[state.tvMin,state.tvMax<100?state.tvMax:Math.max(state.tvMin,Math.ceil(d3.max(values)))]:null):state.ranges[metric];
  const rangeStart=Math.min(0,Math.floor(d3.min(values)),activeRange?.[0]??0),rangeLimit=Math.max(1,Math.ceil(d3.max(values)),activeRange?.[1]??0);
  const lowerValue=activeRange?.[0]??rangeStart,upper=activeRange?.[1]??rangeLimit;
  const filters=[...(state.tvMin>0||state.tvMax<100?[['change',`TV: ${fmt(state.tvMin)}–${state.tvMax===100?'sin límite':fmt(state.tvMax)} pp`]]:[]),...Object.entries(state.ranges).filter(([,r])=>r).map(([k,r])=>[k,`${{deltaAM:'AM',deltaWeekend:'Fin de semana',recovery:'Volumen'}[k]}: ${fmt(r[0])}–${fmt(r[1])} ${k==='recovery'?'%':'pp'}`])];

  const leyendas={
    change:{titulo:'Cambio de forma del ritmo semanal',que:`Distancia TV: cuánto del ritmo semanal cambió de lugar entre 2020 y ${state.year}.`,bajo:'igual a 2020',alto:'muy distinto'},
    deltaAM:{titulo:'Cambio del peso de la mañana',que:`Franja 6–10 am de lunes a viernes, ${state.year} menos 2020.`,bajo:'menos mañana',alto:'más mañana'},
    deltaWeekend:{titulo:'Cambio del peso del fin de semana',que:`Sábado + domingo en la semana, ${state.year} menos 2020.`,bajo:'menos fin de semana',alto:'más fin de semana'},
    recovery:{titulo:'Volumen frente a 2020',que:`Entradas por día de ${state.year} como % de 2020.`,bajo:'menos entradas',alto:'más entradas'}
  };
  const L=leyendas[metric];
  host.innerHTML=`
  <div class="map-stage">
    <svg class="map-svg" role="img" aria-label="Mapa de los complejos de estación de subway de Nueva York"></svg>
    <div class="map-panel map-panel-controls">
      <div class="eyebrow">02 · GEOGRAFÍA</div>
      <label class="map-field">Color de los puntos<select id="map-metric">${Object.entries(names).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="map-field">Entrada al análisis<select id="preset-select"><option value="">Todos los complejos</option><option value="morning"${state.preset==='morning'?' selected':''}>La mañana cambia (Δ AM &lt; −2 pp)</option><option value="weekend"${state.preset==='weekend'?' selected':''}>Otro fin de semana (Δ &gt; +2 pp)</option><option value="change"${state.preset==='change'?' selected':''}>Ritmos que se alejan</option><option value="decoupled"${state.preset==='decoupled'?' selected':''}>Volumen ≠ ritmo</option></select></label>
      <div class="map-control"><button id="map-select">Seleccionar área</button><button id="map-center">Centrar ↺</button></div>
      <details class="map-filter"${activeRange?' open':''}><summary>Filtrar por ${title} <span class="map-filter-n">${items.length} de ${values.length}</span></summary>
        <div class="metric-formula-help"><button id="metric-formula-trigger" class="metric-formula-trigger" aria-expanded="false" aria-describedby="metric-formula-panel">Cómo se calcula <span aria-hidden="true">ⓘ</span></button><div id="metric-formula-panel" class="metric-formula-panel" role="tooltip" hidden><b>Cómo se calcula: ${title}</b><div class="metric-formula-equation">${esc(formulas[metric].formula)}</div><p>${esc(formulas[metric].explanation)}</p><p><b>Unidad e interpretación</b><br>${esc(formulas[metric].unit)}</p><p>${esc(formulas[metric].example)}</p><div class="metric-formula-base">Base de cálculo: enero–febrero de cada año, frente a 2020.<br>Wᵧ(d,h) = entradas registradas / cantidad de días de ese tipo en el período.<br>Pᵧ(i) = Wᵧ(i) / Σ Wᵧ(i); los 168 valores de P suman 1.<br>y = año elegido; i = combinación día–hora.</div></div></div>
        <div class="tv-range-control"><div class="tv-range-values"><span>Mín. <output id="map-min-output">${fmt(lowerValue)} ${unit}</output></span><span>Máx. <output id="map-max-output">${fmt(upper)} ${unit}</output></span></div><div class="dual-range" role="group" aria-label="Rango de ${title}"><div class="dual-range-track"></div><div class="dual-range-selected"></div><input id="map-min-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${lowerValue}" aria-label="Mínimo de ${title}"><input id="map-max-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${upper}" aria-label="Máximo de ${title}"></div></div>
        <button id="map-range-reset" class="text-button">Quitar este filtro</button>
        ${filters.length?`<div class="metric-filter-chips">${filters.map(([key,label])=>`<button data-clear-metric="${key}" title="Quitar este filtro">${esc(label)} ×</button>`).join('')}</div>`:''}
      </details>
    </div>
    <div class="map-panel map-legend" aria-label="Leyenda">
      <div class="map-legend-title">${L.titulo}</div>
      <div class="map-legend-what">${L.que}</div>
      <div id="map-key"></div>
      <div class="map-legend-marks"><span><i class="lg-dot"></i> un punto = un complejo &nbsp;<i class="lg-ring"></i> seleccionado &nbsp;<i class="lg-ring pin"></i> fijado</span></div>
      <div class="map-legend-foot">${items.length} complejos · mediana ${fmt(d3.median(items,s=>metricValue(s,metric)))} ${unit}</div>
    </div>
    <div class="map-credit">Plano: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · Contornos: NYC DCP · catálogo MTA actual</div>
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
  const clipId='map-clip-'+Math.random().toString(36).slice(2,8);
  const clipPath=svg.append('clipPath').attr('id',clipId).selectAll('path').data(cubiertos).join('path').attr('d',path);
  gTiles.attr('clip-path',`url(#${clipId})`);
  g.selectAll('.map-bg').data(cubiertos).join('path').attr('class','map-bg').attr('fill-rule','evenodd').attr('vector-effect','non-scaling-stroke').attr('d',path);
  // Trazado del metro (GTFS de la MTA, simplificado): contexto recesivo en gris bajo los puntos.
  if(app.lineas)g.append('g').attr('class','map-lines').selectAll('path').data(app.lineas.features).join('path').attr('d',path).attr('fill','none').attr('vector-effect','non-scaling-stroke');
  const labels=[['MANHATTAN',-74.003,40.789],['BROOKLYN',-73.987,40.635],['QUEENS',-73.817,40.740],['BRONX',-73.854,40.870]];
  g.selectAll('.borough-name').data(labels).join('text').attr('class','borough-name').attr('x',d=>projection(d.slice(1))[0]).attr('y',d=>projection(d.slice(1))[1]).attr('text-anchor','middle').text(d=>d[0]);
  const ids=new Set(items.map(s=>s.id));
  // Para las dos medidas divergentes, la escala llega al percentil 95 del valor absoluto y satura
  // más allá (se declara en la leyenda): si llegara al máximo, el 90 % de los puntos quedaría pálido.
  let color=metricColor(state.mapMetric,app.data.stations.filter(s=>profile(s)));
  let saturaEn=null;
  if(metric==='deltaAM'||metric==='deltaWeekend'){saturaEn=Math.ceil(d3.quantile(values.map(Math.abs).sort(d3.ascending),0.95));color=d3.scaleDiverging([-saturaEn,0,saturaEn],t=>t<=.5?d3.interpolateRgb('#176c91','#f5f5ef')(2*t):d3.interpolateRgb('#f5f5ef','#b6532c')(2*t-1)).clamp(true);}
  g.selectAll('.context-point').data(app.data.stations.filter(s=>!ids.has(s.id)&&profile(s)&&passesMetricRanges(s))).join('circle').attr('class','context-point').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',1.6).attr('fill','#b8c7c1').attr('opacity',.45);
  const points=g.selectAll('.map-dot').data(items).join('circle').attr('class','map-dot').attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',5.2).attr('fill',s=>color(metricValue(s,state.mapMetric)))
    .on('pointerenter',function(e,s){d3.select(this).raise().transition().duration(120).attr('r',8/transform.k);showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}<br><small>Clic para abrir huella y evidencia</small>`,e);}).on('pointermove',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}`,e)).on('pointerleave',function(){d3.select(this).transition().duration(160).attr('r',5.2/transform.k);hideTooltip();}).on('click',(e,s)=>{e.stopPropagation();e.shiftKey?app.pin(s.id):app.select(s.id);});
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
      .text(s=>nivel===2?`${s.name.replace(/ \(.*/,'')} · ${fmt(metricValue(s,state.mapMetric))} ${unit}`:s.name.replace(/ \(.*/,''));
    g.selectAll('.borough-name').attr('display',k>3?'none':null);
  }
  pintarEtiquetas(transform.k);
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
  const zoom=d3.zoom().scaleExtent([1,12]).translateExtent([[0,0],[width,height]]).on('zoom',e=>{transform=e.transform;g.attr('transform',transform);clipPath.attr('transform',transform);pintarTeselas(transform);points.attr('r',5.2/transform.k);rings.attr('r',8.5/transform.k);g.selectAll('.context-point').attr('r',1.6/transform.k);pintarEtiquetas(transform.k);if(label)label.attr('font-size',11/transform.k).attr('stroke-width',4/transform.k).attr('x',labelPos[0]+12/transform.k).attr('y',labelPos[1]-8/transform.k);hideTooltip();});
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
  const legend=host.querySelector('#map-key'),domain=color.domain(),min=domain[0],max=domain.at(-1);
  const ticks=d3.scaleLinear().domain([min,max]).ticks(5).filter(t=>t>=min&&t<=max);
  legend.innerHTML=`<div class="map-key-bar" style="background:linear-gradient(90deg,${d3.range(21).map(i=>color(min+(max-min)*i/20)).join(',')})"></div>
    <div class="map-key-ticks">${ticks.map(t=>`<span style="left:${100*(t-min)/(max-min)}%">${fmt(t)}</span>`).join('')}</div>
    <div class="map-key-words"><span>${L.bajo}</span><span>${unit==='%'?'%':'pp'}</span><span>${L.alto}</span></div>
    ${metric==='change'?'':metric==='recovery'?`<div class="map-key-note">Crudo = 100 %.</div>`:`<div class="map-key-note">Satura en ±${saturaEn} pp.</div>`}`;
  if(!items.length)app.toast('El grupo está vacío; los puntos grises conservan el contexto geográfico.');
}
