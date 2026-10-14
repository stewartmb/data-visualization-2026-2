import {atlasOrder} from './atlas-order.js?v=20261014-2';
import {state,esc,fmt,signed,profile,metricValue,hellinger,deltaColor,shareColor,cellValue,showTooltip,hideTooltip,heading,stats,dayShort} from './model.js?v=20261014-7';

export function renderAtlas(host,app,items){
  const focus=app.station(state.selected),order=atlasOrder(items,state,focus);
  state.sort=order.key;
  host.innerHTML=heading('01 / EXPLORAR PATRONES','Una ciudad. Muchos ritmos.','Cada fila es un complejo de estación; cada columna, una hora de la semana. Reordena el atlas para reconocer semejanzas y localizar los cambios.','T1 · T2 · T3')+`
  <div class="toolbar"><div class="segmented" id="matrix-mode"><button data-mode="delta">Cambio</button><button data-mode="current">${state.year}</button><button data-mode="base">2020</button></div>
  <label>Ordenar<select id="matrix-sort">${order.options.map(([v,t])=>`<option value="${v}" ${v==='similar'&&!focus?'disabled':''}>${t}${v==='similar'&&!focus?' (selecciona una estación)':''}</option>`).join('')}</select></label>
  <label>Tiempo<select id="matrix-day"><option value="all">Semana completa</option>${dayShort.map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select></label>
  <div class="segmented spacer" id="matrix-zoom"><button data-detail="false">Todo el grupo</button><button data-detail="true">Leer estaciones</button></div></div>
  <div class="order-explanation" role="status"><b>Orden de arriba hacia abajo</b><span>${esc(order.description)}</span><small>El orden se recalcula al cambiar el año, el modo o el día. Las cifras junto a los nombres muestran el criterio; pasa el cursor para leerlo completo.</small></div>
  <div class="viz-card"><svg class="matrix-axis" aria-hidden="true"></svg><div class="matrix-scroll"><canvas tabindex="0" aria-label="Atlas horario. Usa el selector de complejos para acceder a cualquier fila con el teclado."></canvas><div class="matrix-spacer"></div></div>
  <div class="chart-note"><div class="color-key">${state.mode==='delta'?'−0,65 pp':''}<span class="gradient ${state.mode==='delta'?'':'seq'}"></span>${state.mode==='delta'?'+0,65 pp':'1,5 %'}</div><span id="matrix-hover">${state.mode==='delta'?'Azul: menor peso · naranja: mayor peso respecto de 2020.':'Porcentaje de las entradas de una semana comparable.'}</span></div></div>
  <div class="toolbar"><label>Ir a un complejo<select id="station-picker" aria-label="Seleccionar complejo"><option value="">Selecciona…</option>${items.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.borough)}</option>`).join('')}</select></label><span style="font-size:10px;color:var(--muted)">Clic: detalle · Mayús + clic: fijar · Mayús + arrastrar filas: formar grupo</span></div>
  ${stats(items)}<div class="narrative"><b>Cómo comparar</b><span>La forma de cada estación se normaliza a 100 %. Un cambio de color indica distribución horaria, no un aumento o una caída del número de pasajeros.</span></div>`;
  host.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',state.mode===b.dataset.mode);b.onclick=()=>app.set({mode:b.dataset.mode});});
  const sort=host.querySelector('#matrix-sort');sort.value=state.sort;sort.onchange=()=>app.set({sort:sort.value});
  const day=host.querySelector('#matrix-day');day.value=state.day;day.onchange=()=>app.set({day:day.value});
  host.querySelectorAll('[data-detail]').forEach(b=>{b.classList.toggle('active',String(state.detail)===b.dataset.detail);b.onclick=()=>app.set({detail:b.dataset.detail==='true'});});
  const picker=host.querySelector('#station-picker');picker.value=state.selected||'';picker.onchange=()=>{if(picker.value)app.select(picker.value);};
  if(!items.length){host.querySelector('.matrix-scroll').innerHTML='<div class="empty">Ningún complejo cumple estos filtros.<br>Restablece el grupo o cambia la búsqueda.</div>';return;}
  const rows=order.rows;
  const scroller=host.querySelector('.matrix-scroll'),canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d');
  const width=scroller.clientWidth,height=scroller.clientHeight,label=Math.min(285,Math.max(125,width*.28)),axisH=43;
  const columns=state.day==='all'?d3.range(168):d3.range(+state.day*24,+state.day*24+24);
  const colW=(width-label-10)/columns.length,rowH=state.detail?36:Math.max(1,height/rows.length),totalH=Math.max(height,rowH*rows.length);
  const ratio=Math.min(devicePixelRatio||1,2);
  canvas.width=width*ratio;canvas.height=height*ratio;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.scale(ratio,ratio);
  host.querySelector('.matrix-spacer').style.height=Math.max(0,totalH-height)+'px';
  const axis=d3.select(host.querySelector('.matrix-axis')).attr('viewBox',`0 0 ${width} ${axisH}`);
  axis.append('text').attr('x',12).attr('y',26).attr('fill','#72837d').attr('font-size',9).text(`${rows.length} complejos · valor del orden`);
  for(const d of state.day==='all'?d3.range(7):[+state.day]){
    const start=state.day==='all'?d*24:0;
    axis.append('text').attr('x',label+(start+12)*colW).attr('y',14).attr('text-anchor','middle').attr('font-size',10).attr('fill','#405c61').text(dayShort[d]);
    const ticks=24*colW<45?[0]:24*colW<75?[0,12]:[0,6,12,18];
    for(const h of ticks)axis.append('text').attr('x',label+(start+h)*colW+1).attr('y',32).attr('font-size',8).attr('fill','#81908b').text(String(h).padStart(2,'0'));
  }
  let hover=-1,dragStart=null;
  function draw(){
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    const offset=scroller.scrollTop,first=Math.max(0,Math.floor(offset/rowH)),last=Math.min(rows.length,Math.ceil((offset+height)/rowH));
    for(let r=first;r<last;r++){
      const s=rows[r],y=r*rowH-offset;
      for(let c=0;c<columns.length;c++){
        const v=cellValue(s,columns[c]);ctx.fillStyle=state.mode==='delta'?deltaColor(v):shareColor(v);
        ctx.fillRect(label+c*colW,y,Math.ceil(colW+.05),rowH+(state.detail?-1:.25));
      }
      const isSelected=s.id===state.selected,isPin=state.pins.includes(s.id);
      if(state.detail){
        ctx.fillStyle=isSelected?'#e8f2eb':isPin?'#faf0e6':'#fff';ctx.fillRect(0,y,label-2,rowH);
        ctx.fillStyle=isSelected?'#0b6b78':'#556d71';ctx.font=`${isSelected?'bold ':''}10px system-ui`;ctx.fillText((isPin?'◆ ':'')+s.name.slice(0,Math.floor((label-15)/5.4)),9,y+14);
        ctx.font='9px system-ui';ctx.fillStyle='#526963';ctx.fillText(`${r+1} · ${order.format(s)}`,9,y+28);
        ctx.strokeStyle='#e5ece6';ctx.beginPath();ctx.moveTo(0,y+rowH-.5);ctx.lineTo(width,y+rowH-.5);ctx.stroke();
      }
      if(isSelected||isPin||r===hover){ctx.strokeStyle=isSelected?'#102937':isPin?'#c96035':'#102937';ctx.lineWidth=isSelected?2:1;ctx.strokeRect(label,y,width-label-10,Math.max(rowH,2));}
    }
    ctx.strokeStyle='#fff';ctx.lineWidth=2;
    if(state.day==='all')for(let d=1;d<7;d++){ctx.beginPath();ctx.moveTo(label+d*24*colW,0);ctx.lineTo(label+d*24*colW,height);ctx.stroke();}
    if(!state.detail){ctx.fillStyle='#60756f';ctx.font='10px system-ui';for(let i=0;i<rows.length;i+=Math.max(1,Math.ceil(rows.length/9))){const y=i*rowH-offset;if(y>=0&&y<height)ctx.fillText(`${i+1} · ${rows[i].name.slice(0,Math.max(10,Math.floor((label-12)/5.4)-15))} · ${order.format(rows[i])}`,9,y+11);}}
  }
  function hit(e){const rect=canvas.getBoundingClientRect();const r=Math.floor((e.clientY-rect.top+scroller.scrollTop)/rowH),c=Math.floor((e.clientX-rect.left-label)/colW);return {r,c};}
  canvas.addEventListener('pointermove',e=>{
    const {r,c}=hit(e),s=rows[r];if(!s)return;
    hover=r;draw();host.querySelector('#matrix-hover').textContent=`${s.name} · ${s.borough} · orden: ${order.format(s)}`;
    if(c<0)showTooltip(`<b>${esc(s.name)}</b><br>Posición ${r+1} de ${rows.length}<br>Valor del orden: ${esc(order.format(s))}<br>${esc(order.description)}`,e);
    if(c>=0&&c<columns.length){const i=columns[c],h=i%24,d=Math.floor(i/24),a=profile(s,2020).p[i]*100,b=profile(s).p[i]*100;
      showTooltip(`<b>${esc(s.name)}</b><br>${dayShort[d]} ${h}:00–${h+1}:00<br><small>Peso en una semana comparable</small><br>2020: ${a.toFixed(3)} % · ${state.year}: ${b.toFixed(3)} %<br>Cambio: ${(b-a).toFixed(3)} pp`,e);}
  });
  canvas.addEventListener('pointerleave',()=>{hover=-1;hideTooltip();draw();});
  canvas.addEventListener('pointerdown',e=>{dragStart=hit(e).r;});
  canvas.addEventListener('pointerup',e=>{
    const {r}=hit(e);if(!rows[r])return;
    if(e.shiftKey&&dragStart!==null&&Math.abs(r-dragStart)>1){const a=Math.max(0,Math.min(r,dragStart)),b=Math.min(rows.length-1,Math.max(r,dragStart));app.set({cohort:new Set(rows.slice(a,b+1).map(s=>s.id)),preset:null});}
    else if(e.shiftKey)app.pin(rows[r].id);else app.select(rows[r].id);
    dragStart=null;
  });
  canvas.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const i=Math.max(0,rows.findIndex(s=>s.id===state.selected)),next=Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1)));app.select(rows[next].id);}
  });
  scroller.addEventListener('scroll',()=>{hideTooltip();draw();});draw();
  const extremes=d3.sum(rows,s=>d3.sum(columns,i=>Math.abs(cellValue(s,i))>(state.mode==='delta'?.65:1.5)?1:0));
  host.querySelector('.chart-note').insertAdjacentHTML('beforeend',`<span style="margin-left:auto;font-size:9px">${extremes} celdas saturan la escala; el tooltip conserva el valor.</span>`);
}
