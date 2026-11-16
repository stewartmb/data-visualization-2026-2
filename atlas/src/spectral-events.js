import {esc,hideTooltip,showTooltip} from './model.js?v=20261028-4';

const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const compactCount = new Intl.NumberFormat('es-PE',{notation:'compact'});
const labels = {
  date: new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}),
  day: new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'short',timeZone:'UTC'}),
  month: new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}),
  time: new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}),
  count: new Intl.NumberFormat('es-PE',{maximumFractionDigits:1})
};
const parseHour = hour => new Date(hour + ':00:00Z');
const parseMonth = month => new Date(month + '-01T00:00:00Z');
const sameDay = (a,b) => a.toISOString().slice(0,10) === b.toISOString().slice(0,10);
const eventTime = (start,end) => {
  const a = parseHour(start), b = parseHour(end);
  return sameDay(a,b)
    ? labels.date.format(a) + ' · ' + labels.time.format(a) + '–' + labels.time.format(b)
    : labels.day.format(a) + ' ' + labels.time.format(a) + ' → ' + labels.day.format(b) + ' ' + labels.time.format(b);
};
const number = value => value === null ? 'Sin registro' : labels.count.format(value);
const changeColor = d3.scaleDiverging([-1,0,1],t=>t<.5?d3.interpolateRgb('#146b91','#f8f8f4')(2*t):d3.interpolateRgb('#f8f8f4','#ba542c')(2*t-1)).clamp(true);
const change = station => station.expected ? (station.entries-station.expected)/station.expected : 0;
const deltaLabel = value => (value>0?'+':'') + number(value*100) + ' %';
const shortName = station => station.name.replace(/\s+\(.*/,'');
const file = name => 'data/spectral/' + name + '.json?v=events1';

export function createSpectralEvents({geo,flows,onFlows}){
  const buttons = document.querySelectorAll('[data-analysis]');
  const panel = document.querySelector('#spectral-workspace');
  const calendar = panel.querySelector('#spectral-calendar');
  const eventList = panel.querySelector('#spectral-episodes');
  const detail = panel.querySelector('#spectral-detail');
  const caption = panel.querySelector('#spectral-map-caption');
  const viewport = panel.querySelector('.spectral-map');
  const svg = d3.select(viewport.querySelector('svg'));
  const monthCache = new Map();
  const stations = new Map(flows.nodes.map(node => [String(node.id),node]));
  let active = false, catalog, catalogRequest, activeMonth, episode, record, selected, timeOrigin;
  let serial = 0, pending = false, message = '', points, projection, camera = d3.zoomIdentity;
  const initial = new URLSearchParams(location.search);
  const zoom = d3.zoom().scaleExtent([1,30]).on('zoom',event => {
    camera = event.transform;
    svg.select('.spectral-map-layer').attr('transform',camera);
    svg.selectAll('.spectral-node').attr('r',s => pointRadius(s)/camera.k);
  });
  const pointRadius = station => (station.id === selected ? 7.5 : station.event ? 5 : 1.4);
  const resetMap = panel.querySelector('#spectral-center');
  resetMap.addEventListener('click',()=>svg.call(zoom.transform,d3.zoomIdentity));

  function syncURL(){
    const url = new URL(location.href);
    url.searchParams.set('analysis','events');
    for(const [key,value] of [['month',activeMonth],['event',episode?.id],['complex',selected]]){
      if(value)url.searchParams.set(key,value);
      else url.searchParams.delete(key);
    }
    history.replaceState(null,'',url);
  }

  function drawMap(){
    const {width,height} = svg.node().getBoundingClientRect();
    if(!active||width<40||height<40)return;
    svg.attr('viewBox',`0 0 ${width} ${height}`).selectAll('*').remove();
    const boroughs = geo.features.filter(feature => feature.properties.name !== 'Staten Island');
    const area = {type:'FeatureCollection',features:boroughs};
    projection = d3.geoMercator().fitExtent([[16,20],[width-16,height-18]],area);
    const flat = d3.geoTransform({point(lon,lat){this.stream.point(...projection([lon,lat]));}});
    const path = d3.geoPath(flat);
    const layer = svg.append('g').attr('class','spectral-map-layer');
    layer.selectAll('.map-bg').data(boroughs).join('path').attr('class','map-bg')
      .attr('fill-rule','evenodd').attr('vector-effect','non-scaling-stroke').attr('d',path);
    const rail = d3.line().x(coord=>projection(coord)[0]).y(coord=>projection(coord)[1]);
    layer.append('g').attr('class','spectral-rails').attr('aria-hidden','true').selectAll('path')
      .data(flows.links.filter(link=>link.kind==='rail')).join('path')
      .attr('d',link=>rail(link.coords)).attr('vector-effect','non-scaling-stroke');
    layer.append('g').attr('aria-hidden','true').selectAll('text')
      .data([['Manhattan',width<550?-73.995:-74.062,40.81],['Brooklyn',-73.965,40.637],['Queens',-73.765,40.728],['Bronx',-73.848,40.859]])
      .join('text').attr('class','borough-name').attr('text-anchor','middle')
      .attr('x',d=>projection([d[1],d[2]])[0]).attr('y',d=>projection([d[1],d[2]])[1]).text(d=>d[0]);
    points = layer.append('g').attr('class','spectral-nodes');
    svg.call(zoom.translateExtent([[-width/3,-height/3],[width*4/3,height*4/3]])).call(zoom.transform,camera);
    drawPoints();
  }

  function drawPoints(){
    if(!points)return;
    const involved = new Map((record?.stations??[]).map(station=>[station.id,station]));
    const data = [...stations.values()].map(station=>({...station,id:String(station.id),event:involved.get(String(station.id))}));
    const ordered = data.sort((a,b)=>Number(!!a.event)-Number(!!b.event)||Number(a.id===selected)-Number(b.id===selected));
    const marks = points.selectAll('circle').data(ordered,d=>d.id).join('circle')
      .attr('class','spectral-node').attr('data-complex',d=>d.id).classed('is-involved',d=>!!d.event).classed('is-selected',d=>d.id===selected)
      .attr('cx',d=>projection([d.lon,d.lat])[0]).attr('cy',d=>projection([d.lon,d.lat])[1])
      .attr('r',d=>pointRadius(d)/camera.k).attr('vector-effect','non-scaling-stroke')
      .attr('fill',d=>d.event?changeColor(change(d.event)):'#8e9ea2')
      .attr('tabindex',d=>d.event?0:null).attr('role',d=>d.event?'button':null)
      .attr('aria-pressed',d=>d.event?String(d.id===selected):null)
      .attr('aria-label',d=>d.event?`${shortName(d)} · ${deltaLabel(change(d.event))}`:null)
      .attr('aria-hidden',d=>d.event?null:'true');
    const tooltip = (event,d) => {
      if(!d.event)return;
      showTooltip(`<strong>${esc(shortName(d))}</strong><br>${number(d.event.entries)} entradas · ${number(d.event.expected)} habituales<br>${deltaLabel(change(d.event))} en sus horas detectadas`,event);
    };
    marks.on('click',(_,d)=>{if(d.event)selectComplex(d.id);})
      .on('keydown',(event,d)=>{
        if(d.event&&['Enter',' '].includes(event.key)){event.preventDefault();selectComplex(d.id);}
      })
      .on('pointerenter',tooltip).on('pointerleave',hideTooltip)
      .on('focus',function(_,d){const box=this.getBoundingClientRect();tooltip({clientX:box.right,clientY:box.top},d);})
      .on('blur',hideTooltip);
    resetMap.hidden = false;
  }

  function drawCalendar(){
    if(!catalog)return;
    const maximum = d3.max(Object.values(catalog.months).flat(),event=>event.strength)||1;
    const intensity = d3.scaleSequentialSqrt(d3.interpolateRgb('#e6eef0','#176982')).domain([0,maximum]);
    const years = catalog.meta.years;
    calendar.innerHTML = `<table class="spectral-calendar"><thead><tr><td></td>${months.map(month=>
      `<th scope="col" title="${month}">${month.slice(0,1)}</th>`).join('')}</tr></thead><tbody>${years.map(year=>
      `<tr><th scope="row">${year}</th>${months.map((_,i)=>{
        const key = year+'-'+String(i+1).padStart(2,'0');
        const events = catalog.months[key]??[];
        const label = labels.month.format(parseMonth(key));
        const title = events.length?`${label} · ${events.length} episodios destacados`:`${label} · Sin episodios destacados`;
        return `<td><button type="button" data-spectral-month="${key}" aria-label="${title}" title="${title}"
          aria-pressed="${key===activeMonth}"${events.length?` style="--cell:${intensity(events[0].strength)}"`:' disabled'}></button></td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function drawEpisodes(){
    if(!catalog)return;
    const events = [...(catalog.months[activeMonth]??[])].sort((a,b)=>a.start.localeCompare(b.start));
    eventList.innerHTML = activeMonth
      ? `<h3>${labels.month.format(parseMonth(activeMonth))}</h3><ol>${events.map(event=>{
        const a = parseHour(event.start);
        return `<li><button type="button" data-spectral-event="${event.id}" aria-pressed="${episode?.id===event.id}">
          <strong>${labels.day.format(a)} · ${labels.time.format(a)}</strong>
          <span>${event.hours} h · ${event.complexes} complejos</span>
        </button></li>`;
      }).join('')}</ol>`
      : '<p>Elige un mes para ver sus episodios.</p>';
  }

  function drawDetail(){
    if(!episode||pending||message){
      caption.textContent = episode ? eventTime(episode.start,episode.end) : '';
      detail.innerHTML = `<p class="spectral-empty" role="status">${esc(message||(pending?'Cargando episodio…':'Selecciona un episodio para comparar las entradas observadas y habituales.'))}</p>`;
      return;
    }
    const station = record?.stations.find(item=>item.id===selected);
    const subject = station ? shortName(stations.get(station.id)) : 'Complejos del episodio';
    const chosen = station ?? record;
    caption.textContent = eventTime(episode.start,episode.end);
    detail.innerHTML = `<h3>${esc(subject)}</h3>
      <p class="spectral-detail-date">${esc(caption.textContent)} · ${episode.hours} h</p>
      <div class="spectral-series-key"><span>Observadas</span><span>Habituales</span></div>
      <svg class="spectral-chart" role="img" tabindex="0" aria-label="Entradas por hora antes, durante y después. Usa las flechas izquierda y derecha para recorrer las horas."></svg>
      <output class="spectral-hour-reading" aria-live="polite"></output>
      <p class="spectral-detail-scope">${station
        ? 'Pulsa el complejo de nuevo para ver el conjunto.'
        : `${episode.complexes} complejos. Selecciona uno en el mapa para ver sus entradas.`}</p>`;
    drawChart(chosen);
  }

  function drawChart(chosen){
    const plot = d3.select(detail.querySelector('.spectral-chart'));
    const reading = detail.querySelector('.spectral-hour-reading');
    const W = Math.max(224,plot.node().clientWidth), H = 156;
    const m = {left:43,right:14,top:15,bottom:25};
    const n = chosen.observed.length;
    const dates = Array.from({length:n},(_,i)=>new Date(timeOrigin + (record.start+i)*3600000));
    const values = [chosen.observed,chosen.typical];
    const x = d3.scaleUtc().domain([dates[0],dates[n-1]]).range([m.left,W-m.right]);
    const y = d3.scaleLinear().domain([0,d3.max(values.flat())||1]).nice(3).range([H-m.bottom,m.top]);
    plot.attr('viewBox',`0 0 ${W} ${H}`);
    const [first,last] = record.window;
    plot.append('rect').attr('class','spectral-event-band')
      .attr('x',x(dates[first])).attr('y',m.top)
      .attr('width',x(dates[Math.min(n-1,last)])-x(dates[first])).attr('height',H-m.bottom-m.top);
    const ticks = [...new Set([0,Math.floor((n-1)/2),n-1])].map(i=>dates[i]);
    plot.append('g').attr('class','chart-axis').attr('transform',`translate(0,${H-m.bottom})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(date=>labels.time.format(date)).tickSize(3));
    plot.append('g').attr('class','chart-axis').attr('transform',`translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(3).tickFormat(v=>compactCount.format(v)).tickSize(3));
    const line = d3.line().defined(value=>value!==null).x((_,i)=>x(dates[i])).y(y);
    plot.selectAll('.spectral-series').data(values).join('path')
      .attr('class',(_,i)=>i?'spectral-series is-typical':'spectral-series').attr('d',line);
    const marker = plot.append('line').attr('class','spectral-chart-marker').attr('y1',m.top).attr('y2',H-m.bottom);
    let currentHour;
    function inspect(i){
      currentHour = i;
      const pos=x(dates[i]);
      marker.attr('x1',pos).attr('x2',pos);
      reading.textContent = `${labels.day.format(dates[i])} · ${labels.time.format(dates[i])} · ${number(chosen.observed[i])} obs. / ${number(chosen.typical[i])} hab.`;
    }
    const peak = dates.findIndex(date=>date.getTime()===parseHour(episode.peak).getTime());
    inspect(Math.max(0,peak));
    plot.on('pointermove',event=>{
      const [pointer] = d3.pointer(event,plot.node());
      const hour = Math.round((+x.invert(pointer)-dates[0])/3600000);
      inspect(Math.max(0,Math.min(n-1,hour)));
    }).on('pointerleave',()=>inspect(Math.max(0,peak)))
      .on('keydown',event=>{
        if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();
        const direction = event.key==='ArrowLeft' ? -1 : 1;
        inspect(Math.max(0,Math.min(n-1,currentHour+direction)));
      });
  }

  function refreshSelection(){
    if(!active)return;
    drawPoints();
    drawDetail();
    syncURL();
  }

  function selectComplex(id){
    const hadFocus = document.activeElement?.dataset.complex === id;
    selected = selected===id ? null : id;
    refreshSelection();
    if(hadFocus)points.select(`[data-complex="${id}"]`).node()?.focus({preventScroll:true});
  }

  async function selectEpisode(event,complex=null){
    const ticket = ++serial;
    episode = event;
    selected = null;
    record = null;
    pending = true;
    message = '';
    drawEpisodes();
    refreshSelection();
    try{
      const month = event.id.slice(0,7);
      if(!monthCache.has(month)){
        monthCache.set(month,d3.json(file(month)).catch(error=>{monthCache.delete(month);throw error;}));
      }
      const monthData = await monthCache.get(month);
      if(ticket!==serial)return;
      record = monthData?.[event.id];
      if(!record?.stations?.length)throw Error('Faltan los datos del episodio.');
      if(record.stations.some(station=>station.id===complex))selected=complex;
    }catch(error){
      if(ticket!==serial)return;
      message = 'No se pudo cargar el episodio. Pulsa su fecha para reintentar.';
      console.error(error);
    }
    if(ticket!==serial)return;
    pending = false;
    refreshSelection();
  }

  function clearEpisode(){
    serial++;
    episode=record=selected=null;
    pending=false;
    message='';
    drawEpisodes();
    refreshSelection();
  }

  calendar.addEventListener('click',event=>{
    const button = event.target.closest('[data-spectral-month]');
    if(!button)return;
    const month = button.dataset.spectralMonth;
    if(month===activeMonth){
      activeMonth=null;
      clearEpisode();
    }else{
      activeMonth = month;
      selectEpisode(catalog.months[month][0]);
    }
    calendar.querySelectorAll('[data-spectral-month]').forEach(item=>{
      item.setAttribute('aria-pressed',String(item.dataset.spectralMonth===activeMonth));
    });
  });
  eventList.addEventListener('click',event=>{
    const button = event.target.closest('[data-spectral-event]');
    if(!button)return;
    const chosen = catalog.months[activeMonth].find(item=>item.id===button.dataset.spectralEvent);
    if(episode?.id===chosen.id&&!message)clearEpisode();
    else selectEpisode(chosen);
    eventList.querySelector(`[data-spectral-event="${chosen.id}"]`)?.focus({preventScroll:true});
  });

  async function load(){
    if(catalog){drawMap();drawDetail();syncURL();return;}
    calendar.textContent = 'Cargando calendario…';
    catalogRequest ??= d3.json(file('index'));
    try{
      catalog = await catalogRequest;
      timeOrigin = +parseHour(catalog.meta.origin);
      drawCalendar();
      drawEpisodes();
      if(!active)return;
      drawMap();
      const month = initial.get('month');
      if(catalog.months[month]?.length){
        activeMonth = month;
        const id = initial.get('event');
        drawCalendar();
        selectEpisode(catalog.months[month].find(item=>item.id===id)??catalog.months[month][0],initial.get('complex'));
      }else{
        drawDetail();
        syncURL();
      }
    }catch(error){
      catalogRequest = null;
      catalog = null;
      calendar.innerHTML = '<p role="status">No se pudo abrir el calendario.</p><button type="button">Reintentar</button>';
      calendar.querySelector('button').onclick = load;
      console.error(error);
    }
  }

  function show(events){
    if(events===active)return;
    active=events;
    hideTooltip();
    document.body.classList.toggle('spectral-mode',events);
    panel.hidden=!events;
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.analysis===(events?'events':'flows')));
    if(events){syncURL();load();}
    else onFlows();
  }
  for(const button of buttons)button.addEventListener('click',()=>show(button.dataset.analysis==='events'));
  new ResizeObserver(()=>drawMap()).observe(viewport);
  return {show,get active(){return active;}};
}
