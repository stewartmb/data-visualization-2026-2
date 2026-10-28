// Test the actual overlay/worker coordinator with deterministic graphics devices.
// Real GPU arithmetic is covered separately by webgpu.html and webgpu-bands.html.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
if(!vm.SourceTextModule){
 const run=spawnSync(process.execPath,['--experimental-vm-modules',fileURLToPath(import.meta.url)],{stdio:'inherit'});
 process.exit(run.status??1);
}
const root=fileURLToPath(new URL('../atlas/src/',import.meta.url));
async function harness({webgl=true,search=''}={}){
 const calls=[],status={textContent:''},workers=[];
 let resolveGPU,rejectGPU;
 const ready=new Promise((resolve,reject)=>{resolveGPU=resolve;rejectGPU=reject;});
 class Renderer{
  constructor(){this.canvas={dataset:{},style:{cssText:''}};this.camera={k:1,x:0,y:0};this.selected=-1;this.count=0;}
  resize(w,h){this.width=w;this.height=h;}
  setCamera(c){this.camera=c;}
  setParameters(f,b){this.parameters={fidelity:f,strength:b};}
  schedule(){}
  dispose(){this.disposed=true;}
 }
 class GPU extends Renderer{
  constructor(){super();calls.push('webgpu');this.ready=ready;}
  setRailLoads(){}
  async setScene(m){calls.push('gpu-scene');this.count=m.count;}
 }
 class GL extends Renderer{
  constructor(){super();calls.push('webgl2');if(!webgl)throw Error('WebGL2 unavailable');}
  scene(free,reference,metadata,count){calls.push('cpu-scene');this.count=count;}
 }
 class Worker{
  constructor(){workers.push(this);this.messages=[];}
  postMessage(m){this.messages.push(m);}
  terminate(){this.terminated=true;}
 }
 const context=vm.createContext({URL,URLSearchParams,location:{search},Worker,setTimeout,clearTimeout,performance,
  document:{querySelector(){return status;}},console:{warn(){},error(){}}});
 const modules=new Map();
 async function load(file){
  if(modules.has(file))return modules.get(file);
  let m;
  if(file.endsWith('/raeb-renderer.mjs'))m=new vm.SyntheticModule(['RaebRenderer'],function(){this.setExport('RaebRenderer',GL);},{context,identifier:file});
  else if(file.endsWith('/raeb-webgpu.mjs'))m=new vm.SyntheticModule(['RaebWebGPU'],function(){this.setExport('RaebWebGPU',GPU);},{context,identifier:file});
  else m=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{context,identifier:file,initializeImportMeta(meta){meta.url=pathToFileURL(file).href;}});
  modules.set(file,m);
  await m.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier.split('?')[0])));
  return m;
 }
 const m=await load(path.join(root,'raeb-overlay.mjs'));await m.evaluate();
 const data={links:[],nodes:[{id:'1',lon:0,lat:0}],flows:{},meta:{raeb:{network:'raeb/network.json.gz'}}};
 const overlay=new m.namespace.RaebOverlay(data);
 return {overlay,calls,status,workers,resolveGPU,rejectGPU};
}
const scene=()=>({type:'scene',sourceId:0,count:1,samples:2,free:new Float32Array(4).buffer,reference:new Float32Array(4).buffer,metadata:new Float32Array(4).buffer,retention:new Float32Array(2).buffer,railInfo:new Float32Array().buffer,railVertices:new Float32Array().buffer});
// A failed WebGL constructor must never prevent a usable WebGPU startup.
{
 const h=await harness({webgl:false});
 const pending=h.overlay.message(scene());
 await Promise.resolve();assert.deepEqual(h.calls,['webgpu']);
 h.resolveGPU();await h.overlay.backendReady;await pending;
 assert(h.overlay.gpu);assert.deepEqual(h.calls,['webgpu','gpu-scene']);
 assert.equal(h.overlay.cpuRenderer,null);
}
// Slow GPU rejection: queued selection/scene must go to the chosen CPU backend.
{
 const h=await harness();
 const selection=h.overlay.message({type:'selection',sourceId:0,loads:new Float32Array([7]).buffer});
 const pending=h.overlay.message(scene());
 assert.deepEqual(h.calls,['webgpu']);
 h.rejectGPU(Error('No WebGPU adapter'));await h.overlay.backendReady;await selection;await pending;
 assert.deepEqual(h.calls,['webgpu','webgl2','cpu-scene']);
 assert.equal(h.overlay.gpu,false);assert.equal(h.overlay.failed,false);
 assert.equal(h.overlay.selectedLinks[0],7);
 assert.equal(h.overlay.renderer.canvas.dataset.gpuFallback,'No WebGPU adapter');
 assert(h.workers[0].messages.some(m=>m.type==='parameters'));
}
// Both devices unavailable: one clear error; no worker activity or stuck spinner.
{
 const h=await harness({webgl:false});
 h.rejectGPU(Error('No WebGPU adapter'));await h.overlay.backendReady;
 assert.deepEqual(h.calls,['webgpu','webgl2']);assert(h.overlay.failed);assert(h.workers[0].terminated);
 assert.match(h.status.textContent,/WebGPU ni WebGL2/);
 h.overlay.parameters(.5,.7);h.overlay.frame(2024,0,8);h.overlay.request();
 assert.match(h.status.textContent,/WebGPU ni WebGL2/);
 assert.equal(h.workers[0].messages.length,0);
}
// Device loss during use: preserve camera, selection and parameters; restart scene.
{
 const h=await harness();h.resolveGPU();await h.overlay.backendReady;
 const o=h.overlay,old=o.renderer, camera={k:2,x:12,y:34};old.selected=0;old.camera=camera;
 const mount={};old.canvas.parentNode=mount;old.canvas.replaceWith=canvas=>{mount.canvas=canvas;};
 o.width=640;o.height=480;o.fidelity=.6;o.strength=.8;o.year=2024;o.day=0;o.hour=8;
 o.projection=coords=>coords;o.projection.scale=()=>1;o.projection.translate=()=>[0,0];
 old.onError(Error('GPU device lost'));
 assert.deepEqual(h.calls,['webgpu','webgl2']);assert(old.disposed);assert.equal(o.gpu,false);
 assert.equal(mount.canvas,o.renderer.canvas);assert.equal(o.renderer.selected,0);
 assert.deepEqual(o.renderer.camera,camera);assert.deepEqual(o.renderer.parameters,{fidelity:.6,strength:.8});
 assert(h.workers[0].messages.some(m=>m.type==='source'&&m.sourceId===1));
 old.onError(Error('Repeated device loss'));assert.deepEqual(h.calls,['webgpu','webgl2']);
}
// Explicit CPU debug mode stays available and does not request a GPU device.
{
 const h=await harness({search:'?compute=cpu'});await h.overlay.backendReady;
 assert.deepEqual(h.calls,['webgl2']);assert.equal(h.overlay.renderer.canvas.dataset.backend,'cpu');
}
console.log('PASS: WebGPU starts without WebGL2; lazy CPU fallback; queued scene/selection; both unavailable; runtime device loss; explicit CPU mode.');
