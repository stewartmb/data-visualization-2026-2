import assert from 'node:assert/strict';
import {originBranches,originLoads} from '../atlas/src/od-routing.mjs';

import {zoneFlow} from '../atlas/src/od-zones.mjs';

const nodes=['A','B','C','D'].map((id,i)=>({id,lat:0,lon:i*.001}));
const routeNodes=Object.fromEntries(nodes.map(({id})=>[id,{complex:id}]));
const edges=[['A','B',2],['B','C',2],['A','C',8],['B','D',3]];
const links=edges.map(([a,b,len])=>({a,b,stop_a:a,stop_b:b,len,allowed:[true,true]}));
const matrix=new Float32Array(16);
const paths=Array.from({length:16},()=>[]);
for(const [pair,trips,path] of [[1,3,[0]],[2,10,[0,2]],[3,4,[0,6]],[8,2,[3,1]],[12,7,[7,1]]]){
  matrix[pair]=trips;paths[pair]=path;
}
const graph={nodes,routeNodes,links,matrix,paths};
const cross=zoneFlow({...graph,zones:[[0],[2]]});
assert.equal(cross.trips,12);
assert.deepEqual([...cross.loads],[10,2,10,2,0,0,0,0]);
assert.equal(cross.routeKm,.004);
assert.ok(Math.abs(cross.directKm-.22239)<.00001);
assert.deepEqual(zoneFlow({...graph,zones:[[2],[3]]}),{
  loads:new Float64Array(8),trips:0,routeKm:0,directKm:0
});
const branches=originBranches(paths,matrix,0,links.length);
assert.deepEqual([...branches.links],[17,10,0,4]);
assert.deepEqual([...branches.destinations],[0,3,10,4]);
assert.deepEqual([...originLoads(paths,matrix,[0,2],links.length)],[17,2,10,2,0,0,4,0]);
assert.deepEqual([...originLoads(paths,matrix,[],links.length)],Array(8).fill(0));
console.log('PASS: OD branches, destinations, origin loads and bidirectional flows between zones.');
