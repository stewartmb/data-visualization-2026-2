import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app = new URL('../atlas/data/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, app)));
const readSpectral = name => JSON.parse(readFileSync(new URL('../data/entries_archive/spectral/'+name, import.meta.url)));
const index = readSpectral('index.json');
const network = read('network_current.json');
const ids = new Set(network.nodes.map(node => String(node.id)));

assert.equal(ids.size, index.meta.complexes);
assert.equal(Object.keys(index.meta.source_sha256).length, 72);
assert.ok(index.meta.valid_hours <= index.meta.observed_hours);
assert.ok(index.meta.observed_hours <= index.meta.hour_slots * ids.size);
assert.equal(index.meta.scales.length, 4);

for (const [month, episodes] of Object.entries(index.months)) {
  const details = readSpectral(month + '.json');
  assert.ok(episodes.length <= 6);
  assert.equal(Object.keys(details).length, episodes.length);
  for (const event of episodes) {
    assert.ok(event.id.startsWith(month));
    assert.ok(event.start <= event.peak && event.peak < event.end);
    const record = details[event.id];
    assert.equal(event.complexes, record.stations.length);
    assert.equal(event.complexes, new Set(record.stations.map(station => station.id)).size);
    assert.equal(record.window[1] - record.window[0], event.hours);
    assert.ok(record.window[0] >= 0 && record.window[1] <= record.observed.length);
    assert.equal(record.observed.length, record.typical.length);
    for (const station of record.stations) {
      assert.ok(ids.has(station.id));
      assert.ok(station.score >= index.meta.cutoff - 0.0001);
      assert.equal(station.observed.length, record.observed.length);
      assert.equal(station.typical.length, record.observed.length);
      assert.ok(station.observed.every((value,i) => (value === null) === (station.typical[i] === null)));
    }
    for (const [i, total] of record.observed.entries()) {
      const samples = record.stations.map(station => station.observed[i]).filter(sample => sample !== null);
      if (!samples.length) assert.equal(total, null);
      else assert.ok(Math.abs(total - samples.reduce((sum, sample) => sum + sample, 0)) < 0.06 * (1 + samples.length));
    }
  }
}
assert.ok(index.months['2023-09'].some(event => event.start.startsWith('2023-09-29')));
console.log('PASS: cobertura, catálogo, correspondencia de episodios, ventanas, faltantes y sumas por hora.');
