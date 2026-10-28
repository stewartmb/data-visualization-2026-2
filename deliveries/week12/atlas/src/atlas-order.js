// Ordering follows the visible year, mode and temporal scope.
export function atlasOrder(stations,state,focus){
  const delta=state.mode==='delta',year=state.mode==='base'?2020:state.year;
  const days=state.day==='all'?[0,1,2,3,4,5,6]:[+state.day];
  const indices=days.flatMap(d=>Array.from({length:24},(_,h)=>d*24+h));
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const p=(s,y)=>s.profiles[String(y)];
  function share(s,y,hours){
    const ds=state.day==='all'?[0,1,2,3,4]:days;
    const v=p(s,y).p,total=sum(ds.flatMap(d=>v.slice(d*24,d*24+24)));
    return total?100*sum(ds.flatMap(d=>hours.map(h=>v[d*24+h])))/total:0;
  }
  const daily=(s,y)=>p(s,y).weekly*sum(indices.map(i=>p(s,y).p[i]))/days.length;
  const vector=s=>{const v=indices.map(i=>delta?p(s,state.year).p[i]-p(s,2020).p[i]:p(s,year).p[i]);const total=sum(v);return !delta&&total?v.map(x=>x/total):v;};
  const ref=focus?vector(focus):null;
  const options=delta?[
    ['change','Mayor cambio de forma'],['morning','Mayor caída de la mañana'],['morningUp','Mayor aumento de la mañana'],
    ['volume','Mayor recuperación del volumen'],['volumeDown','Menor recuperación del volumen'],
    ['similar','Cambios parecidos a la selección'],['borough','Distrito y nombre']
  ]:[['morning','Mayor peso de la mañana'],['afternoon','Mayor peso de la tarde'],['night','Mayor peso de la noche'],...(state.day==='all'?[['weekend','Mayor peso del fin de semana']]:[]),['volume','Más entradas diarias'],['similar','Perfiles parecidos a la selección'],['borough','Distrito y nombre']];
  let key=options.some(x=>x[0]===state.sort)?state.sort:(delta?'change':'morning');
  // Never silently substitute another ordering when no reference exists.
  if(key==='similar'&&!focus)key=delta?'change':'morning';
  const scope=state.day==='all'?'semana completa':['lunes','martes','miércoles','jueves','viernes','sábado','domingo'][+state.day];
  const morningScope=state.day==='all'?'lunes a viernes':scope;
  function value(s){
    if(key==='borough')return 0;
    if(key==='similar'){const v=vector(s);return delta?Math.sqrt(sum(v.map((x,i)=>(x-ref[i])**2))):Math.sqrt(sum(v.map((x,i)=>(Math.sqrt(x)-Math.sqrt(ref[i]))**2))/2);}
    if(key==='weekend')return 100*sum(p(s,year).p.slice(120));
    if(key==='change')return 50*sum(indices.map(i=>Math.abs(p(s,state.year).p[i]-p(s,2020).p[i])));
    if(key==='volume'||key==='volumeDown')return delta?100*daily(s,state.year)/daily(s,2020):daily(s,year);
    const hours=key==='afternoon'?[16,17,18,19]:key==='night'?[20,21,22,23]:[6,7,8,9];
    return delta?share(s,state.year,hours)-share(s,2020,hours):share(s,year,hours);
  }
  const ascending=key==='similar'||(delta&&(key==='morning'||key==='volumeDown'));
  const rows=[...stations].sort((a,b)=>key==='borough'?a.borough.localeCompare(b.borough)||a.name.localeCompare(b.name):(ascending?value(a)-value(b):value(b)-value(a))||a.name.localeCompare(b.name));
  const period=delta?`${state.year} frente a 2020`:`${year}`;
  let description;
  if(key==='borough')description=`Distrito y nombre, de A a Z · ${scope} · ${period}.`;
  else if(key==='similar')description=`De más a menos parecido a ${focus.name} · ${scope} · ${period}. ${delta?'Se comparan diferencias horarias; no cantidades de entradas.':'Se compara la distribución de entradas dentro del período visible.'}`;
  else if(key==='weekend')description=`De mayor a menor peso del sábado y domingo dentro de la semana completa · ${year}. Valor: porcentaje de las entradas semanales.`;
  else if(key==='change')description=`De mayor a menor redistribución horaria · ${scope} · ${period}. Valor: mitad de la suma de diferencias absolutas en puntos porcentuales de la semana.`;
  else if(key==='volume'||key==='volumeDown')description=delta?`${key==='volumeDown'?'De menor a mayor':'De mayor a menor'} recuperación del volumen · ${scope} · ${period}. Índice: 2020 = 100 %.`:`De más a menos entradas diarias promedio · ${scope} · ${year}.`;
  else {const range=key==='afternoon'?'16:00–19:59':key==='night'?'20:00–23:59':'06:00–09:59';description=`${delta?(key==='morning'?'De mayor caída a mayor aumento':'De mayor aumento a mayor caída'):'De mayor a menor peso'} · ${range}, ${morningScope} · ${period}. ${delta?'Diferencia en puntos porcentuales':'Porcentaje'} respecto de todas las entradas de esos días.`;}
  const format=s=>key==='borough'?s.borough:key==='similar'?`dist. ${value(s).toFixed(3)}`:key==='volume'||key==='volumeDown'?(delta?`${value(s).toFixed(1)} %`:Math.round(value(s)).toLocaleString('es-PE')):`${delta&&value(s)>0?'+':''}${value(s).toFixed(2)} ${delta?'pp':'%'}`;
  return {rows,key,options,description,format,value,year};
}
