import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {clusterStations,stationRadius,clusterRadius} from '../atlas/src/map-layout.mjs';

const require=createRequire(import.meta.url),d3=require('../atlas/lib/d3.min.js');
const atlas=JSON.parse(readFileSync(new URL('../atlas/data/atlas.json',import.meta.url)));
const geo=JSON.parse(readFileSync(new URL('../atlas/data/boroughs.geojson',import.meta.url)));
const covered={type:'FeatureCollection',features:geo.features.filter(f=>f.properties.name!=='Staten Island')};

function check(points,zoom,protectedIds=new Set()){
  const r=stationRadius(zoom),groups=clusterStations(points,2*r+3,protectedIds);
  assert.deepEqual(groups.flatMap(g=>g.members.map(p=>p.id)).sort(),points.map(p=>p.id).sort(),'Every complex represented exactly once');
  for(const id of protectedIds)assert.equal(groups.find(g=>g.members.some(p=>p.id===id)).members.length,1,'Selected/pinned complexes remain individual');
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i],b=groups[j];if(a.protected||b.protected)continue;
    const ra=a.members.length===1?r:clusterRadius(a.members.length),rb=b.members.length===1?r:clusterRadius(b.members.length);
    assert(Math.hypot(a.x-b.x,a.y-b.y)>=ra+rb+2-1e-9,'Visible markers must not overlap');
  }
  return groups;
}

for(const [width,height] of [[850,890],[640,600],[1200,850]]){
  const projection=d3.geoMercator().fitExtent([[12,12],[width-12,height-12]],covered);
  let previous=0;
  for(const zoom of [1,2.5,6.25,12]){
    const points=atlas.stations.map(s=>{const [x,y]=projection([s.lon,s.lat]);return {id:s.id,x:x*zoom,y:y*zoom};});
    const groups=check(points,zoom);
    assert(groups.length>=previous,'Zoom reveals at least as many individual marks');previous=groups.length;
    check(points,zoom,new Set([points[0].id,points[100].id]));
    assert.deepEqual(clusterStations([...points].reverse(),2*stationRadius(zoom)+3),groups,'Independent of input ordering');
  }
}
assert.deepEqual(clusterStations([],10),[]);
check([{id:'a',x:0,y:0},{id:'b',x:0,y:0}],12);
assert.equal(check([{id:'a',x:0,y:0},{id:'b',x:0,y:0}],12).length,1,'Colocated stations retain their membership');
assert(stationRadius(1)<stationRadius(3)&&stationRadius(12)<=6.5);
console.log(`PASS: ${atlas.stations.length} complexes, 3 viewport sizes × 4 zoom levels; membership, separation, protected selection, stable ordering and colocated stations.`);
