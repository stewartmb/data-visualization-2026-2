import {RaebCPUOverlay} from './raeb-cpu-overlay.mjs?v=gpu4';
import {RaebWebGPU} from './raeb-webgpu.mjs?v=gpu5';

// D3 retains interaction and linked panels. CPU prepares route hierarchies;
// density, motion, convergence and flow rasterization stay on the GPU.
export class RaebOverlay extends RaebCPUOverlay{
 status(text){super.status(this.gpu&&!text.startsWith('WebGPU')?'WebGPU · '+text:text);}
 constructor(data){
  super(data);this.cpuRenderer=this.renderer;this.gpu=false;
  const disabled=new URLSearchParams(location.search).get('compute')==='cpu';
  if(disabled){this.cpuRenderer.canvas.dataset.backend='cpu';this.backendReady=Promise.resolve(false);return;}
  const gpu=this.gpuRenderer=new RaebWebGPU();
  this.backendReady=gpu.ready.then(()=>{
   const old=this.renderer;this.gpu=true;this.renderer=gpu;gpu.selected=old.selected;
   gpu.canvas.style.cssText=old.canvas.style.cssText;
   if(old.canvas.parentNode)old.canvas.replaceWith(gpu.canvas);
   if(this.width)gpu.resize(this.width,this.height);gpu.setCamera(old.camera);
   gpu.setParameters(this.fidelity??.9,this.strength??.65);
   gpu.onError=error=>this.fallback(error);this.paintReference();return true;
  }).catch(error=>{this.cpuRenderer.canvas.dataset.backend='cpu';this.cpuRenderer.canvas.dataset.gpuFallback=error.message;gpu.dispose();return false;});
 }
 fallback(error){
  if(!this.gpu)return;this.gpu=false;this.gpuPending=null;this.requestId++;
  const old=this.renderer,cpu=this.cpuRenderer;cpu.selected=old.selected;cpu.canvas.style.cssText=old.canvas.style.cssText;
  old.canvas.replaceWith(cpu.canvas);this.renderer=cpu;old.dispose();
  cpu.canvas.dataset.backend='cpu';cpu.canvas.dataset.gpuFallback=error.message;cpu.resize(this.width,this.height);cpu.setCamera(old.camera);cpu.setParameters(this.fidelity,this.strength);
  this.currentKey=null;this.paintReference();this.frame(this.year,this.day,this.hour,this.data.nodes[cpu.selected]?.id);
  console.warn('RAEB: respaldo CPU activo:',error.message);
 }
 paintReference(){
  if(!this.gpu)return super.paintReference();
  if(this.exactGroup)this.exactGroup.style.display='none';
  this.renderer.setRailLoads(this.data.flows[String(this.year)]?.[this.day]?.[this.hour],this.selectedLinks);
 }
 request(){
  if(!this.gpu)return super.request();if(!this.renderer.count)return;
  this.worker.postMessage({type:'gpuParameters',sourceId:this.sourceId,id:++this.requestId,fidelity:this.fidelity??.9,strength:this.strength??.65});
 }
 async message(m){
  if(m.sourceId!==this.sourceId)return;
  if(m.type==='scene'){
   await this.backendReady;if(m.sourceId!==this.sourceId)return;
   if(!this.gpu)return super.message(m);
   try{
    if(this.solverTask)await this.solverTask;if(m.sourceId!==this.sourceId)return;
    await this.renderer.setScene({...m,free:new Float32Array(m.free),reference:new Float32Array(m.reference),metadata:new Float32Array(m.metadata),retention:new Float32Array(m.retention),railInfo:new Float32Array(m.railInfo),railVertices:new Float32Array(m.railVertices)});
    if(m.sourceId!==this.sourceId)return;this.paintReference();this.request();
   }catch(error){this.fallback(error);}return;
  }
  if(!this.gpu)return super.message(m);
  if(m.type==='selection'){this.selectedLinks=new Float32Array(m.loads);this.paintReference();return;}
  if(m.type==='gpuLevel'){this.renderer.setLevel(m.level,new Float32Array(m.points));return;}
  if(m.type==='gpuJob'){
   if(m.id!==this.requestId)return;this.gpuPending=m;if(!this.solverTask){this.solverTask=this.solveGPU().finally(()=>{this.solverTask=null;});}return;
  }
  if(m.type==='error'){this.status(m.message);console.error(m.message);}
 }
 async solveGPU(){
  try{
   while(this.gpuPending&&this.gpu){
    const job=this.gpuPending;this.gpuPending=null;
    const cancelled=()=>job.sourceId!==this.sourceId||job.id!==this.requestId||!this.gpu;
    if(cancelled())continue;
    this.status('WebGPU · calculando los haces…');
    const stats=await this.renderer.solve(job.fidelity,job.strength,{cancelled,onIteration:s=>{if(!cancelled())this.status(`WebGPU · refinando · ${s.iterations} iteraciones`);}});
    if(!stats||cancelled())continue;
    const r=this.renderer;r.canvas.dataset.totalLatencyMs=(performance.now()-this.parameterStarted).toFixed(1);r.canvas.dataset.layoutStats=JSON.stringify(stats);
    const kind=job.fidelity===0?'Abstracción libre':job.fidelity===1?'Caminos de referencia':'Abstracción guiada por la red';
    this.status(`WebGPU · ${kind} · ${r.count.toLocaleString('es-PE')} relaciones OD${stats.converged?'':' · refinamiento parcial'}`);
    const el=document.querySelector('#raeb-status');if(el)el.title=`GPU: ${stats.iterations} iteraciones · NMI ${stats.nmi.toFixed(3)} · ${Math.round(stats.ms)} ms · imagen óptica compartida · ${stats.cacheHit?'caché':'cálculo'}`;
   }
  }catch(error){this.fallback(error);}
 }
}
