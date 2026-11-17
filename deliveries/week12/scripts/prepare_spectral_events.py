#!/usr/bin/env python3
"""Prepare subway entry episodes using spectral graph wavelets and a local weekly reference."""
import argparse
import calendar
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import duckdb
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components

YEARS = tuple(range(2021, 2026))
START = datetime(YEARS[0], 1, 1)
STOP = datetime(YEARS[-1] + 1, 1, 1)
HOURS = int((STOP - START).total_seconds() / 3600)
ORDER = 30
WEEK = 7 * 24
REFERENCE_WEEKS = 4
MIN_PEERS = 4
MONTH_LIMIT = 6
PEAK_QUANTILE = 0.80


def hour_string(hour):
    return (START + timedelta(hours=int(hour))).isoformat(timespec="hours")


def contents_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def spatial_graph(network):
    indices = {str(node["id"]): i for i, node in enumerate(network["nodes"])}
    edges = set()
    for edge in network["service_edges"] + network["declared_transfer_edges"]:
        a, b = (indices[str(edge[key])] for key in ("source", "target"))
        if a != b:
            edges.update(((a, b), (b, a)))
    rows, cols = zip(*sorted(edges))
    matrix = csr_matrix((np.ones(len(rows), dtype=np.float32), (rows, cols)),
                        shape=(len(indices), len(indices)))
    return indices, matrix


def load_entries(parquets, indices):
    observations = np.full((len(indices), HOURS), np.nan, dtype=np.float32)
    with duckdb.connect() as connection:
        for year in YEARS:
            paths = sorted(parquets.glob(f"{year}-??.parquet"))
            if len(paths) != 12:
                raise ValueError(f"{year}: se requieren los doce Parquet locales")
            rows = connection.execute("""
                SELECT station_complex_id,
                       date_diff('hour', ?::TIMESTAMP, transit_timestamp) AS hour,
                       sum(ridership) AS entries
                FROM read_parquet(?)
                WHERE lower(transit_mode) = 'subway'
                  AND transit_timestamp >= ? AND transit_timestamp < ?
                  AND ridership IS NOT NULL
                GROUP BY 1, 2
            """, [START, [str(path) for path in paths], datetime(year, 1, 1), datetime(year+1, 1, 1)])
            while batch := rows.fetchmany(100_000):
                matched = [(indices[str(station)], hour, count) for station, hour, count in batch
                           if str(station) in indices and count >= 0]
                if matched:
                    index, hour, count = zip(*matched)
                    observations[index, hour] = count
            print(f"{year}: entradas por complejo y hora agregadas", flush=True)
    return observations


def weekly_reference(observations):
    typical = np.full_like(observations, np.nan)
    offsets = np.array([week * WEEK for week in range(-REFERENCE_WEEKS, REFERENCE_WEEKS + 1) if week])
    for begin in range(0, observations.shape[1], WEEK):
        end = min(begin + WEEK, observations.shape[1])
        hours = np.arange(begin, end)[None, :] + offsets[:, None]
        inside = (hours >= 0) & (hours < observations.shape[1])
        peers = observations[:, np.clip(hours, 0, observations.shape[1] - 1)]
        peers[:, ~inside] = np.nan
        count = np.isfinite(peers).sum(axis=1)
        enough = count >= MIN_PEERS
        # A dummy reference suppresses all-NaN reductions before the mask is restored.
        peers[:, 0, :] = np.where(enough, peers[:, 0, :], 0)
        typical[:, begin:end] = np.where(enough, np.nanmedian(peers, axis=1), np.nan)
    return typical


def hammond_kernel(x):
    return np.piecewise(x, [x < 1, x > 2],
                        [lambda x: x**2, lambda x: (2 / x)**2,
                         lambda x: ((x - 6) * x + 11) * x - 5])


def coefficients(adjacency, signal, year_ranges):
    # Strong product of the spatial graph and a path over consecutive hours.
    degree = np.asarray(adjacency.sum(axis=1))
    spectral_bound = float(2 * (degree * 3 + 2).max())
    scales = np.geomspace(40 / spectral_bound, 1 / spectral_bound, 4)
    weights = np.stack([np.polynomial.chebyshev.chebinterpolate(
        lambda x: hammond_kernel(scale * spectral_bound * (x + 1) / 2), ORDER)
        for scale in scales]).astype(np.float32)
    bands = np.empty((len(scales),) + signal.shape, dtype=np.float32)

    def laplacian_on(values, product_degree):
        adjacent = adjacency @ values
        across_time = values + adjacent
        result = product_degree * values - adjacent
        result[:, 1:] -= across_time[:, :-1]
        result[:, :-1] -= across_time[:, 1:]
        return (2 / spectral_bound) * result - values

    for year, begin, end in year_ranges:
        start = max(0, begin - ORDER)
        stop = min(signal.shape[1], end + ORDER)
        core = slice(begin - start, end - start)
        prev = np.ascontiguousarray(signal[:, start:stop])
        time_degree = np.full(prev.shape[1], 2, dtype=np.float32)
        time_degree[[0, -1]] = 1
        product_degree = degree + (degree + 1) * time_degree
        current = laplacian_on(prev, product_degree)
        output = bands[:, :, begin:end]
        output[:] = weights[:, 0, None, None] * prev[:, core]
        output += weights[:, 1, None, None] * current[:, core]
        for term in range(2, ORDER + 1):
            nxt = 2 * laplacian_on(current, product_degree) - prev
            output += weights[:, term, None, None] * nxt[:, core]
            prev, current = current, nxt
        print(f"{year}: cuatro bandas espectrales calculadas", flush=True)
    return bands, scales, spectral_bound


def extract_episodes(score, eligible, adjacency, cutoff):
    episodes, previous = [], []
    for hour in np.flatnonzero((eligible & (score >= cutoff)).sum(axis=0) >= 3):
        active = np.flatnonzero(eligible[:, hour] & (score[:, hour] >= cutoff))
        count, groups = connected_components(adjacency[active][:, active], directed=False)
        current = []
        for group in range(count):
            stations = active[groups == group]
            if len(stations) < 3:
                continue
            membership = set(map(int, stations))
            joins = {index for last_hour, members, index in previous if hour == last_hour + 1
                     and len(membership & members) >= 2}
            if joins:
                idx = min(joins)
                for merged in joins - {idx}:
                    episodes[idx].extend(episodes[merged])
                    episodes[merged] = []
                    current = [(t, s, idx if i == merged else i) for t, s, i in current]
                    previous = [(t, s, idx if i == merged else i) for t, s, i in previous]
            else:
                idx = len(episodes)
                episodes.append([])
            episodes[idx].append((int(hour), membership))
            current.append((hour, membership, idx))
        previous = current
    return [episode for episode in episodes if episode]


def monthly_selection(episodes, score):
    ranked = defaultdict(list)
    for episode in episodes:
        peak, strength = max(
            ((hour, float(np.mean(score[sorted(members), hour]))) for hour, members in episode),
            key=lambda point: point[1])
        # One group can split and rejoin. Count each complex/hour combination once.
        members_by_hour = defaultdict(set)
        for hour, members in episode:
            members_by_hour[hour].update(members)
        if len(members_by_hour) < 2:
            continue
        ranked[hour_string(peak)[:7]].append((strength, peak, sorted(members_by_hour.items())))
    return {month: sorted(events, key=lambda event: (-event[0], event[1]))[:MONTH_LIMIT]
            for month, events in sorted(ranked.items())}


def round_samples(values):
    return [round(float(value), 1) if np.isfinite(value) else None for value in values]


def episode_record(episode_id, event, observations, typical, score, ids):
    strength, peak, membership = event
    start, end = membership[0][0], membership[-1][0] + 1
    visible_start, visible_end = max(0, start-8), min(HOURS, end+8)
    members = sorted(set().union(*(group for _, group in membership)))
    visible = slice(visible_start, visible_end)
    observed, expected = observations[members, visible], typical[members, visible]
    valid = np.isfinite(observed) & np.isfinite(expected)
    observed = np.where(valid, observed, np.nan)
    expected = np.where(valid, expected, np.nan)
    group_observed = np.where(valid.any(axis=0), np.nansum(observed, axis=0), np.nan)
    group_expected = np.where(valid.any(axis=0), np.nansum(expected, axis=0), np.nan)
    times_by_member = defaultdict(list)
    for hour, group in membership:
        for member in group:
            times_by_member[member].append(hour)
    stations = []
    for row, station in enumerate(members):
        active_hours = sorted(times_by_member[station])
        paired_hours = [hour for hour in active_hours if np.isfinite(typical[station, hour])]
        count = round(float(observations[station, paired_hours].sum()), 1) if paired_hours else None
        baseline = round(float(typical[station, paired_hours].sum()), 1) if paired_hours else None
        stations.append({
            "id": ids[station], "entries": count, "expected": baseline,
            "score": round(float(score[station, active_hours].max()), 4),
            "observed": round_samples(observed[row]), "typical": round_samples(expected[row]),
        })
    summary = {"id": episode_id, "start": hour_string(start), "end": hour_string(end),
               "peak": hour_string(peak), "hours": end-start,
               "strength": round(strength, 4), "complexes": len(members)}
    detail = {"start": visible_start, "window": [start-visible_start, end-visible_start],
              "stations": stations, "observed": round_samples(group_observed),
              "typical": round_samples(group_expected)}
    return summary, detail



def compare_detectors(spectral, baseline, ids):
    # Documented cases and matched weekday/time windows from the same months.
    windows = [
        ("Ophelia", "2023-09-29T06", "2023-09-30T03"),
        ("Ida", "2021-09-01T21", "2021-09-02T11"),
    ]
    windows += [
        ("Viernes de contraste", f"2023-09-{day:02d}T06", f"2023-09-{day+1:02d}T03")
        for day in (1, 8, 15, 22)
    ]
    windows += [
        ("Miércoles de contraste", f"2021-09-{day:02d}T21", f"2021-09-{day+1:02d}T11")
        for day in (8, 15, 22, 29)
    ]
    report = []
    for label, start, end in windows:
        entry = {"window": label, "start": start, "end": end}
        for name, catalog in (("spectral", spectral), ("baseline", baseline)):
            intersecting = []
            affected = set()
            hours = set()
            for month in catalog.values():
                for _, peak, membership in month:
                    overlap = [(hour, members) for hour, members in membership
                               if start <= hour_string(hour) < end]
                    if overlap:
                        intersecting.append(hour_string(peak))
                        for hour, members in overlap:
                            hours.add(hour)
                            affected.update(ids[member] for member in members)
            entry[name] = {"episodes": len(intersecting), "hours": len(hours), "complexes": len(affected),
                           "peaks": sorted(intersecting)}
        report.append(entry)
    return report


def write_json(path, value):
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n")


def peak_quantile(values, observed):
    maxima = np.max(values, axis=1, where=observed, initial=-np.inf)
    return float(np.quantile(maxima[np.isfinite(maxima)], PEAK_QUANTILE))


def prepare(parquets, network_path, output):
    network = json.loads(network_path.read_text())
    indices, adjacency = spatial_graph(network)
    observations = load_entries(parquets, indices)
    typical = weekly_reference(observations)
    observed = np.isfinite(observations)
    comparable = observed & np.isfinite(typical)
    # Stabilize the contrast before the transform so busy stations do not
    # dominate solely because they record more entries.
    contrast = 2 * (np.sqrt(observations + 0.375) - np.sqrt(typical + 0.375))
    signal = np.where(comparable, contrast, 0)
    ranges, begin = [], 0
    for year in YEARS:
        end = begin + 24 * (365 + calendar.isleap(year))
        ranges.append((year, begin, end))
        begin = end
    bands, scales, spectral_bound = coefficients(adjacency, signal, ranges)
    score = np.abs(bands[-1])
    del bands, contrast, signal
    q25, q75 = np.quantile(score[comparable], (0.25, 0.75))
    score /= q75 - q25 or 1.0
    np.log1p(score, out=score)
    score /= score[comparable].max() or 1.0
    cutoff = peak_quantile(score, comparable)
    chosen = monthly_selection(extract_episodes(score, comparable, adjacency, cutoff), score)
    output.mkdir(parents=True, exist_ok=True)
    by_month = {}
    for month, events in chosen.items():
        by_month[month] = []
        month_details = {}
        for i, event in enumerate(events, start=1):
            episode_id = f"{month}-d-{i}"
            summary, detail = episode_record(episode_id, event, observations, typical, score, list(indices))
            by_month[month].append(summary)
            month_details[episode_id] = detail
        write_json(output / f"{month}.json", month_details)
    source_files = sorted(path for year in YEARS for path in parquets.glob(f"{year}-??.parquet"))
    meta = {"years": YEARS, "complexes": len(indices), "hour_slots": HOURS, "origin": hour_string(0),
            "observed_hours": int(observed.sum()), "valid_hours": int(comparable.sum()),
            "links": adjacency.nnz // 2, "graph_sha256": contents_hash(network_path),
            "cutoff": cutoff, "quantile": PEAK_QUANTILE, "scales": scales.tolist(),
            "cutoff_scope": "maximum_comparable_score_per_complex",
            "signal": "square_root_contrast_with_weekly_reference",
            "normalization": "absolute_iqr_log1p_global_maximum",
            "spectral_bound": spectral_bound, "chebyshev_order": ORDER,
            "source_sha256": {path.name: contents_hash(path) for path in source_files},
            "sources": ["https://data.ny.gov/d/wujg-7c2s", "https://data.ny.gov/d/5wq4-mkjj"]}
    write_json(output / "index.json", {"meta": meta, "months": by_month})
    print(f"{sum(map(len, by_month.values()))} episodios en {len(by_month)} meses · umbral {cutoff:.3f}", flush=True)
    baseline = np.abs(observations - typical)
    baseline_cutoff = peak_quantile(baseline, comparable)
    baseline_events = monthly_selection(extract_episodes(baseline, comparable, adjacency, baseline_cutoff), baseline)
    comparison = compare_detectors(chosen, baseline_events, list(indices))
    write_json(output / "comparison.json", {
        "baseline_cutoff": baseline_cutoff, "spectral_cutoff": cutoff, "windows": comparison
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parents[3]
    parser.add_argument("--parquets", type=Path, default=root / "deliveries/week12/data/raw/full_period/parquet")
    parser.add_argument("--network", type=Path, default=root / "atlas/data/network_current.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    prepare(args.parquets, args.network, args.output)
