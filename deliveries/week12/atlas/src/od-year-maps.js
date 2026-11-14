import {flowColor,FLOW_COLOR_STOPS} from './raeb-gpu-shaders.mjs?v=flow-gray1';

export function createODYearMaps(host,geo,flows){
  const width=84,height=120;
  const boroughs=geo.features.filter(feature=>feature.properties.name!=='Staten Island');
  const area={type:'FeatureCollection',features:boroughs};
  const railLinks=flows.links.flatMap((link,index)=>link.kind==='rail'?[{link,index}]:[]);
  // Fit the same railway extent in every thumbnail. The boroughs provide context.
  const network={type:'MultiLineString',coordinates:railLinks.map(({link})=>link.coords)};
  const projection=d3.geoMercator().fitExtent([[5,5],[width-5,height-5]],network);
  const land=new Path2D(d3.geoPath(projection)(area));
  const line=d3.line().x(point=>point[0]).y(point=>point[1]);
  const rails=railLinks.map(({link,index})=>({index,path:new Path2D(line(link.coords.map(projection)))}));
  const period=document.querySelector('#od-preview-period');
  const legend=document.querySelector('.od-preview-key i');
  legend.style.background=`linear-gradient(90deg,${FLOW_COLOR_STOPS.map(stop=>stop.color).join(',')})`;

  const slots=Array.from(host.querySelectorAll('button[data-od-year]'),button=>{
    const canvas=button.querySelector('canvas');
    const pixelRatio=Math.max(2,window.devicePixelRatio||1);
    canvas.width=width*pixelRatio;
    canvas.height=height*pixelRatio;
    const context=canvas.getContext('2d');
    context.scale(canvas.width/width,canvas.height/height);
    context.lineCap='round';
    context.lineJoin='round';
    return {year:button.dataset.odYear,context};
  });

  let previousDay,previousHour;
  return (day,hour,label)=>{
    if(day===previousDay&&hour===previousHour)return;
    previousDay=day;
    previousHour=hour;
    period.textContent=label;
    for(const {year,context} of slots){
      const loads=flows.flows[year][day][hour];
      context.fillStyle='#edf1f1';
      context.fillRect(0,0,width,height);
      context.fillStyle='#e0e3df';
      context.fill(land,'evenodd');
      context.strokeStyle='#bcc6c2';
      context.lineWidth=.45;
      context.stroke(land);
      const frame=rails.map(rail=>({
        path:rail.path,
        trips:loads[rail.index*2]+loads[rail.index*2+1]
      })).sort((a,b)=>a.trips-b.trips);
      for(const {path,trips} of frame){
        context.strokeStyle=trips>0?flowColor(trips):'#a9b4b5';
        context.lineWidth=trips>0?1.1:.55;
        context.stroke(path);
      }
    }
  };
}
