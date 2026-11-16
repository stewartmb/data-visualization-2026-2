import {esc,fmt,signed,showTooltip,hideTooltip} from './model.js?v=20261028-4';
import {odPeriodLabel} from './od-period.mjs';
import {OD_CHANGE_COLORS,readGzip} from './od-encoding.mjs?v=annual-overview1';

const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fullMonth = new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'});
const monthName = key => fullMonth.format(new Date(key+'-01T00:00:00Z'));
const monthShort = key => months[+key.slice(5)-1]+' '+key.slice(0,4);
const clockTime = hour => String(hour).padStart(2,'0')+':00';
const signColor = delta => OD_CHANGE_COLORS[delta<0?'loss':delta>0?'gain':'neutral'];

export function createMonthlyOD({dataset,stations,syncURL}){
  const $ = id => document.getElementById(id);
  const tabs = $('od-analysis-tabs'), panel = $('monthly-od-panel');
  const calendar = $('monthly-od-calendar'), status = $('monthly-od-status');
  const detail = $('monthly-od-detail'), weekday = $('monthly-od-day'), slider = $('monthly-od-hour');
  const highlights = $('monthly-od-highlights');
  const summary = $('monthly-od-summary');
  const mapStations = new Map(stations.map(station=>[station.id,station]));
  const params = new URLSearchParams(location.search);
  let active = params.get('analysis')==='months';
  let selectedMonth = params.get('month');
  let slot = params.has('monthlySlot') ? +params.get('monthlySlot') : null;
  if(!Number.isInteger(slot)||slot<0||slot>=168)slot=null;
  let selectedId = null, catalog, catalogRequest, comparison, scene;
  let marker, hourScale, request = 0;
  const cache = new Map();
  const url = name => new URL('monthly-od/'+name+'?v=1',dataset.dataURL);
  summary.textContent='Cambios mensuales';

  function writeURL(output){
    if(!active)return;
    output.set('analysis','months');
    if(selectedMonth)output.set('month',selectedMonth);
    if(slot!==null)output.set('monthlySlot',slot);
  }

  function updateMode(){
    panel.hidden = summary.hidden = !active;
    document.body.classList.toggle('monthly-od-active',active);
    document.querySelector('.context-bar').inert = active;
    tabs.querySelectorAll('button').forEach(button=>{
      button.setAttribute('aria-pressed',String((button.dataset.odAnalysis==='months')===active));
    });
    if(scene){
      scene.key.hidden=!active;
      scene.points.attr('display',active?null:'none');
      scene.controls.forEach(control=>{control.inert=active;});
      scene.svg.attr('role',active?'group':scene.role)
        .attr('aria-label',active?'Cambio mensual de viajes iniciados por complejo':scene.label);
    }
  }

  function mount({svg,layer,position,scale,cancelDrawing}){
    const stage = svg.node().closest('.map-stage');
    const key = document.createElement('div');
    key.className = 'monthly-od-map-key';
    key.innerHTML = '<strong>Viajes iniciados por complejo</strong><br>Color: bajó o subió · Área: magnitud del cambio';
    stage.querySelector('.map-viewport').append(key);
    const controls = stage.querySelectorAll(stage.querySelector('.flow-controls')
      ? '.flow-controls > *, .map-layer' : '.map-panel-controls');
    scene = {svg,points:layer.append('g').attr('class','monthly-nodes'),position,scale,cancelDrawing,key,controls,
      role:svg.attr('role'),label:svg.attr('aria-label')};
    updateMode();
    if(active&&comparison)drawMap();
  }

  function drawCalendar(){
    const extent = d3.max(Object.values(catalog.months),item=>Math.abs(item.delta??0))||1;
    const color = d3.scaleLinear().domain([-extent,0,extent]).range(['#176c91','#ebefee','#b6532c']).clamp(true);
    calendar.innerHTML = `<table class="monthly-calendar" aria-label="Mayor cambio neto por mes"><thead><tr>
      <td class="monthly-year-header"></td>${months.map(name=>`<th scope="col">${name.slice(0,1)}</th>`).join('')}
      </tr></thead><tbody>${catalog.years.map(year=>`<tr><th scope="row">${year}</th>${months.map((_,i)=>{
        const key = `${year}-${String(i+1).padStart(2,'0')}`;
        const row = catalog.months[key];
        const available = Number.isInteger(row?.peak);
        const label = available
          ? `${monthName(key)} · ${odPeriodLabel(Math.floor(row.peak/24),row.peak%24)} · ${signed(row.delta)} viajes`
          : `${monthName(key)} · sin mes anterior`;
        const style = available ? ` style="--month-color:${color(row.delta)}"` : ' disabled';
        return `<td><button type="button" data-od-month="${key}" aria-pressed="false" aria-label="${esc(label)}" title="${esc(label)}"${style}></button></td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function readMonth(key){
    if(!cache.has(key)){
      cache.set(key,readGzip(url(key+'.f32.gz')).then(bytes=>{
        const numberOfValues = catalog.stations.length*168;
        if(bytes.byteLength!==numberOfValues*4)throw Error('El mes no coincide con el catálogo OD.');
        const values = new Float32Array(bytes);
        return catalog.stations.map((id,index)=>({
          id,values:values.subarray(index*168,(index+1)*168)
        }));
      }).catch(error=>{cache.delete(key);throw error;}));
    }
    return cache.get(key);
  }

  async function chooseMonth(key,initialSlot=null){
    const keys = Object.keys(catalog.months), index = keys.indexOf(key);
    const meta = catalog.months[key];
    if(index<=0||!Number.isInteger(meta?.peak))return;
    const base = keys[index-1], ticket = ++request;
    selectedMonth = key;
    slot = initialSlot ?? meta.peak;
    selectedId = null;
    comparison = null;
    hideTooltip();
    scene?.points.selectAll('*').remove();
    calendar.querySelectorAll('button').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.odMonth===key));
    });
    detail.hidden=true;
    summary.textContent=`${monthShort(base)} → ${monthShort(key)}`;
    status.textContent='Cargando el cambio mensual…';
    syncURL();
    try{
      const [a,b] = await Promise.all([readMonth(base),readMonth(key)]);
      if(ticket!==request)return;
      const common = [];
      const sumA = new Float64Array(168), sumB = new Float64Array(168);
      let max = 1;
      for(const [i,origin] of a.entries()){
        const station = mapStations.get(origin.id), va = origin.values, vb = b[i].values;
        if(!station||!va.some(Boolean)||!vb.some(Boolean))continue;
        common.push({station,a:va,b:vb});
        for(let k=0;k<168;k++){
          sumA[k]+=va[k];
          sumB[k]+=vb[k];
          max=Math.max(max,Math.abs(vb[k]-va[k]));
        }
      }
      comparison={base,key,common,sumA,sumB,max};
      drawHighlights();
      if(active)drawComparison();
    }catch(error){
      if(ticket!==request)return;
      status.textContent='No se pudieron cargar los meses.';
      const retry=document.createElement('button');
      retry.className='text-button';
      retry.type='button';
      retry.textContent='Reintentar';
      retry.onclick=()=>chooseMonth(key,slot);
      status.append(' ',retry);
      console.error(error);
    }
  }

  function load(){
    if(catalogRequest)return;
    status.textContent='Cargando meses OD…';
    catalogRequest = d3.json(url('index.json')).then(index=>{
      catalog=index;
      drawCalendar();
      const requested = catalog.months[selectedMonth];
      const key = Number.isInteger(requested?.peak)
        ? selectedMonth : Object.keys(catalog.months).at(-1);
      selectedMonth=key;
      if(active)return chooseMonth(key,slot);
    }).catch(error=>{
      catalogRequest=null;
      status.textContent='No se pudo abrir el calendario.';
      const retry=document.createElement('button');
      retry.className='text-button';
      retry.type='button';
      retry.textContent='Reintentar';
      retry.onclick=load;
      status.append(' ',retry);
      console.error(error);
    });
  }

  function changeMode(open){
    if(active===open)return;
    active=open;
    hideTooltip();
    updateMode();
    if(open){
      scene?.cancelDrawing();
      if(comparison)drawComparison();
      else if(catalog&&selectedMonth)chooseMonth(selectedMonth,slot);
      else load();
    }
    syncURL();
  }

  function setSlot(nextSlot){
    if(nextSlot===slot)return;
    const changedDay=Math.floor(nextSlot/24)!==Math.floor(slot/24);
    slot=nextSlot;
    if(changedDay)drawComparison();
    else drawReading();
    syncURL();
  }

  function setHour(hour){
    setSlot(Math.floor(slot/24)*24+hour);
  }

  function drawHighlights(){
    const {sumA,sumB}=comparison;
    const ranked=Array.from(sumB,(value,slot)=>({slot,delta:value-sumA[slot]}))
      .sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,6);
    highlights.replaceChildren(...ranked.map(({slot,delta})=>{
      const item=document.createElement('li');
      const button=document.createElement('button');
      button.type='button';
      button.dataset.monthlySlot=slot;
      button.title='Cambio en viajes iniciados en la red comparable';
      const period=document.createElement('strong');
      period.textContent=odPeriodLabel(Math.floor(slot/24),slot%24);
      const change=document.createElement('span');
      change.textContent=signed(delta);
      change.style.color=signColor(delta);
      change.setAttribute('aria-label',`${signed(delta)} viajes estimados`);
      button.append(period,change);
      button.onclick=()=>setSlot(slot);
      item.append(button);
      return item;
    }));
  }

  function activeSeries(){
    const row=comparison.common.find(item=>item.station.id===selectedId);
    return row??{a:comparison.sumA,b:comparison.sumB};
  }

  function drawComparison(){
    const {base,key,common}=comparison;
    status.textContent=`${common.length} complejos con datos en ambos meses. El color de cada mes indica el mayor cambio horario de la red.`;
    detail.hidden=false;
    $('monthly-od-base').textContent=monthShort(base);
    $('monthly-od-target').textContent=monthShort(key);
    $('monthly-od-subject').textContent=mapStations.get(selectedId)?.name??'Red comparable';
    weekday.value=Math.floor(slot/24);
    drawChart();
    drawReading();
  }

  function drawChart(){
    const plot=d3.select($('monthly-od-chart')).attr('viewBox','0 0 250 145');
    plot.selectAll('*').remove();
    const {a,b}=activeSeries(), start=Math.floor(slot/24)*24;
    const series=[a.slice(start,start+24),b.slice(start,start+24)];
    hourScale=d3.scaleLinear([0,23],[41,237]);
    const y=d3.scaleLinear([0,d3.max(series,values=>d3.max(values))||1],[117,8]).nice(3);
    const line=d3.line().x((_,h)=>hourScale(h)).y(y);
    plot.append('g').attr('class','chart-axis').attr('transform','translate(0,117)')
      .call(d3.axisBottom(hourScale).tickValues([0,6,12,18,23]).tickFormat(clockTime).tickSize(3));
    const tickFormat=new Intl.NumberFormat('es-PE',{notation:'compact'});
    plot.append('g').attr('class','chart-axis').attr('transform','translate(41,0)')
      .call(d3.axisLeft(y).ticks(3).tickFormat(v=>tickFormat.format(v)).tickSize(3));
    plot.selectAll('.monthly-series').data(series).join('path').attr('class','monthly-series')
      .attr('fill','none').attr('stroke',(_,i)=>i?'#176982':'#71848b')
      .attr('stroke-dasharray',(_,i)=>i?null:'4 3').attr('stroke-width',(_,i)=>i?2:1.4).attr('d',line);
    marker=plot.append('line').attr('y1',8).attr('y2',117).attr('stroke','#596e72').attr('stroke-dasharray','2 2');
    plot.on('click',event=>{
      const [x]=d3.pointer(event,plot.node());
      setHour(Math.max(0,Math.min(23,Math.round(hourScale.invert(x)))));
    });
  }

  function drawReading(){
    const {a,b}=activeSeries(), hour=slot%24;
    const x=hourScale(hour);
    marker.attr('x1',x).attr('x2',x);
    slider.value=hour;
    const period=odPeriodLabel(Math.floor(slot/24),hour);
    for(const button of highlights.querySelectorAll('button')){
      button.setAttribute('aria-pressed',String(+button.dataset.monthlySlot===slot));
    }
    slider.setAttribute('aria-valuetext',period);
    $('monthly-od-hour-label').value=clockTime(hour);
    $('monthly-od-reading').textContent=`${period} · ${fmt(a[slot])} → ${fmt(b[slot])} · ${signed(b[slot]-a[slot])} viajes`;
    summary.innerHTML=`<strong>${esc(mapStations.get(selectedId)?.name??'Cambio mensual · Red comparable')}</strong>`+
      `${monthShort(comparison.base)} → ${monthShort(comparison.key)} · ${period}`;
    drawMap();
  }

  function updateZoom(){
    if(!active||!scene)return;
    scene.points.selectAll('.monthly-node').attr('r',row=>{
      const share=Math.abs(row.b[slot]-row.a[slot])/comparison.max;
      const radius=Math.sqrt(4+117*share);
      return radius/scene.scale();
    });
  }

  function chooseStation(id){
    selectedId=selectedId===id?null:id;
    hideTooltip();
    drawComparison();
  }

  function drawMap(){
    if(!scene||!comparison)return;
    scene.points.selectAll('circle').data(comparison.common,row=>row.station.id).join('circle')
      .attr('class','monthly-node').attr('data-month-origin',row=>row.station.id)
      .attr('cx',row=>scene.position(row.station)[0]).attr('cy',row=>scene.position(row.station)[1])
      .attr('fill',row=>signColor(row.b[slot]-row.a[slot]))
      .attr('stroke',row=>selectedId===row.station.id?'#102937':'#fff')
      .attr('stroke-width',row=>selectedId===row.station.id?2:0.8)
      .attr('vector-effect','non-scaling-stroke').attr('opacity',row=>selectedId&&row.station.id!==selectedId?0.62:0.95)
      .attr('role','button').attr('tabindex',0).attr('aria-pressed',row=>String(row.station.id===selectedId))
      .attr('aria-label',row=>`${row.station.name} · ${signed(row.b[slot]-row.a[slot])} viajes`)
      .on('pointermove',(event,row)=>showTooltip(`<b>${esc(row.station.name)}</b><br>${fmt(row.a[slot])} → ${fmt(row.b[slot])} viajes · ${signed(row.b[slot]-row.a[slot])}`,event))
      .on('pointerleave',hideTooltip)
      .on('click',(event,row)=>{event.stopPropagation();chooseStation(row.station.id);})
      .on('keydown',(event,row)=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseStation(row.station.id);}
      });
    updateZoom();
  }

  weekday.replaceChildren(...days.map((day,index)=>new Option(day,index)));
  weekday.onchange=()=>setSlot(+weekday.value*24+slot%24);
  slider.oninput=()=>setHour(+slider.value);
  tabs.hidden=false;
  tabs.onclick=event=>{
    const button=event.target.closest('button[data-od-analysis]');
    if(button)changeMode(button.dataset.odAnalysis==='months');
  };
  calendar.onclick=event=>{
    const button=event.target.closest('button[data-od-month]');
    if(button)chooseMonth(button.dataset.odMonth);
  };
  updateMode();
  if(active)load();
  return {mount,updateZoom,writeURL,get active(){return active;},
    clearStation(){if(selectedId)chooseStation(selectedId);}};
}
