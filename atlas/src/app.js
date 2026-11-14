import {state,esc,fmt,profile,measures,hellinger,hideTooltip,passesMetricRanges,BASE,setBase} from './model.js?v=20261028-4';
import {renderAtlas} from './atlas-view.js?v=20261014-9';
import {renderMap} from './map-view.js?v=zoom-width1';
import {createODYearMaps} from './od-year-maps.js?v=linked-scope1';
import {renderPaths} from './paths-view.js?v=20261014-9';
import {renderEvidence} from './evidence-view.js?v=overview1';
import {renderInspector} from './inspector.js?v=linked-scope1';
import {renderProject} from './project-view.js?v=20261028-release1';

import {activeContrastBase,activeODCompareBase,availableContrastYears,normalizeContrastBase,inspectorContrast,contrastMeasures,annualMeasures,isODMap} from './contrast-model.mjs?v=annual-od1';
import {dataset} from './datasets.mjs?v=rail-reading1';
import {createRoutingData} from './od-routing.mjs?v=linked-scope1';

const views={atlas:renderAtlas,map:renderMap,paths:renderPaths,evidence:renderEvidence,project:renderProject};
const labels={atlas:'Atlas semanal',map:'Geografía',paths:'Trayectorias',evidence:'Evidencia',project:'Proyecto'};
let data,geo,lineas,flows,toastTimer,historicalProfiles,historicalPromise;
let choosingODYears=false,pendingODYear=null;
const stationIndices=new Map();
const scopeKeys=['borough','query','cohort','preset','tvMin','tvMax','ranges'];
async function loadHistoricalProfiles(){
  if(historicalProfiles)return historicalProfiles;
  historicalPromise??=d3.json('data/historical_contrast.json').then(value=>{
    if(value?.meta?.status!=='PASS'||![2019,2020,2024].every(y=>value.meta.years.includes(y)))throw Error('Los perfiles históricos no están validados.');
    historicalProfiles=value;return value;
  }).catch(error=>{historicalPromise=null;throw error;});
  return historicalPromise;
}
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
  if(p.has('cohort'))state.cohort=new Set(p.get('cohort')?p.get('cohort').split(','):[]);
  if(p.get('pins'))state.pins=p.get('pins').split(',').slice(0,3);
  for(const [key,allowed] of Object.entries({mode:['delta','current','base'],sort:['change','similar','borough','morning','morningUp','afternoon','night','weekend','volume','volumeDown'],day:['all','0','1','2','3','4','5','6'],mapMetric:['change','deltaAM','deltaWeekend','recovery'],inspectorTab:['fingerprint','compare','evolution','source'],layer:['points','flows'],flowShow:['volume','change']}))if(allowed.includes(p.get(key)))state[key]=p.get(key);
  for(const key of ['tvMin','tvMax'])if(p.has(key)&&Number.isFinite(+p.get(key)))state[key]=Math.max(0,Math.min(100,+p.get(key)));
  if(state.tvMin>state.tvMax)[state.tvMin,state.tvMax]=[state.tvMax,state.tvMin];
  for(const key of ['deltaAM','deltaWeekend','recovery']){const lo=p.get(key+'Min'),hi=p.get(key+'Max');if(lo!==null&&hi!==null&&Number.isFinite(+lo)&&Number.isFinite(+hi))state.ranges[key]=[Math.min(+lo,+hi),Math.max(+lo,+hi)];}
  for(const key of ['detail','clock','pathsFocus'])if(p.has(key))state[key]=p.get(key)==='true';
  if(p.has('hour')&&Number.isInteger(+p.get('hour')))state.flowHour=Math.max(0,Math.min(23,+p.get('hour')));
  if(p.has('day')&&Number.isInteger(+p.get('day')))state.flowDay=Math.max(0,Math.min(6,+p.get('day')));
  setBase(normalizeContrastBase(p.get('base'),state.year,dataset.defaultBase,dataset.years));
  const contrastBase=+p.get('contrastBase');
  state.contrastBase=availableContrastYears(state,dataset).includes(contrastBase)?contrastBase:null;
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
  if(state.cohort)p.set('cohort',[...state.cohort].join(','));
  if(state.tvMin>0)p.set('tvMin',state.tvMin);
  if(state.tvMax<100)p.set('tvMax',state.tvMax);
  for(const [key,range] of Object.entries(state.ranges))if(range){p.set(key+'Min',range[0]);p.set(key+'Max',range[1]);}
  if(state.pins.length)p.set('pins',state.pins.join(','));
  for(const key of ['mode','sort','day','detail','mapMetric','inspectorTab','clock','pathsFocus','layer','flowShow'])p.set(key,state[key]);p.set('hour',state.flowHour);p.set('day',state.flowDay);p.set('base',BASE);p.set('fidelity',state.fidelity);p.set('bundling',state.bundling);
  if(availableContrastYears(state,dataset).includes(state.contrastBase))p.set('contrastBase',state.contrastBase);
  if(state.paperRAEB){
    p.set('raeb','paper');p.set('pra',state.paperLevel);
    if(state.paperRadius!==null)p.set('paperRadius',state.paperRadius);
    else if(state.paperBundling!==null)p.set('paperBundling',state.paperBundling);
  }else p.set('raeb','atlas');
  if(state.selected)p.set('inspect',state.selected);
  if(new URLSearchParams(location.search).get('compute')==='cpu')p.set('compute','cpu');
  history.replaceState(null,'',`?${p}`);
}
const app={
  dataset,
  syncURL:updateURL,
  updateODYearMaps:null,
  updateFlowHour:null,
  updateClosure:null,
  setFlowTime(day,hour){
    if(day===state.flowDay&&app.updateFlowHour){
      state.flowHour=hour;
      app.updateFlowHour(hour);
      app.updateClosure?.();
    }else app.set({flowDay:day,flowHour:hour});
  },
  routing:null,
  get historicalProfiles(){return historicalProfiles;},
  async setContrastBase(year){
    if(year===state.year||!availableContrastYears(state,dataset).includes(year))return;
    if(!dataset.years.includes(year))await loadHistoricalProfiles();
    state.contrastBase=year;
    // Re-render only the right column: no camera, map metric, OD frame, node
    // sizes, year, or bundling job is changed by a historical contrast.
    renderInspector(app);updateURL();
  },
  get data(){return data;},get geo(){return geo;},get lineas(){return lineas;},get flows(){return flows;},state,
  station:id=>data.stations.find(s=>s.id===id),
  filtered(query=state.query){
    const q=query.trim().toLocaleLowerCase();
    return data.stations.filter(s=>{
      if(!profile(s))return false;
      if(state.borough!=='all'&&s.borough!==state.borough)return false;
      if(q&&!`${s.name} ${s.id} ${s.routes.join(' ')}`.toLocaleLowerCase().includes(q))return false;
      if(state.cohort&&!state.cohort.has(s.id))return false;
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
    Object.assign(state,patch);
    if(state.selected&&scopeKeys.some(key=>key in patch)&&!app.filtered().some(s=>s.id===state.selected))state.selected=null;
    render();
  },
  resetScope(){
    document.querySelector('#search').value='';
    app.set({selected:null,cohort:null,preset:null,query:'',borough:'all',tvMin:0,tvMax:100,
      ranges:{deltaAM:null,deltaWeekend:null,recovery:null}});
  },
  select(id){state.selected=id;render();},
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
  document.querySelector('.od-year-strip').classList.toggle('has-year-maps',canCompare);
  if(!canCompare){
    choosingODYears=false;
    pendingODYear=null;
  }
  const a=canCompare?(choosingODYears?pendingODYear:state.odCompareBase):null;
  app.odPreviewBase=a??state.year;
  if(canCompare)app.updateODYearMaps?.(state.flowDay,state.flowHour,app.odPreviewBase,app.odScope);
  const comparing=canCompare&&state.odCompareBase!==null;
  const button=document.querySelector('#od-compare');
  button.hidden=!canCompare;
  button.textContent=choosingODYears?'Cancelar':comparing?'Salir de comparación':'Comparar';
  document.querySelector('#od-compare-status').textContent=canCompare
    ? choosingODYears
      ? a===null?'Elige A, el año de referencia.':`A · ${a}. Elige B, un año distinto.`
      : comparing?`A ${a} → B ${state.year}`:`Mapa principal · ${state.year}`
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
    if(year===pendingODYear)return;
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
  hideTooltip();
  const focusId=document.activeElement?.id;
  const previousScroll=document.querySelector('.matrix-scroll')?.scrollTop||0;
  const items=app.filtered();
  const selected=app.station(state.selected);
  const scoped=!!selected||items.length!==data.stations.length;
  app.odScope={
    origins:scoped?(selected?[selected]:items).map(s=>stationIndices.get(s.id)).filter(Number.isInteger):null,
    label:selected?selected.name.replace(/ \([^)]*\)/g,''):state.cohort?'Área seleccionada':state.query?'Resultados de búsqueda':state.borough!=='all'?state.borough:scoped?'Grupo filtrado':'Toda la red'
  };
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');});
  renderODYears();
  document.querySelector('#borough').value=state.borough;
  const search=document.querySelector('#search');
  if(search!==document.activeElement)search.value=state.query;
  const periodLabel=document.querySelector('#period-label');if(periodLabel)periodLabel.textContent=`${state.year}`;
  document.querySelector('#cohort-count').textContent=`${items.length} / ${data.stations.length} ${dataset.stationLabel}`;
  const rangeNotes=[...(state.tvMin>0||state.tvMax<100?[`TV ${fmt(state.tvMin)}–${fmt(state.tvMax)} pp`]:[]),...Object.entries(state.ranges).filter(([,r])=>r).map(([k,r])=>`${{deltaAM:'AM',deltaWeekend:'Fin de semana',recovery:'Volumen'}[k]} ${fmt(r[0])}–${fmt(r[1])} ${k==='recovery'?'%':'pp'}`)];
  const groupNote=state.cohort?'Grupo de complejos seleccionado':state.preset==='morning'?'Cambio AM menor que −2 pp':state.preset==='weekend'?'Cambio de fin de semana mayor que +2 pp':state.preset==='change'?'Cambio de forma ≥10 pp':state.preset==='decoupled'?'Índice volumen entre 80–120 % y cambio de forma ≥10 pp':state.query?'Resultados de búsqueda':state.borough==='all'?'Todos los complejos de subway':state.borough;
  document.querySelector('#cohort-note').textContent=[...rangeNotes,groupNote].join(' · ');
  document.body.classList.add('has-inspector');
  document.querySelector('#selection-label').textContent=selected?`${selected.name}${items.some(s=>s.id===selected.id)?'':' · fuera del grupo activo'}`:'';
  const host=document.querySelector('#content');host.replaceChildren();host.dataset.view=state.view;
  app.updateFlowHour=null;
  views[state.view](host,app,items);
  if(state.view==='atlas'&&previousScroll)document.querySelector('.matrix-scroll').scrollTop=previousScroll;
  renderInspector(app);
  if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  document.querySelector('#footer-status').textContent=`${dataset.comparison} · ${dataset.credit}`;
  updateURL();
}

function exportCSV(){
  if(isODMap(state)&&activeODCompareBase(state,flows)===null){
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
const loadData=name=>d3.json(new URL(name==='flows.json'?'flows.json?v=rail-reading1':name,dataset.dataURL));
Promise.all([loadData('atlas.json'),loadData('boroughs.geojson'),dataset.id==='nyc'?loadData('lineas.geojson').catch(()=>null):null,loadData('flows.json')]).then(async([a,g,l,f])=>{
  if(!a.stations?.length)throw Error('Falta el catálogo de estaciones.');
  if(dataset.id==='nyc'&&a.stations.some(s=>!s.profiles?.['2021']||!s.profiles['2024']||
    Object.values(s.profiles).filter(Boolean).some(p=>p.p.length!==168||p.p.some(v=>!Number.isFinite(v)||v<0)))){
    throw Error('Los perfiles no cumplen la estructura esperada.');
  }
  if(!f?.starts||!f?.flows||!f?.meta?.years?.includes(BASE)||!f.meta.years.includes(state.year))throw Error('Faltan los agregados OD para esta comparación. No se usarán datos de entradas como reemplazo.');
  data=a;geo=g;lineas=l;flows=f;
  app.routing=createRoutingData(f,dataset.dataURL);
  // Métricas exclusivamente desde el OD: los perfiles de 168 celdas de cada complejo se derivan de los
  // viajes iniciados (starts[y][nodo][dow][hora], semana representativa). El contraste histórico
  // utiliza perfiles separados de entradas, con la misma fuente para ambos años.
  if(f&&f.starts){
    const ni=new Map(f.nodes.map((n,i)=>[n.id,i]));
    for(const s of data.stations){
      const i=ni.get(s.id);s.profiles={};
      for(const y of f.meta.years){
        const u=f.starts[String(y)]?.[i];if(!u){s.profiles[String(y)]=null;continue;}
        const v=u.flat(),V=d3.sum(v);
        if(V<=0){s.profiles[String(y)]=null;continue;}
        const p=v.map(x=>x/V),work=d3.sum(p.slice(0,120));
        s.profiles[String(y)]={p,am:work?100*d3.sum(d3.range(5),d=>d3.sum(p.slice(d*24+6,d*24+10)))/work:0,pm:work?100*d3.sum(d3.range(5),d=>d3.sum(p.slice(d*24+16,d*24+20)))/work:0,weekend:100*d3.sum(p.slice(120)),daily:V/7,weekly:V,actualDaily:V/7,observedCells:v.filter(x=>x>0).length};
      }
      s.series=[];
    }
    data.meta.comparison=dataset.comparison;
  }
  state.pins=state.pins.filter(id=>app.station(id));
  if(!app.station(state.selected))state.selected=null;
  f.nodes.forEach((station,index)=>stationIndices.set(station.id,index));
  if(!isODMap(state)&&state.contrastBase!==null&&!dataset.years.includes(state.contrastBase))await loadHistoricalProfiles();
  document.querySelector('.brand small').textContent=`ATLAS DE RITMOS · ${dataset.name.toUpperCase()}`;
  if(dataset.id==='bart')document.title='Fractal · Área de la Bahía · BART';
  document.querySelector('#borough').replaceChildren(
    new Option(dataset.territoryLabel,'all'),
    ...dataset.areas.map(area=>new Option(area,area))
  );
  if(dataset.id==='bart')document.querySelector('#search').placeholder='Buscar estación';
  document.querySelector('#loading').hidden=true;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>app.set({view:b.dataset.view})));
  const yearStrip=document.querySelector('#od-years');
  yearStrip.style.setProperty('--year-count',f.meta.years.length);
  for(const year of f.meta.years){
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
  let searchTimer;
  search.addEventListener('input',()=>{
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>app.set({query:search.value}),180);
  });
  search.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    clearTimeout(searchTimer);
    const query=search.value;
    const first=app.filtered(query)[0];
    app.set({query,selected:first?.id??null});
  });
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>app.set({preset:b.dataset.preset,cohort:null,query:'',sort:'change'})));
  document.querySelector('#reset').addEventListener('click',()=>{clearTimeout(searchTimer);app.resetScope();});
  document.querySelector('#save').addEventListener('click',()=>{
    const params=new URLSearchParams(location.search);
    if(state.selected)params.set('inspect',state.selected);
    const saved=app.saved();saved.unshift({name:`${labels[state.view]} · ${state.borough==='all'?'NYC':state.borough} · ${app.filtered().length} complejos`,url:`?${params}`,date:new Date().toISOString()});
    try{localStorage.setItem('rhythm-atlas-saved',JSON.stringify(saved.slice(0,12)));app.toast('Exploración guardada en este navegador. Encuéntrala en Evidencia.');if(state.view==='evidence')render();}catch{app.toast('Este navegador no permite guardar; puedes copiar la URL.');}
  });
  document.querySelector('#export').addEventListener('click',exportCSV);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.selected)app.set({selected:null});});
  // Chart dimensions depend on width. Height-only changes (mobile browser chrome,
  // screenshots) must not destroy a brush or a pending interaction.
  let rt,lastWidth=innerWidth;window.addEventListener('resize',()=>{if(innerWidth===lastWidth)return;lastWidth=innerWidth;clearTimeout(rt);rt=setTimeout(render,160);});
  render();
}).catch(error=>{
  const el=document.querySelector('#loading');el.innerHTML=`<div><h2>No se pudo abrir el atlas</h2><p>${esc(error.message)}</p><p>Abre esta carpeta con un servidor HTTP. Consulta atlas/README.md.</p><button onclick="location.reload()">Reintentar</button></div>`;
  console.error(error);
});
