const weekdays=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

export function odPeriodLabel(day,hour,short=false){
  if(day===null)return 'Todo el año';
  const weekday=short?weekdays[day].slice(0,3):weekdays[day];
  return `${weekday} · ${String(hour).padStart(2,'0')}:00`;
}

export function odLoads(flows,year,day,hour){
  return day===null?flows.annual?.years[year]?.loads:flows.flows?.[year]?.[day]?.[hour];
}

export function odStarts(flows,year,day,hour,station){
  return day===null?flows.annual?.years[year]?.starts[station]:flows.starts?.[year]?.[station]?.[day]?.[hour];
}

export function odIncoming(flows,year,day,hour,station){
  return day===null?flows.annual?.years[year]?.incoming[station]:flows.incoming?.[year]?.[day]?.[hour]?.[station];
}
