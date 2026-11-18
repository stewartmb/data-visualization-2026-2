import {frameURL,networkURL,readGzip} from './od-encoding.mjs?v=annual-overview1';
import {odLoads} from './od-period.mjs';

export function createRoutingData(flows,dataURL){
  let graph,worker,sequence=0;
  const pending=new Map();
  const frames=new Map(),scopedLoads=new Map();
  return {
    network(){
      graph??=readGzip(networkURL(dataURL,flows.meta),true).catch(error=>{graph=null;throw error;});
      return graph;
    },
    frame(year,day,hour){
      const url=frameURL(dataURL,year,day,hour);
      if(!frames.has(url.href)){
        const task=readGzip(url).then(buffer=>{
          const matrix=new Float32Array(buffer);
          if(matrix.length!==flows.nodes.length**2)throw Error('La matriz OD y el catálogo tienen distinto tamaño.');
          return matrix;
        }).catch(error=>{frames.delete(url.href);throw error;});
        frames.set(url.href,task);
        if(frames.size>4)frames.delete(frames.keys().next().value);
      }
      return frames.get(url.href);
    },
    loads(year,day,hour,origins){
      if(origins===null)return Promise.resolve(odLoads(flows,year,day,hour));
      if(!origins.length)return Promise.resolve(new Float64Array(flows.links.length*2));
      const key=`${year}/${day}/${hour}/${origins.join(',')}`;
      if(!scopedLoads.has(key)){
        const task=this.aggregate(year,day,hour,{origins}).catch(error=>{scopedLoads.delete(key);throw error;});
        scopedLoads.set(key,task);
        if(scopedLoads.size>24)scopedLoads.delete(scopedLoads.keys().next().value);
      }
      return scopedLoads.get(key);
    },
    zoneFlow(year,day,hour,zones){
      const key=`zones/${year}/${day}/${hour}/${zones[0].join(',')}/${zones[1].join(',')}`;
      if(!scopedLoads.has(key)){
        const task=this.aggregate(year,day,hour,{zones}).catch(error=>{scopedLoads.delete(key);throw error;});
        scopedLoads.set(key,task);
        if(scopedLoads.size>24)scopedLoads.delete(scopedLoads.keys().next().value);
      }
      return scopedLoads.get(key);
    },
    async aggregate(year,day,hour,options){
      const [network,matrix]=await Promise.all([this.network(),this.frame(year,day,hour)]);
      if(!worker){
        worker=new Worker(new URL('./od-routing-worker.mjs?v=remove-scenarios1',import.meta.url),{type:'module'});
        worker.onmessage=({data})=>{
          const task=pending.get(data.id);
          if(!task)return;
          pending.delete(data.id);
          if(data.error)task.reject(Error(data.error));
          else task.resolve(data.impact);
        };
        worker.onerror=event=>{
          for(const task of pending.values())task.reject(Error(event.message));
          pending.clear();worker.terminate();worker=null;
        };
        worker.postMessage({graph:{nodes:flows.nodes,links:flows.links,paths:network.paths}});
      }
      return new Promise((resolve,reject)=>{
        const id=++sequence;
        pending.set(id,{resolve,reject});
        worker.postMessage({id,matrix,...options});
      });
    }
  };
}

export function originLoads(paths,matrix,origins,linkCount){
  const n=Math.round(Math.sqrt(matrix.length));
  const loads=new Float64Array(linkCount*2);
  for(const origin of origins)for(let destination=0;destination<n;destination++){
    const pair=origin*n+destination,count=matrix[pair];
    if(count>0)for(const arc of paths[pair])loads[arc]+=count;
  }
  return loads;
}

export function originBranches(paths,matrix,origin,linkCount){
  const n=Math.round(Math.sqrt(matrix.length));
  const links=new Float64Array(linkCount),destinations=new Float64Array(n);
  let total=0;
  for(let destination=0;destination<n;destination++){
    const pair=origin*n+destination,count=matrix[pair];
    total+=count;
    if(!count||!paths[pair]?.length)continue;
    destinations[destination]=count;
    for(const arc of paths[pair])links[arc>>1]+=count;
  }
  return {links,destinations,total};
}
