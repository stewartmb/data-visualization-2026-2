import {state,esc,fmt,profile,measures,hellinger,hideTooltip,passesMetricRanges,BASE,setBase} from './model.js?v=20261028-4';
import {renderAtlas} from './atlas-view.js?v=study-period1';
import {renderMap} from './map-view.js?v=station-highlight1';
import {createSpectralEvents} from './spectral-events.js?v=monthly-contrast1';
import {createODYearMaps} from './od-year-maps.js?v=map-layout2';
import {renderPaths} from './paths-view.js?v=od-only1';
import {renderEvidence} from './evidence-view.js?v=study-period1';
import {renderInspector} from './inspector.js?v=station-highlight1';
import {renderProject} from './project-view.js?v=study-period1';

import {activeContrastBase,activeODCompareBase,normalizeContrastBase,inspectorContrast,contrastMeasures,annualMeasures,isODMap} from './contrast-model.mjs?v=od-only1';
import {dataset} from './datasets.mjs?v=study-period1';
import {createRoutingData} from './od-routing.mjs?v=annual-overview1';

const views={atlas:renderAtlas,map:renderMap,paths:renderPaths,evidence:renderEvidence,project:renderProject};
const labels={atlas:'Atlas semanal',map:'Geografía',paths:'Trayectorias',evidence:'Evidencia',project:'Proyecto'};
let data,geo,lineas,flows,toastTimer;
let choosingODYears=false,pendingODYear=null,searchTimer;
const stationIndices=new Map();
const scopeKeys=['borough','query','cohort','preset','tvMin','tvMax','ranges'];
function hydrate(){
  const p=new URLSearchParams(location.search);
  state.view='map';
  state.showFlowNodes=p.get('flowNodes')!=='0';
  state.year=dataset.years.includes(+p.get('year'))?+p.get('year'):dataset.defaultYear;
  const odBase=+p.get('odBase');
  state.odCompareBase=dataset.years.includes(odBase)&&odBase!==state.year?odBase:null;
  if(['all',...dataset.areas].includes(p.get('borough')))state.borough=p.get('borough');
  state.selected=p.get('inspect')||null;state.query=p.get('q')||'';
  if(['morning','weekend','change','decoupled'].includes(p.get('preset')))state.preset=p.get('preset');
  const zoneA=new Set((p.get('zoneA')??'').split(',').filter(Boolean));
  const zoneB=new Set((p.get('zoneB')??'').split(',').filter(id=>id&&!zoneA.has(id)));
  state.odZones=zoneA.size&&zoneB.size&&!state.selected?{a:zoneA,b:zoneB}:null;
  if(p.has('cohort'))state.cohort=new Set(p.get('cohort')?p.get('cohort').split(','):[]);
  state.cohortSource=state.cohort?.size&&p.get('cohortSource')==='scatter'?'scatter':null;
  if(p.get('pins'))state.pins=p.get('pins').split(',').slice(0,3);
  for(const [key,allowed] of Object.entries({mode:['delta','current','base'],sort:['change','similar','borough','morning','morningUp','afternoon','night','weekend','volume','volumeDown'],day:['all','0','1','2','3','4','5','6'],mapMetric:['change','deltaAM','deltaWeekend','recovery'],inspectorTab:['fingerprint','compare','evolution','source'],layer:['points','flows'],flowShow:['volume','change']}))if(allowed.includes(p.get(key)))state[key]=p.get(key);
  for(const key of ['tvMin','tvMax'])if(p.has(key)&&Number.isFinite(+p.get(key)))state[key]=Math.max(0,Math.min(100,+p.get(key)));
  if(state.tvMin>state.tvMax)[state.tvMin,state.tvMax]=[state.tvMax,state.tvMin];
  for(const key of ['deltaAM','deltaWeekend','recovery']){const lo=p.get(key+'Min'),hi=p.get(key+'Max');if(lo!==null&&hi!==null&&Number.isFinite(+lo)&&Number.isFinite(+hi))state.ranges[key]=[Math.min(+lo,+hi),Math.max(+lo,+hi)];}
  for(const key of ['detail','clock','pathsFocus'])if(p.has(key))state[key]=p.get(key)==='true';
  if(p.has('hour')&&Number.isInteger(+p.get('hour'))){
    state.flowHour=Math.max(0,Math.min(23,+p.get('hour')));
    if(p.has('day')&&Number.isInteger(+p.get('day')))state.flowDay=Math.max(0,Math.min(6,+p.get('day')));
  }else if(dataset.id==='nyc'){
    state.flowDay=null;
    state.flowHour=null;
  }
  setBase(normalizeContrastBase(p.get('base'),state.year,dataset.defaultBase,dataset.years));
  const contrastBase=+p.get('contrastBase');
  state.contrastBase=dataset.years.includes(contrastBase)?contrastBase:null;
  if(p.has('fidelity')&&Number.isFinite(+p.get('fidelity')))state.fidelity=Math.max(0,Math.min(1,+p.get('fidelity')));
  state.paperRAEB=p.get('raeb')!=='atlas';
  state.paperLevel=p.has('pra')&&/^\d$/.test(p.get('pra'))?Math.min(5,+p.get('pra')):5;
  if(p.has('bundling')&&Number.isFinite(+p.get('bundling')))state.bundling=Math.max(0,Math.min(1,+p.get('bundling')));
  state.paperBundling=p.has('paperBundling')&&Number.isFinite(+p.get('paperBundling'))?Math.max(0,Math.min(1,+p.get('paperBundling'))):null;
  state.paperRadius=p.has('paperRadius')&&Number.isFinite(+p.get('paperRadius'))?Math.max(0,+p.get('paperRadius')):p.has('pra')||p.has('paperBundling')?null:0;
}
function updateURL(){
  const p=new URLSearchParams({view:state.view,year:state.year});
  if(dataset.id!=='nyc')p.set('system',dataset.id);
  if(!state.showFlowNodes)p.set('flowNodes','0');
  if(state.odCompareBase!==null)p.set('odBase',state.odCompareBase);
  if(state.borough!=='all')p.set('borough',state.borough);
  if(state.query)p.set('q',state.query);
  if(state.preset)p.set('preset',state.preset);
  if(state.odZones){
    p.set('zoneA',[...state.odZones.a].join(','));
    p.set('zoneB',[...state.odZones.b].join(','));
  }
  if(state.cohort){
    p.set('cohort',[...state.cohort].join(','));
    if(state.cohortSource==='scatter')p.set('cohortSource','scatter');
  }
  if(state.tvMin>0)p.set('tvMin',state.tvMin);
  if(state.tvMax<100)p.set('tvMax',state.tvMax);
  for(const [key,range] of Object.entries(state.ranges))if(range){p.set(key+'Min',range[0]);p.set(key+'Max',range[1]);}
  if(state.pins.length)p.set('pins',state.pins.join(','));
  for(const key of ['mode','sort','day','detail','mapMetric','inspectorTab','clock','pathsFocus','layer','flowShow'])p.set(key,state[key]);
  if(state.flowDay!==null){p.set('hour',state.flowHour);p.set('day',state.flowDay);}
  p.set('base',BASE);p.set('fidelity',state.fidelity);p.set('bundling',state.bundling);
  if(dataset.years.includes(state.contrastBase))p.set('contrastBase',state.contrastBase);
  if(state.paperRAEB){
    p.set('raeb','paper');p.set('pra',state.paperLevel);
    if(state.paperRadius!==null)p.set('paperRadius',state.paperRadius);
    else if(state.paperBundling!==null)p.set('paperBundling',state.paperBundling);
  }else p.set('raeb','atlas');
  if(state.selected)p.set('inspect',state.selected);
  if(new URLSearchParams(location.search).get('compute')==='cpu')p.set('compute','cpu');
  app.spectralEvents?.writeURL(p);
  history.replaceState(null,'',`?${p}`);
}
let stationPreview=null;
let stationPreviewMark=null;
function showStationPreview(id,mark){
  if(id===null&&mark&&mark!==stationPreviewMark)return;
  const update=(key,highlighted)=>{
    if(key===null)return;
    const escaped=CSS.escape(String(key));
    const selector=`[data-station-id="${escaped}"],[data-context-station-id="${escaped}"],[data-scatter-station="${escaped}"]`;
    document.querySelectorAll(selector).forEach(point=>point.classList.toggle('is-station-preview',highlighted));
  };
  if(id!==stationPreview)update(stationPreview,false);
  stationPreview=id;
  stationPreviewMark=mark??null;
  update(id,true);
}

const app={
  dataset,
  syncURL:updateURL,
  updateODYearMaps:null,
  updateFlowHour:null,
  setFlowTime(day,hour){
    if(day===state.flowDay&&hour===state.flowHour)return;
    if(day===state.flowDay&&app.updateFlowHour){
      state.flowHour=hour;
      app.updateFlowHour(hour);
    }else app.set({flowDay:day,flowHour:hour});
  },
  routing:null,
  setContrastBase(year){
    if(year===state.year||!dataset.years.includes(year))return;
    state.contrastBase=year;
    // Re-render only the linked analysis: no camera, map metric, OD frame, node
    // sizes, year, or bundling job is changed by changing the reference year.
    renderInspector(app);updateURL();
  },
  get data(){return data;},get geo(){return geo;},get lineas(){return lineas;},get flows(){return flows;},state,
  station:id=>data.stations.find(s=>s.id===id),
  filtered(query=state.query,{ignoreCohort=false}={}){
    const q=query.trim().toLocaleLowerCase();
    return data.stations.filter(s=>{
      if(!profile(s))return false;
      if(state.borough!=='all'&&s.borough!==state.borough)return false;
      if(q&&!`${s.name} ${s.id} ${s.routes.join(' ')}`.toLocaleLowerCase().includes(q))return false;
      if(!ignoreCohort&&state.cohort&&!state.cohort.has(s.id))return false;
      const m=measures(s);
      if(!passesMetricRanges(s))return false;
      if(state.preset==='morning'&&m.deltaAM>=-2)return false;
      if(state.preset==='weekend'&&m.deltaWeekend<=2)return false;
      if(state.preset==='change'&&m.change<10)return false;
      if(state.preset==='decoupled'&&(m.recovery<80||m.recovery>120||m.change<10))return false;
      return true;
    });
  },
  set(patch){
    if(['mode','sort','day','year'].some(k=>k in patch&&patch[k]!==state[k])){
      const scroller=document.querySelector('.matrix-scroll');if(scroller)scroller.scrollTop=0;
    }
    if(!('odZones' in patch)&&(patch.selected||scopeKeys.some(key=>key in patch)))state.odZones=null;
    if('cohort' in patch){
      if(!('areaOutline' in patch))state.areaOutline=null;
      if(!('cohortSource' in patch))state.cohortSource=null;
    }
    Object.assign(state,patch);
    if(state.selected&&scopeKeys.some(key=>key in patch)&&!app.filtered().some(s=>s.id===state.selected))state.selected=null;
    render();
  },
  resetScope(){
    clearTimeout(searchTimer);
    document.querySelector('#search').value='';
    app.set({selected:null,odZones:null,cohort:null,preset:null,query:'',borough:'all',tvMin:0,tvMax:100,
      ranges:{deltaAM:null,deltaWeekend:null,recovery:null}});
  },
  select(id){app.set({selected:id});},
  toggleStation(id){app.select(state.selected===id?null:id);},
  showStationPreview,
  pin(id){
    if(state.pins.includes(id))state.pins=state.pins.filter(x=>x!==id);
    else if(state.pins.length<3)state.pins.push(id);
    else return app.toast('Puedes fijar hasta tres complejos. Quita uno para añadir otro.');
    render();
  },
  similar(id){
    const s=app.station(id),p=profile(s).p;
    const ranked=data.stations.filter(x=>profile(x)).map(x=>({id:x.id,d:hellinger(p,profile(x).p)})).sort((a,b)=>a.d-b.d);
    app.set({view:'atlas',preset:null,query:'',borough:'all',cohort:new Set(ranked.slice(0,13).map(x=>x.id)),sort:'similar',detail:true});
    app.toast('Estación seleccionada y sus 12 perfiles más cercanos; semejanza no implica causa común.');
  },
  toast(text){const el=document.querySelector('#toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4200);},
  saved(){try{return JSON.parse(localStorage.getItem('rhythm-atlas-saved')||'[]');}catch{return [];}}
};

function renderODYears(){
  const canCompare=state.view==='map'&&state.layer==='flows';
  const strip=document.querySelector('.od-year-strip');
  strip.hidden=!canCompare;
  strip.closest('aside').setAttribute('aria-label',canCompare?'Comparación entre años':'Detalle de la selección');
  if(!canCompare){
    choosingODYears=false;
    pendingODYear=null;
  }
  const a=canCompare?(choosingODYears?pendingODYear:state.odCompareBase):null;
  const comparing=canCompare&&state.odCompareBase!==null;
  app.odPreviewBase=(comparing?state.odCompareBase:a)??state.year;
  if(canCompare)app.updateODYearMaps?.(state.flowDay,state.flowHour,app.odPreviewBase,app.odScope,comparing);
  const button=document.querySelector('#od-compare');
  button.hidden=!canCompare;
  button.textContent=choosingODYears?'Cancelar':comparing?'Salir de comparación':'Comparar';
  const status=document.querySelector('#od-compare-status');
  status.textContent=canCompare&&choosingODYears
    ? a===null?'Elige A, el año de referencia.':'Elige un año distinto para B.'
    : '';
  document.querySelectorAll('[data-od-year]').forEach(yearButton=>{
    const year=+yearButton.dataset.odYear;
    const role=year===a?'A':comparing&&!choosingODYears&&year===state.year?'B':'';
    yearButton.querySelector('small').textContent=role;
    yearButton.dataset.role=role;
    const activeYear=!choosingODYears&&year===state.year;
    const label=role?`${year}, año ${role}`:activeYear?`${year}, visible en el mapa principal`:String(year);
    yearButton.setAttribute('aria-label',label);
    yearButton.setAttribute('aria-pressed',String(!!role||activeYear));
  });
}

function chooseODYear(event,year){
  const canCompare=state.view==='map'&&state.layer==='flows';
  if(canCompare&&(event.metaKey||event.ctrlKey||choosingODYears)){
    if(!choosingODYears||pendingODYear===null){
      choosingODYears=true;
      pendingODYear=year;
      renderODYears();
      return;
    }
    if(year===pendingODYear){
      pendingODYear=null;
      renderODYears();
      return;
    }
    const odCompareBase=pendingODYear;
    choosingODYears=false;
    pendingODYear=null;
    app.set({year,odCompareBase});
    return;
  }
  choosingODYears=false;
  pendingODYear=null;
  app.set({year,odCompareBase:null});
}

function render(){
  if(BASE===state.year)setBase(normalizeContrastBase(null,state.year,dataset.defaultBase,dataset.years));
  showStationPreview(null);
  hideTooltip();
  const focusId=document.activeElement?.id;
  const previousScroll=document.querySelector('.matrix-scroll')?.scrollTop||0;
  const previousControls=document.querySelector('.od-stage .flow-controls');
  const previousControlScroll=previousControls?.scrollTop??0;
  const previousPageScroll=previousControls&&innerWidth<1000?window.scrollY:null;
  const items=app.filtered();
  const selected=app.station(state.selected);
  const scoped=!!selected||items.length!==data.stations.length;
  const toIndices=ids=>Array.from(ids,id=>stationIndices.get(id)).filter(Number.isInteger);
  const zones=state.layer==='flows'&&state.odZones?[state.odZones.a,state.odZones.b].map(toIndices):null;
  const between=zones?.every(ids=>ids.length)?zones:null;
  const rangeNotes=[...(state.tvMin>0||state.tvMax<100?[`TV ${fmt(state.tvMin)}–${fmt(state.tvMax)} pp`]:[]),...Object.entries(state.ranges).filter(([,r])=>r).map(([k,r])=>`${{deltaAM:'AM',deltaWeekend:'Fin de semana',recovery:'Volumen'}[k]} ${fmt(r[0])}–${fmt(r[1])} ${k==='recovery'?'%':'pp'}`)];
  const presetNote={morning:'Cambio AM menor que −2 pp',weekend:'Cambio de fin de semana mayor que +2 pp',change:'Cambio de forma ≥10 pp',decoupled:'Índice volumen entre 80–120 % y cambio de forma ≥10 pp'}[state.preset];
  const scopeNotes=[
    ...(state.borough!=='all'&&(selected||state.cohort||state.query||between)?[state.borough]:[]),
    ...(state.query.trim()?[`Búsqueda: «${state.query.trim()}»`]:[]),
    ...(state.cohort&&selected?['Grupo seleccionado']:[]),
    ...(presetNote?[presetNote]:[]),...rangeNotes
  ];
  const groupNote=state.cohort?'Grupo de complejos seleccionado':presetNote??(state.query?'Resultados de búsqueda':state.borough==='all'?'Todos los complejos de subway':state.borough);
  document.querySelector('#cohort-note').textContent=[...rangeNotes,groupNote].join(' · ');
  app.odScope={
    notes:scopeNotes,
    zones:between,
    origins:between?between.flat():scoped?toIndices((selected?[selected]:items).map(s=>s.id)):null,
    label:between?'Zona A ↔ Zona B':selected?selected.name.replace(/ \([^)]*\)/g,''):state.cohort?(state.cohortSource==='scatter'?'Área en la dispersión':'Área seleccionada'):state.query?'Resultados de búsqueda':state.borough!=='all'?state.borough:scoped?'Grupo filtrado':'Toda la red'
  };
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');});
  renderODYears();
  document.querySelector('#borough').value=state.borough;
  const search=document.querySelector('#search');
  if(search!==document.activeElement)search.value=state.query;
  const periodLabel=document.querySelector('#period-label');if(periodLabel)periodLabel.textContent=`${state.year}`;
  document.querySelector('#cohort-count').textContent=`${items.length} / ${data.stations.length} ${dataset.stationLabel}`;
  document.body.classList.add('has-inspector');
  document.querySelector('#selection-label').textContent=selected?`${selected.name}${items.some(s=>s.id===selected.id)?'':' · fuera del grupo activo'}`:'';
  const host=document.querySelector('#content');host.replaceChildren();host.dataset.view=state.view;
  app.updateFlowHour=null;
  views[state.view](host,app,items);
  if(state.view==='atlas'&&previousScroll)document.querySelector('.matrix-scroll').scrollTop=previousScroll;
  renderInspector(app);
  const controls=document.querySelector('.od-stage .flow-controls');
  if(previousControls&&controls){
    controls.scrollTop=previousControlScroll;
    if(previousPageScroll!==null)window.scrollTo({top:previousPageScroll,behavior:'instant'});
  }
  if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  updateURL();
}

async function exportCSV(){
  const base=activeODCompareBase(state,flows);
  if(isODMap(state)&&app.odScope.zones){
    const {year,flowDay,flowHour,odZones}=state;
    const scope=app.odScope.zones;
    const zones=[[...odZones.a].join('|'),[...odZones.b].join('|')];
    const years=base===null?[year]:[base,year];
    try{
      const rows=await Promise.all(years.map(async y=>{
        const flow=await app.routing.zoneFlow(y,flowDay,flowHour,scope);
        return [y,flowDay===null?'':flowDay+1,flowHour??'',...zones,flow.trips,flow.routeKm,flow.directKm,flowDay===null?'annual_daily_mean':'weekday_hour'];
      }));
      return downloadCSV(['year','weekday_iso','departure_hour','zone_a_complex_ids','zone_b_complex_ids','assigned_trips','mean_route_km','mean_straight_km','period'],
        rows,`viajes-entre-zonas-${years.join('-')}.csv`);
    }catch{
      return app.toast('No se pudieron exportar los viajes entre zonas.');
    }
  }
  if(isODMap(state)&&base===null){
    const rows=app.filtered().flatMap(s=>{
      const m=annualMeasures(s,state.year);
      return m?[['od',s.id,s.name,s.borough,state.year,m.daily,m.peakShare,Math.floor(m.peak/24)+1,m.peak%24]]:[];
    });
    return downloadCSV(['measure_source','complex_id','name','borough','year','avg_daily_trips','peak_hour_weekly_share_pct','peak_weekday_iso','peak_hour'],
      rows,`evidencia-od-${state.year}.csv`);
  }
  const contrast=inspectorContrast(app,activeContrastBase(state,flows,BASE,dataset),state.year);
  const contrastBase=contrast.contrast.base;
  const columns=['measure_source','complex_id','name','borough','baseline','target','change_tv_pp','delta_am_pp','delta_weekend_pp','volume_index_pct','observed_cells_baseline','observed_cells_target','retrieved_at_utc'];
  const rows=contrast.filtered().map(s=>{const m=contrastMeasures(s,contrastBase,state.year);return [contrast.contrast.kind,s.id,s.name,s.borough,'Jan-Dec '+contrastBase,`Jan-Dec ${state.year}`,m.change,m.deltaAM,m.deltaWeekend,m.recovery,profile(s,contrastBase).observedCells,profile(s).observedCells,contrast.contrast.meta.built_at_utc||data.meta.retrieved];});
  downloadCSV(columns,rows,`evidencia-${contrast.contrast.kind}-${contrastBase}-${state.year}.csv`);
}
function downloadCSV(columns,rows,filename){
  const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
  const csv=rows.map(row=>row.map(quote).join(',')).join('\n');
  const blob=new Blob(['\ufeff'+columns.join(',')+'\n'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

hydrate();
const loadData=name=>d3.json(new URL(['flows.json','annual-od.json'].includes(name)?name+'?v=od-2025-1':name,dataset.dataURL));
const nyc=dataset.id==='nyc';
Promise.all([loadData(nyc?'stations.json':'atlas.json'),loadData('boroughs.geojson'),nyc?loadData('lineas.geojson').catch(()=>null):null,
  loadData('flows.json'),nyc?loadData('annual-od.json'):null]).then(([a,g,l,f,annual])=>{
  if(!a.stations?.length)throw Error('Falta el catálogo de estaciones.');
  if(!f?.starts||!f?.flows||!f?.meta?.years?.includes(BASE)||!f.meta.years.includes(state.year))throw Error('Faltan los agregados OD del período seleccionado.');
  if(nyc&&(!annual?.volume_limit||!f.meta.years.every(y=>annual.years[y]?.starts.length===f.nodes.length&&
    annual.years[y]?.loads.length===2*f.links.length)))throw Error('Faltan los agregados anuales OD.');
  f.annual=annual;
  data=a;geo=g;lineas=l;flows=f;
  app.routing=createRoutingData(f,dataset.dataURL);
  // Perfiles de 168 horas derivados de los viajes iniciados en cada complejo.
  if(f&&f.starts){
    const ni=new Map(f.nodes.map((n,i)=>[n.id,i]));
    for(const s of data.stations){
      const i=ni.get(s.id);s.profiles={};
      for(const y of f.meta.years){
        const u=f.starts[String(y)]?.[i];if(!u){s.profiles[String(y)]=null;continue;}
        const v=u.flat(),V=d3.sum(v);
        if(V<=0){s.profiles[String(y)]=null;continue;}
        const p=v.map(x=>x/V),work=d3.sum(p.slice(0,120));
        const daily=f.annual?.years[y]?.starts[i]??V/7;
        s.profiles[String(y)]={p,am:work?100*d3.sum(d3.range(5),d=>d3.sum(p.slice(d*24+6,d*24+10)))/work:0,pm:work?100*d3.sum(d3.range(5),d=>d3.sum(p.slice(d*24+16,d*24+20)))/work:0,weekend:100*d3.sum(p.slice(120)),daily,weekly:V,actualDaily:daily,observedCells:v.filter(x=>x>0).length};
      }
      s.series=[];
    }
    data.meta={comparison:dataset.comparison,retrieved:f.meta.built_at_utc??''};
  }
  state.pins=state.pins.filter(id=>app.station(id));
  if(!app.station(state.selected))state.selected=null;
  f.nodes.forEach((station,index)=>stationIndices.set(station.id,index));
  const brand=document.querySelector('.masthead .brand');
  brand.querySelector('small').textContent=`ATLAS DE RITMOS · ${dataset.name.toUpperCase()}`;
  if(dataset.id==='bart'){
    brand.href='./?system=bart';
    document.title='Fractal · Área de la Bahía · BART';
  }
  document.querySelector('#borough').replaceChildren(
    new Option(dataset.territoryLabel,'all'),
    ...dataset.areas.map(area=>new Option(area,area))
  );
  if(dataset.id==='bart')document.querySelector('#search').placeholder='Buscar estación';
  document.querySelector('#loading').hidden=true;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>app.set({view:b.dataset.view})));
  const yearStrip=document.querySelector('#od-years');
  for(const year of dataset.years){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.odYear=year;
    const caption=document.createElement('span');
    caption.className='od-year-caption';
    caption.append(String(year),document.createElement('small'));
    const canvas=document.createElement('canvas');
    canvas.setAttribute('aria-hidden','true');
    const change=document.createElement('span');
    change.className='od-year-change';
    change.id=`od-year-detail-${year}`;
    button.setAttribute('aria-describedby',change.id);
    button.append(canvas,caption,change);
    button.addEventListener('click',event=>chooseODYear(event,year));
    yearStrip.append(button);
  }
  app.updateODYearMaps=createODYearMaps(yearStrip,g,f,app.routing);
  document.querySelector('#od-compare').addEventListener('click',()=>{
    if(!choosingODYears&&state.odCompareBase!==null){
      app.set({odCompareBase:null});
      return;
    }
    choosingODYears=!choosingODYears;
    pendingODYear=null;
    renderODYears();
  });
  // Entradas al análisis: un selector en el panel del mapa (se delega porque la vista se redibuja).
  document.addEventListener('change',e=>{if(e.target.id==='preset-select')app.set({preset:e.target.value||null,cohort:null,query:'',sort:'change'});});
  document.querySelector('#borough').addEventListener('change',e=>app.set({borough:e.target.value}));
  const search=document.querySelector('#search');
  const options=document.querySelector('#search-options');
  let suggestions=[], activeOption=-1;

  function highlightSuggestion(index){
    activeOption=index;
    for(const [i,option] of [...options.children].entries()){
      option.setAttribute('aria-selected',String(i===index));
    }
    if(index<0){
      search.removeAttribute('aria-activedescendant');
    }else{
      const option=options.children[index];
      search.setAttribute('aria-activedescendant',option.id);
      option.scrollIntoView({block:'nearest'});
    }
  }

  function closeSuggestions(){
    suggestions=[];
    options.replaceChildren();
    options.hidden=true;
    search.setAttribute('aria-expanded','false');
    highlightSuggestion(-1);
  }

  function selectSuggestion(station){
    clearTimeout(searchTimer);
    closeSuggestions();
    const query=station?.name??search.value;
    search.value=query;
    app.set({query,selected:station?.id??null});
  }

  function showSuggestions(){
    closeSuggestions();
    if(!search.value.trim())return;
    suggestions=app.filtered(search.value).slice(0,8);
    if(!suggestions.length)return;
    suggestions.forEach((station,index)=>{
      const option=document.createElement('div');
      option.id='search-option-'+index;
      option.setAttribute('role','option');
      option.setAttribute('aria-selected','false');
      const name=document.createElement('strong');
      name.textContent=station.name;
      const area=document.createElement('span');
      area.textContent=[station.borough,station.routes.join(' · ')].filter(Boolean).join(' / ');
      option.append(name,area);
      option.addEventListener('mousedown',event=>event.preventDefault());
      option.addEventListener('click',()=>selectSuggestion(station));
      options.append(option);
    });
    options.hidden=false;
    search.setAttribute('aria-expanded','true');
  }

  search.addEventListener('focus',showSuggestions);
  search.addEventListener('blur',closeSuggestions);
  search.addEventListener('input',()=>{
    clearTimeout(searchTimer);
    showSuggestions();
    searchTimer=setTimeout(()=>app.set({query:search.value}),180);
  });
  search.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!options.hidden){
      event.stopPropagation();
      closeSuggestions();
    }else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      if(options.hidden)showSuggestions();
      if(!suggestions.length)return;
      event.preventDefault();
      const step=event.key==='ArrowDown'?1:-1;
      const next=activeOption<0&&step<0?suggestions.length-1:activeOption+step;
      highlightSuggestion((next+suggestions.length)%suggestions.length);
    }else if(event.key==='Enter'){
      event.preventDefault();
      selectSuggestion(suggestions[activeOption]??app.filtered(search.value)[0]);
    }
  });
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>app.set({preset:b.dataset.preset,cohort:null,query:'',sort:'change'})));
  document.querySelector('#save').addEventListener('click',()=>{
    const params=new URLSearchParams(location.search);
    if(state.selected)params.set('inspect',state.selected);
    const saved=app.saved();saved.unshift({name:`${labels[state.view]} · ${state.borough==='all'?'NYC':state.borough} · ${app.filtered().length} complejos`,url:`?${params}`,date:new Date().toISOString()});
    try{localStorage.setItem('rhythm-atlas-saved',JSON.stringify(saved.slice(0,12)));app.toast('Exploración guardada en este navegador. Encuéntrala en Evidencia.');if(state.view==='evidence')render();}catch{app.toast('Este navegador no permite guardar; puedes copiar la URL.');}
  });
  document.querySelector('#export').addEventListener('click',exportCSV);
  if(nyc){
    document.querySelector('#atlas-analysis').hidden=false;
    app.spectralEvents=createSpectralEvents({flows:f,syncURL:updateURL,dataURL:dataset.eventsURL,onModeChange:render});
  }
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(!app.spectralEvents?.closeEpisode()&&state.selected)app.set({selected:null});
  });
  // Chart dimensions depend on width. Height-only changes (mobile browser chrome,
  // screenshots) must not destroy a brush or a pending interaction.
  let rt,lastWidth=innerWidth;window.addEventListener('resize',()=>{if(innerWidth===lastWidth)return;lastWidth=innerWidth;clearTimeout(rt);rt=setTimeout(render,160);});
  render();
}).catch(error=>{
  const el=document.querySelector('#loading');el.innerHTML=`<div><h2>No se pudo abrir el atlas</h2><p>${esc(error.message)}</p><p>Abre esta carpeta con un servidor HTTP. Consulta atlas/README.md.</p><button onclick="location.reload()">Reintentar</button></div>`;
  console.error(error);
});
