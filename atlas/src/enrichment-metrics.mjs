export function aggregateTransfers(rows,ids,year){
  const selected=rows.filter(r=>ids.has(r.station_complex_id)&&r.year===year);
  const entries=selected.reduce((n,r)=>n+r.calendar_standardized_weekly_entries,0);
  const transfers=selected.reduce((n,r)=>n+r.calendar_standardized_weekly_free_transfers,0);
  return {entries,transfers,share:entries?100*transfers/entries:null,complexes:selected.length};
}

// Fare counts have borough resolution. Never divide them among selected stations.
export function aggregateFares(rows,boroughs,year){
  const selected=rows.filter(r=>boroughs.has(r.borough)&&r.year===year);
  const counts=new Map();let total=0;
  for(const r of selected){total+=r.ridership;counts.set(r.fare_class_category,(counts.get(r.fare_class_category)||0)+r.ridership);}
  return {total,categories:[...counts].map(([category,count])=>({category,count,share:total?100*count/total:null}))};
}
