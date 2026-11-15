export function bindMapLasso({svg,outlines,zoom,width,height,projection,stations,position,app,twoZones}){
  const node=svg.node();
  const singleButton=document.querySelector('#map-select');
  const pairButton=document.querySelector('#map-select-pair');
  const hint=document.querySelector('#map-selection-hint');
  const line=d3.line();
  function showAreas(areas){
    outlines.selectAll('path').data(areas).join('path')
      .attr('class',(_,i)=>`map-zone-outline zone-${i?'b':'a'}`)
      .attr('d',area=>line(area.map(projection))+'Z');
  }
  const savedAreas=twoZones?.outlines??(app.state.areaOutline?[app.state.areaOutline]:[]);
  showAreas(savedAreas);

  const appliedMode=twoZones?'pair':app.state.cohort?'single':null;
  let overlay,mode,first,pointerId,points;
  function syncButtons(){
    const active=overlay?mode:appliedMode;
    for(const [button,choice] of [[singleButton,'single'],[pairButton,'pair']]){
      if(!button)continue;
      const pressed=active===choice;
      button.classList.toggle('active',pressed);
      button.setAttribute('aria-pressed',String(pressed));
    }
  }
  syncButtons();

  function finish(){
    if(!overlay)return;
    overlay.remove();
    overlay=null;
    first=null;
    pointerId=null;
    points=null;
    syncButtons();
    hint.hidden=true;
    node.removeEventListener('keydown',cancelOnEscape);
    node.removeAttribute('tabindex');
    svg.classed('is-lasso-active',false).call(zoom);
    showAreas(savedAreas);
  }
  function cancelOnEscape(event){
    if(event.key!=='Escape')return;
    event.stopPropagation();
    finish();
  }
  function start(choice){
    if(overlay){
      const previous=mode;
      finish();
      if(previous===choice)return;
    }
    if(choice===appliedMode){
      app.set(choice==='pair'?{odZones:null}:{cohort:null});
      return;
    }
    mode=choice;
    pointerId=null;
    hint.hidden=false;
    hint.textContent=choice==='pair'?'Dibuja la zona A y suelta.':'Rodea los complejos que quieres incluir.';
    showAreas([]);
    const wheel=svg.on('wheel.zoom');
    svg.classed('is-lasso-active',true).on('.zoom',null).on('wheel.zoom',function(event,d){
      if(pointerId===null)wheel.call(this,event,d);
      else event.preventDefault();
    },{passive:false});
    overlay=svg.append('g').attr('class','map-lasso');
    syncButtons();
    const surface=overlay.append('rect').attr('width',width).attr('height',height).attr('class','map-lasso-surface');
    const trace=overlay.append('path').attr('class','map-lasso-trace');
    overlay.on('click',event=>event.stopPropagation());
    const point=event=>{
      const [x,y]=d3.pointer(event,node);
      return [Math.max(0,Math.min(width,x)),Math.max(0,Math.min(height,y))];
    };
    const update=event=>{
      const next=point(event);
      const last=points.at(-1);
      if(Math.hypot(next[0]-last[0],next[1]-last[1])<2)return;
      points.push(next);
      trace.attr('d',line(points)+'Z');
    };
    surface.on('pointerdown',function(event){
      if(event.button!==0||pointerId!==null)return;
      event.preventDefault();
      this.setPointerCapture(event.pointerId);
      pointerId=event.pointerId;
      points=[point(event)];
    }).on('pointermove',event=>{
      if(event.pointerId===pointerId)update(event);
    }).on('pointercancel',event=>{
      if(event.pointerId===pointerId)finish();
    }).on('pointerup',event=>{
      if(event.pointerId!==pointerId)return;
      update(event);
      pointerId=null;
      trace.attr('d',null);
      const camera=d3.zoomTransform(node);
      const worldPoints=points.map(p=>camera.invert(p));
      const ids=new Set(stations.filter(s=>d3.polygonContains(worldPoints,position(s))).map(s=>s.id));
      if(points.length<3||!ids.size){
        hint.textContent='El área debe incluir al menos un complejo. Vuelve a dibujar.';
        return;
      }
      const outline=worldPoints.map(projection.invert);
      if(mode==='single'){
        finish();
        app.set({cohort:ids,areaOutline:outline,preset:null,selected:null});
      }else if(!first){
        first={ids,outline};
        showAreas([outline]);
        hint.textContent=`Zona A · ${ids.size}. Dibuja la zona B.`;
      }else{
        if([...ids].some(id=>first.ids.has(id))){
          hint.textContent='La zona B debe contener otros complejos. Vuelve a dibujarla.';
          return;
        }
        const odZones={a:first.ids,b:ids,outlines:[first.outline,outline]};
        finish();
        app.set({odZones,cohort:null,preset:null,selected:null});
      }
    });
    node.addEventListener('keydown',cancelOnEscape);
    node.setAttribute('tabindex','0');
    node.focus({preventScroll:true});
  }
  singleButton.onclick=()=>start('single');
  if(pairButton)pairButton.onclick=()=>start('pair');
}
