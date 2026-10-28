// Context verified against the downloaded OD partitions and the MTA closure
// announcement. A large ratio alone never excludes a complex from the axis.
export const CLOSURE_CONTEXT={
  stationId:'301',affectedYears:[2021],
  label:'Base afectada por cierre',
  explanation:'181 St (1) estuvo cerrada por sustitución de ascensores durante casi todo 2021. El índice anual conserva ese cierre en el denominador; no mide únicamente recuperación de demanda.',
  sources:[
    {label:'Anuncio oficial MTA',url:'https://apps.cio.ny.gov/apps/mediacontact/public/view.cfm?parm=05263848-E4F1-92EC-B38BB3829F9FE33D'},
    {label:'Reapertura, diciembre de 2021',url:'https://patch.com/new-york/washington-heights-inwood/wash-heights-181st-street-1-station-reopens-new-elevators'}
  ]
};
export function comparisonContext(stationId,baseYear,targetYear){
  return String(stationId)===CLOSURE_CONTEXT.stationId&&[baseYear,targetYear].some(y=>CLOSURE_CONTEXT.affectedYears.includes(+y))?CLOSURE_CONTEXT:null;
}
export function scatterDomain(rows,baseYear,targetYear){
  const main=[],context=[];
  for(const row of rows){
    if(!Number.isFinite(row.recovery)||!Number.isFinite(row.change))continue;
    (comparisonContext(row.id,baseYear,targetYear)?context:main).push(row);
  }
  // Every ordinary, finite observation determines the scale; no clipping,
  // winsorization, percentile threshold, or altered recovery value.
  const xMax=Math.max(150,...main.map(r=>Math.ceil(r.recovery/50)*50));
  const yMax=Math.max(5,...main.map(r=>Math.ceil(r.change/5)*5));
  return {main,context,xMax,yMax};
}
