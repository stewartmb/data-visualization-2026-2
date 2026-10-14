import {state,esc,fmt,profile,cohortProfile,showTooltip,hideTooltip,heading,stats} from './model.js';

export function renderPaths(host,app,items){
  host.innerHTML=heading('03 / SEGUIR TRAYECTORIAS','La recuperación no sigue una sola dirección.','Sigue dos cambios del ritmo a la vez: el peso de la mañana laborable y el del fin de semana. Cada punto fechado representa enero–febrero de ese año.','T1 · T4 · T5')+`
  <div class="toolbar"><div class="segmented"><button id="focus-paths" class="${state.pathsFocus?'active':''}">Enfocar trayectorias</button><button id="all-paths" class="${!state.pathsFocus?'active':''}">Todos los complejos</button></div><span>Arrastra para formar un grupo por su posición en ${state.year}.</span></div>
  <div class="viz-card"><svg class="paths-svg" role="img" aria-label="Trayectorias del peso de la mañana y del fin de semana entre 2020 y el año seleccionado"></svg><div class="path-key"><i></i> Sistema completo <i class="sel"></i> Estación seleccionada</div><div class="chart-note">La línea conecta años, no trayectos del metro. Sistema: distribución ponderada por entradas; los puntos tenues son estaciones en ${state.year}.</div></div>
  ${stats(items)}<div class="narrative"><b>Contexto de servicio</b><span>En enero–febrero de 2021 hubo cierres nocturnos del metro. El cambio de forma combina uso y condiciones de operación; consulta Evidencia antes de interpretar motivos.</span></div>`;
  const svg=d3.select(host.querySelector('svg')),width=svg.node().clientWidth,height=svg.node().clientHeight;
  host.querySelector('#focus-paths').onclick=()=>app.set({pathsFocus:true});
  host.querySelector('#all-paths').onclick=()=>app.set({pathsFocus:false});
  svg.attr('viewBox',`0 0 ${width} ${height}`);
  const margin={left:66,right:32,top:42,bottom:57};
  const ids=[...new Set([...state.pins,state.selected].filter(Boolean))];
  const paths=[{id:'system',label:'Sistema',color:'#c96035',points:d3.range(2020,state.year+1).map(year=>({year,p:app.data.system[year]}))}];
  if(state.cohort||state.borough!=='all'||state.preset||state.query){const pts=d3.range(2020,state.year+1).map(year=>({year,p:cohortProfile(items,year)}));if(pts.some(p=>p.p))paths.push({id:'group',label:'Grupo activo',color:'#9a7a45',points:pts});}
  ids.forEach((id,i)=>{const s=app.station(id);if(s)paths.push({id,label:s.name,color:id===state.selected?'#0b7c83':['#8454a1','#627d40','#b9862c'][i%3],points:d3.range(2020,state.year+1).map(year=>({year,p:profile(s,year)}))});});
  host.querySelector('.path-key').innerHTML=paths.map(r=>`<div style="margin:4px 0"><i style="background:${r.color};margin-left:0"></i>${esc(r.id==='system'?'Sistema completo':r.label)}</div>`).join('');
  const all=state.pathsFocus?paths.flatMap(r=>r.points.map(d=>d.p).filter(Boolean)):app.data.stations.flatMap(s=>d3.range(2020,state.year+1).map(y=>profile(s,y)).filter(Boolean));
  const x=d3.scaleLinear().domain([Math.max(0,d3.min(all,p=>p.am)-(state.pathsFocus?.6:2)),Math.min(100,d3.max(all,p=>p.am)+(state.pathsFocus?.6:2))]).nice().range([margin.left,width-margin.right]);
  const y=d3.scaleLinear().domain([Math.max(0,d3.min(all,p=>p.weekend)-(state.pathsFocus?.6:1)),Math.min(100,d3.max(all,p=>p.weekend)+(state.pathsFocus?.6:1))]).nice().range([height-margin.bottom,margin.top]);
  const defs=svg.append('defs');
  defs.append('clipPath').attr('id','phase-clip').append('rect').attr('x',margin.left).attr('y',margin.top).attr('width',width-margin.left-margin.right).attr('height',height-margin.top-margin.bottom);
  svg.append('rect').attr('class','paths-bg').attr('x',margin.left).attr('y',margin.top).attr('width',width-margin.left-margin.right).attr('height',height-margin.top-margin.bottom);
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).ticks(7).tickFormat(v=>`${v} %`).tickSize(-(height-margin.top-margin.bottom))).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','chart-axis').attr('transform',`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(v=>`${v} %`).tickSize(-(width-margin.left-margin.right))).call(g=>g.select('.domain').remove());
  svg.append('text').attr('class','axis-label').attr('x',(width+margin.left)/2).attr('y',height-15).attr('text-anchor','middle').text('Peso AM · 06:00–10:00 sobre el total de lunes a viernes →');
  svg.append('text').attr('class','axis-label').attr('x',margin.left).attr('y',23).text('↑ Peso de sábado + domingo sobre una semana comparable');
  // Brush underneath points: selecting a point remains available, as in the original prototype.
  const brush=d3.brush().extent([[margin.left,margin.top],[width-margin.right,height-margin.bottom]]).on('end',event=>{
    if(!event.sourceEvent||!event.selection)return;
    const [[x0,y0],[x1,y1]]=event.selection;
    const cohort=new Set(items.filter(s=>{const p=profile(s);return x(p.am)>=x0&&x(p.am)<=x1&&y(p.weekend)>=y0&&y(p.weekend)<=y1;}).map(s=>s.id));
    app.set({cohort,preset:null});
  });
  svg.append('g').attr('class','paths-brush').call(brush);
  const itemsSet=new Set(items.map(s=>s.id));
  svg.append('g').attr('clip-path','url(#phase-clip)').selectAll('circle').data(app.data.stations.filter(s=>profile(s))).join('circle')
    .attr('class','path-station').attr('cx',s=>x(profile(s).am)).attr('cy',s=>y(profile(s).weekend)).attr('r',s=>itemsSet.has(s.id)?3.7:2)
    .style('opacity',s=>itemsSet.has(s.id)?.55:.10).style('fill',s=>itemsSet.has(s.id)?'#678b86':'#b8c7c1')
    .on('pointerenter',(e,s)=>showTooltip(`<b>${esc(s.name)}</b><br>${state.year} · ${esc(s.borough)}<br>AM: ${fmt(profile(s).am)} %<br>Fin de semana: ${fmt(profile(s).weekend)} %`,e)).on('pointerleave',hideTooltip)
    .on('click',(e,s)=>{e.stopPropagation();if(itemsSet.has(s.id))e.shiftKey?app.pin(s.id):app.select(s.id);});
  const line=d3.line().defined(d=>d.p).x(d=>x(d.p.am)).y(d=>y(d.p.weekend));
  const occupied=[];
  paths.forEach((r,i)=>{
    defs.append('marker').attr('id',`arrow-${i}`).attr('viewBox','0 -4 8 8').attr('refX',7).attr('refY',0).attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto').append('path').attr('d','M0,-3L7,0L0,3').attr('fill',r.color);
    svg.append('path').datum(r.points).attr('d',line).attr('fill','none').attr('stroke',r.color).attr('stroke-width',r.id==='system'?2.8:2).attr('marker-end',`url(#arrow-${i})`).attr('stroke-dasharray',r.id==='group'?'4,4':null).style('pointer-events','none');
    svg.append('g').selectAll('circle').data(r.points.filter(d=>d.p)).join('circle').attr('cx',d=>x(d.p.am)).attr('cy',d=>y(d.p.weekend)).attr('r',r.id==='system'?5:4).attr('fill',r.color).attr('stroke','#fff').attr('stroke-width',1.5)
      .on('pointerenter',(e,d)=>showTooltip(`<b>${esc(r.label)} · ${d.year}</b><br>AM ${fmt(d.p.am)} % · fin de semana ${fmt(d.p.weekend)} %`,e)).on('pointerleave',hideTooltip);
    if(r.id==='system'||r.id===state.selected)r.points.filter(d=>d.p).forEach(d=>{
      const px=x(d.p.am),py=y(d.p.weekend),offsets=[[10,-10],[10,21],[-39,-10],[-39,21],[14,-26],[-44,35],[12,38]];
      let box;
      for(const [dx,dy] of offsets){const b={x:px+dx,y:py+dy-10,w:32,h:14};if(b.x>margin.left&&b.x+b.w<width-margin.right&&b.y>margin.top&&b.y+b.h<height-margin.bottom&&!occupied.some(o=>b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y)){box=b;break;}}
      box ||= {x:px+10,y:py-20,w:32,h:14};occupied.push(box);
      svg.append('text').attr('class','path-year').attr('x',box.x).attr('y',box.y+10).attr('fill',r.color).text(d.year).style('pointer-events','none');
    });
  });
  svg.on('dblclick',()=>app.set({cohort:null,preset:null}));
}
