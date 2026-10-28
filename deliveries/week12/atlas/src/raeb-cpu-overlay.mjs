import {routeHierarchy} from './raeb-core.mjs?v=gpu4';
import {RaebRenderer} from './raeb-renderer.mjs';

export class RaebCPUOverlay{
  constructor(data,{renderer=new RaebRenderer()}={}){
    this.data=data;this.levels=routeHierarchy(data.links).level;this.renderer=renderer;this.sourceId=0;this.requestId=0;this.currentKey=null;
    this.worker=new Worker(new URL('./raeb-worker.mjs?v=gpu4',import.meta.url),{type:'module'});
    this.worker.onmessage=({data:m})=>this.message(m);
    this.worker.onerror=e=>this.status('No se pudo calcular el agrupamiento: '+e.message);
  }
  attach(group,width,height,projection,camera){
    // A regular HTML overlay avoids foreignObject/WebGL compositor omissions
    // in WebKit. Pointer events pass through to the SVG's station marks.
    const stage=group.ownerSVGElement.closest('.map-stage');
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
      el.setAttribute('stroke-width','1.2');el.setAttribute('vector-effect','non-scaling-stroke');this.exactGroup.appendChild(el);return el;
    });
    this.width=width;this.height=height;this.projection=projection;this.transform(camera);
  }
  status(text){const el=document.querySelector('#raeb-status');if(el)el.textContent=text;}
  frame(year,day,hour,selected){
    const p=this.projection,key=`${year}/${day}/${hour}/${this.width}/${this.height}/${p.scale()}/${p.translate()}`;
    const selectedIndex=this.data.nodes.findIndex(n=>n.id===selected);
    if(selectedIndex!==this.renderer.selected){this.selectedLinks=null;this.worker.postMessage({type:'selection',sourceId:this.sourceId,selected:selectedIndex});}
    this.renderer.selected=selectedIndex;this.year=year;this.day=day;this.hour=hour;this.paintReference();this.renderer.schedule();
    if(key===this.currentKey)return;this.parameterStarted=performance.now();this.currentKey=key;this.selectedLinks=null;this.sourceId++;
    this.renderer.count=0;this.renderer.schedule();this.status('Procesando…');
    const networkUrl=new URL('../data/'+this.data.meta.raeb.network,import.meta.url).href;
    const frameUrl=new URL(`../data/raeb/${year}/${day}-${String(hour).padStart(2,'0')}.f32.gz`,import.meta.url).href;
    const nodes=this.data.nodes.map(n=>p([n.lon,n.lat]));
    const links=this.data.links.map(l=>({...l,points:l.coords.map(c=>p(c))}));
    this.worker.postMessage({type:'source',sourceId:this.sourceId,networkUrl,frameUrl,nodes,links,width:this.width,height:this.height,samples:32,selected:selectedIndex});
  }
  transform(camera){
    this.renderer.setCamera(camera);this.renderer.canvas.dataset.camera=JSON.stringify({k:camera.k,x:camera.x,y:camera.y});
    if(this.foreign)this.foreign.setAttribute('transform',`matrix(${1/camera.k} 0 0 ${1/camera.k} ${-camera.x/camera.k} ${-camera.y/camera.k})`);
    this.renderer.schedule();
  }
  parameters(fidelity,strength){
    this.requestId++;this.parameterStarted=performance.now();this.renderer.awaitingSeed=fidelity>0&&fidelity<1;this.fidelity=fidelity;this.strength=strength;this.paintReference();this.renderer.setParameters(fidelity,strength);
    const status=document.querySelector('#raeb-status');if(status)status.removeAttribute('title');
    this.status('Procesando…');
    clearTimeout(this.parameterTimer);
    this.parameterTimer=setTimeout(()=>this.request(),75);
  }
  paintReference(){
    const exact=this.fidelity===1;this.renderer.exact=exact;
    if(!this.exactGroup)return;this.exactGroup.style.display=(this.fidelity??0)>0?'':'none';
    const loads=this.data.flows[String(this.year)]?.[this.day]?.[this.hour];if(!loads)return;
    const focused=this.renderer.selected>=0;
    this.exactPaths.forEach((el,i)=>{
      const total=loads[2*i]+loads[2*i+1],selected=this.selectedLinks?.[i]||0;
      el.setAttribute('stroke',selected>0?'#c75226':'#0e546d');
      const membership=Math.max(0,Math.min(1,(this.fidelity??0)*5-this.levels[i]+1));
      const alpha=1-Math.exp(-(selected>0?selected:total)*membership/800);
      el.setAttribute('opacity',String(alpha*(focused&&selected<=0?.18:1)));
    });
  }
  request(){
    if(!this.renderer.count)return;
    const id=++this.requestId;
    this.worker.postMessage({type:'parameters',id,fidelity:this.fidelity??.9,strength:this.strength??.65});
  }
  message(m){
    if(m.sourceId!==this.sourceId)return;
    const r=this.renderer;
    if(m.type==='selection'){this.selectedLinks=new Float32Array(m.loads);this.paintReference();
    }else if(m.type==='scene'){
      const css=buffer=>{const a=new Float32Array(buffer);if(m.grid)for(let i=0;i<a.length;i+=2){a[i]=(a[i]-1)*m.grid.gridToCss[0];a[i+1]=(a[i+1]-1)*m.grid.gridToCss[1];}return a;};this.reference=css(m.reference);this.free=css(m.free);
      r.scene(this.free,this.reference,new Float32Array(m.metadata),m.count,m.samples,new Float32Array(m.retention));
      r.setParameters(this.fidelity??.9,this.strength??.65);this.request();
      r.canvas.dataset.curves=String(m.count);r.canvas.dataset.samples=String(m.samples);
      this.status('Procesando…');
    }else if(m.type==='seed'||m.type==='layout'||m.type==='progress'){
      if(m.id!==this.requestId)return;
      r.awaitingSeed=false;
      if(m.type==='seed')r.canvas.dataset.seedLatencyMs=(performance.now()-this.parameterStarted).toFixed(1);
      if(this.fidelity!==1)r.layout(new Float32Array(m.points));
      if(m.type==='seed')this.status('Procesando…');
      if(m.type==='layout'){
        if(m.fidelity===0&&m.strength===1){
          this.free=new Float32Array(m.points);r.anchors(this.free,this.reference);
        }
        r.canvas.dataset.layoutStats=JSON.stringify(m.stats);r.canvas.dataset.totalLatencyMs=(performance.now()-this.parameterStarted).toFixed(1);
        this.status(m.stats.converged?'Completado':'Completado (parcial)');
        const status=document.querySelector('#raeb-status');if(status)status.title=`${m.stats.iterations} iteraciones · NMI ${m.stats.nmi.toFixed(3)} · ${Math.round(m.stats.ms)} ms. La desviación, cuando aparece, usa una muestra de hasta 128 curvas.`;
      }
    }else if(m.type==='error'){this.status(m.message);console.error('RAEB:',m.message);}
  }
}
