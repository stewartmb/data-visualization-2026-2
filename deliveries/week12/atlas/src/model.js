export let BASE=2021; // año base de la comparación (par base → objetivo, 2021–2024)
export function setBase(y){BASE=y;}
export const state = {view:'atlas',year:2024,borough:'all',query:'',preset:null,cohort:null,selected:null,pins:[],mode:'delta',sort:'change',day:'all',detail:false,mapMetric:'change',tvMin:0,tvMax:100,ranges:{deltaAM:null,deltaWeekend:null,recovery:null},inspectorTab:'fingerprint',clock:true,pathsFocus:true,layer:'flows',flowHour:8,flowDay:0,flowShow:'volume',fidelity:0.9,bundling:0.65};
export const dayShort=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number = new Intl.NumberFormat('es-PE',{maximumFractionDigits:1});
export const fmt = n => number.format(n);
export const signed = n => `${n>0?'+':''}${fmt(n)}`;
export const profile = (s,y=state.year) => s.profiles[String(y)];
export function relevantEvents(data,s,y=state.year){
  const historical=(s.name.match(/\(([^)]+)\)/)?.[1]||'').split(',').map(x=>x.trim());
  return (data.events||[]).filter(e=>(e.years.includes(BASE)||e.years.includes(y))&&(e.scope==='all'||e.ids?.includes(s.id)||(e.scope==='historical-route'&&historical.includes(e.route))));
}
export function measures(s,y=state.year){
  const a=profile(s,BASE),b=profile(s,y);
  if(!a||!b)return null;
  return {change:50*d3.sum(a.p,(v,i)=>Math.abs(v-b.p[i])),deltaAM:b.am-a.am,deltaWeekend:b.weekend-a.weekend,recovery:100*b.daily/a.daily};
}
export function hellinger(a,b){return Math.sqrt(d3.sum(a,(v,i)=>(Math.sqrt(v)-Math.sqrt(b[i]))**2)/2);}
export function cohortProfile(stations,y){
  const rows=stations.map(s=>profile(s,y)).filter(Boolean),weight=d3.sum(rows,r=>r.weekly);
  if(!weight)return null;
  const p=d3.range(168).map(i=>d3.sum(rows,r=>r.p[i]*r.weekly)/weight);
  const weekday=d3.sum(p.slice(0,120));
  return {p,am:100*d3.sum(d3.range(5),d=>d3.sum(p.slice(d*24+6,d*24+10)))/weekday,weekend:100*d3.sum(p.slice(120)),daily:weight/7};
}
export function metricValue(s,key,y=state.year){return measures(s,y)?.[key] ?? NaN;}
const diverging=t=>t<=.5?d3.interpolateRgb('#176c91','#f5f5ef')(2*t):d3.interpolateRgb('#f5f5ef','#b6532c')(2*t-1);
export const deltaColor=d3.scaleDiverging([-0.65,0,0.65],diverging).clamp(true);
export const shareColor=d3.scaleSequential(t=>d3.interpolateRgbBasis(['#faf8ef','#afd0bd','#0b6475'])(t)).domain([0,1.5]).clamp(true);
export function metricColor(key,stations){
  if(key==='change')return d3.scaleSequential(d3.interpolateViridis).domain([0,d3.max(stations,s=>metricValue(s,key))||1]);
  if(key==='recovery')return d3.scaleDiverging([0,100,Math.max(150,d3.max(stations,s=>metricValue(s,key))||150)],t=>d3.interpolateRgbBasis(['#316e92','#f5f2df','#bd5b33'])(t));
  const max=d3.max(stations,s=>Math.abs(metricValue(s,key)))||1;
  return d3.scaleDiverging([-max,0,max],diverging);
}
export function cellValue(s,i,mode=state.mode){
  const b=profile(s,BASE),p=profile(s);
  return mode==='delta'?100*(p.p[i]-b.p[i]):100*(mode==='base'?b.p[i]:p.p[i]);
}
export function showTooltip(html,event){
  const el=document.querySelector('#tooltip');el.innerHTML=html;el.hidden=false;
  const box=el.getBoundingClientRect();
  el.style.left=`${Math.max(8,Math.min(event.clientX+15,innerWidth-box.width-10))}px`;
  el.style.top=`${Math.max(8,Math.min(event.clientY+15,innerHeight-box.height-10))}px`;
}
export function hideTooltip(){document.querySelector('#tooltip').hidden=true;}
export function heading(kicker,title,description,tasks){return `<div class="view-heading"><div><div class="eyebrow">${kicker}</div><h2>${title}</h2><p>${description}</p></div><div class="task-tag">${tasks}</div></div>`;}
export function stats(stations){
  if(!stations.length)return '';
  const change=d3.median(stations,s=>metricValue(s,'change'));
  const am=d3.median(stations,s=>metricValue(s,'deltaAM'));
  const rec=d3.median(stations,s=>metricValue(s,'recovery'));
  return `<div class="stats-strip"><div class="stat"><strong>${stations.length}</strong><span>complejos en el grupo</span></div><div class="stat"><strong>${fmt(change)} pp</strong><span>mediana del cambio de forma</span></div><div class="stat"><strong>${signed(am)} pp</strong><span>mediana del cambio AM</span></div><div class="stat"><strong>${fmt(rec)} %</strong><span>mediana del índice de volumen</span></div></div>`;
}

export function passesMetricRanges(s){
  const m=measures(s);if(!m||m.change<state.tvMin||m.change>state.tvMax)return false;
  return Object.entries(state.ranges).every(([key,range])=>!range||(m[key]>=range[0]&&m[key]<=range[1]));
}
