import {RaebCPUOverlay} from './raeb-cpu-overlay.mjs?v=backend-first';
import {RaebRenderer} from './raeb-renderer.mjs';
import {RaebWebGPU} from './raeb-webgpu.mjs?v=bands1';

// D3 retains interaction and linked panels. CPU prepares route hierarchies;
// density, motion, convergence and flow rasterization stay on the GPU.
export class RaebOverlay extends RaebCPUOverlay{
 constructor(data){
  // Do not create a WebGL context until the preferred WebGPU backend fails.
  const disabled=new URLSearchParams(location.search).get('compute')==='cpu';
  const renderer=disabled?new RaebRenderer():new RaebWebGPU();
  super(data,{renderer});
  this.gpu=!disabled;this.cpuRenderer=disabled?renderer:null;this.failed=false;
  if(disabled){renderer.canvas.dataset.backend='cpu';this.backendReady=Promise.resolve(false);return;}
  const gpu=this.gpuRenderer=renderer;
  this.backendReady=gpu.ready.then(()=>{
   gpu.onError=error=>this.fallback(error);this.paintReference();return this.gpu;
  }).catch(error=>this.fallback(error,{restart:false}));
 }
 fallback(error,{restart=true}={}){
  if(!this.gpu||this.failed)return false;
  this.gpu=false;this.gpuPending=null;this.requestId++;
  const old=this.renderer;let cpu;
  try{cpu=this.cpuRenderer??=new RaebRenderer();}
  catch(fallbackError){
   this.failed=true;this.sourceId++;clearTimeout(this.parameterTimer);this.worker.terminate();old.dispose();
   const message='No se pudieron iniciar WebGPU ni WebGL2. El mapa de flujos no está disponible en este navegador.';
   old.canvas.dataset.backend='unavailable';old.canvas.dataset.gpuFallback=error.message;old.canvas.dataset.webglError=fallbackError.message;
   this.backendError=message;this.status(message);console.error(message,{webgpu:error.message,webgl2:fallbackError.message});return false;
  }
  cpu.selected=old.selected;cpu.canvas.style.cssText=old.canvas.style.cssText;
  if(old.canvas.parentNode)old.canvas.replaceWith(cpu.canvas);
  this.renderer=cpu;old.dispose();
  cpu.canvas.dataset.backend='cpu';cpu.canvas.dataset.gpuFallback=error.message;
  if(this.width)cpu.resize(this.width,this.height);
  cpu.setCamera(old.camera);cpu.setParameters(this.fidelity??.9,this.strength??.65);
  this.currentKey=null;this.paintReference();
  // At startup, a worker scene may already be waiting on backendReady. Reuse
  // it; after a running GPU fails, request a fresh scene for the CPU renderer.
  if(restart&&this.projection&&this.year!==undefined)this.frame(this.year,this.day,this.hour,this.data.nodes[cpu.selected]?.id);
  console.warn('RAEB: respaldo CPU activo:',error.message);return false;
 }
 frame(...args){if(this.failed)return this.status(this.backendError);return super.frame(...args);}
 parameters(...args){if(this.failed)return this.status(this.backendError);return super.parameters(...args);}
 paintReference(){
  if(this.failed)return;
  if(!this.gpu)return super.paintReference();
  if(this.exactGroup)this.exactGroup.style.display='none';
  this.renderer.setRailLoads(this.data.flows[String(this.year)]?.[this.day]?.[this.hour],this.selectedLinks);
 }
 request(){
  if(this.failed)return;
  if(!this.gpu)return super.request();if(!this.renderer.count)return;
  this.worker.postMessage({type:'gpuParameters',sourceId:this.sourceId,id:++this.requestId,fidelity:this.fidelity??.9,strength:this.strength??.65});
 }
 async message(m){
  if(m.sourceId!==this.sourceId)return;
  await this.backendReady;
  if(this.failed||m.sourceId!==this.sourceId)return;
  if(m.type==='scene'){
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
    this.status('Procesando…');
    const stats=await this.renderer.solve(job.fidelity,job.strength,{cancelled});
    if(!stats||cancelled())continue;
    const r=this.renderer;r.canvas.dataset.totalLatencyMs=(performance.now()-this.parameterStarted).toFixed(1);r.canvas.dataset.layoutStats=JSON.stringify(stats);
    this.status(stats.converged?'Completado':'Completado (parcial)');
    const el=document.querySelector('#raeb-status');if(el)el.title=`GPU: ${stats.iterations} iteraciones · NMI ${stats.nmi.toFixed(3)} · ${Math.round(stats.ms)} ms · densidad óptica antes del estilo · ${stats.cacheHit?'caché':'cálculo'}`;
   }
  }catch(error){this.fallback(error);}
 }
}
