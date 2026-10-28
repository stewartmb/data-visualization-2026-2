import {COMPUTE,DISPLAY} from './raeb-gpu-shaders.mjs';
const ENTRIES={initialize:[0,1,3,4,7,8],splat:[0,1,8,9],decodeDensity:[0,9,10],convolve:[0,10,11],maximum:[0,11,13],maximumFinal:[13,14],boost:[0,11,12,14],advect:[0,1,2,3,4,5,6,11],smooth:[0,1,2,3,4,5,6],rasterCurves:[0,1,6,7,15],rasterRails:[0,15,23,24],rasterGuide:[0,12,23,24],image:[0,15,17],histogram:[0,16,17,18,19,20],mutualInformation:[0,18,19,20,21],mutualInformationFinal:[21,22]};
export class RaebWebGPU{
 constructor(){
  this.canvas=document.createElement('canvas');this.canvas.className='raeb-canvas';this.canvas.setAttribute('aria-hidden','true');this.canvas.style.cssText='display:block;pointer-events:none;width:100%;height:100%';
  this.camera={k:1,x:0,y:0};this.parameters={fidelity:.9,strength:.65};this.selected=-1;this.count=0;this.generation=0;this.levels=new Map();this.layouts=new Map();this.buffers=new Map();this.ready=this.initialize();
 }
 async initialize(){
  if(!navigator.gpu)throw Error('WebGPU no está disponible');
  this.adapter=await navigator.gpu.requestAdapter();if(!this.adapter)throw Error('Sin adaptador WebGPU');
  this.device=await this.adapter.requestDevice();const d=this.device;
  d.addEventListener('uncapturederror',e=>{this.canvas.dataset.gpuError=e.error.message;console.error('WebGPU:',e.error.message);this.onError?.(e.error);});
  d.lost.then(info=>{if(!this.disposed)this.onError?.(Error('GPU desconectada: '+info.message));});
  const module=d.createShaderModule({code:COMPUTE});
  const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join('\n'));
  this.pipelines=Object.fromEntries(await Promise.all(Object.keys(ENTRIES).map(async key=>[key,await d.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:key}})])));
  this.format=navigator.gpu.getPreferredCanvasFormat();this.context=this.canvas.getContext('webgpu');if(!this.context)throw Error('Canvas WebGPU no disponible');
  this.context.configure({device:d,format:this.format,alphaMode:'premultiplied'});
  const display=d.createShaderModule({code:DISPLAY});
  this.displayPipeline=await d.createRenderPipelineAsync({layout:'auto',vertex:{module:display,entryPoint:'vertex'},fragment:{module:display,entryPoint:'fragment',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
  this.uniformCompute=this.create(96,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,'compute parameters');
  this.uniformDraw=this.create(96,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,'drawing parameters');
  this.statsRead=this.create(16,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,'NMI readback');
  this.canvas.dataset.renderer='WebGPU compute + optical raster';this.canvas.dataset.backend='webgpu';return this;
 }
 create(size,usage,label){
  if(size>this.device.limits.maxBufferSize)throw Error(`La GPU no admite el buffer ${label} (${size} bytes)`);
  return this.device.createBuffer({size:Math.max(4,Math.ceil(size/4)*4),usage,label});
 }
 storage(dataOrBytes,label){
  const bytes=typeof dataOrBytes==='number'?dataOrBytes:dataOrBytes.byteLength;
  if(bytes>this.device.limits.maxStorageBufferBindingSize)throw Error(`El buffer ${label} excede el límite de almacenamiento GPU`);
  const b=this.create(bytes,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST,label);
  if(typeof dataOrBytes!=='number'&&bytes)this.device.queue.writeBuffer(b,0,dataOrBytes);return b;
 }
 resize(width,height){
  this.width=width;this.height=height;const ratio=Math.min(1.25,devicePixelRatio||1,Math.sqrt(4_000_000/(width*height)));
  const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.screenDirty=true;}this.schedule();
 }
 setCamera(camera){this.camera=camera;this.inputAt=performance.now();this.schedule();}
 setParameters(fidelity,strength){this.parameters={fidelity,strength};this.inputAt=performance.now();this.schedule();}
 params({fidelity=this.parameters.fidelity,strength=this.parameters.strength,radius=1,analysis=false}={}){
  const data=new ArrayBuffer(96),u=new Uint32Array(data),f=new Float32Array(data),s=this.scene;
  u.set([s.width,s.height,this.count,this.samples],0);
  u.set([analysis?s.width:this.canvas.width,analysis?s.height:this.canvas.height,this.linkCount,analysis?0:this.selected+1],4);
  const k=fidelity*5;f.set([fidelity,strength,radius,k-Math.floor(k)],8);
  if(analysis)f.set([1,1,0,0],12);
  else{
   const rx=this.canvas.width/this.width,ry=this.canvas.height/this.height,c=this.camera;
   f.set([c.k*s.gridToCss[0]*rx,c.k*s.gridToCss[1]*ry,(c.x-c.k*s.gridToCss[0])*rx,(c.y-c.k*s.gridToCss[1])*ry],12);
  }
  f.set([this.width,this.height,...s.gridToCss],16);return data;
 }
 resources(uniform=this.uniformCompute,extra={}){return new Map([[0,uniform],...this.buffers,...Object.entries(extra).map(([k,v])=>[+k,v])]);}
 pass(encoder,key,resources,x,y=1){
  if(!x||!y)return;const pipeline=this.pipelines[key];
  const entries=ENTRIES[key].map(binding=>{const buffer=resources.get(binding);if(!buffer)throw Error(`Falta buffer ${binding} para ${key}`);return {binding,resource:{buffer}};});
  const pass=encoder.beginComputePass({label:key});pass.setPipeline(pipeline);pass.setBindGroup(0,this.device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries}));pass.dispatchWorkgroups(x,y);pass.end();
 }
 async setScene(message){
  await this.ready;this.generation++;await this.device.queue.onSubmittedWorkDone();this.releaseScene();
  this.scene=message.grid;this.count=message.count;this.samples=message.samples;this.linkCount=message.railInfo.length/8;this.railData=message.railInfo;
  this.pointBytes=this.count*this.samples*8;const pixels=this.scene.width*this.scene.height;
  const input=[['free',message.free],['reference',message.reference],['metadata',message.metadata],['levels',message.retention],['rails',message.railInfo],['vertices',message.railVertices]];
  const b=Object.fromEntries(input.map(([name,data])=>[name,this.storage(data,name)]));
  this.levels.set(0,b.free);this.levels.set(5,b.reference);
  this.buffers=new Map([[1,this.storage(this.pointBytes,'points')],[2,this.storage(this.pointBytes,'advection')],[5,b.reference],[6,b.levels],[7,b.metadata],[8,this.storage(this.count*4,'masses')],[9,this.storage(pixels*8,'density fixed64')],[10,this.storage(pixels*4,'decoded density')],[11,this.storage(pixels*4,'density field')],[12,this.storage(pixels*4,'reference guide')],[13,this.storage(Math.ceil(pixels/256)*4,'max partials')],[14,this.storage(4,'max density')],[15,this.storage(pixels*16,'analysis optical')],[16,this.storage(pixels*4,'previous image')],[17,this.storage(pixels*4,'current image')],[18,this.storage(65536*4,'joint histogram')],[19,this.storage(256*4,'histogram A')],[20,this.storage(256*4,'histogram B')],[21,this.storage(256*16,'NMI partials')],[22,this.storage(16,'NMI statistics')],[23,b.vertices],[24,b.rails]]);
  this.canvas.dataset.curves=String(this.count);this.canvas.dataset.samples=String(this.samples);this.canvas.dataset.pointReadbacks='0';
  // A reference pose is a meaningful initial view while a hierarchy is prepared.
  this.bindLevel(5,5);this.device.queue.writeBuffer(this.uniformCompute,0,this.params({fidelity:1,analysis:true}));
  const encoder=this.device.createCommandEncoder();this.pass(encoder,'initialize',this.resources(),Math.ceil(this.count/256));this.device.queue.submit([encoder.finish()]);this.schedule();
 }
 bindLevel(lo,hi){if(!this.levels.has(lo)||!this.levels.has(hi))throw Error(`Falta nivel ${lo}/${hi}`);this.buffers.set(3,this.levels.get(lo));this.buffers.set(4,this.levels.get(hi));}
 setLevel(level,points){if(!this.levels.has(level))this.levels.set(level,this.storage(points,'hierarchy '+level));}
 setRailLoads(loads,selected){
  if(!this.railData||!loads)return;
  for(let i=0;i<this.linkCount;i++){this.railData[i*8+3]=loads[2*i]+loads[2*i+1];this.railData[i*8+4]=selected?.[i]||0;}
  this.device.queue.writeBuffer(this.buffers.get(24),0,this.railData);this.schedule();
 }
 raster(encoder,resources,{image=false}={}){
  encoder.clearBuffer(resources.get(15));this.pass(encoder,'rasterCurves',resources,Math.ceil(this.count/64));this.pass(encoder,'rasterRails',resources,Math.ceil(this.linkCount/64));
  if(image)this.pass(encoder,'image',resources,Math.ceil(this.scene.width*this.scene.height/256));
 }
 async solve(fidelity,strength,{cancelled=()=>false,onIteration=()=>{},maxIterations=48,stability=.8}={}){
  const generation=this.generation,started=performance.now(),key=`${fidelity}/${strength}`;this.parameters={fidelity,strength};
  const cached=this.layouts.get(key);
  if(cached){const e=this.device.createCommandEncoder();e.copyBufferToBuffer(cached.buffer,0,this.buffers.get(1),0,this.pointBytes);this.device.queue.submit([e.finish()]);await this.device.queue.onSubmittedWorkDone();this.schedule();return {...cached.stats,cacheHit:true,ms:performance.now()-started};}
  this.bindLevel(Math.floor(fidelity*5),Math.ceil(fidelity*5));
  let radius=Math.max(.05,this.scene.kernel.radius*strength),iterations=0,nmi=1;
  this.device.queue.writeBuffer(this.uniformCompute,0,this.params({fidelity,strength,radius,analysis:true}));
  let e=this.device.createCommandEncoder();let resources=this.resources();this.pass(e,'initialize',resources,Math.ceil(this.count/256));e.clearBuffer(this.buffers.get(12));this.pass(e,'rasterGuide',resources,Math.ceil(this.linkCount/64));
  this.raster(e,resources,{image:true});this.device.queue.submit([e.finish()]);await this.device.queue.onSubmittedWorkDone();
  // Initial image becomes the previous image. The same rasterizer draws the map.
  [this.buffers.get(16),this.buffers.get(17)];let prev=this.buffers.get(16);this.buffers.set(16,this.buffers.get(17));this.buffers.set(17,prev);this.schedule();
  if(strength>0&&fidelity<1&&this.count){
   for(let iteration=0;iteration<maxIterations;iteration++){
    if(cancelled()||generation!==this.generation)return null;
    this.device.queue.writeBuffer(this.uniformCompute,0,this.params({fidelity,strength,radius,analysis:true}));e=this.device.createCommandEncoder();resources=this.resources();
    e.clearBuffer(this.buffers.get(9));this.pass(e,'splat',resources,Math.ceil(this.count*this.samples/256));this.pass(e,'decodeDensity',resources,Math.ceil(this.scene.width*this.scene.height/256));
    this.pass(e,'convolve',resources,Math.ceil(this.scene.width/8),Math.ceil(this.scene.height/8));this.pass(e,'maximum',resources,Math.ceil(this.scene.width*this.scene.height/256));this.pass(e,'maximumFinal',resources,1);this.pass(e,'boost',resources,Math.ceil(this.scene.width*this.scene.height/256));
    this.pass(e,'advect',resources,Math.ceil(this.count*this.samples/256));this.pass(e,'smooth',resources,Math.ceil(this.count*this.samples/256));
    this.raster(e,resources,{image:true});for(const binding of [18,19,20])e.clearBuffer(this.buffers.get(binding));
    this.pass(e,'histogram',resources,Math.ceil(this.scene.width*this.scene.height/256));this.pass(e,'mutualInformation',resources,256);this.pass(e,'mutualInformationFinal',resources,1);
    e.copyBufferToBuffer(this.buffers.get(22),0,this.statsRead,0,16);this.device.queue.submit([e.finish()]);
    await this.statsRead.mapAsync(GPUMapMode.READ);nmi=new Float32Array(this.statsRead.getMappedRange())[0];this.statsRead.unmap();
    if(cancelled()||generation!==this.generation)return null;
    iterations=iteration+1;prev=this.buffers.get(16);this.buffers.set(16,this.buffers.get(17));this.buffers.set(17,prev);radius*=.9;
    onIteration({iterations,nmi});this.schedule();if(nmi>=stability)break;
   }
  }
  if(cancelled()||generation!==this.generation)return null;
  const result={backend:'webgpu',iterations,nmi,converged:nmi>=stability||strength<=0||fidelity===1,ms:performance.now()-started,kernel:this.scene.kernel,stabilityImage:'shared optical raster: curves + retained GTFS',pointReadbacks:0};
  const buffer=this.storage(this.pointBytes,'cached layout');e=this.device.createCommandEncoder();e.copyBufferToBuffer(this.buffers.get(1),0,buffer,0,this.pointBytes);this.device.queue.submit([e.finish()]);this.layouts.set(key,{buffer,stats:result});
  if(this.layouts.size>2){const oldest=this.layouts.keys().next().value;this.layouts.get(oldest).buffer.destroy();this.layouts.delete(oldest);}this.canvas.dataset.layoutStats=JSON.stringify(result);this.schedule();return result;
 }
 schedule(){if(!this.pending)this.pending=requestAnimationFrame(()=>{this.pending=0;this.draw().catch(e=>this.onError?.(e));});}
 async draw(){
  if(!this.device||!this.context||!this.scene||!this.count||this.disposed)return;
  if(this.drawing){this.redraw=true;return;}this.drawing=true;
  try{
   const size=this.canvas.width*this.canvas.height*16;
   if(!this.screenOptical||this.screenBytes!==size){await this.device.queue.onSubmittedWorkDone();this.screenOptical?.destroy();this.screenOptical=this.storage(size,'screen optical');this.screenBytes=size;}
   this.device.queue.writeBuffer(this.uniformDraw,0,this.params());const encoder=this.device.createCommandEncoder(),resources=this.resources(this.uniformDraw,{15:this.screenOptical});
   this.raster(encoder,resources);
   const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'}]});
   pass.setPipeline(this.displayPipeline);pass.setBindGroup(0,this.device.createBindGroup({layout:this.displayPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformDraw}},{binding:15,resource:{buffer:this.screenOptical}}]}));pass.draw(3);pass.end();this.device.queue.submit([encoder.finish()]);
   await this.device.queue.onSubmittedWorkDone();if(this.inputAt){this.canvas.dataset.inputToPaintMs=(performance.now()-this.inputAt).toFixed(1);this.inputAt=0;}this.canvas.dataset.camera=JSON.stringify({k:this.camera.k,x:this.camera.x,y:this.camera.y});
  }finally{this.drawing=false;if(this.redraw){this.redraw=false;this.schedule();}}
 }
 async readBuffer(binding,Type=Float32Array){
  await this.device.queue.onSubmittedWorkDone();const source=this.buffers.get(binding),read=this.create(source.size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,'validation readback'),e=this.device.createCommandEncoder();e.copyBufferToBuffer(source,0,read,0,source.size);this.device.queue.submit([e.finish()]);await read.mapAsync(GPUMapMode.READ);const data=new Type(read.getMappedRange().slice(0));read.unmap();read.destroy();return data;
 }
 releaseScene(){
  const owned=new Set([...this.buffers.values(),...this.levels.values(),...[...this.layouts.values()].map(x=>x.buffer),this.screenOptical]);for(const b of owned)if(b)b.destroy();
  this.buffers.clear();this.levels.clear();this.layouts.clear();this.screenOptical=null;this.screenBytes=0;this.scene=null;
 }
 dispose(){this.disposed=true;this.generation++;this.releaseScene();this.uniformCompute?.destroy();this.uniformDraw?.destroy();this.statsRead?.destroy();this.device?.destroy();}
}
