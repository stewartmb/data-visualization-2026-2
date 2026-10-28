// A right-column comparison has its own base and its own source. Never mix
// hourly entries in one year with OD estimates in the other year.
export const CONTRAST_YEARS=[2019,2020,2021,2022,2023];
export function normalizeContrastBase(base,target,mapBase=2021){
  return CONTRAST_YEARS.includes(+base)&&+base<target?+base:Math.min(mapBase,target-1);
}
export function contrastMeasures(station,base,target){
  const a=station.profiles[String(base)],b=station.profiles[String(target)];
  if(!a||!b||a.daily<=0||b.daily<=0)return null;
  return {change:50*a.p.reduce((sum,v,i)=>sum+Math.abs(v-b.p[i]),0),deltaAM:b.am-a.am,
    deltaWeekend:b.weekend-a.weekend,recovery:100*b.daily/a.daily};
}
export function contrastCell(station,index,mode,base,target){
  const a=station.profiles[String(base)],b=station.profiles[String(target)];
  return mode==='delta'?100*(b.p[index]-a.p[index]):100*(mode==='base'?a.p[index]:b.p[index]);
}
export function inspectorContrast(mapApp,base,target){
  const kind=base<2021?'entries':'od';
  if(kind==='entries'&&!mapApp.historicalProfiles?.profiles)throw Error('Faltan los perfiles históricos de entradas para ambos años del contraste.');
  const stations=kind==='entries'?mapApp.data.stations.map(s=>({...s,profiles:mapApp.historicalProfiles.profiles[s.id]||{}})):mapApp.data.stations;
  const index=new Map(stations.map(s=>[s.id,s]));
  const meta=kind==='entries'?mapApp.historicalProfiles.meta:mapApp.flows.meta;
  const contrast={kind,base,target,meta,label:kind==='entries'?'Entradas estimadas MTA':'OD estimado MTA',unit:kind==='entries'?'entradas':'viajes OD'};
  return {...mapApp,data:{...mapApp.data,stations},contrast,
    station:id=>index.get(id),
    filtered:()=>mapApp.filtered().map(s=>index.get(s.id)).filter(s=>s&&contrastMeasures(s,base,target))};
}
