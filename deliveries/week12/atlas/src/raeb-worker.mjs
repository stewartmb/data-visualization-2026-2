import {makeScene,bundle,bundleFree} from './raeb-core.mjs?v=gpu4';
const layouts=new Map();
let network=null,sourceId=0,requestId=0,scene=null,pending=null,processing=false,warming=false,weights=null,selected=-1;
let sentLevels=new Set();
async function decompress(url,json=false){
  const response=await fetch(url);if(!response.ok)throw Error(`No se pudo leer ${url}: ${response.status}`);
  const decoded=new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
  return json?decoded.json():decoded.arrayBuffer();
}
function send(type,points,extra={}){const buffer=points.buffer;postMessage({type,sourceId,...extra,points:buffer},[buffer]);}
function selection(){
  if(!weights||!network)return;const n=Math.round(Math.sqrt(weights.length)),loads=new Float32Array(scene?.routes.length||0);
  if(selected>=0&&scene)for(let d=0;d<n;d++){const pair=selected*n+d;for(const arc of network.paths[pair])loads[arc>>1]+=weights[pair];}
  postMessage({type:'selection',sourceId,loads:loads.buffer},[loads.buffer]);
}
async function solveLatest(){
  if(processing||warming||!scene||!pending)return;processing=true;
  try{
    while(pending&&scene&&!warming){
      const job=pending;pending=null;const current=sourceId;
      const key=`${job.fidelity}/${job.strength}`,cached=layouts.get(key);
      const started=performance.now();let result;
      if(cached){result={points:cached.points.slice(),stats:{...cached.stats,cacheHit:true,ms:performance.now()-started}};}
      else{
        send('seed',scene.css(scene.seedAt(job.fidelity)),{id:job.id});
        await new Promise(resolve=>setTimeout(resolve,0));
        if(current!==sourceId||job.id!==requestId)continue;
        const options={cancelled:()=>current!==sourceId||job.id!==requestId,
          progress:(points,stats)=>{if(current===sourceId&&job.id===requestId)send('progress',points,{id:job.id,stats});}};
        result=job.fidelity===0&&job.strength===1?await bundleFree(scene,options):await bundle(scene,job.fidelity,job.strength,options);
        if(result&&current===sourceId&&job.id===requestId){
          layouts.set(key,{points:result.points.slice(),stats:result.stats});
          if(layouts.size>2)layouts.delete(layouts.keys().next().value);
        }
      }
      if(result&&current===sourceId&&job.id===requestId)send('layout',result.points,{id:job.id,stats:result.stats,fidelity:job.fidelity,strength:job.strength});
    }
  }catch(error){postMessage({type:'error',sourceId,message:error.message});}
  finally{processing=false;}
}
onmessage=async({data})=>{
  try{
    if(data.type==='source'){
      sourceId=data.sourceId;requestId++;scene=null;weights=null;pending=null;layouts.clear();selected=data.selected;warming=true;const current=sourceId;
      network??=await decompress(data.networkUrl,true);
      const buffer=await decompress(data.frameUrl);if(current!==sourceId)return;weights=new Float32Array(buffer);if(current!==sourceId)return;
      scene=makeScene(data.nodes,data.links,network.paths,weights,data.width,data.height,data.samples);
      selection();
      const free=scene.seed(0).slice(),reference=scene.seed(5).slice(),metadata=scene.metadata.slice(),retention=scene.sampleLevels.slice();
      const railInfo=new Float32Array(scene.routes.length*8),vertices=[];
      scene.routes.forEach((r,i)=>{railInfo.set([vertices.length/2,r.length,scene.hierarchy.level[i],0,0,0,0,0],i*8);for(const p of r)vertices.push(...p);});
      const railVertices=new Float32Array(vertices),grid={width:scene.width,height:scene.height,gridToCss:scene.gridToCss,kernel:scene.kernel};sentLevels=new Set([0,5]);
      postMessage({type:'scene',sourceId,free:free.buffer,reference:reference.buffer,metadata:metadata.buffer,retention:retention.buffer,count:scene.active.length,samples:scene.samples,kernel:scene.kernel,grid,railInfo:railInfo.buffer,railVertices:railVertices.buffer},[free.buffer,reference.buffer,metadata.buffer,retention.buffer,railInfo.buffer,railVertices.buffer]);
      // Do not compute an unrelated free layout before the requested level.
      warming=false;solveLatest();
    }else if(data.type==='selection'){
      if(data.sourceId===sourceId){selected=data.selected;selection();}
    }else if(data.type==='gpuParameters'){
      if(data.sourceId!==sourceId||!scene)return;
      requestId=data.id;
      for(const level of new Set([Math.floor(data.fidelity*5),Math.ceil(data.fidelity*5)]))if(!sentLevels.has(level)){
        const points=scene.seed(level).slice();sentLevels.add(level);postMessage({type:'gpuLevel',sourceId,level,points:points.buffer},[points.buffer]);
      }
      postMessage({type:'gpuJob',sourceId,id:data.id,fidelity:data.fidelity,strength:data.strength});
    }else if(data.type==='parameters'){
      requestId=data.id;pending=data;solveLatest();
    }
  }catch(error){postMessage({type:'error',sourceId,message:error.message});}
};
