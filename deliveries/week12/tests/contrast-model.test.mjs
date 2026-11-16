import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeContrastBase,annualMeasures,inspectorContrast,contrastMeasures,contrastCell,normalizeContrastBase} from '../atlas/src/contrast-model.mjs';

const load = name => JSON.parse(readFileSync(new URL('../atlas/data/'+name,import.meta.url)));
const flows = load('flows.json');
const catalog = load('stations.json');
const years = [2021,2022,2023,2024,2025];
assert.deepEqual(flows.meta.years,years);
assert.deepEqual(new Set(catalog.stations.map(s=>s.id)),new Set(flows.nodes.map(s=>s.id)));
assert(catalog.stations.every(s=>!('profiles' in s)&&!('series' in s)));

const indices = new Map(flows.nodes.map((node,index)=>[node.id,index]));
const stations = catalog.stations.map(station=>{
  const profiles = Object.fromEntries(years.map(year=>{
    const counts = flows.starts[year][indices.get(station.id)].flat();
    assert.equal(counts.length,168);
    assert(counts.every(count=>Number.isFinite(count)&&count>=0));
    const weekly = counts.reduce((total,count)=>total+count,0);
    return [year,{p:counts.map(count=>count/weekly),daily:weekly/7,weekly,am:0,weekend:0}];
  }));
  return {...station,profiles};
});
const map = {data:{stations},flows,filtered:()=>stations};
assert.equal(inspectorContrast(map,null,2025).filtered().length,424);
assert.equal(inspectorContrast(map,2021,2025).filtered().length,424);
assert.equal(inspectorContrast(map,2021,2025).data.stations,stations);
assert.throws(()=>inspectorContrast(map,2019,2025),/agregados OD/);
assert.throws(()=>inspectorContrast(map,null,2020),/agregados OD/);

const state = {view:'map',layer:'flows',year:2021,contrastBase:2019};
const dataset = {years};
assert.equal(activeContrastBase(state,flows,2021,dataset),2022);
assert.equal(activeContrastBase({...state,layer:'points'},flows,2021,dataset),2022);
assert.equal(activeContrastBase({...state,odCompareBase:2025},flows,2021,dataset),2025);
assert.equal(normalizeContrastBase(2024,2024,2021),2021);
assert.deepEqual(annualMeasures({profiles:{2025:{daily:10,p:[0.15,0.5,0.35]}}},2025),
  {daily:10,peak:1,peakShare:50});
const a = {p:Array(168).fill(1/168),daily:10,am:20,weekend:20};
const proportional = {profiles:{2021:a,2025:{...a,daily:20}}};
assert.equal(contrastMeasures(proportional,2021,2025).change,0);
assert.equal(contrastMeasures(proportional,2021,2025).recovery,200);
assert.equal(contrastCell(proportional,10,'delta',2021,2025),0);
console.log('PASS: catálogo sin entradas, cinco años OD y comparaciones con una sola fuente.');
