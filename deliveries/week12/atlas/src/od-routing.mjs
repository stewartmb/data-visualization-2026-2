import {betweenZonePairs} from './od-zones.mjs?v=zone-lasso1';
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
        const task=this.scenario(year,day,hour,{origins}).catch(error=>{scopedLoads.delete(key);throw error;});
        scopedLoads.set(key,task);
        if(scopedLoads.size>24)scopedLoads.delete(scopedLoads.keys().next().value);
      }
      return scopedLoads.get(key);
    },
    zoneFlow(year,day,hour,zones){
      const key=`zones/${year}/${day}/${hour}/${zones[0].join(',')}/${zones[1].join(',')}`;
      if(!scopedLoads.has(key)){
        const task=this.scenario(year,day,hour,{zones}).catch(error=>{scopedLoads.delete(key);throw error;});
        scopedLoads.set(key,task);
        if(scopedLoads.size>24)scopedLoads.delete(scopedLoads.keys().next().value);
      }
      return scopedLoads.get(key);
    },
    async scenario(year,day,hour,options){
      const [network,matrix]=await Promise.all([this.network(),this.frame(year,day,hour)]);
      if(!worker){
        worker=new Worker(new URL('./od-scenario-worker.mjs?v=zone-lasso1',import.meta.url),{type:'module'});
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
        worker.postMessage({graph:{nodes:flows.nodes,links:flows.links,routeNodes:network.meta.route_nodes,paths:network.paths}});
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

export const arcCost=(link,direction)=>Array.isArray(link.cost)?link.cost[direction]:link.cost??link.len;

function addToHeap(heap,entry){
  let i=heap.length;
  heap.push(entry);
  while(i>0){
    const parent=(i-1)>>1;
    if(heap[parent][0]<=entry[0])break;
    heap[i]=heap[parent];i=parent;
  }
  heap[i]=entry;
}

function takeFromHeap(heap){
  const first=heap[0],last=heap.pop();
  if(!heap.length)return first;
  let i=0;
  while(i*2+1<heap.length){
    const left=i*2+1,right=left+1;
    const child=right<heap.length&&heap[right][0]<heap[left][0]?right:left;
    if(heap[child][0]>=last[0])break;
    heap[i]=heap[child];i=child;
  }
  heap[i]=last;
  return first;
}

function routingGraph(nodes,links,routeNodes,closed){
  const ids=Object.keys(routeNodes),index=new Map(ids.map((id,i)=>[id,i]));
  const groups=new Map(nodes.map(n=>[n.id,[]]));
  ids.forEach((id,i)=>groups.get(routeNodes[id].complex).push(i));
  const closedStops=new Set(groups.get(closed));
  const endpoints=nodes.map(n=>groups.get(n.id));
  const forward=ids.map(()=>[]),reverse=ids.map(()=>[]);
  links.forEach((link,i)=>{
    const a=index.get(link.stop_a),b=index.get(link.stop_b);
    if(closedStops.has(a)||closedStops.has(b))return;
    for(const direction of [0,1]){
      if(!link.allowed[direction])continue;
      const from=direction?b:a,to=direction?a:b;
      const cost=arcCost(link,direction),arc=2*i+direction;
      forward[from].push([to,cost,arc]);
      reverse[to].push([from,cost,arc]);
    }
  });
  return {index,endpoints,forward,reverse};
}

function shortest(adjacency,sources){
  const cost=new Float64Array(adjacency.length).fill(Infinity),heap=[];
  const previous=new Int32Array(adjacency.length).fill(-1),arcs=previous.slice();
  for(const source of sources){cost[source]=0;addToHeap(heap,[0,source]);}
  while(heap.length){
    const [distance,stop]=takeFromHeap(heap);
    if(distance!==cost[stop])continue;
    for(const [target,increment,arc] of adjacency[stop]){
      const value=distance+increment;
      if(value>=cost[target])continue;
      cost[target]=value;previous[target]=stop;arcs[target]=arc;
      addToHeap(heap,[value,target]);
    }
  }
  return {cost,previous,arcs};
}

function closest(cost,stops){
  return stops.reduce((best,stop)=>best<0||cost[stop]<cost[best]?stop:best,-1);
}

export function closureImpact({nodes,links,routeNodes,paths,matrix,closed}){
  const {endpoints,forward}=routingGraph(nodes,links,routeNodes,closed);
  const n=nodes.length;
  const affected={access:0,disconnected:0,detoured:0,equivalent:0,extraCost:0};
  for(let o=0;o<n;o++){
    const reroute=[];
    for(let d=0;d<n;d++){
      if(o===d)continue;
      const pair=o*n+d,trips=matrix[pair],path=paths[pair];
      if(!trips||!path.length)continue;
      if(nodes[o].id===closed||nodes[d].id===closed){affected.access+=trips;continue;}
      if(!path.some(arc=>{const link=links[arc>>1];return link.a===closed||link.b===closed;}))continue;
      const cost=path.reduce((sum,arc)=>sum+arcCost(links[arc>>1],arc&1),0);
      reroute.push({d,trips,cost});
    }
    if(!reroute.length)continue;
    const {cost:distance}=shortest(forward,endpoints[o]);
    for(const {d,trips,cost} of reroute){
      const newCost=Math.min(...endpoints[d].map(stop=>distance[stop]));
      if(!Number.isFinite(newCost))affected.disconnected+=trips;
      else if(newCost-cost>.01){affected.detoured+=trips;affected.extraCost+=trips*(newCost-cost);}
      else affected.equivalent+=trips;
    }
  }
  return affected;
}

export function connectionImpact({nodes,links,routeNodes,paths,matrix,from,to,length,origins=null,zones=null}){
  const {index,endpoints,forward,reverse}=routingGraph(nodes,links,routeNodes);
  const a=index.get(from),b=index.get(to);
  if(a===undefined||b===undefined||a===b||!(length>0))throw Error('Los extremos del enlace deben ser paradas distintas.');
  const fromA=shortest(forward,[a]),fromB=shortest(forward,[b]);
  const toA=shortest(reverse,[a]),toB=shortest(reverse,[b]);
  const perComplex=tree=>endpoints.map(stops=>closest(tree.cost,stops));
  const originA=perComplex(toA),originB=perComplex(toB);
  const destA=perComplex(fromA),destB=perComplex(fromB);
  const changes=new Float64Array(links.length);
  let redirected=0,saved=0,pairs=0;
  const n=nodes.length;
  function addRoute(tree,stop,trips){
    while(tree.arcs[stop]>=0){
      changes[tree.arcs[stop]>>1]+=trips;
      stop=tree.previous[stop];
    }
  }
  const activeOrigins=origins===null?null:new Set(origins);
  const activePairs=zones?new Set(betweenZonePairs(zones,n)):null;
  for(let pair=0;pair<matrix.length;pair++){
    if(activePairs&&!activePairs.has(pair))continue;
    const origin=Math.floor(pair/n);
    if(activeOrigins&&!activeOrigins.has(origin))continue;
    const trips=matrix[pair],path=paths[pair];
    if(!trips||!path.length)continue;
    const dest=pair%n;
    const viaAB=toA.cost[originA[origin]]+length+fromB.cost[destB[dest]];
    const viaBA=toB.cost[originB[origin]]+length+fromA.cost[destA[dest]];
    const newCost=Math.min(viaAB,viaBA);
    const oldCost=path.reduce((sum,arc)=>sum+arcCost(links[arc>>1],arc&1),0);
    if(!(newCost<oldCost-.01))continue;
    pairs++;
    redirected+=trips;
    saved+=trips*(oldCost-newCost);
    for(const arc of path)changes[arc>>1]-=trips;
    if(viaAB<=viaBA){
      addRoute(toA,originA[origin],trips);addRoute(fromB,destB[dest],trips);
    }else{
      addRoute(toB,originB[origin],trips);addRoute(fromA,destA[dest],trips);
    }
  }
  return {redirected,pairs,meanSaving:redirected?saved/redirected:0,changes};
}

function projectOnto(x,y,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
  return [ax+t*dx,ay+t*dy];
}

export function bundleAt(layout,x,y,radius){
  const {points,samples,metadata}=layout;
  const step=samples*2,r2=radius*radius,contributors=[];
  let representative=null,best=Infinity;
  for(let offset=0,curve=0;offset<points.length;offset+=step,curve++){
    let nearest=r2;
    for(let i=offset;i<offset+step-2;i+=2){
      const ax=points[i],ay=points[i+1],bx=points[i+2],by=points[i+3];
      if(x<Math.min(ax,bx)-radius||x>Math.max(ax,bx)+radius||
         y<Math.min(ay,by)-radius||y>Math.max(ay,by)+radius)continue;
      const [px,py]=projectOnto(x,y,ax,ay,bx,by);
      nearest=Math.min(nearest,(x-px)**2+(y-py)**2);
    }
    if(nearest>=r2)continue;
    const i=curve*4;
    contributors.push({trips:metadata[i],origin:metadata[i+1],destination:metadata[i+2]});
    if(nearest<best){best=nearest;representative=points.subarray(offset,offset+step);}
  }
  return {representative,contributors};
}

export function distanceToLines(x,y,lines){
  let distance=Infinity;
  for(const line of lines)for(let i=1;i<line.length;i++){
    const [px,py]=projectOnto(x,y,...line[i-1],...line[i]);
    distance=Math.min(distance,Math.hypot(x-px,y-py));
  }
  return distance;
}
