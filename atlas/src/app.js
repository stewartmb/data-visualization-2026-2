import {state,esc,fmt,profile,measures,hellinger,hideTooltip} from './model.js';
import {renderAtlas} from './atlas-view.js?v=20261014-2';
import {renderMap} from './map-view.js';
import {renderPaths} from './paths-view.js';
import {renderEvidence} from './evidence-view.js';
import {renderInspector} from './inspector.js';

const views={atlas:renderAtlas,map:renderMap,paths:renderPaths,evidence:renderEvidence};
const labels={atlas:'Atlas semanal',map:'Geografía',paths:'Trayectorias',evidence:'Evidencia'};
let data,geo,toastTimer;
function hydrate(){
  const p=new URLSearchParams(location.search);
  if(views[p.get('view')])state.view=p.get('view');
  if([2021,2022,2023,2024].includes(+p.get('year')))state.year=+p.get('year');
  if(['all','Manhattan','Brooklyn','Queens','Bronx'].includes(p.get('borough')))state.borough=p.get('borough');
  state.selected=p.get('station')||null;state.query=p.get('q')||'';
  if(['morning','weekend','change','decoupled'].includes(p.get('preset')))state.preset=p.get('preset');
  if(p.has('cohort'))state.cohort=new Set(p.get('cohort')?p.get('cohort').split(','):[]);
  if(p.get('pins'))state.pins=p.get('pins').split(',').slice(0,3);
  for(const [key,allowed] of Object.entries({mode:['delta','current','base'],sort:['change','similar','borough','morning','morningUp','afternoon','night','weekend','volume','volumeDown'],day:['all','0','1','2','3','4','5','6'],mapMetric:['change','deltaAM','deltaWeekend','recovery'],inspectorTab:['fingerprint','compare','evolution','source']}))if(allowed.includes(p.get(key)))state[key]=p.get(key);
  for(const key of ['detail','clock','pathsFocus'])if(p.has(key))state[key]=p.get(key)==='true';
}
function updateURL(){
  const p=new URLSearchParams({view:state.view,year:state.year});
  if(state.borough!=='all')p.set('borough',state.borough);
  if(state.selected)p.set('station',state.selected);
  if(state.query)p.set('q',state.query);
  if(state.preset)p.set('preset',state.preset);
  if(state.cohort)p.set('cohort',[...state.cohort].join(','));
  if(state.pins.length)p.set('pins',state.pins.join(','));
  for(const key of ['mode','sort','day','detail','mapMetric','inspectorTab','clock','pathsFocus'])p.set(key,state[key]);
  history.replaceState(null,'',`?${p}`);
}
const app={
  get data(){return data;},get geo(){return geo;},state,
  station:id=>data.stations.find(s=>s.id===id),
  filtered(){
    const q=state.query.toLocaleLowerCase();
    return data.stations.filter(s=>{
      if(!profile(s))return false;
      if(state.borough!=='all'&&s.borough!==state.borough)return false;
      if(q&&!`${s.name} ${s.id} ${s.routes.join(' ')}`.toLocaleLowerCase().includes(q))return false;
      if(state.cohort&&!state.cohort.has(s.id))return false;
      const m=measures(s);
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
  document.querySelector('#period-label').textContent=`ene–feb ${state.year}`;
  document.querySelector('#cohort-count').textContent=`${items.length} / ${data.stations.length}`;
  document.querySelector('#cohort-note').textContent=state.cohort?'Grupo de complejos seleccionado':state.preset==='morning'?'Cambio AM menor que −2 pp':state.preset==='weekend'?'Cambio de fin de semana mayor que +2 pp':state.preset==='decoupled'?'Índice volumen entre 80–120 % y cambio de forma ≥10 pp':state.query?'Resultados de búsqueda':state.borough==='all'?'Todos los complejos de subway':state.borough;
  const selected=app.station(state.selected);
  document.body.classList.toggle('has-inspector',Boolean(selected));
  document.querySelector('#selection-label').textContent=selected?`${selected.name}${items.some(s=>s.id===selected.id)?'':' · fuera del grupo activo'}`:'Selecciona un complejo para investigar';
  const host=document.querySelector('#content');host.replaceChildren();
  views[state.view](host,app,items);
  if(state.view==='atlas'&&previousScroll)document.querySelector('.matrix-scroll').scrollTop=previousScroll;
  renderInspector(app);
  if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  document.querySelector('#footer-status').textContent=`${data.meta.comparison} · selección compartida entre vistas`;
  updateURL();
}

function exportCSV(){
  const columns=['complex_id','name','borough','baseline','target','change_tv_pp','delta_am_pp','delta_weekend_pp','volume_index_pct','observed_cells_baseline','observed_cells_target','retrieved_at_utc'];
  const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
  const rows=app.filtered().map(s=>{const m=measures(s);return [s.id,s.name,s.borough,'Jan-Feb 2020',`Jan-Feb ${state.year}`,m.change,m.deltaAM,m.deltaWeekend,m.recovery,profile(s,2020).observedCells,profile(s).observedCells,data.meta.retrieved].map(quote).join(',');});
  const blob=new Blob(['\ufeff'+columns.join(',')+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`evidencia-ritmos-${state.year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

hydrate();
Promise.all([d3.json('data/atlas.json'),d3.json('data/boroughs.geojson')]).then(([a,g])=>{
  if(!a.stations?.length||a.stations.some(s=>!s.profiles['2020']||!s.profiles['2024']||Object.values(s.profiles).filter(Boolean).some(p=>p.p.length!==168||p.p.some(v=>!Number.isFinite(v)||v<0))))throw Error('Los perfiles no cumplen la estructura esperada.');
  data=a;geo=g;
  state.pins=state.pins.filter(id=>app.station(id));
  if(!app.station(state.selected))state.selected=null;
  document.querySelector('#loading').hidden=true;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>app.set({view:b.dataset.view})));
  document.querySelector('#year').addEventListener('change',e=>app.set({year:+e.target.value}));
  document.querySelector('#borough').addEventListener('change',e=>app.set({borough:e.target.value}));
  let timer;document.querySelector('#search').addEventListener('input',e=>{const query=e.target.value;clearTimeout(timer);timer=setTimeout(()=>app.set({query}),180);});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>app.set({preset:b.dataset.preset,cohort:null,query:'',sort:'change'})));
  document.querySelector('#reset').addEventListener('click',()=>app.set({cohort:null,preset:null,query:'',borough:'all'}));
  document.querySelector('#save').addEventListener('click',()=>{
    const saved=app.saved();saved.unshift({name:`${labels[state.view]} · ${state.borough==='all'?'NYC':state.borough} · ${app.filtered().length} complejos`,url:location.search,date:new Date().toISOString()});
    try{localStorage.setItem('rhythm-atlas-saved',JSON.stringify(saved.slice(0,12)));app.toast('Exploración guardada en este navegador. Encuéntrala en Evidencia.');if(state.view==='evidence')render();}catch{app.toast('Este navegador no permite guardar; puedes copiar la URL.');}
  });
  document.querySelector('#export').addEventListener('click',exportCSV);
  const guide=document.querySelector('#guide');
  document.querySelector('#help').addEventListener('click',()=>guide.showModal());
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
