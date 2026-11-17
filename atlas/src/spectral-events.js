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
const eventTime = (start,end,{includeYear=true}={}) => {
  const from = parseHour(start), to = parseHour(end);
  const crossesYear = from.getUTCFullYear() !== to.getUTCFullYear();
  const fromDate = (includeYear || crossesYear ? labels.date : labels.day).format(from);
  const fromTime = labels.time.format(from);
  const toTime = labels.time.format(to);
  if(sameDay(from,to))return `${fromDate} · ${fromTime}–${toTime}`;
  const toDate = (crossesYear ? labels.date : labels.day).format(to);
  return `${fromDate} · ${fromTime} → ${toDate} ${toTime}`;
};
const number = value => value === null ? 'Sin registro' : labels.count.format(value);
const spectralNumber = new Intl.NumberFormat('es-PE',{minimumFractionDigits:4,maximumFractionDigits:4}).format;
const signedCount = new Intl.NumberFormat('es-PE',{maximumFractionDigits:1,signDisplay:'exceptZero'}).format;
const changeColor = d3.scaleDiverging([-1,0,1],t=>t<.5?d3.interpolateRgb('#146b91','#f8f8f4')(2*t):d3.interpolateRgb('#f8f8f4','#ba542c')(2*t-1)).clamp(true);
function hourChange(station,hour){
  const observed = station.observed[hour], typical = station.typical[hour];
  return observed==null||typical==null ? null : observed-typical;
}
const deltaLabel = value => (value>0?'+':'') + number(value*100) + ' %';
const shortName = station => station.name.replace(/\s+\(.*/,'');
export function createSpectralEvents({flows,syncURL,dataURL,onModeChange}){
  const file = name => new URL(name + '.json?v=episode-deviation1',dataURL);
  const buttons = document.querySelectorAll('[data-analysis]');
  const panel = document.querySelector('#spectral-timeline');
  const navigation = document.querySelector('#spectral-navigation');
  const calendar = navigation.querySelector('#spectral-calendar');
  const intensityKey = navigation.querySelector('.spectral-intensity-key');
  const episodes = panel.querySelector('#spectral-episodes');
  const episodeHeading = episodes.querySelector('.spectral-episodes-heading');
  const episodeMonth = episodes.querySelector('#spectral-episode-month');
  const episodeOrder = episodes.querySelector('#spectral-episode-order');
  const eventList = episodes.querySelector('ol');
  const episodePrompt = episodes.querySelector('p');
  const detailPanel = document.querySelector('#spectral-detail-panel');
  const detail = detailPanel.querySelector('#spectral-detail');
  const subject = detail.querySelector('.spectral-chart-subject');
  const legend = detail.querySelector('.spectral-series-key');
  const frame = detail.querySelector('.spectral-chart-frame');
  const chart = frame.querySelector('.spectral-chart');
  const status = frame.querySelector('.spectral-chart-status');
  const reading = detail.querySelector('.spectral-hour-reading');
  const driver = detail.querySelector('.spectral-hour-driver');
  const complexes = detailPanel.querySelector('#spectral-complexes');
  const complexHeading = complexes.querySelector('h3');
  const complexToggle = complexes.querySelector('.spectral-complexes-toggle');
  const complexSeries = d3.select(complexes.querySelector('#spectral-complex-series'));
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
  let pinnedHour, showAllComplexes = false;
  let serial = 0, pending = false, message = '', maximumChange = 1;

  function radiusForChange(difference){
    const minRadius = 2.5, maxRadius = 12;
    // Scale the area above the minimum used to keep every complex selectable.
    return Math.sqrt(minRadius**2 + (maxRadius**2-minRadius**2)*difference/maximumChange);
  }

  function pointRadius(station){
    return station.event ? radiusForChange(Math.abs(hourChange(station.event,inspectedHour)??0)) : 1.4;
  }

  function drawSizeKey(){
    const middle = d3.least(d3.ticks(0,maximumChange,4).filter(value=>value>0&&value<maximumChange),
      value=>Math.abs(value-maximumChange/2))??maximumChange/2;
    const samples = d3.select(scene.key.querySelector('.spectral-size-samples'))
      .selectAll('li').data([0,middle,maximumChange]).join(enter=>{
        const sample = enter.append('li');
        sample.append('svg').attr('width',28).attr('height',28).attr('aria-hidden','true')
          .append('circle').attr('cx',14).attr('cy',14);
        sample.append('span');
        return sample;
      });
    samples.select('circle').attr('r',radiusForChange);
    samples.select('span').text(number);
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
    scene = {svg,key,
      points:layer.append('g').attr('class','spectral-nodes'),position,scale,cancelDrawing,
      role:svg.attr('role'),label:svg.attr('aria-label')};
    drawScene();
  }

  function drawScene(){
    const visible = !!episode;
    document.body.classList.toggle('spectral-episode-active',visible);
    header.hidden = !visible;
    summarySubject.textContent = visible
      ? selected ? shortName(stations.get(selected)) : `${episode.complexes} complejos del episodio`
      : '';
    period.textContent = visible ? `Episodio · ${eventTime(episode.start,episode.end)}` : '';
    period.title = period.textContent;
    summaryHour.textContent = summaryHour.title = '';
    if(!scene){
      drawDetail();
      return;
    }
    scene.key.hidden = !record||pending||!!message;
    if(!scene.key.hidden)drawSizeKey();
    scene.points.attr('display',visible?null:'none');
    scene.svg.attr('role',visible?'group':scene.role)
      .attr('aria-label',visible?'Complejos del episodio':calendarOpen?'Red de referencia del metro':scene.label);
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
      selectComplex(d.id);
    })
      .on('keydown',(event,d)=>{
        if(d.event&&['Enter',' '].includes(event.key)){event.preventDefault();selectComplex(d.id);}
      })
      .on('pointerenter',tooltip).on('pointerleave',hideTooltip)
      .on('focus',function(_,d){const box=this.getBoundingClientRect();tooltip({clientX:box.right,clientY:box.top},d);})
      .on('blur',hideTooltip);
  }

  function drawCalendar(){
    if(!catalog)return;
    const peaks = Object.values(catalog.months)
      .filter(events=>events.length)
      .map(events=>d3.max(events,event=>event.strength));
    const intensity = d3.scaleSequential(d3.interpolateRgb('#d2e5e8','#176982')).domain(d3.extent(peaks));
    intensityKey.hidden = !peaks.length;
    const headings = months.map(month=>
      `<th scope="col" title="${month}"><span class="month-initial">${month[0]}</span><span class="month-abbreviation">${month}</span></th>`
    ).join('');
    const rows = catalog.meta.years.map(year=>{
      const cells = months.map((_,index)=>{
        const key = year+'-'+String(index+1).padStart(2,'0');
        const events = catalog.months[key]??[];
        const label = labels.month.format(parseMonth(key));
        const peak = d3.max(events,event=>event.strength);
        const title = peak===undefined ? `${label} · Sin episodios destacados`
          : `${label} · Señal máxima ${spectralNumber(peak)} · ${events.length} episodios destacados`;
        const appearance = peak===undefined ? ' disabled' : ` style="--cell:${intensity(peak)}"`;
        return `<td><button type="button" data-spectral-month="${key}" aria-label="${title}" title="${title}"
          aria-pressed="${key===activeMonth}"${appearance}></button></td>`;
      }).join('');
      return `<tr><th scope="row">${year}</th>${cells}</tr>`;
    }).join('');
    calendar.innerHTML = `<table class="spectral-calendar" aria-labelledby="spectral-navigation-heading">
      <thead><tr><td></td>${headings}</tr></thead><tbody>${rows}</tbody>
    </table>`;
  }

  function drawEpisodes(){
    if(!catalog)return;
    episodeHeading.hidden = eventList.hidden = !activeMonth;
    episodePrompt.hidden = !!activeMonth;
    if(activeMonth)episodeMonth.textContent = labels.month.format(parseMonth(activeMonth));
    const events = [...(catalog.months[activeMonth]??[])];
    const byDate = (a,b) => a.start.localeCompare(b.start);
    const order = episodeOrder.querySelector('input:checked').value;
    events.sort(order==='strength'
      ? (a,b) => b.strength-a.strength || byDate(a,b)
      : byDate);
    eventList.innerHTML = events.map(event=>
      `<li><button type="button" data-spectral-event="${event.id}" aria-pressed="${episode?.id===event.id}">
        <strong>${eventTime(event.start,event.end,{includeYear:false})}</strong>
        <span class="spectral-episode-facts">
          <span>${event.hours} h · ${event.complexes} complejos</span>
          <span class="spectral-episode-strength">Señal ${spectralNumber(event.strength)}</span>
        </span>
      </button></li>`
    ).join('');
  }

  function drawDetail(){
    const empty = !episode||!record||pending||!!message;
    for(const element of [subject,legend,chart,reading,complexes])element.toggleAttribute('hidden',empty);
    status.hidden = !empty;
    frame.classList.toggle('is-empty',empty);
    driver.hidden = true;
    if(empty){
      d3.select(chart).selectAll('*').remove();
      complexSeries.selectAll('*').remove();
      status.textContent = message||(pending?'Cargando episodio…':'Selecciona un episodio para ver sus entradas.');
      return;
    }
    subject.textContent = `Total del episodio · ${record.stations.length} complejos`;
    drawCharts();
  }

  function drawCharts(){
    const dates = record.observed.map((_,i)=>new Date(timeOrigin + (record.start+i)*3600000));
    const hours = d3.range(...record.window);
    const ranked = record.stations.map(station=>({
      station,
      name: shortName(stations.get(station.id)),
      change: d3.max(hours,hour=>Math.abs(hourChange(station,hour)??0))??0
    })).sort((a,b)=>b.change-a.change || a.name.localeCompare(b.name,'es'));
    const visible = showAllComplexes ? ranked : ranked.filter(({station},i)=>i<3||station.id===selected);
    complexHeading.textContent = showAllComplexes ? 'Complejos del episodio' : 'Complejos con mayor cambio';
    complexToggle.hidden = ranked.length<=3;
    complexToggle.textContent = showAllComplexes ? 'Ver principales' : `Ver los ${ranked.length}`;
    complexToggle.setAttribute('aria-pressed',String(showAllComplexes));
    const cards = complexSeries.selectAll('.spectral-complex').data(visible,({station})=>station.id).join(enter=>{
      const card = enter.append('article').attr('class','spectral-complex');
      card.append('button').attr('type','button').attr('class','spectral-complex-name');
      card.append('svg').attr('class','spectral-chart').attr('role','img').attr('tabindex',0);
      card.append('p').attr('class','spectral-complex-reading');
      return card;
    }).classed('is-selected',({station})=>station.id===selected);
    cards.select('button').text(({name})=>name)
      .attr('aria-pressed',({station})=>String(station.id===selected))
      .on('click',(_, {station})=>selectComplex(station.id));
    cards.select('svg').attr('aria-label',({name})=>
      `Entradas por hora de ${name}. Pulsa en la gráfica o usa las flechas para fijar una hora.`);
    const stationMaximum = d3.max(ranked,({station})=>Math.max(d3.max(station.observed)??0,d3.max(station.typical)??0));
    const updateAggregate = drawChart(chart,record,dates,null,inspect);
    const updateComplexes = [];
    cards.each(function({station}){
      const plot = drawChart(this.querySelector('svg'),station,dates,stationMaximum,inspect);
      const value = this.querySelector('p');
      updateComplexes.push(hour=>{
        plot(hour);
        const observed = station.observed[hour], typical = station.typical[hour];
        const difference = hourChange(station,hour);
        value.textContent = `${number(observed)} obs. / ${number(typical)} hab.`;
        if(difference!==null)value.textContent += ` · ${signedCount(difference)}`;
      });
    });

    let currentHour;
    function inspect(hour){
      if(currentHour===hour)return;
      currentHour = inspectedHour = hour;
      const date = dates[hour];
      const time = `${labels.day.format(date)} · ${labels.time.format(date)}`;
      paintHour(date);
      updateAggregate(hour);
      updateComplexes.forEach(update=>update(hour));
      const difference = hourChange(record,hour);
      reading.textContent = `${time} · ${number(record.observed[hour])} obs. / ${number(record.typical[hour])} hab.`;
      if(difference!==null)reading.textContent += ` · Cambio ${signedCount(difference)}`;
      const selectedStation = record.stations.find(station=>station.id===selected);
      const summaryChange = selectedStation ? hourChange(selectedStation,hour) : difference;
      summaryHour.textContent = `${time} · ${summaryChange===null
        ? 'Sin comparación' : `${signedCount(summaryChange)} entradas frente a lo habitual`}`;
      summaryHour.title = summaryHour.textContent;
      updateLargestChange(hour,difference);
    }
    inspect(pinnedHour);
  }

  function updateLargestChange(hour,difference){
    driver.hidden = true;
    if(selected||difference===null)return;
    const largest = d3.greatest(record.stations,station=>Math.abs(hourChange(station,hour)??0));
    const change = hourChange(largest,hour);
    if(!change)return;
    const name = shortName(stations.get(largest.id));
    const typical = largest.typical[hour];
    const percent = typical ? ' (' + deltaLabel(change/typical) + ')' : '';
    driver.innerHTML = `<span>Mayor diferencia a esta hora</span>
      <strong>${esc(name)}</strong>
      <span class="${change<0?'spectral-decrease':'spectral-increase'}">${signedCount(change)} entradas${percent} ↗</span>`;
    driver.onclick = () => {
      selectComplex(largest.id);
      chart.focus({preventScroll:true});
    };
    driver.hidden = false;
  }

  function drawChart(svg,series,dates,maximum,inspect){
    const plot = d3.select(svg);
    plot.selectAll('*').remove();
    const W = svg.clientWidth || 200, H = svg.clientHeight;
    const m = {left:43,right:14,top:15,bottom:25};
    const n = dates.length;
    const values = [series.observed,series.typical];
    const x = d3.scaleUtc().domain([dates[0],dates[n-1]]).range([m.left,W-m.right]);
    const y = d3.scaleLinear().domain([0,(maximum??d3.max(values.flat()))||1]).nice(3).range([H-m.bottom,m.top]);
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
    function hourAtPointer(event){
      const [pointer] = d3.pointer(event,svg);
      const hour = Math.round((+x.invert(pointer)-dates[0])/3600000);
      return Math.max(0,Math.min(n-1,hour));
    }
    plot.on('pointermove',event=>{
      if(event.pointerType!=='touch')inspect(hourAtPointer(event));
    }).on('pointerleave pointercancel',()=>{
      inspect(pinnedHour);
    }).on('click',event=>{
      pinnedHour = hourAtPointer(event);
      inspect(pinnedHour);
    }).on('keydown',event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      const direction = event.key==='ArrowLeft' ? -1 : 1;
      pinnedHour = Math.max(0,Math.min(n-1,pinnedHour+direction));
      inspect(pinnedHour);
    });
    return hour=>{
      const position = x(dates[hour]);
      marker.attr('x1',position).attr('x2',position);
    };
  }

  function refreshSelection(){
    drawScene();
    syncURL();
  }

  function selectComplex(id){
    const hadFocus = document.activeElement?.dataset.complex === id;
    selected = selected===id ? null : id;
    refreshSelection();
    if(hadFocus)scene.points.select(`[data-complex="${id}"]`).node()?.focus({preventScroll:true});
  }

  async function selectEpisode(event,complex=null){
    const ticket = ++serial;
    hideTooltip();
    episode = event;
    showAllComplexes = false;
    inspectedHour = pinnedHour = undefined;
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
      // Use a shared hour for all stations. Increases and decreases should not cancel out.
      inspectedHour = pinnedHour = d3.greatest(d3.range(...record.window),hour=>
        d3.sum(record.stations,station=>Math.abs(hourChange(station,hour)??0)))??record.window[0];
      maximumChange = d3.max(record.stations,station=>
        d3.max(station.observed,(_,hour)=>Math.abs(hourChange(station,hour)??0)))||1;
      if(record.stations.some(station=>station.id===complex))selected = complex;
    }catch(error){
      if(ticket!==serial)return;
      message = 'No se pudo cargar el episodio. Pulsa su fecha para reintentar.';
      console.error(error);
    }
    if(ticket!==serial)return;
    pending = false;
    refreshSelection();
  }

  function clearEpisode(refresh = refreshSelection){
    serial++;
    hideTooltip();
    episode=record=selected=null;
    inspectedHour = pinnedHour = undefined;
    pending=false;
    message='';
    drawEpisodes();
    refresh();
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
  complexToggle.addEventListener('click',()=>{
    showAllComplexes = !showAllComplexes;
    drawCharts();
  });
  episodeOrder.addEventListener('change',drawEpisodes);
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
    navigation.hidden = panel.hidden = detailPanel.hidden = !calendarOpen;
    document.body.classList.toggle('spectral-calendar-open',calendarOpen);
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.analysis===(calendarOpen?'events':'years')));
  }

  function showCalendar(open){
    if(calendarOpen===open)return;
    calendarOpen = open;
    updatePanel();
    if(open){
      hideTooltip();
      scene?.cancelDrawing();
      onModeChange();
      load();
    }else{
      restore = null;
      clearEpisode(onModeChange);
    }
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
    get calendarActive(){return calendarOpen;},
    clearComplex(){if(selected)selectComplex(null);}
  };
}
