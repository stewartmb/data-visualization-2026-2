import assert from 'node:assert/strict';
import {epanechnikov,discreteFrechet,normalizedMI,makeScene,bundle,bundleFree} from '../atlas/src/raeb-core.mjs';
// Compare the optimized radial kernel against its direct mathematical sum.
const w=9,h=7,r=2.7,field=Float32Array.from({length:w*h},(_,i)=>(i*13%17)/17),got=epanechnikov(field,w,h,r);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 let expected=0;for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)expected+=field[yy*w+xx]*Math.max(0,1-((x-xx)**2+(y-yy)**2)/(r*r));
 assert(Math.abs(got[y*w+x]-expected)<1e-5);
}
assert.equal(discreteFrechet([0,0,1,1],[0,0,1,1]),0);
assert.equal(discreteFrechet([0,0,1,1],[0,1,1,2]),1);
assert.equal(normalizedMI(Uint8Array.from([0,10,100,255]),Uint8Array.from([0,10,100,255])),1);
const nodes=[[20,20],[180,20],[180,180]],links=[{len:160,reference_flow:20,points:[nodes[0],[100,100],nodes[1]]},{len:160,reference_flow:10,points:[nodes[1],nodes[2]]}];
const paths=[[],[0],[0,2],[1],[],[2],[3,1],[3],[]],weights=new Float32Array([0,20,10,30,0,40,50,60,0]),original=weights.slice();
const scene=makeScene(nodes,links,paths,weights,200,200,16),reference=scene.css(scene.seed(5));
const layouts=[await bundle(scene,0,1),await bundle(scene,.6,.65),await bundle(scene,1,1),await bundleFree(scene),await bundle(scene,0,0)];
for(const layout of layouts){
 assert(layout.points.every(Number.isFinite));
 for(let c=0;c<scene.active.length;c++)for(const i of [c*32,c*32+30]){assert(Math.abs(layout.points[i]-reference[i])<1e-3);assert(Math.abs(layout.points[i+1]-reference[i+1])<1e-3);}
}
assert.deepEqual(weights,original);assert.deepEqual(layouts[2].points,reference);
assert.equal(layouts[3].stats.freeSymmetricTrails,3);
assert.deepEqual(layouts[4].points,scene.css(scene.seed(0)));
assert.equal(await bundle(scene,0,1,{cancelled:()=>true}),null);
// A retained real section must stay at the same original arc-length sample
// across hierarchy levels; independent resampling used to create diagonals.
const coarse=scene.css(scene.seed(1));let shared=0;
for(let i=0;i<scene.sampleLevels.length;i++)if(scene.sampleLevels[i]<=1){
 assert(Math.abs(coarse[i*2]-reference[i*2])<1e-3);assert(Math.abs(coarse[i*2+1]-reference[i*2+1])<1e-3);shared++;
}
assert(shared>0);
const high=await bundle(scene,.99,1),bindings=scene.retention(.99);
for(let i=0;i<bindings.length;i++)if(bindings[i]===1){assert(Math.abs(high.points[i*2]-reference[i*2])<1e-3);assert(Math.abs(high.points[i*2+1]-reference[i*2+1])<1e-3);}
assert(high.stats.deviationPx<layouts[0].stats.deviationPx);
console.log('PASS: radial kernel, Fréchet, NMI, finite layouts, OD endpoints, reference extreme, symmetric multiplicity, conserved weights cancellation, aligned hierarchy samples and retained real geometry.');
