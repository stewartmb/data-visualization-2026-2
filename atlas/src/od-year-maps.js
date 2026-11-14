import {OD_CHANGE_LIMIT,OD_CHANGE_COLORS,railChange} from './od-encoding.mjs?v=rail-reading1';
import {fmt,signed,dayShort} from './model.js?v=20261028-4';

export function createODYearMaps(host,geo,flows,routing){
  const width=100,height=120;
  const area={type:'FeatureCollection',features:geo.features.filter(feature=>feature.properties.name!=='Staten Island')};
  const railLinks=flows.links.flatMap((link,index)=>link.kind==='rail'?[{link,index}]:[]);
  const projection=d3.geoMercator().fitExtent([[5,5],[width-5,height-5]],{
    type:'MultiLineString',coordinates:railLinks.map(({link})=>link.coords)
  });
  const land=new Path2D(d3.geoPath(projection)(area));
  const line=d3.line();
  const rails=railLinks.map(({link,index})=>({link,index,path:new Path2D(line(link.coords.map(projection)))}));
  const names=new Map(flows.nodes.map(s=>[s.id,s.name.replace(/ \([^)]*\)/g,'')]));
  const period=document.querySelector('#od-preview-period');
  const referenceLabel=document.querySelector('#od-preview-base');
  const range=document.querySelector('#od-preview-range');
  const scopeLabel=document.querySelector('#od-preview-scope');
  const legend=document.querySelector('.od-preview-key i');
  const {loss,gain,neutral}=OD_CHANGE_COLORS;
  const interpolate={loss:d3.interpolateRgb(neutral,loss),gain:d3.interpolateRgb(neutral,gain)};
  legend.style.background=`linear-gradient(90deg,${loss},${neutral},${gain})`;
  const slots=Array.from(host.querySelectorAll('button[data-od-year]'),button=>{
    const canvas=button.querySelector('canvas');
    const ratio=Math.max(2,window.devicePixelRatio||1);
    canvas.width=width*ratio;
    canvas.height=height*ratio;
    const context=canvas.getContext('2d');
    context.scale(canvas.width/width,canvas.height/height);
    context.lineCap='round';
    context.lineJoin='round';
    return {year:+button.dataset.odYear,button,context};
  });
  function drawBase(context){
    context.fillStyle='#edf0f1';
    context.fillRect(0,0,width,height);
    context.fillStyle='#e0e3df';
    context.fill(land,'evenodd');
    context.strokeStyle='#bcc6c2';
    context.lineWidth=.43;
    context.stroke(land);
    context.strokeStyle='#b4bec1';
    context.lineWidth=.52;
    for(const rail of rails)context.stroke(rail.path);
  }
  let previous,requestId=0;
  return async (day,hour,reference,{origins,label})=>{
    const key=`${day}/${hour}/${reference}/${origins?.join(',')??'all'}/${label}`;
    if(key===previous)return;
    previous=key;
    const request=++requestId;
    period.textContent=`${dayShort[day]} · ${String(hour).padStart(2,'0')}:00`;
    referenceLabel.textContent=`Cambio frente a ${reference}`;
    scopeLabel.hidden=origins===null;
    scopeLabel.textContent=origins===null?'':`Salidas · ${label}`;
    let loadsByYear;
    if(origins===null){
      loadsByYear=new Map(slots.map(({year})=>[year,flows.flows[year][day][hour]]));
    }else{
      host.setAttribute('aria-busy','true');
      range.textContent='Calculando…';
      for(const {context,button} of slots){
        drawBase(context);
        button.removeAttribute('title');
        button.querySelector('.od-year-change').textContent='Actualizando…';
      }
      try{
        loadsByYear=new Map(await Promise.all(slots.map(async({year})=>[year,await routing.loads(year,day,hour,origins)])));
      }catch{
        if(request!==requestId)return;
        previous=null;
        host.removeAttribute('aria-busy');
        range.textContent='';
        for(const {button} of slots)button.querySelector('.od-year-change').textContent='Sin datos';
        return;
      }
      if(request!==requestId)return;
    }
    host.removeAttribute('aria-busy');
    const base=loadsByYear.get(reference);
    const frames=slots.map(slot=>{
      const loads=loadsByYear.get(slot.year);
      const changes=rails.map(rail=>{
        const i=rail.index*2;
        return {...rail,delta:loads[i]+loads[i+1]-base[i]-base[i+1]};
      }).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
      return {...slot,changes};
    });
    const acrossYears=frames.flatMap(({changes})=>changes.map(({delta})=>Math.abs(delta)));
    const peak=d3.max(acrossYears)||0;
    const step=peak>0?10**Math.floor(Math.log10(peak/2)):1;
    const limit=peak>0?Math.max(1,Math.ceil(peak/step)*step):(flows.meta.change_limit??OD_CHANGE_LIMIT);
    range.textContent=`−${fmt(limit)} · 0 · +${fmt(limit)}`;
    for(const {year,button,context,changes} of frames){
      drawBase(context);
      for(const {path,delta} of changes){
        if(Math.abs(delta)<.001)continue;
        const strength=railChange(delta,limit);
        context.strokeStyle=interpolate[delta<0?'loss':'gain'](strength);
        context.lineWidth=.65+1.5*strength;
        context.stroke(path);
      }
      const major=changes.at(-1);
      const caption=button.querySelector('.od-year-change');
      const title=year===reference?'Referencia':major&&Math.abs(major.delta)>=.001
        ? `${signed(major.delta)} viajes · cambio máx.`:'Sin cambio';
      caption.textContent=title;
      button.title=year===reference?`${year}, año de referencia`:major&&Math.abs(major.delta)>=.001
        ? `${year} frente a ${reference} · ${names.get(major.link.a)} ↔ ${names.get(major.link.b)} · ${signed(major.delta)} viajes asignados`:title;
      button.dataset.previewReference=reference;
      button.dataset.previewScope=label;
    }
  };
}
