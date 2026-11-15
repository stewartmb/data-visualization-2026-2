import {zoneFlow} from './od-zones.mjs?v=zone-lasso1';
import {closureImpact,connectionImpact,originLoads} from './od-routing.mjs?v=zone-lasso1';

let graph;
onmessage=({data})=>{
  if(data.graph){graph=data.graph;return;}
  try{
    if(data.zones){
      const impact=zoneFlow({...graph,...data});
      postMessage({id:data.id,impact},[impact.loads.buffer]);
      return;
    }
    if(data.origins){
      const impact=originLoads(graph.paths,data.matrix,data.origins,graph.links.length);
      postMessage({id:data.id,impact},[impact.buffer]);
      return;
    }
    const impact=(data.connection?connectionImpact:closureImpact)({...graph,...data,...data.connection});
    postMessage({id:data.id,impact});
  }catch(error){
    postMessage({id:data.id,error:error.message});
  }
};
