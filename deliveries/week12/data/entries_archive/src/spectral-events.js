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
    : labels.date.format(a) + ' · ' + labels.time.format(a) + ' → ' + (a.getUTCFullYear()===b.getUTCFullYear()?labels.day:labels.date).format(b) + ' ' + labels.time.format(b);
};
const number = value => value === null ? 'Sin registro' : labels.count.format(value);
const signedCount = new Intl.NumberFormat('es-PE',{maximumFractionDigits:1,signDisplay:'exceptZero'}).format;
const changeColor = d3.scaleDiverging([-1,0,1],t=>t<.5?d3.interpolateRgb('#146b91','#f8f8f4')(2*t):d3.interpolateRgb('#f8f8f4','#ba542c')(2*t-1)).clamp(true);
function hourChange(station,hour){
  const observed = station.observed[hour], typical = station.typical[hour];
  return observed==null||typical==null ? null : observed-typical;
}
const deltaLabel = value => (value>0?'+':'') + number(value*100) + ' %';
const shortName = station => station.name.replace(/\s+\(.*/,'');
const file = name => 'data/spectral/' + name + '.json?v=events1';

export function createSpectralEvents({flows,syncURL}){
  const buttons = document.querySelectorAll('[data-analysis]');
  const panel = document.querySelector('#spectral-timeline');
  const calendar = panel.querySelector('#spectral-calendar');
  const eventList = panel.querySelector('#spectral-episodes');
  const detail = panel.querySelector('#spectral-detail');
  const subject = detail.querySelector('.spectral-chart-subject');
  const legend = detail.querySelector('.spectral-series-key');
  const frame = detail.querySelector('.spectral-chart-frame');
  const chart = frame.querySelector('.spectral-chart');
  const status = frame.querySelector('.spectral-chart-status');
  const reading = detail.querySelector('.spectral-hour-reading');
  const driver = detail.querySelector('.spectral-hour-driver');
  const scope = detail.querySelector('.spectral-detail-scope');
  const header = document.querySelector('#spectral-header');
  const summarySubject = header.querySelector('#spectral-subject');
  const period = header.querySelector('#spectral-period');
  const summaryHour = header.querySelector('#spectral-summary-hour');
  const close = header.querySelector('#close-spectral-episode');
  const monthCache = new Map();
  const stations = new Map(flows.nodes.map(node => [String(node.id),node]));
  const initial = new URLSearchParams(location.search);
  let calendarOpen = initial.get('analysis')==='events';
  let restore = calendarOpen ? {month:initial.get('month'),id:initial.get('event'),complex:initial.get('complex')} : null;
  let catalog, catalogRequest, activeMonth, episode, record, selected, timeOrigin, scene, inspectedHour;
  let serial = 0, pending = false, message = '', maximumChange = 1;

  function pointRadius(station){
    if(!station.event)return 1.4;
    const difference = Math.abs(hourChange(station.event,inspectedHour)??0);
    const minRadius = 2.5, maxRadius = 12;
    // Scale the area above the minimum used to keep every complex selectable.
    return Math.sqrt(minRadius**2 + (maxRadius**2-minRadius**2)*difference/maximumChange);
  }

  function writeURL(params){
    if(!calendarOpen)return;
    params.set('analysis','events');
    for(const [key,value] of [['month',activeMonth??restore?.month],
      ['event',episode?.id??restore?.id],['complex',selected??restore?.complex]]){
      if(value)params.set(key,value);
    }
  }

  function mount({stage,svg,layer,position,scale,cancelDrawing}){
    const key = document.querySelector('#spectral-key-template').content.firstElementChild.cloneNode(true);
    stage.querySelector('.map-viewport').append(key);
    const controls = stage.querySelectorAll(stage.querySelector('.flow-controls')
      ? '.flow-controls > *, .map-layer' : '.map-panel-controls');
    scene = {controls,svg,key,
      points:layer.append('g').attr('class','spectral-nodes'),position,scale,cancelDrawing,
      role:svg.attr('role'),label:svg.attr('aria-label')};
    updateMapControls();
    drawScene();
  }

  function updateMapControls(){
    if(!scene)return;
    for(const control of scene.controls)control.inert = calendarOpen;
  }

  function drawScene(){
    const visible = !!episode;
    document.body.classList.toggle('spectral-episode-active',visible);
    header.hidden = !visible;
    summarySubject.textContent = visible
      ? selected ? shortName(stations.get(selected)) : `${episode.complexes} complejos del episodio`
      : '';
    period.textContent = visible ? `Episodio · ${eventTime(episode.start,episode.end)}` : '';
    summaryHour.textContent = '';
    if(!scene){
      drawDetail();
      return;
    }
    scene.key.hidden = !visible;
    scene.points.attr('display',visible?null:'none');
    scene.svg.attr('role',visible?'group':scene.role)
      .attr('aria-label',visible?'Complejos del episodio':scene.label);
    if(visible){
      scene.key.querySelector('.spectral-map-hour').textContent = '';
      drawPoints();
    }else scene.points.selectAll('circle').remove();
    drawDetail();
  }

  function updateZoom(){
    if(episode&&scene)scene.points.selectAll('circle').attr('r',d=>pointRadius(d)/scene.scale());
  }

  function paintHour(date){
    if(!scene)return;
    scene.key.querySelector('.spectral-map-hour').textContent =
      labels.day.format(date) + ' · ' + labels.time.format(date);
    scene.points.selectAll('.spectral-node.is-involved')
      .attr('fill',station=>{
        const difference = hourChange(station.event,inspectedHour);
        const typical = station.event.typical[inspectedHour];
        if(difference===null)return '#c2cbcd';
        return changeColor(typical>0?difference/typical:Math.sign(difference));
      })
      .attr('aria-label',station=>{
        const difference = hourChange(station.event,inspectedHour);
        return shortName(station) + ' · ' +
          (difference===null?'sin comparación a esta hora':signedCount(difference)+' entradas a esta hora');
      });
    updateZoom();
  }

  function drawPoints(){
    const {points,position,scale} = scene;
    const involved = new Map((record?.stations??[]).map(station=>[station.id,station]));
    const data = [...stations.values()].map(station=>({...station,id:String(station.id),event:involved.get(String(station.id))}));
    const ordered = data.sort((a,b)=>Number(!!a.event)-Number(!!b.event)||Number(a.id===selected)-Number(b.id===selected));
    const marks = points.selectAll('circle').data(ordered,d=>d.id).join('circle')
      .attr('class','spectral-node').attr('data-complex',d=>d.id).classed('is-involved',d=>!!d.event).classed('is-selected',d=>d.id===selected)
      .attr('cx',d=>position(d)[0]).attr('cy',d=>position(d)[1])
      .attr('r',d=>pointRadius(d)/scale()).attr('vector-effect','non-scaling-stroke')
      .attr('fill','#8e9ea2')
      .attr('tabindex',d=>d.event?0:null).attr('role',d=>d.event?'button':null)
      .attr('aria-pressed',d=>d.event?String(d.id===selected):null)
      .attr('aria-hidden',d=>d.event?null:'true');
    const tooltip = (event,d) => {
      if(!d.event)return;
      const difference = hourChange(d.event,inspectedHour);
      const observed = d.event.observed[inspectedHour], typical = d.event.typical[inspectedHour];
      const reference = typical>0 ? ' · ' + deltaLabel(difference/typical) : '';
      const summary = difference===null ? 'Sin comparación a esta hora'
        : `${number(observed)} entradas · ${number(typical)} habituales<br>${signedCount(difference)} entradas${reference}`;
      showTooltip(`<strong>${esc(shortName(d))}</strong><br>${summary}`,event);
    };
    marks.on('click',(event,d)=>{
      if(!d.event)return;
      event.stopPropagation();
      selectComplex(d.id,true);
    })
      .on('keydown',(event,d)=>{
        if(d.event&&['Enter',' '].includes(event.key)){event.preventDefault();selectComplex(d.id,true);}
      })
      .on('pointerenter',tooltip).on('pointerleave',hideTooltip)
      .on('focus',function(_,d){const box=this.getBoundingClientRect();tooltip({clientX:box.right,clientY:box.top},d);})
      .on('blur',hideTooltip);
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
    const empty = !episode||!record||pending||!!message;
    for(const element of [subject,legend,chart,reading,scope])element.toggleAttribute('hidden',empty);
    status.hidden = !empty;
    frame.classList.toggle('is-empty',empty);
    driver.hidden = true;
    d3.select(chart).selectAll('*').remove();
    if(empty){
      status.textContent = message||(pending?'Cargando episodio…':'Selecciona un episodio para ver sus entradas.');
      return;
    }
    const station = record.stations.find(item=>item.id===selected);
    subject.textContent = station ? shortName(stations.get(station.id)) : 'Complejos del episodio';
    scope.textContent = station
      ? 'Pulsa el complejo de nuevo para ver el conjunto.'
      : 'Selecciona un complejo en el mapa para ver sus entradas.';
    drawChart(station??record);
  }

  function drawChart(chosen){
    const plot = d3.select(chart);
    const W = plot.node().clientWidth || 200, H = 156;
    const m = {left:W<240?34:43,right:14,top:15,bottom:25};
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
      if(currentHour===i)return;
      currentHour = inspectedHour = i;
      paintHour(dates[i]);
      const pos=x(dates[i]);
      marker.attr('x1',pos).attr('x2',pos);
      const observed = chosen.observed[i], typical = chosen.typical[i];
      const compared = observed!==null&&typical!==null;
      reading.textContent = `${labels.day.format(dates[i])} · ${labels.time.format(dates[i])} · ${number(observed)} obs. / ${number(typical)} hab.`;
      if(compared)reading.textContent += ` · Cambio ${signedCount(observed-typical)}`;
      summaryHour.textContent = `${labels.day.format(dates[i])} · ${labels.time.format(dates[i])} · ${compared
        ? `${signedCount(observed-typical)} entradas frente a lo habitual` : 'Sin comparación'}`;
      driver.hidden = true;
      if(selected||!compared)return;
      let largest;
      for(const station of record.stations){
        const difference = hourChange(station,i);
        if(difference===null||difference===0)continue;
        if(!largest||Math.abs(difference)>Math.abs(largest.difference)){
          largest = {id:station.id,difference,usual:station.typical[i]};
        }
      }
      if(!largest)return;
      const name = shortName(stations.get(largest.id));
      const percent = largest.usual ? ' (' + deltaLabel(largest.difference/largest.usual) + ')' : '';
      driver.innerHTML = `<span>Mayor diferencia a esta hora</span>
        <strong>${esc(name)}</strong>
        <span class="${largest.difference<0?'spectral-decrease':'spectral-increase'}">${signedCount(largest.difference)} entradas${percent} ↗</span>`;
      driver.onclick = () => {
        selectComplex(largest.id);
        chart.focus({preventScroll:true});
      };
      driver.hidden = false;
    }
    const peak = dates.findIndex(date=>date.getTime()===parseHour(episode.peak).getTime());
    inspect(inspectedHour??Math.max(0,peak));
    plot.on('pointermove',event=>{
      const [pointer] = d3.pointer(event,plot.node());
      const hour = Math.round((+x.invert(pointer)-dates[0])/3600000);
      inspect(Math.max(0,Math.min(n-1,hour)));
    }).on('keydown',event=>{
        if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();
        const direction = event.key==='ArrowLeft' ? -1 : 1;
        inspect(Math.max(0,Math.min(n-1,currentHour+direction)));
      });
  }

  function refreshSelection(){
    drawScene();
    syncURL();
  }

  function strongestHour(station){
    const hours = d3.range(...record.window)
      .filter(i=>hourChange(station,i)!==null);
    return d3.greatest(hours,i=>Math.abs(hourChange(station,i)));
  }

  function selectComplex(id,focusEpisode=false){
    const hadFocus = document.activeElement?.dataset.complex === id;
    selected = selected===id ? null : id;
    if(selected&&focusEpisode){
      inspectedHour = strongestHour(record.stations.find(station=>station.id===selected));
    }
    refreshSelection();
    if(hadFocus)scene.points.select(`[data-complex="${id}"]`).node()?.focus({preventScroll:true});
  }

  async function selectEpisode(event,complex=null){
    const ticket = ++serial;
    hideTooltip();
    episode = event;
    inspectedHour = undefined;
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
      maximumChange = d3.max(record.stations,station=>
        d3.max(station.observed,(_,hour)=>Math.abs(hourChange(station,hour)??0)))||1;
      const station = record.stations.find(station=>station.id===complex);
      if(station){
        selected = complex;
        inspectedHour = strongestHour(station);
      }
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
    hideTooltip();
    episode=record=selected=null;
    inspectedHour=undefined;
    pending=false;
    message='';
    drawEpisodes();
    refreshSelection();
  }

  calendar.addEventListener('click',event=>{
    const button = event.target.closest('[data-spectral-month]');
    if(!button)return;
    const month = button.dataset.spectralMonth;
    activeMonth = month===activeMonth ? null : month;
    clearEpisode();
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

  function load(){
    if(catalogRequest)return;
    calendar.textContent = 'Cargando calendario…';
    catalogRequest = d3.json(file('index')).then(value=>{
      catalog = value;
      timeOrigin = +parseHour(catalog.meta.origin);
      const saved = restore;
      restore = null;
      if(catalog.months[saved?.month]?.length)activeMonth = saved.month;
      drawCalendar();
      drawEpisodes();
      const savedEvent = catalog.months[activeMonth]?.find(event=>event.id===saved?.id);
      if(calendarOpen&&savedEvent)selectEpisode(savedEvent,saved.complex);
      else syncURL();
    }).catch(error=>{
      catalogRequest = null;
      catalog = null;
      calendar.innerHTML = '<p role="status">No se pudo abrir el calendario.</p><button type="button">Reintentar</button>';
      calendar.querySelector('button').onclick = load;
      console.error(error);
    });
  }

  function updatePanel(){
    panel.hidden = !calendarOpen;
    document.body.classList.toggle('spectral-calendar-open',calendarOpen);
    updateMapControls();
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.analysis===(calendarOpen?'events':'years')));
  }

  function showCalendar(open){
    if(calendarOpen===open)return;
    calendarOpen = open;
    updatePanel();
    if(open){
      hideTooltip();
      scene?.cancelDrawing();
      load();
    }
    else{
      restore = null;
      clearEpisode();
    }
    syncURL();
  }

  function closeEpisode(){
    if(!episode)return false;
    const id = episode.id;
    clearEpisode();
    eventList.querySelector(`[data-spectral-event="${id}"]`)?.focus({preventScroll:true});
    return true;
  }

  close.addEventListener('click',closeEpisode);
  for(const button of buttons)button.addEventListener('click',()=>showCalendar(button.dataset.analysis==='events'));
  updatePanel();
  if(calendarOpen)load();

  return {
    mount, updateZoom, writeURL, closeEpisode,
    get episodeActive(){return !!episode;},
    clearComplex(){if(selected)selectComplex(null);}
  };
}
