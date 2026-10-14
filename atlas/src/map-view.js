import {state,esc,fmt,signed,profile,metricValue,metricColor,showTooltip,hideTooltip,heading,stats} from './model.js?v=20261014-7';
let transform=d3.zoomIdentity;
const names={change:'Cambio de forma · distancia TV (pp)',deltaAM:'Cambio del peso AM · puntos porcentuales',deltaWeekend:'Cambio del peso de fin de semana · puntos porcentuales',recovery:'Índice de volumen · 2020 = 100 %'};

export function renderMap(host,app,items){
  const rangeLimit=Math.max(Math.ceil(d3.max(app.data.stations.filter(s=>profile(s)),s=>metricValue(s,'change'))||1),state.tvMin,state.tvMax<100?state.tvMax:0),upper=Math.min(state.tvMax,rangeLimit);

  host.innerHTML=heading('02 / SITUAR EL CAMBIO','El ritmo también tiene geografía.','Localiza los patrones del atlas. Una estación puede recuperar volumen y, aun así, distribuir sus entradas en horarios distintos.','T2 · T3 · T4')+`
  <div class="toolbar"><label>Color<select id="map-metric">${Object.entries(names).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><span class="spacer" style="font-size:10px;color:var(--muted)">Clic: investigar · rueda: acercar · arrastrar: mover</span></div>
  ${state.mapMetric==='change'?`<div class="map-emphasis"><b>Filtrar distancia TV</b><label for="map-min-tv">Desde <output id="map-min-output">${fmt(state.tvMin)} pp</output><input id="map-min-tv" type="range" min="0" max="${rangeLimit}" step="0.5" value="${Math.min(state.tvMin,rangeLimit)}" aria-label="Distancia TV mínima"></label><label for="map-max-tv">Hasta <output id="map-max-output">${fmt(upper)} pp</output><input id="map-max-tv" type="range" min="0" max="${rangeLimit}" step="0.5" value="${upper}" aria-label="Distancia TV máxima"></label><button id="map-range-reset" class="text-button">Quitar filtro TV</button><span>${items.length} estaciones en el grupo</span><small>Se aplica al soltar la barra. Solo se muestran estaciones dentro del rango; el filtro se conserva en las otras vistas.</small></div>`:''}
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
  g.selectAll('.context-point').data(app.data.stations.filter(s=>!ids.has(s.id)&&profile(s)&&metricValue(s,'change')>=state.tvMin&&metricValue(s,'change')<=state.tvMax)).join('circle').attr('class','context-point').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',1.6).attr('fill','#b8c7c1').attr('opacity',.45);
  const points=g.selectAll('.map-dot').data(items).join('circle').attr('class','map-dot').attr('vector-effect','non-scaling-stroke').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]).attr('r',4.1).attr('fill',s=>color(metricValue(s,state.mapMetric)))
    .on('pointerenter',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}<br><small>Clic para abrir huella y evidencia</small>`,e)).on('pointermove',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${esc(s.borough)}<br>${names[state.mapMetric]}: ${fmt(metricValue(s,state.mapMetric))}`,e)).on('pointerleave',hideTooltip).on('click',(e,s)=>{e.stopPropagation();e.shiftKey?app.pin(s.id):app.select(s.id);});
  // Draw larger changes last so low values cannot cover them in dense areas.
  points.sort((a,b)=>Math.abs(metricValue(a,state.mapMetric))-Math.abs(metricValue(b,state.mapMetric)));
  if(state.mapMetric==='change'){
    const lower=host.querySelector('#map-min-tv'),higher=host.querySelector('#map-max-tv');
    lower.oninput=()=>{if(+lower.value>+higher.value)higher.value=lower.value;preview();};
    higher.oninput=()=>{if(+higher.value<+lower.value)lower.value=higher.value;preview();};
    function preview(){host.querySelector('#map-min-output').textContent=`${fmt(+lower.value)} pp`;host.querySelector('#map-max-output').textContent=`${fmt(+higher.value)} pp`;}
    const apply=()=>app.set({tvMin:+lower.value,tvMax:+higher.value===rangeLimit?100:+higher.value});
    lower.onchange=apply;higher.onchange=apply;host.querySelector('#map-range-reset').onclick=()=>app.set({tvMin:0,tvMax:100});
  }
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
