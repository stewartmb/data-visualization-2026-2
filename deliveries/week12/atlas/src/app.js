import {state,esc,fmt,profile,measures,hellinger,hideTooltip,passesMetricRanges,BASE,setBase} from './model.js?v=20261028-4';
import {renderAtlas} from './atlas-view.js?v=20261014-9';
import {renderMap} from './map-view.js?v=20261028-backend-first';
import {renderPaths} from './paths-view.js?v=20261014-9';
import {renderEvidence} from './evidence-view.js?v=20261014-9';
import {renderInspector} from './inspector.js?v=20261028-release1';
import {renderProject} from './project-view.js?v=20261028-release1';

import {normalizeContrastBase,inspectorContrast,contrastMeasures} from './contrast-model.mjs';

const views={atlas:renderAtlas,map:renderMap,paths:renderPaths,evidence:renderEvidence,project:renderProject};
const labels={atlas:'Atlas semanal',map:'Geografía',paths:'Trayectorias',evidence:'Evidencia',project:'Proyecto'};
let data,geo,lineas,flows,toastTimer,historicalProfiles,historicalPromise;
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
  if([2021,2022,2023,2024].includes(+p.get('year')))state.year=+p.get('year');
  if(['all','Manhattan','Brooklyn','Queens','Bronx'].includes(p.get('borough')))state.borough=p.get('borough');
  state.selected=p.get('station')||null;state.query=p.get('q')||'';
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
  if(p.has('base')&&[2021,2022,2023].includes(+p.get('base')))setBase(+p.get('base'));
  state.contrastBase=normalizeContrastBase(p.has('contrastBase')?+p.get('contrastBase'):2019,state.year,BASE);
  if(p.has('fidelity')&&Number.isFinite(+p.get('fidelity')))state.fidelity=Math.max(0,Math.min(1,+p.get('fidelity')));
  if(p.has('bundling')&&Number.isFinite(+p.get('bundling')))state.bundling=Math.max(0,Math.min(1,+p.get('bundling')));
}
function updateURL(){
  const p=new URLSearchParams({view:state.view,year:state.year});
  if(state.borough!=='all')p.set('borough',state.borough);
  if(state.selected)p.set('station',state.selected);
  if(state.query)p.set('q',state.query);
  if(state.preset)p.set('preset',state.preset);
  if(state.cohort)p.set('cohort',[...state.cohort].join(','));
  if(state.tvMin>0)p.set('tvMin',state.tvMin);
  if(state.tvMax<100)p.set('tvMax',state.tvMax);
  for(const [key,range] of Object.entries(state.ranges))if(range){p.set(key+'Min',range[0]);p.set(key+'Max',range[1]);}
  if(state.pins.length)p.set('pins',state.pins.join(','));
  for(const key of ['mode','sort','day','detail','mapMetric','inspectorTab','clock','pathsFocus','layer','flowShow'])p.set(key,state[key]);p.set('hour',state.flowHour);p.set('day',state.flowDay);p.set('base',BASE);p.set('fidelity',state.fidelity);p.set('bundling',state.bundling);p.set('contrastBase',state.contrastBase??BASE);
  history.replaceState(null,'',`?${p}`);
}
const app={
  syncURL:updateURL,
  get historicalProfiles(){return historicalProfiles;},
  async setContrastBase(year){
    if(normalizeContrastBase(year,state.year,BASE)!==year)return;
    if(year<2021)await loadHistoricalProfiles();
    state.contrastBase=year;
    // Re-render only the right column: no camera, map metric, OD frame, node
    // sizes, year, or bundling job is changed by a historical contrast.
    renderInspector(app);updateURL();
  },
  get data(){return data;},get geo(){return geo;},get lineas(){return lineas;},get flows(){return flows;},state,
  station:id=>data.stations.find(s=>s.id===id),
  filtered(){
    const q=state.query.toLocaleLowerCase();
    return data.stations.filter(s=>{
      if(!profile(s))return false;
      if(state.borough!=='all'&&s.borough!==state.borough)return false;
      if(q&&!`${s.name} ${s.id} ${s.routes.join(' ')}`.toLocaleLowerCase().includes(q))return false;
      if(state.cohort&&!state.cohort.has(s.id))return false;
      const m=measures(s);
      if(!passesMetricRanges(s))return false;
      if(state.preset==='morning'&&m.deltaAM>=-2)return false;
      if(state.preset==='weekend'&&m.deltaWeekend<=2)return false;
      if(state.preset==='decoupled'&&(m.recovery<80||m.recovery>120||m.change<10))return false;
      return true;
    });
  },
  set(patch){if(['mode','sort','day','year'].some(k=>k in patch&&patch[k]!==state[k])){const scroller=document.querySelector('.matrix-scroll');if(scroller)scroller.scrollTop=0;}Object.assign(state,patch);render();},
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

function render(){
  hideTooltip();
  const focusId=document.activeElement?.id;
  const previousScroll=document.querySelector('.matrix-scroll')?.scrollTop||0;
  const items=app.filtered();
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');});
  document.querySelector('#year').value=state.year;document.querySelector('#borough').value=state.borough;
  document.querySelector('#search').value=state.query;
  const periodLabel=document.querySelector('#period-label');if(periodLabel)periodLabel.textContent=`${state.year}`;
  document.querySelector('#cohort-count').textContent=`${items.length} / ${data.stations.length} complejos`;
  const rangeNotes=[...(state.tvMin>0||state.tvMax<100?[`TV ${fmt(state.tvMin)}–${fmt(state.tvMax)} pp`]:[]),...Object.entries(state.ranges).filter(([,r])=>r).map(([k,r])=>`${{deltaAM:'AM',deltaWeekend:'Fin de semana',recovery:'Volumen'}[k]} ${fmt(r[0])}–${fmt(r[1])} ${k==='recovery'?'%':'pp'}`)];
  const groupNote=state.cohort?'Grupo de complejos seleccionado':state.preset==='morning'?'Cambio AM menor que −2 pp':state.preset==='weekend'?'Cambio de fin de semana mayor que +2 pp':state.preset==='decoupled'?'Índice volumen entre 80–120 % y cambio de forma ≥10 pp':state.query?'Resultados de búsqueda':state.borough==='all'?'Todos los complejos de subway':state.borough;
  document.querySelector('#cohort-note').textContent=[...rangeNotes,groupNote].join(' · ');
  const selected=app.station(state.selected);
  document.body.classList.add('has-inspector');
  document.querySelector('#selection-label').textContent=selected?`${selected.name}${items.some(s=>s.id===selected.id)?'':' · fuera del grupo activo'}`:'';
  const host=document.querySelector('#content');host.replaceChildren();host.dataset.view=state.view;
  views[state.view](host,app,items);
  if(state.view==='atlas'&&previousScroll)document.querySelector('.matrix-scroll').scrollTop=previousScroll;
  renderInspector(app);
  if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  document.querySelector('#footer-status').textContent=`${data.meta.comparison} · MTA / Open NY · referencia GTFS MTA 2026`;
  updateURL();
}

function exportCSV(){
  const contrast=inspectorContrast(app,normalizeContrastBase(state.contrastBase??BASE,state.year,BASE),state.year);
  const contrastBase=contrast.contrast.base;
  const columns=['measure_source','complex_id','name','borough','baseline','target','change_tv_pp','delta_am_pp','delta_weekend_pp','volume_index_pct','observed_cells_baseline','observed_cells_target','retrieved_at_utc'];
  const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
  const rows=contrast.filtered().map(s=>{const m=contrastMeasures(s,contrastBase,state.year);return [contrast.contrast.kind,s.id,s.name,s.borough,'Jan-Dec '+contrastBase,`Jan-Dec ${state.year}`,m.change,m.deltaAM,m.deltaWeekend,m.recovery,profile(s,contrastBase).observedCells,profile(s).observedCells,contrast.contrast.meta.built_at_utc||data.meta.retrieved].map(quote).join(',');});
  const blob=new Blob(['\ufeff'+columns.join(',')+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`evidencia-${contrast.contrast.kind}-${contrastBase}-${state.year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

hydrate();
Promise.all([d3.json('data/atlas.json'),d3.json('data/boroughs.geojson'),d3.json('data/lineas.geojson').catch(()=>null),d3.json('data/flows.json')]).then(async([a,g,l,f])=>{
  if(!a.stations?.length||a.stations.some(s=>!s.profiles[String(BASE)]||!s.profiles['2024']||Object.values(s.profiles).filter(Boolean).some(p=>p.p.length!==168||p.p.some(v=>!Number.isFinite(v)||v<0))))throw Error('Los perfiles no cumplen la estructura esperada.');
  if(!f?.starts||!f?.flows||!f?.meta?.years?.includes(BASE)||!f.meta.years.includes(state.year))throw Error('Faltan los agregados OD para esta comparación. No se usarán datos de entradas como reemplazo.');
  data=a;geo=g;lineas=l;flows=f;
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
    data.meta.comparison='Semana representativa del OD estimado de la MTA (los doce meses completos, ponderados por el calendario); viajes iniciados por complejo, día y hora.';
  }
  state.pins=state.pins.filter(id=>app.station(id));
  if(!app.station(state.selected))state.selected=null;
  if(state.contrastBase<2021)await loadHistoricalProfiles();
  document.querySelector('#loading').hidden=true;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>app.set({view:b.dataset.view})));
  document.querySelector('#year').addEventListener('change',e=>{const y=+e.target.value;if(y<=BASE)setBase(Math.max(2021,y-1));app.set({year:y});});
  // Entradas al análisis: un selector en el panel del mapa (se delega porque la vista se redibuja).
  document.addEventListener('change',e=>{if(e.target.id==='preset-select')app.set({preset:e.target.value||null,cohort:null,query:'',sort:'change'});});
  document.querySelector('#borough').addEventListener('change',e=>app.set({borough:e.target.value}));
  let timer;document.querySelector('#search').addEventListener('input',e=>{const query=e.target.value;clearTimeout(timer);timer=setTimeout(()=>app.set({query}),180);});
  // Enter: abre el detalle del primer complejo que coincide (details on demand desde el teclado).
  document.querySelector('#search').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=app.filtered()[0];if(first)app.select(first.id);}});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>app.set({preset:b.dataset.preset,cohort:null,query:'',sort:'change'})));
  document.querySelector('#reset').addEventListener('click',()=>app.set({cohort:null,preset:null,query:'',borough:'all',tvMin:0,tvMax:100,ranges:{deltaAM:null,deltaWeekend:null,recovery:null}}));
  document.querySelector('#save').addEventListener('click',()=>{
    const saved=app.saved();saved.unshift({name:`${labels[state.view]} · ${state.borough==='all'?'NYC':state.borough} · ${app.filtered().length} complejos`,url:location.search,date:new Date().toISOString()});
    try{localStorage.setItem('rhythm-atlas-saved',JSON.stringify(saved.slice(0,12)));app.toast('Exploración guardada en este navegador. Encuéntrala en Evidencia.');if(state.view==='evidence')render();}catch{app.toast('Este navegador no permite guardar; puedes copiar la URL.');}
  });
  document.querySelector('#export').addEventListener('click',exportCSV);
  const guide=document.querySelector('#guide');
  document.querySelector('#help').addEventListener('click',()=>{renderProject(document.querySelector('#guide-body'),app);guide.showModal();});
  document.querySelector('#close-guide').addEventListener('click',()=>guide.close());
  guide.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.selected&&!guide.open)app.set({selected:null});});
  // Chart dimensions depend on width. Height-only changes (mobile browser chrome,
  // screenshots) must not destroy a brush or a pending interaction.
  let rt,lastWidth=innerWidth;window.addEventListener('resize',()=>{if(innerWidth===lastWidth)return;lastWidth=innerWidth;clearTimeout(rt);rt=setTimeout(render,160);});
  render();
}).catch(error=>{
  const el=document.querySelector('#loading');el.innerHTML=`<div><h2>No se pudo abrir el atlas</h2><p>${esc(error.message)}</p><p>Abre esta carpeta con un servidor HTTP. Consulta atlas/README.md.</p><button onclick="location.reload()">Reintentar</button></div>`;
  console.error(error);
});
