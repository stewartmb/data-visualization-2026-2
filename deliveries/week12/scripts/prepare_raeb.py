#!/usr/bin/env python3
"""Prepara OD completo y caminos GTFS para RAEB, sin inferir enlaces por cercanía.

--source-package permite reutilizar una adquisición validada de otra copia local.
La salida es portable: geometrías, caminos y 672 matrices Float32 gzip (4×7×24).
"""
import argparse
import calendar
import csv
import gzip
import hashlib
import heapq
import io
import json
import math
import os
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone
import zipfile

import duckdb
import numpy as np

P = Path(__file__).resolve().parents[1]
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''): h.update(b)
    return h.hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
    path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == '.gz' else raw)


def xy(lon, lat, latitude=40.73):
    return np.array([lon * 111320 * math.cos(math.radians(latitude)), lat * 111320])


def network(archive, stations, catalog, latitude=40.73, *, by_stop=False):
    with zipfile.ZipFile(archive) as z:
        def read(name):
            with z.open(name) as f:
                return list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig')))
        stops = {r['stop_id']: r for r in read('stops.txt')}
        trips = {r['trip_id']: r for r in read('trips.txt')}
        shapes = defaultdict(list)
        for r in read('shapes.txt'):
            shapes[r['shape_id']].append((int(r['shape_pt_sequence']), float(r['shape_pt_lon']), float(r['shape_pt_lat'])))
        shapes = {k: np.array([[x, y] for _, x, y in sorted(v)]) for k, v in shapes.items()}
        sequences = defaultdict(list)
        for r in read('stop_times.txt'):
            sequences[r['trip_id']].append((int(r['stop_sequence']), r['stop_id']))
        patterns = set()
        for tid, seq in sequences.items():
            trip = trips[tid]
            patterns.add((trip['shape_id'], trip['route_id'], tuple(s for _, s in sorted(seq))))
        transfers, feed_info = read('transfers.txt'), read('feed_info.txt')
    ids = {s['id'] for s in stations}
    stop_complex = {}
    for row in catalog:
        for stop in row.get('gtfs_stop_ids', '').split(';'):
            if stop.strip(): stop_complex[stop.strip()] = str(int(float(row['complex_id'])))
    def parent_stop(stop):
        seen = set()
        while stop not in stop_complex and stop in stops and stop not in seen:
            seen.add(stop); stop = stops[stop].get('parent_station', '')
        return stop if stop in stop_complex else None
    links = {}
    physical = {}
    rejected = []
    eligible = {stop for stop, cid in stop_complex.items() if cid in ids} if by_stop else ids
    for shape_id, route, sequence in sorted(patterns):
        coords = shapes.get(shape_id)
        if coords is None or len(coords) < 2: continue
        local = coords * [111320 * math.cos(math.radians(latitude)), 111320]
        delta = local[1:] - local[:-1]
        length = np.linalg.norm(delta, axis=1)
        cum = np.concatenate(([0.0], np.cumsum(length)))
        last_pos = 0.0
        matched = []
        for stop in sequence:
            row = stops[stop]; point = xy(float(row['stop_lon']), float(row['stop_lat']), latitude)
            t = np.clip(np.sum((point - local[:-1]) * delta, axis=1) / np.maximum(length**2, 1e-9), 0, 1)
            projected = local[:-1] + delta * t[:, None]
            along = cum[:-1] + t * length
            distance = np.linalg.norm(projected - point, axis=1)
            distance[along < last_pos - 1] = np.inf
            i = int(np.argmin(distance))
            if not math.isfinite(float(distance[i])) or distance[i] > 250:
                rejected.append({'stop': stop, 'shape': shape_id, 'reason': 'shape distance/order'}); matched.append(None); continue
            pos = float(along[i]); last_pos = pos
            lonlat = coords[i] + t[i] * (coords[i + 1] - coords[i])
            parent = parent_stop(stop)
            if parent is not None and stop_complex[parent] in ids:
                row = stops[parent]
                physical[parent] = {'complex': stop_complex[parent],
                                    'coords': [float(row['stop_lon']), float(row['stop_lat'])]}
            matched.append((parent if by_stop else stop_complex.get(parent), pos, i, lonlat))
        for a, b in zip(matched, matched[1:]):
            if not a or not b or a[0] not in eligible or b[0] not in eligible or a[0] == b[0]: continue
            if b[1] <= a[1]: continue
            geom = [a[3].tolist(), *coords[a[2] + 1:b[2] + 1].tolist(), b[3].tolist()]
            key = tuple(sorted((a[0], b[0])))
            direction = 0 if a[0] == key[0] else 1
            candidate = links.get(key)
            dist = b[1] - a[1]
            if candidate is None:
                candidate = links[key] = {'a': key[0], 'b': key[1], 'len': dist, 'coords': geom if direction == 0 else geom[::-1], 'allowed': [False, False], 'routes': [], 'kind': 'rail'}
            candidate['allowed'][direction] = True
            if route not in candidate['routes']: candidate['routes'].append(route)
            if dist < candidate['len']:
                candidate['len'] = dist; candidate['coords'] = geom if direction == 0 else geom[::-1]
    if by_stop:
        return physical_network(links, physical, transfers, parent_stop, latitude, feed_info, rejected)
    by_id = {s['id']: s for s in stations}
    for r in transfers:
        if r.get('transfer_type') == '3': continue
        a, b = (stop_complex.get(parent_stop(r[k])) for k in ('from_stop_id', 'to_stop_id'))
        if a not in ids or b not in ids or a == b: continue
        key = tuple(sorted((a, b))); direction = 0 if a == key[0] else 1
        if key not in links:
            first, second = by_id[key[0]], by_id[key[1]]
            coords = [[first['lon'], first['lat']], [second['lon'], second['lat']]]
            dist = float(np.linalg.norm(xy(*coords[0], latitude) - xy(*coords[1], latitude)))
            links[key] = {'a': key[0], 'b': key[1], 'len': max(dist, 1), 'coords': coords, 'allowed': [False, False], 'routes': [], 'kind': 'declared_walk_transfer'}
        links[key]['allowed'][direction] = True
    output = list(links.values())
    for edge in output:
        edge['len'] = round(edge['len'], 3)
        edge['coords'] = [[round(x, 7), round(y, 7)] for x, y in edge['coords']]
    return output, {'feed_info': feed_info, 'rejected_shape_matches': rejected, 'inferred_proximity_edges': 0,
                    'meaning': 'Static reference network: GTFS consecutive stops and explicit transfers, not historical service availability or observed passenger paths.'}


def physical_network(rail, nodes, transfers, parent_stop, latitude, feed_info, rejected):
    """Rail uses actual consecutive GTFS stops; transfers are explicitly declared."""
    endpoints = defaultdict(list)
    for link in rail.values():
        endpoints[link['a']].append(link['coords'][0])
        endpoints[link['b']].append(link['coords'][-1])
    nodes = {stop: nodes[stop] for stop in sorted(endpoints)}
    offsets = []
    for stop, node in nodes.items():
        model = xy(*node['coords'], latitude)
        node['coords'] = [round(v, 7) for v in min(
            endpoints[stop], key=lambda point: np.linalg.norm(xy(*point, latitude) - model)
        )]
        offsets.extend(float(np.linalg.norm(xy(*p, latitude) - xy(*node['coords'], latitude)))
                       for p in endpoints[stop])
    edges = []
    for link in rail.values():
        a, b = link['a'], link['b']
        anchor_a, anchor_b = nodes[a]['coords'], nodes[b]['coords']
        geometry = [[round(v, 7) for v in p] for p in link['coords']]
        geometry[0], geometry[-1] = anchor_a, anchor_b
        length = sum(np.linalg.norm(xy(*p, latitude) - xy(*q, latitude)) for p, q in zip(geometry, geometry[1:]))
        edges.append({**link, 'a': nodes[a]['complex'], 'b': nodes[b]['complex'],
                      'stop_a': a, 'stop_b': b, 'coords': geometry,
                      'len': round(float(length), 3), 'cost': round(max(1., float(length)), 3)})
    walk = {}
    for transfer in transfers:
        if transfer['transfer_type'] == '3':
            continue
        a, b = (parent_stop(transfer[k]) for k in ('from_stop_id', 'to_stop_id'))
        if a not in nodes or b not in nodes or a == b:
            continue
        key = tuple(sorted((a, b)))
        coords = [nodes[stop]['coords'] for stop in key]
        length = float(np.linalg.norm(xy(*coords[0], latitude) - xy(*coords[1], latitude)))
        # Compare rail distance with walking/transfer time via an explicitly
        # modeled conversion of 8 m of rail distance per second of transfer.
        cost = max(1., length, 8 * float(transfer.get('min_transfer_time') or 0))
        edge = walk.setdefault(key, {'a': nodes[key[0]]['complex'], 'b': nodes[key[1]]['complex'],
                                    'stop_a': key[0], 'stop_b': key[1], 'kind': 'declared_walk_transfer',
                                    'coords': coords, 'routes': [], 'len': round(length, 3),
                                    'cost': [None, None], 'allowed': [False, False]})
        direction = int(a != key[0])
        previous = edge['cost'][direction]
        edge['cost'][direction] = round(cost if previous is None else min(previous, cost), 3)
        edge['allowed'][direction] = True
    return edges + list(walk.values()), {
        'feed_info': feed_info, 'rejected_shape_matches': rejected,
        'inferred_proximity_edges': 0, 'route_nodes': nodes,
        'endpoint_snap_max_m': round(max(offsets, default=0), 2),
        'endpoint_snap_p95_m': round(float(np.quantile(offsets, .95)), 2) if offsets else 0,
        'rail_cost': 'distance in metres',
        'transfer_cost': 'max(1 m, endpoint distance, GTFS minimum transfer time × 8 m/s), by direction',
        'meaning': 'Static GTFS parent-stop graph with directed declared transfers and multi-source/multi-target OD complex access.'
    }


def paths_for(stations, links):
    n = len(stations); index = {s['id']: i for i, s in enumerate(stations)}
    adj = [[] for _ in stations]
    for li, edge in enumerate(links):
        a, b = index[edge['a']], index[edge['b']]
        if edge['allowed'][0]: adj[a].append((b, edge['len'], 2 * li))
        if edge['allowed'][1]: adj[b].append((a, edge['len'], 2 * li + 1))
    paths = [[] for _ in range(n*n)]; unreachable = []
    pair_index, arc_index = [], []
    for start in range(n):
        dist = [math.inf] * n; prev = [None] * n; dist[start] = 0; queue = [(0, start)]
        while queue:
            d, u = heapq.heappop(queue)
            if d != dist[u]: continue
            for v, w, arc in adj[u]:
                nd = d+w
                if nd < dist[v]:
                    dist[v] = nd; prev[v] = (u, arc); heapq.heappush(queue, (nd, v))
        for end in range(n):
            if start == end: continue
            if prev[end] is None:
                unreachable.append([stations[start]['id'], stations[end]['id']]); continue
            cur = end; path = []
            while cur != start:
                cur, arc = prev[cur]; path.append(arc)
            path.reverse(); pid = start*n+end; paths[pid] = path
            pair_index.extend([pid]*len(path)); arc_index.extend(path)
    return paths, np.array(pair_index, dtype=np.int32), np.array(arc_index, dtype=np.int32), unreachable


def through_incidence(stations, links, paths):
    n = len(stations)
    index = {s['id']: i for i, s in enumerate(stations)}
    link_destinations = [(index[link['b']], index[link['a']]) for link in links]
    pair_indices, complex_indices = [], []
    for pair, path in enumerate(paths):
        origin, destination = divmod(pair, n)
        via = {link_destinations[arc >> 1][arc & 1] for arc in path}
        via.difference_update((origin, destination))
        pair_indices.extend([pair] * len(via))
        complex_indices.extend(sorted(via))
    return np.asarray(pair_indices, dtype=np.int32), np.asarray(complex_indices, dtype=np.int32)


def station_demands(matrix, through_pair, through_complex, n):
    square = matrix.reshape(n, n)
    incoming = square.sum(axis=0, dtype=np.float64) - np.diag(square)
    through = np.bincount(through_complex, weights=matrix[through_pair], minlength=n)
    return np.round(incoming, 4).tolist(), np.round(through, 4).tolist()


def reroute_existing(source, stations, links, net_meta, paths, incidence_pair, incidence_arc):
    data_dir = P/'atlas/data'
    source_dir = source/'atlas/data'
    out = data_dir/'raeb'
    manifest = json.loads((source_dir/'raeb/manifest.json').read_text())
    source_flows = source_dir/'flows.json'
    if sha(source_flows) != manifest['flows_sha256']:
        raise SystemExit('El resumen OD no coincide con el manifiesto.')
    data = json.loads(source_flows.read_text())
    if [s['id'] for s in data['nodes']] != [s['id'] for s in stations]:
        raise SystemExit('Cambió el orden de los complejos en las matrices OD.')
    n = len(stations)
    through_pair, through_complex = through_incidence(stations, links, paths)
    loads_by_year, incoming, through = {}, {}, {}
    guide_flow = np.zeros(len(links))
    for year in data['meta']['years']:
        loads_by_year[str(year)] = year_loads = []
        incoming[str(year)], through[str(year)] = year_arrivals, year_through = [], []
        for day in range(7):
            year_loads.append(day_loads := [])
            year_arrivals.append(day_arrivals := [])
            year_through.append(day_through := [])
            for hour in range(24):
                key = f'{year}/{day}-{hour:02d}'
                frame = source_dir/f'raeb/{key}.f32.gz'
                if sha(frame) != manifest['assets'][key]['sha256']:
                    raise SystemExit(f'Matriz OD distinta del manifiesto: {key}')
                raw = np.frombuffer(gzip.decompress(frame.read_bytes()), dtype='<f4')
                loads = np.bincount(incidence_arc, weights=raw[incidence_pair], minlength=2*len(links))
                day_loads.append(np.round(loads, 3).tolist())
                arrivals, uses = station_demands(raw, through_pair, through_complex, n)
                day_arrivals.append(arrivals)
                day_through.append(uses)
                guide_flow += loads.reshape(-1, 2).sum(axis=1)
        print(f'{year}: 168 matrices verificadas y cargas reasignadas.', flush=True)
    for edge, flow in zip(links, guide_flow):
        edge['reference_flow'] = round(float(flow), 3)
    metadata = data['meta']
    metadata.update(network=net_meta, unreachable_pairs=0, route_model='gtfs-parent-stops-v1',
                    method='Calendar-weighted annual OD. Static GTFS minimum modeled cost, combining rail distance and declared transfer cost.',
                    built_at_utc=datetime.now(timezone.utc).isoformat())
    data.update(links=links, flows=loads_by_year, incoming=incoming, through=through)
    write_json(out/'network.json.gz', {'paths': paths, 'meta': net_meta})
    write_json(data_dir/'flows.json', data)
    manifest.update(network_sha256=sha(out/'network.json.gz'),
                    flows_sha256=sha(data_dir/'flows.json'), metadata=metadata)
    write_json(out/'manifest.json', manifest)


def main():
    from raeb_stop_network import stop_paths

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source-package', type=Path, default=P)
    ap.add_argument('--reroute-existing', action='store_true',
                    help='Validate and reuse the existing annual OD matrices, rebuilding derived routes and loads only.')
    args = ap.parse_args(); source = args.source_package.resolve()
    report_path = source/'data/od_2021_2024/validation.json'
    report = json.loads(report_path.read_text())
    if report.get('status') != 'PASS' or report.get('months_validated') != 48:
        raise SystemExit('Se requieren 48 meses OD con validación PASS.')
    atlas_path = P/'atlas/data/atlas.json'; stations = json.loads(atlas_path.read_text())['stations']
    archive = source/'data/raw/enrichments/gtfs_subway.zip'
    catalog = json.loads((P/'data/station_catalog.json').read_text())
    if sha(archive) != json.loads((source/'data/network_reference/source.json').read_text())['sha256']:
        raise SystemExit('La referencia GTFS difiere de la adquisición registrada.')
    links, net_meta = network(archive, stations, catalog, by_stop=True)
    paths, unreachable = stop_paths(stations, links, net_meta['route_nodes'])
    if unreachable:
        raise SystemExit(f'Pares sin ruta: {unreachable[:20]}')
    incidence_pair = np.repeat(np.arange(len(paths), dtype=np.int32), [len(path) for path in paths])
    incidence_arc = np.fromiter((arc for path in paths for arc in path), dtype=np.int32)
    if args.reroute_existing:
        reroute_existing(source, stations, links, net_meta, paths, incidence_pair, incidence_arc)
        return
    n = len(stations); n_arcs = 2*len(links)
    print(f'GTFS: {n} complejos, {len(links)} tramos, {len(unreachable)} pares no asignables, cero enlaces por proximidad.', flush=True)
    out = P/'atlas/data/raeb'; out.mkdir(parents=True, exist_ok=True)
    write_json(out/'network.json.gz', {'paths': paths, 'meta': net_meta})
    con = duckdb.connect(config={'memory_limit': '3GB', 'threads': 4, 'preserve_insertion_order': False})
    temp = source/'data/raw/od_2021_2024/raeb_tmp'; temp.mkdir(exist_ok=True)
    con.execute("SET temp_directory='"+str(temp).replace("'", "''")+"'")
    con.execute('CREATE TABLE nodes (id VARCHAR, i INTEGER)')
    con.executemany('INSERT INTO nodes VALUES (?, ?)', [(s['id'], i) for i,s in enumerate(stations)])
    starts, flows, coverage, balances, assets = {}, {}, {}, {}, {}
    incoming, through = {}, {}
    through_pair, through_complex = through_incidence(stations, links, paths)
    guide_flow = np.zeros(len(links))
    source_files = {}
    for year in [2021, 2022, 2023, 2024]:
        selected = [source/e['parquet_file'] for key,e in sorted(report['months'].items()) if key.startswith(str(year))]
        assert len(selected) == 12 and all(p.exists() for p in selected)
        for key,e in report['months'].items():
            if key.startswith(str(year)): source_files[key] = {'parquet_sha256': e['parquet_sha256'], 'rows': e['rows']}
        glob = str(source/f'data/raw/od_2021_2024/parquet/{year}-*.parquet').replace("'", "''")
        con.execute('CREATE OR REPLACE TABLE exposure (month INTEGER, day_of_week VARCHAR, d INTEGER, n DOUBLE, den DOUBLE)')
        counts = {(m,d): sum(calendar.weekday(year,m,t)==d for t in range(1, calendar.monthrange(year,m)[1]+1)) for m in range(1,13) for d in range(7)}
        con.executemany('INSERT INTO exposure VALUES (?,?,?,?,?)', [(m,DAYS[d],d,float(v),float(sum(counts[k,d] for k in range(1,13)))) for (m,d),v in counts.items()])
        print(f'{year}: agregando los 12 meses...', flush=True)
        rows = con.execute(f"""SELECT coalesce(o.i,-1)::INTEGER AS o, coalesce(j.i,-1)::INTEGER AS j,
            e.d::INTEGER AS d, p.hour_of_day::INTEGER AS h,
            sum(p.estimated_average_ridership*e.n/e.den)::DOUBLE AS q
            FROM read_parquet('{glob}') p JOIN exposure e USING(month,day_of_week)
            LEFT JOIN nodes o ON o.id=p.origin_station_complex_id
            LEFT JOIN nodes j ON j.id=p.destination_station_complex_id
            GROUP BY ALL ORDER BY d,h,o,j""").fetchnumpy()
        frame_key = rows['d']*24+rows['h']; boundaries = np.searchsorted(frame_key, np.arange(169))
        u = np.zeros((n,7,24)); year_flows = []; balance = defaultdict(float)
        incoming[str(year)], through[str(year)] = year_arrivals, year_through = [], []
        for day in range(7):
            day_flows = []
            year_arrivals.append(day_arrivals := [])
            year_through.append(day_through := [])
            for hour in range(24):
                frame = day*24+hour; lo,hi = boundaries[frame:frame+2]
                o,j,q = rows['o'][lo:hi],rows['j'][lo:hi],rows['q'][lo:hi]
                valid_o = o>=0; mapped = valid_o&(j>=0); same = mapped&(o==j)
                u[:,day,hour] = np.bincount(o[valid_o], weights=q[valid_o], minlength=n)
                matrix = np.zeros(n*n)
                matrix[o[mapped]*n+j[mapped]] = q[mapped]
                arrivals, uses = station_demands(matrix, through_pair, through_complex, n)
                day_arrivals.append(arrivals)
                day_through.append(uses)
                arc_volume = np.bincount(incidence_arc, weights=matrix[incidence_pair], minlength=n_arcs)
                day_flows.append(np.round(arc_volume,3).tolist()); guide_flow += arc_volume.reshape(-1,2).sum(axis=1)
                assigned_mask = np.array([bool(paths[int(a)*n+int(b)]) if a>=0 and b>=0 and a!=b else False for a,b in zip(o,j)])
                balance['input'] += float(q.sum());balance['assigned'] += float(q[assigned_mask].sum())
                balance['same_origin_destination'] += float(q[same].sum());balance['unmapped'] += float(q[~mapped].sum())
                balance['unassignable'] += float(q[mapped&~same&~assigned_mask].sum())
                path = out/f'{year}/{day}-{hour:02d}.f32.gz';path.parent.mkdir(exist_ok=True)
                path.write_bytes(gzip.compress(matrix.astype('<f4').tobytes(), mtime=0))
                assets[f'{year}/{day}-{hour:02d}'] = {'bytes':path.stat().st_size,'sha256':sha(path)}
            year_flows.append(day_flows)
        assert math.isclose(balance['input'],sum(v for k,v in balance.items() if k!='input'),rel_tol=1e-10)
        starts[str(year)] = np.round(u,4).tolist(); flows[str(year)] = year_flows
        coverage[str(year)] = list(range(1,13)); balances[str(year)] = dict(balance)
        print(f'{year}: 168 matrices completas; semana representativa {balance["input"]:,.1f}.',flush=True)
        del rows
    for edge,flow in zip(links,guide_flow): edge['reference_flow'] = round(float(flow),3)
    metadata = {'source':'MTA OD estimates 2021–2024; all 48 validated monthly partitions.',
        'years':[2021,2022,2023,2024], 'route_model':'gtfs-parent-stops-v1', 'months_present':coverage, 'network':net_meta,
        'method':'Calendar-weighted mean for each weekday/hour, denominator includes every occurrence in all twelve months. Static GTFS minimum modeled cost; rail distance and declared transfer cost.',
        'sparse_assumption':'An absent OD cell inside a complete published month contributes zero. Missing months are rejected.',
        'balance_weekly_trips':balances,'unreachable_pairs':len(unreachable),
        'raeb':{'network':'raeb/network.json.gz','frames':'raeb/{year}/{day}-{hour}.f32.gz','dtype':'little-endian Float32, dense origin-major square matrix; includes self OD without a rendered route','samples_per_trail':32},
        'gtfs_sha256':sha(archive),'validation_sha256':sha(report_path),'source_files':source_files,
        'built_at_utc':datetime.now(timezone.utc).isoformat()}
    data = {'meta':metadata,'nodes':[{k:s[k] for k in ['id','name','lat','lon','borough']} for s in stations],
            'links':links,'starts':starts,'incoming':incoming,'through':through,'flows':flows,'origins':{},'manhattanShare':{}}
    write_json(P/'atlas/data/flows.json',data)
    write_json(out/'manifest.json',{'status':'PASS','frames':len(assets),'assets':assets,'network_sha256':sha(out/'network.json.gz'),'flows_sha256':sha(P/'atlas/data/flows.json'),'metadata':metadata})
    root = P.parents[1]/'atlas/data'
    for f in [P/'atlas/data/flows.json',*out.rglob('*')]:
        if not f.is_file():continue
        dest = root/f.relative_to(P/'atlas/data');dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.exists():dest.unlink()
        os.link(f,dest)
    print('PASS: OD anual completo y red GTFS preparados; copias raíz/Semana 12 sincronizadas.',flush=True)


if __name__=='__main__':main()
