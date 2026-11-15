import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {makeRailKernelEstimator,routeHierarchy} from '../atlas/src/raeb-core.mjs';
const root=new URL('../atlas/data/',import.meta.url),read=name=>fs.readFileSync(new URL(name,root)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const F=JSON.parse(read('flows.json')),manifest=JSON.parse(read('raeb/manifest.json')),networkBuffer=read('raeb/network.json.gz'),{paths}=JSON.parse(zlib.gunzipSync(networkBuffer)),n=F.nodes.length;
assert.equal(hash(read('flows.json')),manifest.flows_sha256);assert.equal(hash(networkBuffer),manifest.network_sha256);
assert.deepEqual(F.meta.years,[2021,2022,2023,2024,2025]);
assert.equal(manifest.frames,F.meta.years.length*7*24);assert.equal(Object.keys(manifest.assets).length,manifest.frames);assert.equal(paths.length,n*n);
const annual=JSON.parse(read('annual-od.json'));
assert.equal(annual.source.manifest_sha256,hash(read('raeb/manifest.json')));
assert.equal(F.meta.validation_2025.rows,121209974);
assert.equal(F.meta.validation_2025.outside_network.reduce((total,entry)=>total+entry.rows,0),4);
assert(F.meta.balance_weekly_trips[2025].unmapped>0);
assert.equal(F.meta.balance_weekly_trips[2025].unassignable,0);
const ids=F.nodes.map(n=>n.id);assert.equal(new Set(ids).size,n);assert.equal(F.meta.network.inferred_proximity_edges,0);
const routeNodes=F.meta.network.route_nodes;
assert.equal(F.meta.route_model,'gtfs-parent-stops-v1');
assert.equal(F.meta.network.endpoint_snap_max_m<1,true);
for(const link of F.links){
 assert.equal(routeNodes[link.stop_a].complex,link.a);
 assert.equal(routeNodes[link.stop_b].complex,link.b);
 assert.deepEqual(link.coords[0],routeNodes[link.stop_a].coords);
 assert.deepEqual(link.coords.at(-1),routeNodes[link.stop_b].coords);
 for(const dir of [0,1])if(link.allowed[dir]){
  const cost=Array.isArray(link.cost)?link.cost[dir]:link.cost;
  assert(Number.isFinite(cost)&&cost>0);
 }
}
assert(F.links.some(l=>l.kind==='declared_walk_transfer'&&l.stop_a==='F23'&&l.stop_b==='R33'));
assert.equal(F.links.filter(l=>l.kind==='declared_walk_transfer'&&l.a==='617'&&l.b==='617').length,3);
for(let pair=0;pair<paths.length;pair++){
 const origin=ids[Math.floor(pair/n)],destination=ids[pair%n];
 if(origin===destination){assert.equal(paths[pair].length,0);continue;}
 let current;
 for(const arc of paths[pair]){
  const link=F.links[arc>>1],direction=arc&1,start=direction?link.stop_b:link.stop_a;
  assert(link.allowed[direction]);
  if(current===undefined)assert.equal(routeNodes[start].complex,origin);
  else assert.equal(current,start);
  current=direction?link.stop_a:link.stop_b;
 }
 assert.equal(routeNodes[current]?.complex,destination);
}
const estimateRadius=makeRailKernelEstimator(F.links,40.7);
const radio={minimum:Infinity,maximum:0,monday2024:null,monday2025:null};
let bytes=0,checkedFrames=0,maxRowDifference=0;
for(const year of F.meta.years){
 assert.deepEqual(F.meta.months_present[year],Array.from({length:12},(_,i)=>i+1));let matrixTotal=0,startsTotal=0;
 const balance=F.meta.balance_weekly_trips[year];assert(Math.abs(balance.input-balance.assigned-balance.same_origin_destination-balance.unmapped-balance.unassignable)<1e-5);
 const daily=annual.years[year],annualMatrix=new Float64Array(n*n),calendarDays=daily.day_counts.reduce((a,b)=>a+b);
 assert.equal(calendarDays,year===2024?366:365);
 for(let day=0;day<7;day++)for(let hour=0;hour<24;hour++){
  const key=`${year}/${day}-${String(hour).padStart(2,'0')}`,gz=read('raeb/'+key+'.f32.gz');bytes+=gz.length;
  assert.equal(hash(gz),manifest.assets[key].sha256);assert.equal(gz.length,manifest.assets[key].bytes);
  const raw=zlib.gunzipSync(gz);assert.equal(raw.length,n*n*4);const values=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);
  const dayWeight=daily.day_counts[day]/calendarDays;
  for(let o=0;o<n;o++){let row=0;for(let d=0;d<n;d++){const i=o*n+d,q=values[i];annualMatrix[i]+=dayWeight*q;assert(Number.isFinite(q)&&q>=0);row+=q;}const start=F.starts[year][o][day][hour];maxRowDifference=Math.max(maxRowDifference,Math.abs(row-start));assert(Math.abs(row-start)<=.005+balance.unmapped);matrixTotal+=row;startsTotal+=start;}
  // A full route incidence sum for one cohort per year independently checks
  // the directed arc-load table used by the exact-reference renderer.
  if(day===0&&hour===8){
   const loads=new Float64Array(F.links.length*2),incoming=new Float64Array(n),through=new Float64Array(n);
   const index=new Map(ids.map((id,i)=>[id,i]));
   for(let pair=0;pair<values.length;pair++){
    const q=values[pair],o=Math.floor(pair/n),d=pair%n;
    if(!q||o===d)continue;
    incoming[d]+=q;
    const passed=new Set();
    for(const arc of paths[pair]){
     loads[arc]+=q;
     const link=F.links[arc>>1];
     passed.add(index.get(arc&1?link.a:link.b));
    }
    passed.delete(o);passed.delete(d);
    for(const i of passed)through[i]+=q;
   }
   loads.forEach((v,i)=>assert(Math.abs(v-F.flows[year][day][hour][i])<.005+v*1e-6));
   // The source aggregates are rounded to four decimals and the matrices
   // store each pair in Float32 before this independent reconstruction.
   for(let i=0;i<n;i++){
    for(const [computed,stored] of [[incoming[i],F.incoming[year][day][hour][i]],[through[i],F.through[year][day][hour][i]]]){
     const tolerance=.00005+Math.abs(computed)*2**-24+1e-10;
     assert(Math.abs(computed-stored)<=tolerance,`Demanda distinta en ${year}, complejo ${ids[i]}`);
    }
   }
  }
  const loads=F.flows[year][day][hour];
  const {ranked}=routeHierarchy(F.links.map((link,i)=>({...link,reference_flow:loads[2*i]+loads[2*i+1]})));
  const kernel=estimateRadius(ranked);
  assert(kernel.radiusMeters>0 && Number.isFinite(kernel.radiusMeters),`Sin radio automático en ${key}`);
  radio.minimum=Math.min(radio.minimum,kernel.radiusMeters);
  radio.maximum=Math.max(radio.maximum,kernel.radiusMeters);
  if(day===0&&hour===8&&year>=2024)radio['monday'+year]=kernel;
  checkedFrames++;
 }
 assert(Math.abs(matrixTotal-balance.assigned-balance.same_origin_destination)<.5);
 const expectedStarts=year===2025?balance.input-balance.unmapped:balance.input;
 assert(Math.abs(startsTotal-expectedStarts)<.5);
 const annualGz=read(`raeb/${year}/annual.f32.gz`);
 assert.equal(hash(annualGz),daily.frame_sha256);
 const raw=zlib.gunzipSync(annualGz);
 const values=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);
 assert.equal(values.length,n*n);
 values.forEach((v,i)=>assert.equal(v,Math.fround(annualMatrix[i])));
}

console.log(JSON.stringify({status:'PASS',frames:checkedFrames,nodes:n,links:F.links.length,compressedMatricesBytes:bytes,radioMeters:radio,maxOriginRowDifference:maxRowDifference,checks:'SHA-256, finite/nonnegative full matrices, twelve months, directed stop continuity, exact rail endpoints, declared transfers, no inferred edges, demand balance, origin totals, arc loads'},null,2));
