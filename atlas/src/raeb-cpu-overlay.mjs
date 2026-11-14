import {metersPerProjectedPixel} from './raeb-scale.mjs?v=free-years1';
import {routeHierarchy} from './raeb-core.mjs?v=raeb-rail1';
import {RaebRenderer} from './raeb-renderer.mjs?v=flow-gray1';
import {flowColor, selectedFlowOpacity} from './raeb-gpu-shaders.mjs?v=flow-gray1';

export function setRaebStatus(message) {
  const status = document.querySelector('#raeb-status');
  if (!status) return;
  if (status.textContent !== message) status.textContent = message;
  const stage = status.closest?.('.map-stage');
  if (!stage) return;
  const processing = message === 'Procesando…';
  stage.querySelector('.map-loading').hidden = !processing;
  stage.querySelector('.map-svg').setAttribute('aria-busy', String(processing));
}

export class RaebCPUOverlay{
  constructor(data,{renderer=new RaebRenderer(),paper=false,dataURL=new URL('../data/',import.meta.url),latitude}={}){
    this.data=data;this.paper=paper;this.rendererMode(renderer);this.levels=routeHierarchy(data.links).level;this.renderer=renderer;this.sourceId=0;this.requestId=0;this.currentKey=null;
    this.dataURL=dataURL;
    this.latitude=latitude;
    this.worker=new Worker(new URL('./raeb-worker.mjs?v=free-years1',import.meta.url),{type:'module'});
    this.worker.onmessage=({data:m})=>this.message(m);
    this.worker.onerror=e=>this.status('No se pudo calcular el agrupamiento: '+e.message);
  }
  rendererMode(renderer){renderer.paper=this.paper;renderer.canvas.dataset.raebMode=this.paper?"paper":"atlas";}
  get onTracks(){return this.paper&&this.fidelity===1&&this.strength===0;}
  attach(group,width,height,projection,camera,onKernel){
    this.onKernel=onKernel;
    // A regular HTML overlay avoids foreignObject/WebGL compositor omissions
    // in WebKit. Pointer events pass through to the SVG's station marks.
    const stage=group.ownerSVGElement.parentElement;
    const canvas=this.renderer.canvas;
    const mapRect=group.ownerSVGElement.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
    canvas.style.position='absolute';canvas.style.left=(mapRect.left-stageRect.left-stage.clientLeft)+'px';canvas.style.top=(mapRect.top-stageRect.top-stage.clientTop)+'px';canvas.style.zIndex='1';
    canvas.style.width=width+'px';canvas.style.height=height+'px';stage.appendChild(canvas);
    this.renderer.resize(width,height);
    this.exactGroup=document.createElementNS('http://www.w3.org/2000/svg','g');
    this.exactGroup.setAttribute('class','raeb-exact-reference');this.exactGroup.style.pointerEvents='none';group.appendChild(this.exactGroup);
    this.exactPaths=this.data.links.map(l=>{
      const el=document.createElementNS('http://www.w3.org/2000/svg','path');
      el.setAttribute('d','M'+l.coords.map(c=>projection(c).join(',')).join('L'));el.setAttribute('fill','none');
      el.setAttribute('stroke-width',this.paper?'3':'1.2');el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');el.setAttribute('vector-effect','non-scaling-stroke');this.exactGroup.appendChild(el);return el;
    });
    this.width=width;this.height=height;this.projection=projection;this.transform(camera);
  }
  status(message){setRaebStatus(message);}
  frame(year,day,hour,selected){
    const p=this.projection,key=`${year}/${day}/${hour}/${this.width}/${this.height}/${p.scale()}/${p.translate()}`;
    const selectedIndex=this.data.nodes.findIndex(n=>n.id===selected);
    this.renderer.colorMax=this.data.starts?.[year]?.[selectedIndex]?.[day]?.[hour]||undefined;
    if(selectedIndex!==this.renderer.selected){this.selectedLinks=null;this.worker.postMessage({type:'selection',sourceId:this.sourceId,selected:selectedIndex});}
    if(key!==this.currentKey)this.selectedLinks=null;
    this.renderer.selected=selectedIndex;this.year=year;this.day=day;this.hour=hour;this.paintReference();this.renderer.schedule();
    if(key===this.currentKey){this.onKernel?.(this.kernel);return;}
    this.kernel=null;this.onKernel?.(null);this.parameterStarted=performance.now();this.currentKey=key;this.sourceId++;
    this.renderer.count=0;this.renderer.schedule();this.status('Procesando…');
    const networkUrl=new URL(this.data.meta.raeb.network,this.dataURL).href;
    const frameUrl=new URL(`raeb/${year}/${day}-${String(hour).padStart(2,'0')}.f32.gz`,this.dataURL).href;
    const nodes=this.data.nodes.map(n=>p([n.lon,n.lat]));
    const links=this.data.links.map(l=>({...l,points:l.coords.map(c=>p(c))}));
    this.worker.postMessage({type:'source',sourceId:this.sourceId,networkUrl,frameUrl,nodes,links,width:this.width,height:this.height,samples:32,paper:this.paper,latitude:this.latitude,metersPerPixel:metersPerProjectedPixel(p,this.latitude),selected:selectedIndex});
  }
  transform(camera){
    this.renderer.setCamera(camera);this.renderer.canvas.dataset.camera=JSON.stringify({k:camera.k,x:camera.x,y:camera.y});
    if(this.foreign)this.foreign.setAttribute('transform',`matrix(${1/camera.k} 0 0 ${1/camera.k} ${-camera.x/camera.k} ${-camera.y/camera.k})`);
    this.renderer.schedule();
  }
  parameters(fidelity,strength){
    this.requestId++;this.parameterStarted=performance.now();this.renderer.awaitingSeed=!this.paper&&fidelity>0&&fidelity<1;this.fidelity=fidelity;this.strength=strength;this.paintReference();this.renderer.setParameters(fidelity,strength);
    const status=document.querySelector('#raeb-status');if(status)status.removeAttribute('title');
    this.status(this.onTracks?'Sobre la vía':'Procesando…');
    clearTimeout(this.parameterTimer);
    this.parameterTimer=setTimeout(()=>this.request(),75);
  }
  paintReference(){
    this.renderer.exact=this.onTracks||(!this.paper&&this.fidelity===1);
    if(!this.exactGroup)return;
    const show=this.onTracks||(!this.paper&&(this.fidelity??0)>0);
    this.exactGroup.style.display=show?'':'none';
    if(!show)return;
    const loads=this.data.flows[String(this.year)]?.[this.day]?.[this.hour];if(!loads)return;
    const focused=this.renderer.selected>=0;
    this.exactPaths.forEach((el,i)=>{
      const total=loads[2*i]+loads[2*i+1],selected=this.selectedLinks?.[i]||0;
      const membership=Math.max(0,Math.min(1,(this.fidelity??0)*5-this.levels[i]+1));
      const trips=(focused?selected:total)*membership;
      const weight=trips/800;
      el.setAttribute('stroke',flowColor(trips,this.renderer.colorMax));
      const alpha=focused&&this.renderer.colorMax
        ?selectedFlowOpacity(trips,this.renderer.colorMax)
        :this.onTracks?Math.pow(1-Math.exp(-1.4*weight),.6):1-Math.exp(-weight);
      el.setAttribute('opacity',String(alpha));
    });
  }
  request(){
    clearTimeout(this.parameterTimer);
    if(this.onTracks)return this.status('Sobre la vía');
    if(!this.renderer.count)return;
    const id=++this.requestId;
    this.worker.postMessage({type:'parameters',id,fidelity:this.fidelity??.9,strength:this.strength??.65});
  }
  message(m){
    if(m.sourceId!==this.sourceId)return;
    const r=this.renderer;
    if(m.type==='selection'){this.selectedLinks=new Float32Array(m.loads);this.paintReference();
    }else if(m.type==='scene'){
      this.kernel=m.kernel;this.onKernel?.(this.kernel);
      const css=buffer=>{const a=new Float32Array(buffer);if(m.grid)for(let i=0;i<a.length;i+=2){a[i]=(a[i]-1)*m.grid.gridToCss[0];a[i+1]=(a[i+1]-1)*m.grid.gridToCss[1];}return a;};this.reference=css(m.reference);this.free=css(m.free);
      if(this.paper)r.awaitingSeed=true;
      r.scene(this.free,this.reference,new Float32Array(m.metadata),m.count,m.samples,new Float32Array(m.retention));
      r.setParameters(this.fidelity??.9,this.strength??.65);
      r.canvas.dataset.curves=String(m.count);r.canvas.dataset.samples=String(m.samples);
      this.status('Procesando…');this.request();
    }else if(m.type==='seed'||m.type==='layout'||m.type==='progress'){
      if(m.id!==this.requestId)return;
      r.awaitingSeed=false;
      if(m.type==='seed')r.canvas.dataset.seedLatencyMs=(performance.now()-this.parameterStarted).toFixed(1);
      if(this.paper||this.fidelity!==1)r.layout(new Float32Array(m.points));
      if(m.type==='seed')this.status('Procesando…');
      if(m.type==='layout'){
        if(!this.paper&&m.fidelity===0&&m.strength===1){
          this.free=new Float32Array(m.points);r.anchors(this.free,this.reference);
        }
        r.canvas.dataset.layoutStats=JSON.stringify(m.stats);r.canvas.dataset.totalLatencyMs=(performance.now()-this.parameterStarted).toFixed(1);
        this.status(m.stats.converged?'Completado':'Completado (parcial)');
        const status=document.querySelector('#raeb-status');if(status)status.title=`${m.stats.iterations} iteraciones · NMI ${m.stats.nmi.toFixed(3)} · ${Math.round(m.stats.ms)} ms. La desviación, cuando aparece, usa una muestra de hasta 128 curvas.`;
      }
    }else if(m.type==='error'){this.status(m.message);console.error('RAEB:',m.message);}
  }
}
