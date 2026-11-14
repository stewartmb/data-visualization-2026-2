"""Build the NYC routing graph at GTFS parent-stop resolution."""
import heapq
from collections import defaultdict

import numpy as np


def stop_paths(stations, links, nodes):
    stops_by_complex = defaultdict(list)
    for stop, node in nodes.items():
        stops_by_complex[node['complex']].append(stop)
    stop_ids = list(nodes)
    index = {stop: i for i, stop in enumerate(stop_ids)}
    adj = [[] for _ in nodes]
    for i, link in enumerate(links):
        a, b = index[link['stop_a']], index[link['stop_b']]
        if link['allowed'][0]:
            adj[a].append((b, link['cost'][0] if isinstance(link['cost'], list) else link['cost'], 2*i))
        if link['allowed'][1]:
            adj[b].append((a, link['cost'][1] if isinstance(link['cost'], list) else link['cost'], 2*i+1))
    endpoints = [[index[stop] for stop in stops_by_complex[s['id']]] for s in stations]
    paths, unreachable = [], []
    for origin, sources in zip(stations, endpoints):
        distance = [float('inf')] * len(nodes)
        previous = [None] * len(nodes)
        queue = [(0, stop) for stop in sources]
        heapq.heapify(queue)
        for stop in sources:
            distance[stop] = 0
        while queue:
            cost, stop = heapq.heappop(queue)
            if cost != distance[stop]:
                continue
            for target, increment, arc in adj[stop]:
                next_cost = cost + increment
                if next_cost < distance[target]:
                    distance[target] = next_cost
                    previous[target] = stop, arc
                    heapq.heappush(queue, (next_cost, target))
        for destination, targets in zip(stations, endpoints):
            trail = []
            if origin['id'] != destination['id']:
                target = min(targets, key=distance.__getitem__, default=None)
                if target is None or not np.isfinite(distance[target]):
                    unreachable.append((origin['id'], destination['id']))
                else:
                    while previous[target] is not None:
                        target, arc = previous[target]
                        trail.append(arc)
            paths.append(trail[::-1])
    return paths, unreachable
