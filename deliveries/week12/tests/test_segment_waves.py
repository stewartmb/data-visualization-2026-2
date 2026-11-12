#!/usr/bin/env python3
"""Comprueba el cálculo de wavelets por tramo contra definiciones independientes."""
import base64
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from scipy import sparse

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'deliveries/week12/scripts'))
import build_segment_waves as B  # noqa: E402

T = B.T


def explicit_laplacian(A):
    """Laplaciano del grafo espacio-temporal escrito arista por arista, sin DFT."""
    n = len(A)
    rows, cols = [], []
    node = lambda i, t: (t % T) * n + i
    for t in range(T):
        for i in range(n):
            for step in (-1, 1):                       # mismo tramo, hora anterior y siguiente
                rows.append(node(i, t)); cols.append(node(i, t + step))
            for j in np.flatnonzero(A[i]):
                for step in (-1, 0, 1):                # vecinos en la misma hora y en las adyacentes
                    rows.append(node(i, t)); cols.append(node(j, t + step))
    adjacency = sparse.csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(n * T, n * T))
    assert (adjacency != adjacency.T).nnz == 0 and adjacency.max() == 1
    return sparse.diags(np.asarray(adjacency.sum(1)).ravel()) - adjacency


# 1. Kernel del artículo: continuo en 1 y 2, máximo ≈ 1,39.
assert abs(B.kernel([1])[0] - 1) < 1e-12 and abs(B.kernel([2])[0] - 1) < 1e-12
assert abs(B.kernel(np.linspace(0, 5, 5001)).max() - 1.3849) < 1e-3

# 2. Grafo pequeño al azar: las cuatro escalas coinciden con la descomposición propia densa.
rng = np.random.default_rng(7)
small = np.triu((rng.random((6, 6)) < .5).astype(float), 1)
small = small + small.T
small[0, 1] = small[1, 0] = 1
blocks = B.temporal_blocks(small)
lmax = max(values[-1] for values, _ in blocks)
scales = B.log_scales(lmax)
signal = rng.random((6, T)) * 100
fast = B.gwt(signal, blocks, scales)
L = explicit_laplacian(small).toarray()
values, vectors = np.linalg.eigh(L)
assert abs(values[-1] - lmax) < 1e-8, 'lmax'
flat = signal.T.ravel()                               # índice = t·n + i
for s, scale in enumerate(scales):
    dense = (vectors @ (B.kernel(scale * values) * (vectors.T @ flat))).reshape(T, 6).T
    assert np.abs(dense - fast[s]).max() < 1e-8, f'escala {s}'
assert abs(scales[0] / scales[-1] - 2 * B.LPFACTOR) < 1e-9

# 3. Red real: la banda de alta frecuencia es exactamente L²f / lmax² (el kernel vale x² para x < 1).
result = B.build(ROOT / 'atlas/data/flows.json')
n = result['n']
L = explicit_laplacian(result['A'])
flat = result['load']['2024']['am'].T.ravel()
expected = (L @ (L @ flat) / result['lmax'] ** 2).reshape(T, n).T
got = result['coefficient']['2024']['am'][B.SCALES - 1]
assert np.abs(expected - got).max() < 1e-6 * np.abs(expected).max(), 'alta frecuencia'

# 4. Sentido de la mañana, conservación de carga y normalización.
morning = [d * 24 + h for d in range(5) for h in range(6, 10)]
am = sum(result['load'][y]['am'][:, morning].sum(1) for y in result['years'])
rev = sum(result['load'][y]['rev'][:, morning].sum(1) for y in result['years'])
assert (am >= rev).all()
flows = result['flows']
for y in result['years']:
    total = np.array([flows['flows'][y][d][h] for d in range(7) for h in range(24)]).sum()
    assert abs(result['load'][y]['am'].sum() + result['load'][y]['rev'].sum() - total) < 1e-6 * total
    for v in B.VARIABLES:
        x = result['normalized'][y][v['key']]
        assert x.min() >= 0 and x.max() <= 1 + 1e-12

# 5. El archivo publicado corresponde a estos datos y a este cálculo.
for path in (ROOT / 'atlas/data/segment_waves.json', ROOT / 'deliveries/week12/atlas/data/segment_waves.json'):
    data = json.loads(path.read_text())
    assert data['meta']['source_sha256'] == hashlib.sha256((ROOT / 'atlas/data/flows.json').read_bytes()).hexdigest()
    assert data['flipped'] == [int(x) for x in result['flipped']]
    for y in result['years']:
        for v in B.VARIABLES:
            stored = np.frombuffer(base64.b64decode(data['coef'][y][v['key']]), dtype=np.uint8).reshape(n, T) / 255
            assert np.abs(stored - result['normalized'][y][v['key']][B.SCALES - 1]).max() <= .5 / 255 + 1e-9
            assert np.abs(np.array(data['heat'][y][v['key']]) - B.heatmap_of_changes(result['normalized'][y][v['key']])).max() < 1e-4
        embed = np.array(data['embed'][y])
        assert embed.shape == (n, 2) and embed.min() >= 0 and embed.max() <= 1

print(f'PASS: kernel, GWT exacta en 4 escalas (grafo de prueba), alta frecuencia = L²f/λmax² en la red real '
      f'({n} tramos × {T} horas), sentido de la mañana, conservación de carga, normalización 0–1 y archivo publicado.')
