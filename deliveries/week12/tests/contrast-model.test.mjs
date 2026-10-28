import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectorContrast,contrastMeasures,contrastCell,normalizeContrastBase} from '../atlas/src/contrast-model.mjs';
const load=name=>JSON.parse(fs.readFileSync(new URL('../atlas/data/'+name,import.meta.url)));
const historical=load('historical_contrast.json'),f=load('flows.json'),atlas=load('atlas.json');
assert.equal(historical.meta.status,'PASS');
for(const year of [2019,2020,2021,2022,2023,2024]){
 assert.equal(historical.meta.months_present[year].length,12);
 for(const profiles of Object.values(historical.profiles)){
  const p=profiles[year];if(!p)continue;
  assert.equal(p.p.length,168);assert(p.p.every(v=>Number.isFinite(v)&&v>=0));assert(Math.abs(p.p.reduce((a,b)=>a+b,0)-1)<1e-10);
  assert(Math.abs(p.daily*7-p.weekly)<1e-6);
 }
}
const profile=u=>{const a=u.flat(),weekly=a.reduce((s,v)=>s+v,0),p=a.map(v=>v/weekly);return {p,weekly,daily:weekly/7,am:0,weekend:100*p.slice(120).reduce((s,v)=>s+v,0)};};
const stations=atlas.stations.map((s,i)=>({...s,profiles:Object.fromEntries([2021,2022,2023,2024].map(y=>[y,profile(f.starts[y][i])]))}));
const state={year:2024,base:2021,day:0,hour:8,fidelity:.9,bundling:.65};
const map={data:{stations},flows:f,historicalProfiles:historical,state,filtered:()=>stations,station:id=>stations.find(s=>s.id===id)};
const before=JSON.stringify({state,stations});
const od=inspectorContrast(map,2021,2024),pre=inspectorContrast(map,2019,2024),covid=inspectorContrast(map,2020,2024);
assert.equal(od.contrast.kind,'od');assert.equal(od.data.stations,stations);
for(const view of [pre,covid]){
 assert.equal(view.contrast.kind,'entries');assert.equal(view.data.stations.length,424);
 assert.equal(view.station('301').profiles['2024'],historical.profiles['301']['2024']);
 assert.notEqual(view.station('301').profiles['2024'],map.station('301').profiles['2024']);
 assert.equal(view.filtered().length,424);
}
assert.equal(JSON.stringify({state,stations}),before);
assert.equal(map.station('301').profiles['2019'],undefined);
assert.notEqual(contrastMeasures(pre.station('301'),2019,2024).recovery,contrastMeasures(od.station('301'),2021,2024).recovery);
assert.throws(()=>inspectorContrast({...map,historicalProfiles:null},2019,2024),/Faltan/);
assert.equal(normalizeContrastBase(2023,2022,2021),2021);
const a={p:Array(168).fill(1/168),daily:10,weekly:70,am:20,weekend:20},b={...a,daily:20,weekly:140};
const proportional={profiles:{2019:a,2024:b}};
assert.equal(contrastMeasures(proportional,2019,2024).change,0);assert.equal(contrastMeasures(proportional,2019,2024).recovery,200);
assert.equal(contrastCell(proportional,10,'delta',2019,2024),0);
console.log('PASS: six complete years; normalized 168-cell weeks; equivalent sources on both sides; 2019/2020 confined to right-column clones; unchanged OD profiles/map state; missing historical data rejected; proportional-profile and denominator checks.');
