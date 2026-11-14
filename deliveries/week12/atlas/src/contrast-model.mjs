// A right-column comparison has its own base and its own source. Never mix
// hourly entries in one year with OD estimates in the other year.
export const CONTRAST_YEARS=[2019,2020,2021,2022,2023,2024];
export function normalizeContrastBase(base,target,mapBase=2021,years=CONTRAST_YEARS){
  const available=years.filter(year=>year!==target);
  if(available.includes(+base))return +base;
  if(available.includes(mapBase))return mapBase;
  return available.find(year=>year>=2021)??available[0];
}
export const isODMap=state=>state.view==='map'&&state.layer==='flows';
export function availableContrastYears(state,dataset){
  return isODMap(state)?dataset.years:dataset.contrastYears;
}
export function activeODCompareBase(state,flows){
  const base=state.odCompareBase;
  if(!isODMap(state)||base==null||base===state.year)return null;
  return flows?.flows?.[base]&&flows.flows[state.year]?base:null;
}
export function activeContrastBase(state,flows,mapBase,dataset){
  return activeODCompareBase(state,flows)??normalizeContrastBase(
    state.contrastBase,state.year,mapBase,availableContrastYears(state,dataset)
  );
}
export function contrastMeasures(station,base,target){
  const a=station.profiles[String(base)],b=station.profiles[String(target)];
  if(!a||!b||a.daily<=0||b.daily<=0)return null;
  return {change:50*a.p.reduce((sum,v,i)=>sum+Math.abs(v-b.p[i]),0),deltaAM:b.am-a.am,
    deltaWeekend:b.weekend-a.weekend,recovery:100*b.daily/a.daily};
}
export function annualMeasures(station,year){
  const profile=station.profiles[year];
  if(!profile||profile.daily<=0)return null;
  const peak=profile.p.reduce((best,share,index)=>share>profile.p[best]?index:best,0);
  return {daily:profile.daily,peak,peakShare:100*profile.p[peak]};
}
export function contrastCell(station,index,mode,base,target){
  const a=station.profiles[String(base)],b=station.profiles[String(target)];
  return mode==='delta'?100*(b.p[index]-a.p[index]):100*(mode==='base'?a.p[index]:b.p[index]);
}
export function inspectorContrast(mapApp,base,target){
  const odYears=mapApp.flows?.meta?.years;
  const kind=odYears?.includes(target)&&(base===null||odYears.includes(base))?'od':'entries';
  if(kind==='entries'&&!mapApp.historicalProfiles?.profiles)throw Error('Faltan los perfiles históricos de entradas para ambos años del contraste.');
  const stations=kind==='entries'?mapApp.data.stations.map(s=>({...s,profiles:mapApp.historicalProfiles.profiles[s.id]||{}})):mapApp.data.stations;
  const index=new Map(stations.map(s=>[s.id,s]));
  const meta=kind==='entries'?mapApp.historicalProfiles.meta:mapApp.flows.meta;
  const contrast={kind,base,target,meta,label:kind==='entries'?'Entradas estimadas MTA':mapApp.dataset?.odLabel??'OD estimado MTA',unit:kind==='entries'?'entradas':'viajes OD'};
  return {...mapApp,data:{...mapApp.data,stations},contrast,
    station:id=>index.get(id),
    filtered:()=>mapApp.filtered().map(s=>index.get(s.id)).filter(s=>s&&(base===null?annualMeasures(s,target):contrastMeasures(s,base,target)))};
}
