import {state,esc,fmt,signed,profile,metricValue,metricColor,showTooltip,hideTooltip,heading,stats,passesMetricRanges} from './model.js?v=20261014-9';
let transform=d3.zoomIdentity;
const names={change:'Cambio de forma · distancia TV (pp)',deltaAM:'Cambio del peso AM · puntos porcentuales',deltaWeekend:'Cambio del peso de fin de semana · puntos porcentuales',recovery:'Índice de volumen · 2020 = 100 %'};

export function renderMap(host,app,items){
  const metric=state.mapMetric,unit=metric==='recovery'?'%':'pp',title={change:'distancia TV',deltaAM:'cambio del peso AM',deltaWeekend:'cambio del peso de fin de semana',recovery:'índice de volumen'}[metric];
  const values=app.data.stations.filter(s=>profile(s)).map(s=>metricValue(s,metric));
  const activeRange=metric==='change'?(state.tvMin>0||state.tvMax<100?[state.tvMin,state.tvMax<100?state.tvMax:Math.max(state.tvMin,Math.ceil(d3.max(values)))]:null):state.ranges[metric];
  const rangeStart=Math.min(0,Math.floor(d3.min(values)),activeRange?.[0]??0),rangeLimit=Math.max(1,Math.ceil(d3.max(values)),activeRange?.[1]??0);
  const lowerValue=activeRange?.[0]??rangeStart,upper=activeRange?.[1]??rangeLimit;
  const filters=[...(state.tvMin>0||state.tvMax<100?[['change',`TV: ${fmt(state.tvMin)}–${state.tvMax===100?'sin límite':fmt(state.tvMax)} pp`]]:[]),...Object.entries(state.ranges).filter(([,r])=>r).map(([k,r])=>[k,`${{deltaAM:'AM',deltaWeekend:'Fin de semana',recovery:'Volumen'}[k]}: ${fmt(r[0])}–${fmt(r[1])} ${k==='recovery'?'%':'pp'}`])];

  host.innerHTML=heading('02 / SITUAR EL CAMBIO','El ritmo también tiene geografía.','Localiza los patrones del atlas. Una estación puede recuperar volumen y, aun así, distribuir sus entradas en horarios distintos.','T2 · T3 · T4')+`
  <div class="toolbar"><label>Color<select id="map-metric">${Object.entries(names).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><span class="spacer" style="font-size:10px;color:var(--muted)">Clic: investigar · rueda: acercar · arrastrar: mover</span></div>
  <div class="map-emphasis"><b>Filtrar ${title}</b><div class="tv-range-control"><div class="tv-range-values"><span>Mínimo: <output id="map-min-output">${fmt(lowerValue)} ${unit}</output></span><span>Máximo: <output id="map-max-output">${fmt(upper)} ${unit}</output></span></div><div class="dual-range" role="group" aria-label="Rango de ${title}"><div class="dual-range-track"></div><div class="dual-range-selected"></div><input id="map-min-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${lowerValue}" aria-label="Mínimo de ${title}"><input id="map-max-tv" type="range" min="${rangeStart}" max="${rangeLimit}" step="0.5" value="${upper}" aria-label="Máximo de ${title}"></div></div><button id="map-range-reset" class="text-button">Quitar este filtro</button><span>${items.length} estaciones en el grupo</span><small>Se aplica al soltar la barra. Solo se muestran estaciones dentro del rango; el filtro se conserva en las otras vistas.</small>${filters.length?`<div class="metric-filter-chips">Filtros activos: ${filters.map(([key,label])=>`<button data-clear-metric="${key}" title="Quitar este filtro">${esc(label)} ×</button>`).join('')}</div>`:''}</div>
  <div class="viz-card"><div class="map-control"><button id="map-select">Seleccionar área</button><button id="map-center">Centrar ↺</button></div><svg class="map-svg" role="img" aria-label="Mapa de complejos de estación en los boroughs de Nueva York"></svg><div class="map-credit">Contornos: NYC Department of City Planning · catálogo MTA actual</div><div class="chart-note"><span id="map-key"></span><span>Todos los puntos tienen igual tamaño; solo el color codifica el cambio.</span></div></div>${stats(items)}
  <div class="narrative"><b>Una selección, cuatro lentes</b><span>El grupo definido aquí se conserva en el atlas, las trayectorias y la tabla de evidencia. Los filtros identifican asociaciones espaciales; no explican sus causas.</span></div>`;
  const select=host.querySelector('#map-metric');select.value=state.mapMetric;select.onchange=()=>app.set({mapMetric:select.value});
  const svg=d3.select(host.querySelector('.map-svg')),width=svg.node().clientWidth,height=svg.node().clientHeight;svg.attr('viewBox',`0 0 ${width} ${height}`);
  const coords=app.geo.features.flatMap(f=>f.geometry.coordinates.flat(2));
  const projection=d3.geoMercator().fitExtent([[35,20],[width-35,height-20]],{type:'MultiPoint',coordinates:coords});
  const flat=d3.geoTransform({point(lon,lat){const [x,y]=projection([lon,lat]);this.stream.point(x,y);}});
  const path=d3.geoPath(flat),g=svg.append('g');
  g.selectAll('.map-bg').data(app.geo.features).join('path').attr('class','map-bg').attr('fill-rule','evenodd').attr('d',path);
  const labels=[['MANHATTAN',-74.003,40.789],['BROOKLYN',-73.987,40.635],['QUEENS',-73.817,40.740],['BRONX',-73.854,40.870],['STATEN ISLAND',-74.151,40.586]];
  g.selectAll('.borough-name').data(labels).join('text').attr('class','borough-name').attr('x',d=>projection(d.slice(1))[0]).attr('y',d=>projection(d.slice(1))[1]).attr('text-anchor','middle').text(d=>d[0]);
  const ids=new Set(items.map(s=>s.id)),color=metricColor(state.mapMetric,app.data.stations.filter(s=>profile(s)));
  g.selectAll('.context-point').data(app.data.stations.filter(s=>!ids.has(s.id)&&profile(s)&&passesMetricRanges(s))).join('circle').attr('class','context-point').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',1.6).attr('fill','#b8c7c1').attr('opacity',.45);
  const points=g.selectAll('.map-dot').data(items).join('circle').attr('class','map-dot').attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',4.1).attr('fill',s=>color(metricValue(s,state.mapMetric)))
    .on('pointerenter',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}<br><small>Clic para abrir huella y evidencia</small>`,e)).on('pointermove',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}`,e)).on('pointerleave',hideTooltip).on('click',(e,s)=>{e.stopPropagation();e.shiftKey?app.pin(s.id):app.select(s.id);});
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
  const active=app.data.stations.filter(s=>s.id===state.selected||state.pins.includes(s.id));
  const rings=g.selectAll('.selected-ring').data(active).join('circle').attr('class','selected-ring').attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',7).attr('fill','none').attr('stroke',s=>s.id===state.selected?'#102937':'#c96035').attr('stroke-width',2).style('pointer-events','none');
  const selected=app.station(state.selected);
  if(selected){const p=projection([selected.lon,selected.lat]);g.append('text').attr('x',p[0]+12).attr('y',p[1]-8).attr('font-size',11).attr('fill','#102937').attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',4).attr('stroke-linejoin','round').text(selected.name.replace(/ \(.*/,''));}
  const zoom=d3.zoom().scaleExtent([1,12]).on('zoom',e=>{transform=e.transform;g.attr('transform',transform);points.attr('r',4.1/transform.k);rings.attr('r',7/transform.k);g.selectAll('.context-point').attr('r',1.6/transform.k);hideTooltip();});
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
  legend.innerHTML=`<span class="color-key">${fmt(min)}<span class="gradient" style="background:linear-gradient(90deg,${d3.range(11).map(i=>color(min+(max-min)*i/10)).join(',')})"></span>${fmt(max)} ${state.mapMetric==='recovery'?'%':'pp'}</span>`;
  if(state.mapMetric==='change')host.querySelector('.chart-note>span:last-child').textContent='Escala continua fija para el año elegido. Filtrar no cambia los colores. Los cambios mayores se dibujan encima.';
  if(!items.length)app.toast('El grupo está vacío; los puntos grises conservan el contexto geográfico.');
}
