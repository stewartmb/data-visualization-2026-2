import {zoneFlow} from './od-zones.mjs?v=zone-lasso1';
import {originLoads} from './od-routing.mjs?v=remove-scenarios1';

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
    throw Error('Falta la selección de orígenes o de dos zonas.');
  }catch(error){
    postMessage({id:data.id,error:error.message});
  }
};
