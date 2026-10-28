import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
const root=new URL('../atlas/data/',import.meta.url),read=name=>fs.readFileSync(new URL(name,root)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const F=JSON.parse(read('flows.json')),manifest=JSON.parse(read('raeb/manifest.json')),networkBuffer=read('raeb/network.json.gz'),{paths}=JSON.parse(zlib.gunzipSync(networkBuffer)),n=F.nodes.length;
assert.equal(hash(read('flows.json')),manifest.flows_sha256);assert.equal(hash(networkBuffer),manifest.network_sha256);
assert.equal(manifest.frames,4*7*24);assert.equal(Object.keys(manifest.assets).length,672);assert.equal(paths.length,n*n);
const ids=F.nodes.map(n=>n.id);assert.equal(new Set(ids).size,n);assert.equal(F.meta.network.inferred_proximity_edges,0);
for(let pair=0;pair<paths.length;pair++){
 let current=ids[Math.floor(pair/n)];const destination=ids[pair%n];
 for(const arc of paths[pair]){const link=F.links[arc>>1],direction=arc&1;assert(link?.allowed[direction]);assert.equal(current,direction?link.b:link.a);current=direction?link.a:link.b;}
 assert.equal(current,destination); // self OD deliberately has no loop
}
let bytes=0,checkedFrames=0,maxRowDifference=0;
for(const year of F.meta.years){
 assert.deepEqual(F.meta.months_present[year],Array.from({length:12},(_,i)=>i+1));let matrixTotal=0,startsTotal=0;
 const balance=F.meta.balance_weekly_trips[year];assert(Math.abs(balance.input-balance.assigned-balance.same_origin_destination-balance.unmapped-balance.unassignable)<1e-5);
 for(let day=0;day<7;day++)for(let hour=0;hour<24;hour++){
  const key=`${year}/${day}-${String(hour).padStart(2,'0')}`,gz=read('raeb/'+key+'.f32.gz');bytes+=gz.length;
  assert.equal(hash(gz),manifest.assets[key].sha256);assert.equal(gz.length,manifest.assets[key].bytes);
  const raw=zlib.gunzipSync(gz);assert.equal(raw.length,n*n*4);const values=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);
  for(let o=0;o<n;o++){let row=0;for(let d=0;d<n;d++){const q=values[o*n+d];assert(Number.isFinite(q)&&q>=0);row+=q;}const start=F.starts[year][o][day][hour];maxRowDifference=Math.max(maxRowDifference,Math.abs(row-start));assert(Math.abs(row-start)<=.005+balance.unmapped);matrixTotal+=row;startsTotal+=start;}
  // A full route incidence sum for one cohort per year independently checks
  // the directed arc-load table used by the exact-reference renderer.
  if(day===0&&hour===8){const loads=new Float64Array(F.links.length*2);for(let pair=0;pair<values.length;pair++)for(const arc of paths[pair])loads[arc]+=values[pair];loads.forEach((v,i)=>assert(Math.abs(v-F.flows[year][day][hour][i])<.005+v*1e-6));}
  checkedFrames++;
 }
 assert(Math.abs(matrixTotal-balance.assigned-balance.same_origin_destination)<.5);assert(Math.abs(startsTotal-balance.input)<.5);
}
console.log(JSON.stringify({status:'PASS',frames:checkedFrames,nodes:n,links:F.links.length,compressedMatricesBytes:bytes,maxOriginRowDifference:maxRowDifference,checks:'SHA-256, finite/nonnegative full matrices, twelve months, directed path continuity, no inferred edges, demand balance, origin totals, arc loads'},null,2));
