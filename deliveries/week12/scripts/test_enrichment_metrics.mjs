import assert from 'node:assert/strict';
import {aggregateTransfers,aggregateFares} from '../atlas/src/enrichment-metrics.mjs';
const rows=[{station_complex_id:'a',year:2024,calendar_standardized_weekly_entries:100,calendar_standardized_weekly_free_transfers:50},
  {station_complex_id:'b',year:2024,calendar_standardized_weekly_entries:900,calendar_standardized_weekly_free_transfers:0}];
assert.equal(aggregateTransfers(rows,new Set(['a','b']),2024).share,5,'Use counts, not the unweighted average of shares (25%)');
assert.equal(aggregateTransfers(rows,new Set(['a']),2024).share,50);
assert.equal(aggregateTransfers(rows,new Set(['a']),2020).share,null);
const fares=[{borough:'Queens',year:2024,fare_class_category:'Full Fare',ridership:90},
  {borough:'Queens',year:2024,fare_class_category:'Students',ridership:10},
  {borough:'Bronx',year:2024,fare_class_category:'Full Fare',ridership:100}];
assert.equal(aggregateFares(fares,new Set(['Queens']),2024).total,100);
assert.equal(aggregateFares(fares,new Set(['Queens']),2024).categories.find(r=>r.category==='Students').share,10);
assert.equal(aggregateFares(fares,new Set(['Queens','Bronx']),2024).total,200);
assert.equal(aggregateFares(fares,new Set(['Queens']),2020).total,0);
console.log('PASS: weighted transfer shares, selection, absent years and explicit borough-level fare denominators.');
