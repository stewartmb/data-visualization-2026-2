// Capa «Tramos»: el mapa troceado estación a estación y las vistas enlazadas de ManyWaves
// (Valdrighi et al., CGF 2026): Heatmap of Changes, series con banda y Wavelet Encoding.
// Los coeficientes wavelet y la proyección vienen precalculados en data/segment_waves.json
// (deliveries/week12/scripts/build_segment_waves.py). Aquí solo se leen y se enlazan.
import {state,BASE,setBase,esc,fmt,showTooltip,hideTooltip} from './model.js?v=20261028-4';

const T=168,DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],DAYS_LONG=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const ampm=h=>h===0?'12 am':h<12?`${h} am`:h===12?'12 pm':`${h-12} pm`;
const whenText=t=>`${DAYS_LONG[Math.floor(t/24)]} ${ampm(t%24)}`;
const short=name=>name.replace(/ \(.*/,'');
const LOAD=d3.interpolateRgbBasis(['#cfd9d5','#7fb0ae','#1d6f8d','#102937']);
const WAVE=d3.interpolateRgbBasis(['#e6e2d6','#e9b98d','#c96035','#6e2610']);
// Colormap 2D por posición geográfica (esquinas SO, SE, NO, NE), como el Wavelet Encoding del artículo.
const CORNERS=[[194,69,45],[226,185,59],[59,111,182],[61,153,112]];
const zoneColor=(u,v)=>{const w=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];return `rgb(${[0,1,2].map(k=>Math.round(d3.sum(w,(x,i)=>x*CORNERS[i][k]))).join(',')})`;};

let W=null,loading=null,failed=null,P=null;
let transform=d3.zoomIdentity,lastEmbed=null;
const sel=new Set();let cells=[];

function prepare(app){
  const F=app.flows,n=F.links.length,years=W.meta.years.map(String),vars=W.meta.variables.map(v=>v.key);
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const coef={},maxCoef={},hist={},maxima={};
  for(const v of vars){hist[v]=new Float64Array(256);maxima[v]=[];}
  for(const y of years){
    coef[y]={};maxCoef[y]={};
    for(const v of vars){
      const a=coef[y][v]=bytes(W.coef[y][v]),m=maxCoef[y][v]=new Float32Array(n);
      for(let i=0;i<n;i++){let top=0;for(let t=0;t<T;t++){const c=a[i*T+t];hist[v][c]++;if(c>top)top=c;}m[i]=top/255;maxima[v].push(top/255);}
    }
  }
  for(const v of vars){for(let k=1;k<256;k++)hist[v][k]+=hist[v][k-1];maxima[v].sort(d3.ascending);}
  const flipped=W.flipped,arc=(v,i)=>2*i+(v==='am'?flipped[i]:1-flipped[i]);
  const load=(y,v,i,t)=>F.flows[y][Math.floor(t/24)][t%24][arc(v,i)];
  let loadMax=0;const band={};
  for(const y of years){
    band[y]={};
    for(const v of vars){
      const lo=new Float32Array(T).fill(Infinity),hi=new Float32Array(T),mean=new Float32Array(T);
      for(let t=0;t<T;t++){let sum=0;for(let i=0;i<n;i++){const x=load(y,v,i,t);if(x<lo[t])lo[t]=x;if(x>hi[t])hi[t]=x;sum+=x;}mean[t]=sum/n;if(hi[t]>loadMax)loadMax=hi[t];}
      band[y][v]={lo,hi,mean};
    }
  }
  const node=new Map(F.nodes.map(s=>[s.id,s]));
  const mid=F.links.map(l=>{const a=node.get(l.a),b=node.get(l.b);return [(a.lon+b.lon)/2,(a.lat+b.lat)/2];});
  const ex=d3.extent(mid,m=>m[0]),ey=d3.extent(mid,m=>m[1]);
  const zone=mid.map(m=>zoneColor((m[0]-ex[0])/(ex[1]-ex[0]),(m[1]-ey[0])/(ey[1]-ey[0])));
  const meanLoad=F.links.map((l,i)=>d3.mean(years,y=>d3.mean(d3.range(0,T,4),t=>load(y,'am',i,t)+load(y,'rev',i,t))));
  const order=d3.range(n).sort((a,b)=>meanLoad[a]-meanLoad[b]);
  const heatMax=d3.max(years,y=>d3.max(vars,v=>d3.max(W.heat[y][v].at(-1))));
  return {F,n,years,vars,coef,maxCoef,hist,maxima,flipped,load,loadMax,band,node,zone,order,heatMax,
    label:Object.fromEntries(W.meta.variables.map(v=>[v.key,v.label])),
    name:i=>`${short(node.get(F.links[i].a).name)} — ${short(node.get(F.links[i].b).name)}`,
    toward:(v,i)=>short(node.get(F.links[i][(v==='am')===!!flipped[i]?'a':'b']).name),
    // Percentil τ de todos los coeficientes de la variable (4 años) y de los máximos por tramo.
    cut:(v,tau)=>{const h=hist[v],goal=tau*h[255];let k=0;while(k<255&&h[k]<goal)k++;return k/255;},
    cutMax:(v,tau)=>d3.quantileSorted(maxima[v],tau)};
}

function cellSelection(){
  // Tramos que superan el umbral en todas las celdas elegidas del heatmap (intersección, como en 6.2).
  let out=null;
  for(const c of cells){
    const a=P.coef[c.year][c.v],cut=P.cut(c.v,state.segTau),hit=new Set();
    for(let i=0;i<P.n;i++)if(a[i*T+c.t]/255>=cut)hit.add(i);
    out=out?new Set([...out].filter(i=>hit.has(i))):hit;
  }
  sel.clear();for(const i of out??[])sel.add(i);
}

export function renderSegments(host,app,items){
  state.segVar??='am';state.segColor??='load';state.segTau??=.8;
  app._relane=null;
  if(failed){host.innerHTML=`<div class="map-stage sw-stage"><p class="sw-empty">No se pudo cargar data/segment_waves.json (${esc(failed)}). Genera el archivo con deliveries/week12/scripts/build_segment_waves.py. <button class="text-button" data-mode="flows">Volver a las curvas OD</button></p></div>`;host.querySelector('[data-mode]').onclick=()=>app.set({layer:'flows'});return;}
  if(!W){
    host.innerHTML='<div class="map-stage sw-stage"><p class="sw-empty">Cargando wavelets por tramo…</p></div>';
    loading??=d3.json('data/segment_waves.json').then(w=>{if(!w?.coef||w.meta.segments!==app.flows.links.length)throw Error('no corresponde a flows.json');W=w;}).catch(e=>{failed=e.message;});
    loading.then(()=>{if(state.layer==='segments'&&state.view==='map')app.set({});});return;
  }
  P??=prepare(app);
  const F=P.F,year=String(state.year),v=state.segVar,mode=state.segColor;
  const scope=new Set(items.map(s=>s.id)),inScope=F.links.map(l=>scope.has(l.a)||scope.has(l.b));
  const now=()=>state.flowDay*24+state.flowHour;
  // Alturas fijas de las vistas inferiores: se reservan antes de medir el mapa.
  const rowH=12,gap=9,left=84,top=13,HH=top+P.vars.length*(P.years.length*rowH+gap),SH=Math.max(120,HH+14),EH=Math.max(110,HH+2);

  host.innerHTML=`
  <div class="map-stage sw-stage">
    <div class="sw-map">
      <svg class="map-svg" role="img" aria-label="Mapa de la red de subway troceada en tramos entre estaciones"></svg>
      <div class="map-panel sw-controls">
        <div class="eyebrow">01 · TRAMOS ENTRE ESTACIONES</div>
        <div class="segmented sw-mode" role="group" aria-label="Qué muestra el mapa"><button data-mode="flows">Curvas OD</button><button data-mode="segments" class="active">Tramos</button></div>
        <div class="sw-hour-row"><span class="sw-day-current">${DAYS_LONG[state.flowDay]}</span><output id="sw-hour-label" class="flow-hour-label">${ampm(state.flowHour)}</output></div>
        <div class="segmented sw-days" role="group" aria-label="Día de la semana">${DAYS.map((d,i)=>`<button data-day="${i}" class="${state.flowDay===i?'active':''}" title="${DAYS_LONG[i]}">${d}</button>`).join('')}</div>
        <input id="sw-hour" class="flow-slider" type="range" min="0" max="23" step="1" value="${state.flowHour}" aria-label="Hora de entrada">
        <div class="flow-ticks"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span><span>11 pm</span></div>
        <div class="sw-field"><span>Sentido</span><div class="segmented" role="group" aria-label="Sentido del tramo">${W.meta.variables.map(x=>`<button data-var="${x.key}" class="${v===x.key?'active':''}" title="${esc(x.detail)}">${x.key==='am'?'De la mañana':'Contrario'}</button>`).join('')}</div></div>
        <div class="sw-field"><span>Color del tramo</span><div class="segmented" role="group" aria-label="Color del tramo">${[['load','Carga'],['wave','Cambio'],['zone','Zona']].map(([k,l])=>`<button data-color="${k}" class="${mode===k?'active':''}">${l}</button>`).join('')}</div></div>
        <label class="sw-field sw-tau" title="Percentil de los coeficientes wavelet de alta frecuencia. Decide qué tramos se resaltan en la proyección y cuáles selecciona un clic en la matriz."><span>Umbral de cambio τ <output id="sw-tau-out">${state.segTau.toFixed(2)}</output></span><input id="sw-tau" type="range" min="0.5" max="0.99" step="0.01" value="${state.segTau}"></label>
        <div class="map-control"><button id="sw-clear"${sel.size?'':' disabled'}>Quitar selección</button><button id="sw-center" title="Mostrar toda la red">Vista general ↺</button></div>
      </div>
      <div class="map-panel sw-legend" aria-label="Leyenda">
        <div class="map-legend-title">${esc(P.label[v])} · <span id="sw-legend-when">${whenText(now())}</span></div>
        <div class="map-legend-what">${state.year} · promedio por día de los doce meses. Un trazo = un tramo entre dos estaciones.</div>
        <div id="sw-key"></div>
        <div class="map-legend-foot" id="sw-count"></div>
      </div>
      <div class="map-credit">OD estimado MTA 2021–2024 · recorridos modelados · red de referencia GTFS 2026 · wavelets de grafo según ManyWaves</div>
    </div>
    <div class="sw-dock">
      <section class="sw-card"><div class="eyebrow">CUÁNDO CAMBIA CADA SENTIDO</div><h3>Cambios bruscos por hora <small>promedio del coeficiente wavelet de alta frecuencia</small></h3><svg id="sw-heat" style="height:${HH}px"></svg><p class="sw-hint">Clic en una celda: va a esa hora y selecciona los tramos que superan τ. Mayús + clic: cruza con otra celda.</p></section>
      <section class="sw-card"><div class="eyebrow">SERIES DE LA SEMANA</div><h3 id="sw-series-title"></h3><svg id="sw-series" style="height:${SH}px"></svg></section>
      <section class="sw-card sw-encoding"><div class="eyebrow">TRAMOS QUE CAMBIAN PARECIDO</div><h3>Proyección ${state.year} <small>AlignedUMAP</small></h3><svg id="sw-embed" style="height:${EH}px"></svg><p class="sw-hint">Cerca = cambian a las mismas horas. Arrastra para seleccionar.</p></section>
    </div>
  </div>`;

  // ---------- Mapa troceado ----------
  const svgNode=host.querySelector('.map-svg');
  if(!svgNode.clientHeight)svgNode.style.height='430px';
  const svg=d3.select(svgNode),width=svgNode.clientWidth,height=svgNode.clientHeight;svg.attr('viewBox',`0 0 ${width} ${height}`);
  const covered=app.geo.features.filter(f=>f.properties.name!=='Staten Island');
  const panel=host.querySelector('.sw-controls'),leftPad=getComputedStyle(panel).position==='absolute'&&width>=620?panel.offsetWidth+22:12;
  const projection=d3.geoMercator().fitExtent([[leftPad,12],[width-12,height-12]],{type:'FeatureCollection',features:covered});
  const flat=d3.geoTransform({point(lon,lat){const [x,y]=projection([lon,lat]);this.stream.point(x,y);}});
  const g=svg.append('g');
  g.selectAll('.map-bg').data(covered).join('path').attr('class','map-bg').attr('fill-rule','evenodd').attr('vector-effect','non-scaling-stroke').attr('d',d3.geoPath(flat));
  const line=d3.line(),shape=F.links.map(l=>line(l.coords.map(projection)));
  const tone=d3.scaleSqrt().domain([0,P.loadMax]).range([0,1]).clamp(true);
  const colorOf=(i,t)=>!inScope[i]?'#c9cfcc':mode==='zone'?P.zone[i]:mode==='wave'?WAVE(P.coef[year][v][i*T+t]/255):LOAD(tone(P.load(year,v,i,t)));
  const widthOf=(i,t)=>!inScope[i]?.8:mode==='wave'?1.1+5.4*P.coef[year][v][i*T+t]/255:1+6.5*tone(P.load(year,v,i,t));
  const dots=g.append('g').selectAll('circle').data(F.nodes).join('circle').attr('class','sw-station').attr('cx',s=>projection([s.lon,s.lat])[0]).attr('cy',s=>projection([s.lon,s.lat])[1]);
  const casing=g.append('g').attr('fill','none').attr('stroke','#102937').attr('stroke-linecap','round').selectAll('path').data(P.order).join('path').attr('d',i=>shape[i]).attr('vector-effect','non-scaling-stroke');
  const segs=g.append('g').attr('fill','none').attr('stroke-linecap','round').selectAll('path').data(P.order).join('path').attr('class','sw-seg').attr('d',i=>shape[i]).attr('vector-effect','non-scaling-stroke');
  const tip=(i,t)=>{
    const c=P.coef[year][v][i*T+t]/255,rank=Math.round(100*P.hist[v][Math.round(c*255)]/P.hist[v][255]);
    return `<b>${esc(P.name(i))}</b><br>Líneas: ${esc(F.links[i].routes.join(' ')||'transbordo a pie')}<br>${whenText(t)} · ${state.year}<br>De la mañana (hacia ${esc(P.toward('am',i))}): ${fmt(Math.round(P.load(year,'am',i,t)))}<br>Contrario (hacia ${esc(P.toward('rev',i))}): ${fmt(Math.round(P.load(year,'rev',i,t)))}<br>Cambio brusco, ${esc(P.label[v].toLowerCase())}: ${fmt(Math.round(c*100)/100)} · percentil ${rank}<br><small>Clic: añadir o quitar de la selección</small>`;
  };
  g.append('g').attr('fill','none').attr('stroke','transparent').attr('stroke-width',11).selectAll('path').data(P.order.filter(i=>inScope[i])).join('path').attr('class','sw-hit').attr('d',i=>shape[i]).attr('vector-effect','non-scaling-stroke')
    .on('pointerenter pointermove',(e,i)=>showTooltip(tip(i,now()),e)).on('pointerleave',hideTooltip)
    .on('click',(e,i)=>{e.stopPropagation();cells=[];sel.has(i)?sel.delete(i):sel.add(i);app.set({});});
  const zoom=d3.zoom().scaleExtent([1,12]).translateExtent([[0,0],[width,height]]).on('zoom',e=>{transform=e.transform;g.attr('transform',transform);dots.attr('r',Math.min(2.2,.9+.25*transform.k)/transform.k);hideTooltip();});
  svg.call(zoom).call(zoom.transform,transform);
  host.querySelector('#sw-center').onclick=()=>svg.transition().duration(250).call(zoom.transform,d3.zoomIdentity);

  // ---------- Heatmap of Changes: una fila por sentido y año ----------
  const heatNode=host.querySelector('#sw-heat'),HW=heatNode.clientWidth||440;
  const rows=P.vars.flatMap((key,k)=>P.years.map((y,j)=>({key,y,top:top+k*(P.years.length*rowH+gap)+j*rowH})));
  const hx=d3.scaleLinear().domain([0,T]).range([left,HW-4]),cw=(HW-4-left)/T;
  const heat=d3.select(heatNode).attr('viewBox',`0 0 ${HW} ${HH}`);
  heat.selectAll('.sw-day').data(DAYS).join('text').attr('class','sw-axis').attr('x',(d,i)=>hx(i*24+12)).attr('y',8).attr('text-anchor','middle').text(d=>d);
  const heatScale=d3.scaleLinear().domain([0,P.heatMax]).range([0,1]).clamp(true);
  for(const r of rows){
    const values=W.heat[r.y][r.key].at(-1),current=r.y===year&&r.key===v;
    heat.append('text').attr('class','sw-axis'+(r.y===year?' current':'')).attr('x',left-5).attr('y',r.top+rowH-3).attr('text-anchor','end').text(r.y);
    heat.append('g').selectAll('rect').data(values).join('rect').attr('x',(d,t)=>hx(t)).attr('y',r.top).attr('width',cw+.3).attr('height',rowH-1).attr('fill',d=>WAVE(heatScale(d)))
      .on('pointerenter pointermove',(e,d)=>{const t=Math.floor(hx.invert(d3.pointer(e,heatNode)[0]));showTooltip(`<b>${esc(P.label[r.key])} · ${r.y}</b><br>${whenText(Math.max(0,Math.min(T-1,t)))}<br>Cambio promedio: ${fmt(Math.round(1000*d)/1000)}`,e);}).on('pointerleave',hideTooltip)
      .on('click',(e,d)=>{
        const t=Math.max(0,Math.min(T-1,Math.floor(hx.invert(d3.pointer(e,heatNode)[0])))),cell={year:r.y,v:r.key,t};
        cells=e.shiftKey?[...cells.filter(c=>!(c.year===cell.year&&c.v===cell.v&&c.t===cell.t)),cell]:[cell];
        cellSelection();
        if(+r.y<=BASE)setBase(Math.max(2021,+r.y-1));
        app.set({year:+r.y,segVar:r.key,flowDay:Math.floor(t/24),flowHour:t%24});
        if(!sel.size)app.toast('Ningún tramo supera el umbral τ en esa celda. Baja τ para ver los más altos.');
      });
    if(current)heat.append('rect').attr('class','sw-row-current').attr('x',left-.5).attr('y',r.top-.5).attr('width',HW-4-left+1).attr('height',rowH).attr('fill','none');
  }
  P.vars.forEach((key,k)=>heat.append('text').attr('class','sw-axis sw-var'+(key===v?' current':'')).attr('x',0).attr('y',top+k*(P.years.length*rowH+gap)+rowH*2+3).text(key==='am'?'Mañana':'Contrario'));
  heat.selectAll('.sw-daysep').data(d3.range(1,7)).join('line').attr('class','sw-daysep').attr('x1',d=>hx(d*24)).attr('x2',d=>hx(d*24)).attr('y1',top).attr('y2',HH-gap);
  heat.selectAll('.sw-cell').data(cells).join('rect').attr('class','sw-cell').attr('x',c=>hx(c.t)-1).attr('y',c=>rows.find(r=>r.y===c.year&&r.key===c.v).top-1).attr('width',cw+2).attr('height',rowH+1).attr('fill','none');
  const heatMark=heat.append('line').attr('class','sw-now').attr('y1',top-2).attr('y2',HH-gap+1);

  // ---------- Series con banda mínimo–máximo de todos los tramos ----------
  const seriesNode=host.querySelector('#sw-series'),SW=seriesNode.clientWidth||300,ph=(SH-16)/2;
  const series=d3.select(seriesNode).attr('viewBox',`0 0 ${SW} ${SH}`);
  const chosen=[...sel].sort((a,b)=>P.maxCoef[year][v][b]-P.maxCoef[year][v][a]),drawn=chosen.slice(0,60);
  host.querySelector('#sw-series-title').innerHTML=sel.size?`${sel.size} tramo${sel.size>1?'s':''} seleccionado${sel.size>1?'s':''} <small>${sel.size>60?'los 60 con más cambio · ':''}línea gruesa: su promedio · gris: toda la red</small>`:`Toda la red <small>gris: mínimo y máximo · línea: promedio</small>`;
  const sx=d3.scaleLinear().domain([0,T-1]).range([34,SW-4]),marks=[];
  P.vars.forEach((key,k)=>{
    const b=P.band[year][key],y0=k*(ph+8)+2;
    // Con selección, el eje llega al máximo de los tramos elegidos; la banda de la red se recorta.
    const yMax=sel.size?d3.max(chosen,i=>d3.max(d3.range(T),t=>P.load(year,key,i,t)))||1:d3.max(b.hi),sy=d3.scaleLinear().domain([0,yMax]).range([y0+ph,y0+8]);
    const panel=series.append('g');
    panel.append('clipPath').attr('id','sw-clip-'+key).append('rect').attr('x',34).attr('y',y0+8).attr('width',SW-38).attr('height',ph-8);
    panel.append('path').attr('class','sw-band').attr('clip-path',`url(#sw-clip-${key})`).attr('d',d3.area().x((d,t)=>sx(t)).y0((d,t)=>sy(b.lo[t])).y1(d=>sy(d))(b.hi));
    panel.selectAll('.sw-daysep').data(d3.range(1,7)).join('line').attr('class','sw-daysep').attr('x1',d=>sx(d*24)).attr('x2',d=>sx(d*24)).attr('y1',y0+8).attr('y2',y0+ph);
    const path=d3.line().x((d,t)=>sx(t)).y(d=>sy(d));
    for(const i of drawn)panel.append('path').attr('class','sw-line').attr('d',path(d3.range(T).map(t=>P.load(year,key,i,t))));
    const mean=sel.size?d3.range(T).map(t=>d3.mean(chosen,i=>P.load(year,key,i,t))):Array.from(b.mean);
    panel.append('path').attr('class','sw-mean').attr('d',path(mean));
    panel.append('text').attr('class','sw-axis sw-var'+(key===v?' current':'')).attr('x',SW-4).attr('y',y0+6).attr('text-anchor','end').text(P.label[key]);
    panel.append('text').attr('class','sw-axis').attr('x',30).attr('y',y0+12).attr('text-anchor','end').text(yMax>=1000?fmt(Math.round(yMax/100)/10)+' mil':fmt(Math.round(yMax)));
    panel.append('text').attr('class','sw-axis').attr('x',30).attr('y',y0+ph).attr('text-anchor','end').text('0');
    marks.push(panel.append('line').attr('class','sw-now').attr('y1',y0+8).attr('y2',y0+ph));
  });
  series.selectAll('.sw-dayname').data(DAYS).join('text').attr('class','sw-axis').attr('x',(d,i)=>sx(i*24+12)).attr('y',SH-1).attr('text-anchor','middle').text(d=>d);

  // ---------- Wavelet Encoding: AlignedUMAP por año ----------
  const embedNode=host.querySelector('#sw-embed'),EW=embedNode.clientWidth||200;
  const embed=d3.select(embedNode).attr('viewBox',`0 0 ${EW} ${EH}`);
  const E=W.embed[year],ex=d3.scaleLinear().domain([0,1]).range([8,EW-8]),ey=d3.scaleLinear().domain([0,1]).range([EH-8,8]);
  const strong=i=>inScope[i]&&P.vars.some(key=>P.maxCoef[year][key][i]>=P.cutMax(key,state.segTau));
  const from=lastEmbed&&lastEmbed.year!==year?W.embed[lastEmbed.year]:E;lastEmbed={year};
  const brush=d3.brush().extent([[0,0],[EW,EH]]).on('end',e=>{
    if(!e.sourceEvent||!e.selection)return;
    const [[x0,y0],[x1,y1]]=e.selection;cells=[];sel.clear();
    for(let i=0;i<P.n;i++)if(inScope[i]&&ex(E[i][0])>=x0&&ex(E[i][0])<=x1&&ey(E[i][1])>=y0&&ey(E[i][1])<=y1)sel.add(i);
    app.set({});
  });
  embed.append('g').call(brush);
  const pts=embed.append('g').selectAll('circle').data(d3.range(P.n).sort((a,b)=>strong(a)-strong(b))).join('circle')
    .attr('class',i=>'sw-pt'+(strong(i)?' strong':'')+(sel.has(i)?' selected':'')).attr('r',i=>1.4+2.8*Math.max(P.maxCoef[year].am[i],P.maxCoef[year].rev[i]))
    .attr('fill',i=>strong(i)?P.zone[i]:'#b9c1bd').attr('cx',i=>ex(from[i][0])).attr('cy',i=>ey(from[i][1]))
    .on('pointerenter pointermove',(e,i)=>showTooltip(`<b>${esc(P.name(i))}</b><br>Cambio máximo en la semana: mañana ${fmt(Math.round(100*P.maxCoef[year].am[i])/100)} · contrario ${fmt(Math.round(100*P.maxCoef[year].rev[i])/100)}<br><small>Clic: añadir o quitar de la selección</small>`,e)).on('pointerleave',hideTooltip)
    .on('click',(e,i)=>{e.stopPropagation();cells=[];sel.has(i)?sel.delete(i):sel.add(i);app.set({});});
  if(from!==E)pts.transition().duration(700).attr('cx',i=>ex(E[i][0])).attr('cy',i=>ey(E[i][1]));
  // Clave del colormap 2D: misma orientación que el mapa (norte arriba).
  const key2d=embed.append('g').attr('transform',`translate(${EW-31},3)`).attr('pointer-events','none');
  key2d.selectAll('rect').data(d3.range(25)).join('rect').attr('x',d=>(d%5)*5).attr('y',d=>20-Math.floor(d/5)*5).attr('width',5.2).attr('height',5.2).attr('fill',d=>zoneColor((d%5)/4,Math.floor(d/5)/4));
  key2d.append('text').attr('class','sw-axis').attr('x',12.5).attr('y',33).attr('text-anchor','middle').text('zona');

  // ---------- Pintado rápido al mover la hora ----------
  function paint(){
    const t=now(),any=sel.size>0;
    segs.attr('stroke',i=>colorOf(i,t)).attr('stroke-width',i=>widthOf(i,t)).attr('opacity',i=>any&&!sel.has(i)?.22:1);
    casing.attr('display',i=>sel.has(i)&&sel.size<=40?null:'none').attr('stroke-width',i=>widthOf(i,t)+2.4);
    heatMark.attr('x1',hx(t+.5)).attr('x2',hx(t+.5));
    for(const m of marks)m.attr('x1',sx(t)).attr('x2',sx(t));
    host.querySelector('#sw-hour-label').value=ampm(state.flowHour);host.querySelector('#sw-legend-when').textContent=whenText(t);
    const cut=P.cut(v,state.segTau);let above=0;for(let i=0;i<P.n;i++)if(inScope[i]&&P.coef[year][v][i*T+t]/255>=cut)above++;
    host.querySelector('#sw-count').textContent=`${above} de ${d3.sum(inScope)} tramos superan τ a esta hora${sel.size?` · ${sel.size} seleccionados`:''}`;
    d3.selectAll('#inspector [data-clock-cell]').attr('stroke',i=>i===t?'#102937':null).attr('stroke-width',i=>i===t?1.6:null).attr('aria-pressed',i=>String(i===t));
  }
  paint();
  const key=host.querySelector('#sw-key');
  if(mode==='zone')key.innerHTML='<div class="map-key-note">Color = posición geográfica del tramo, la misma clave de la proyección. Sirve para ubicar en el mapa los grupos que aparecen allí.</div>';
  else{
    const ramp=mode==='wave'?WAVE:LOAD,ticks=mode==='wave'?[[0,'0'],[.5,'0,5'],[1,'1']]:[0,5000,20000,P.loadMax].map(x=>[tone(x),x>=1000?Math.round(x/1000)+' mil':'0']);
    key.innerHTML=`<div class="map-key-bar" style="background:linear-gradient(90deg,${d3.range(21).map(i=>ramp(i/20)).join(',')})"></div><div class="sw-key-ticks">${ticks.map(([p,l])=>`<span style="left:${100*p}%;transform:translateX(${p<=0?0:p>=1?-100:-50}%)">${l}</span>`).join('')}</div><div class="map-key-note">${mode==='wave'?'Coeficiente wavelet de alta frecuencia, normalizado de 0 a 1 con los cuatro años. Alto: la carga del tramo difiere de la de sus tramos vecinos y de la hora anterior y siguiente. Más ancho = más cambio.':'Viajes de la hora en ese sentido (promedio por día). Color y ancho en escala raíz, fija entre horas y años.'}</div>`;
  }

  // ---------- Controles ----------
  const slider=host.querySelector('#sw-hour');slider.oninput=()=>{state.flowHour=+slider.value;paint();app.syncURL?.();};
  host.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>app.set({flowDay:+b.dataset.day}));
  host.querySelectorAll('[data-var]').forEach(b=>b.onclick=()=>app.set({segVar:b.dataset.var}));
  host.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>app.set({segColor:b.dataset.color}));
  host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>app.set({layer:b.dataset.mode}));
  const tau=host.querySelector('#sw-tau');
  tau.oninput=()=>{host.querySelector('#sw-tau-out').value=(+tau.value).toFixed(2);};
  tau.onchange=()=>{state.segTau=+tau.value;if(cells.length)cellSelection();app.set({});};
  host.querySelector('#sw-clear').onclick=()=>{sel.clear();cells=[];app.set({});};
  svg.on('click.clear',e=>{if(sel.size&&!e.defaultPrevented){sel.clear();cells=[];app.set({});}});
}
