import assert from 'node:assert/strict';
import {bundleAt,closureImpact,connectionImpact,originBranches,originLoads} from '../atlas/src/od-routing.mjs';

const nodes=['A','B','C','D'].map(id=>({id}));
const routeNodes=Object.fromEntries(nodes.map(({id})=>[id,{complex:id}]));
const edges=[['A','B',2],['B','C',2],['A','C',8],['B','D',3]];
const links=edges.map(([a,b,len])=>({a,b,stop_a:a,stop_b:b,len,allowed:[true,true]}));
const matrix=new Float32Array(16);
const paths=Array.from({length:16},()=>[]);
for(const [pair,trips,path] of [[1,3,[0]],[2,10,[0,2]],[3,4,[0,6]],[8,2,[3,1]],[12,7,[7,1]]]){
  matrix[pair]=trips;paths[pair]=path;
}
const graph={nodes,routeNodes,links,matrix,paths};
const branches=originBranches(paths,matrix,0,links.length);
assert.deepEqual([...branches.links],[17,10,0,4]);
assert.deepEqual([...branches.destinations],[0,3,10,4]);
assert.deepEqual([...originLoads(paths,matrix,[0,2],links.length)],[17,2,10,2,0,0,4,0]);
assert.deepEqual([...originLoads(paths,matrix,[],links.length)],Array(8).fill(0));
assert.deepEqual(closureImpact({...graph,closed:'B'}),{access:3,disconnected:11,detoured:12,equivalent:0,extraCost:48});
const result=connectionImpact({...graph,from:'A',to:'C',length:1});
assert.equal(result.redirected,12);
assert.equal(result.meanSaving,3);
assert.equal(result.pairs,2);
assert.deepEqual([...result.changes],[-12,-12,0,0]);
assert.equal(connectionImpact({...graph,from:'A',to:'C',length:4}).redirected,0);
assert.equal(connectionImpact({...graph,from:'A',to:'C',length:1,origins:[0]}).redirected,10);
const layout={samples:2,points:new Float32Array([0,0,10,0, 0,2,10,2, 0,20,10,20]),
  metadata:new Float32Array([5,0,1,0, 2,0,2,0, 9,2,3,0])};
const found=bundleAt(layout,5,1,2);
assert.equal(found.contributors.length,2);
assert.equal(found.contributors.reduce((sum,d)=>sum+d.trips,0),7);
assert.equal(bundleAt(layout,5,30,2).representative,null);
console.log('PASS: OD branches and destinations, closed complex, bidirectional hypothetical link, geometry picking.');
