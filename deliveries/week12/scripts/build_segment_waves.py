#!/usr/bin/env python3
"""Wavelets de grafo por tramo (estación a estación), siguiendo ManyWaves (Valdrighi et al., CGF 2026).

Entrada : atlas/data/flows.json  (cargas dirigidas por tramo, año, día y hora; no se modifica)
Salida  : atlas/data/segment_waves.json (+ copia en deliveries/week12/atlas/data/)

Método (secciones del artículo entre paréntesis):
  1. Ubicación = tramo de la red de referencia. Dos tramos son vecinos si comparten estación.
  2. Grafo espacio-temporal (4.1): una copia del grafo por cada una de las 168 horas de la semana
     representativa; cada nodo se une a sí mismo y a sus vecinos en la hora anterior y siguiente.
     La semana es cíclica (domingo 23 h -> lunes 0 h), porque es una semana promedio, no una fecha.
  3. Transformada wavelet de grafo (4.2) por variable y año, con el kernel spline cúbico de Hammond
     et al. y 4 escalas logarítmicas. Se calcula de forma exacta: el tiempo cíclico se diagonaliza
     con una DFT y queda un problema propio de n×n por frecuencia temporal.
  4. Normalización (5.2): valor absoluto, división por el rango intercuartílico de cada variable y
     escala, log(1+w) y división por el máximo. Se normaliza con los cuatro años juntos para que
     los años sean comparables.
  5. Wavelet Encoding (5.3): la secuencia de coeficientes de alta frecuencia de cada tramo se
     proyecta con AlignedUMAP (una proyección por año, alineadas entre sí; métrica coseno).
     El artículo usa un autoencoder convolucional y t-SNE; esto es una simplificación declarada.

Variables por tramo: carga en el sentido dominante de la punta de la mañana (lun-vie, 6-10 h,
suma de los cuatro años) y carga en el sentido contrario.
"""
import argparse
import base64
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
T = 168
SCALES = 4
LPFACTOR = 20          # lmin = lmax / 20, como Hammond et al. y PyGSP
EPSILON = 1e-3         # respuestas casi nulas que el Heatmap of Changes descarta (6.1)
VARIABLES = [
    {'key': 'am', 'label': 'Sentido de la mañana',
     'detail': 'Sentido con más carga de lunes a viernes entre 6 y 10 h (suma 2021–2024).'},
    {'key': 'rev', 'label': 'Sentido contrario', 'detail': 'El otro sentido del mismo tramo.'},
]


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def spatial_adjacency(links):
    """Tramos vecinos = comparten una estación. Matriz 0/1 simétrica sin diagonal."""
    n = len(links)
    at = {}
    for i, link in enumerate(links):
        for station in (link['a'], link['b']):
            at.setdefault(station, []).append(i)
    A = np.zeros((n, n))
    for members in at.values():
        for i in members:
            for j in members:
                if i != j:
                    A[i, j] = 1.0
    return A


def temporal_blocks(A):
    """Diagonaliza el Laplaciano del grafo espacio-temporal cíclico.

    Con C = desplazamiento cíclico + su transpuesta (T×T), la adyacencia es
    A_st = I⊗A + C⊗I + C⊗A y el grado de cada nodo es 3·d_i + 2. La DFT en el tiempo
    diagonaliza C (valores 2cos θ_k), de modo que L se separa en T bloques reales simétricos
    L_k = diag(3d+2) − A − 2cos θ_k (I + A).
    """
    n = len(A)
    degree = A.sum(1)
    blocks = []
    for k in range(T // 2 + 1):
        c = 2 * np.cos(2 * np.pi * k / T)
        L = np.diag(3 * degree + 2) - A - c * (np.eye(n) + A)
        blocks.append(np.linalg.eigh(L))
    return blocks


def kernel(x):
    """Kernel spline cúbico de Hammond et al. (ec. 69), el que usa el artículo."""
    x = np.asarray(x, dtype=float)
    out = np.empty_like(x)
    low, high = x < 1, x > 2
    mid = ~(low | high)
    out[low] = x[low] ** 2
    out[mid] = -5 + 11 * x[mid] - 6 * x[mid] ** 2 + x[mid] ** 3
    out[high] = 4 / x[high] ** 2
    return out


def log_scales(lmax):
    """Escalas logarítmicas de mayor a menor (la última es la de más alta frecuencia)."""
    lmin = lmax / LPFACTOR
    return np.exp(np.linspace(np.log(2 / lmin), np.log(1 / lmax), SCALES))


def gwt(signal, blocks, scales):
    """Coeficientes wavelet exactos. signal: (n, T). Devuelve (SCALES, n, T)."""
    spectrum = np.fft.rfft(signal, axis=1)            # (n, T/2+1)
    out = np.empty((len(scales), spectrum.shape[0], spectrum.shape[1]), dtype=complex)
    for k, (values, vectors) in enumerate(blocks):
        projected = vectors.T @ spectrum[:, k]
        for s, scale in enumerate(scales):
            out[s, :, k] = vectors @ (kernel(scale * values) * projected)
    return np.fft.irfft(out, n=T, axis=2)


def build(flows_path, transform='raw'):
    flows = json.loads(flows_path.read_text())
    links, years = flows['links'], [str(y) for y in flows['meta']['years']]
    n = len(links)
    # loads[y]: (T, 2n) -> forward[i,t] = arco a→b, backward[i,t] = arco b→a
    raw = {y: np.array([flows['flows'][y][d][h] for d in range(7) for h in range(24)], dtype=float) for y in years}
    forward = {y: raw[y][:, 0::2].T for y in years}
    backward = {y: raw[y][:, 1::2].T for y in years}
    # Sentido de la mañana: el arco con más carga lun–vie 6–10 h, sumando los cuatro años.
    morning = [d * 24 + h for d in range(5) for h in range(6, 10)]
    f_am = sum(forward[y][:, morning].sum(1) for y in years)
    b_am = sum(backward[y][:, morning].sum(1) for y in years)
    flipped = b_am > f_am                             # True: el sentido de la mañana es b→a
    load = {y: {'am': np.where(flipped[:, None], backward[y], forward[y]),
                'rev': np.where(flipped[:, None], forward[y], backward[y])} for y in years}

    A = spatial_adjacency(links)
    blocks = temporal_blocks(A)
    lmax = max(values[-1] for values, _ in blocks)
    scales = log_scales(lmax)
    # El artículo aplica la GWT a la variable original. 'sqrt' y 'log' quedan solo para comparar:
    # con ellas el coeficiente de alta frecuencia casi no varía en el tiempo (85 % y 96 % de su
    # varianza la explica el promedio del tramo, frente a 70 % con la carga original).
    shape = {'log': np.log1p, 'sqrt': np.sqrt, 'raw': lambda x: x}[transform]
    coefficient = {y: {v['key']: gwt(shape(load[y][v['key']]), blocks, scales) for v in VARIABLES} for y in years}

    # Normalización 5.2, con los cuatro años juntos por variable y escala.
    normalized = {y: {} for y in years}
    iqr_table = {}
    for v in VARIABLES:
        key = v['key']
        stacked = np.abs(np.stack([coefficient[y][key] for y in years]))   # (Y, S, n, T)
        iqr_table[key] = []
        for s in range(SCALES):
            q1, q3 = np.percentile(stacked[:, s], [25, 75])
            iqr = float(q3 - q1) or 1.0
            iqr_table[key].append(iqr)
            logged = np.log1p(stacked[:, s] / iqr)
            logged /= logged.max()
            for yi, y in enumerate(years):
                normalized[y].setdefault(key, np.empty((SCALES, n, T)))[s] = logged[yi]

    return dict(flows=flows, links=links, years=years, n=n, load=load, flipped=flipped, A=A, blocks=blocks,
                lmax=float(lmax), scales=scales, coefficient=coefficient, normalized=normalized, iqr=iqr_table)


def heatmap_of_changes(normalized):
    """Promedio por hora de los coeficientes normalizados, sin las respuestas casi nulas (6.1)."""
    out = np.zeros(normalized.shape[::2])             # (SCALES, T)
    for s in range(normalized.shape[0]):
        values = normalized[s]
        mask = values >= EPSILON
        out[s] = np.where(mask.any(0), (values * mask).sum(0) / np.maximum(mask.sum(0), 1), 0)
    return out


def encode(result, neighbors=15, seed=42):
    """AlignedUMAP: una proyección por año, con el mismo tramo anclado entre años consecutivos.

    Entrada por tramo y año: sus 168 coeficientes de alta frecuencia de cada variable (336 valores).
    Métrica coseno: dos tramos quedan cerca si cambian a las mismas horas y en el mismo sentido,
    aunque uno cargue mucho más que el otro. Con distancia euclídea la proyección se reduce a un
    arco ordenado por magnitud, que ya se ve en el mapa.
    """
    import warnings
    import umap
    years, n = result['years'], result['n']
    high = SCALES - 1
    features = [np.hstack([result['normalized'][y][v['key']][high] for v in VARIABLES]) for y in years]
    identity = {i: i for i in range(n)}
    mapper = umap.AlignedUMAP(metric='cosine', n_neighbors=neighbors, min_dist=0.15, alignment_regularisation=1e-2,
                              alignment_window_size=2, random_state=seed, n_epochs=400)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        mapper.fit(features, relations=[identity] * (len(years) - 1))
    embeddings = np.stack([np.asarray(e) for e in mapper.embeddings_])
    low, high_ = embeddings.min((0, 1)), embeddings.max((0, 1))
    return (embeddings - low) / (high_ - low)         # 0..1 con una sola escala para los cuatro años


def pack(values):
    """Float 0..1 -> uint8 en base64 (tramo por filas, hora por columnas)."""
    return base64.b64encode(np.clip(np.rint(values * 255), 0, 255).astype(np.uint8).tobytes()).decode()


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--flows', type=Path, default=ROOT / 'atlas/data/flows.json')
    parser.add_argument('--out', type=Path, nargs='*', default=[ROOT / 'atlas/data/segment_waves.json',
                                                                 ROOT / 'deliveries/week12/atlas/data/segment_waves.json'])
    args = parser.parse_args()
    result = build(args.flows)
    years, high = result['years'], SCALES - 1
    embeddings = encode(result)
    payload = {
        'meta': {
            'source': 'atlas/data/flows.json', 'source_sha256': sha256(args.flows),
            'method': 'Graph Wavelet Transform por tramo y variable sobre un grafo espacio-temporal cíclico de 168 horas '
                      '(ManyWaves, Valdrighi et al., CGF 2026). Kernel spline cúbico de Hammond et al., 4 escalas.',
            'deviations': ['Semana representativa cíclica en vez de fechas consecutivas.',
                           'Normalización con |w| / IQR (sin restar la mediana) y con los cuatro años juntos.',
                           'AlignedUMAP (coseno) sobre los coeficientes, en lugar de autoencoder convolucional + t-SNE.'],
            'years': [int(y) for y in years], 'segments': result['n'], 'timestamps': T,
            'variables': VARIABLES, 'scales': [float(s) for s in result['scales']], 'lmax': result['lmax'],
            'iqr': result['iqr'], 'epsilon': EPSILON,
            'encoding': {'umap': 'AlignedUMAP', 'metric': 'cosine', 'n_neighbors': 15, 'min_dist': 0.15,
                         'alignment_regularisation': 1e-2, 'alignment_window_size': 2, 'n_epochs': 400, 'seed': 42},
            'quantization': 'coef: uint8 = round(255 × coeficiente normalizado de alta frecuencia), tramo × hora',
            'built_at_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        },
        'flipped': [int(x) for x in result['flipped']],
        'coef': {y: {v['key']: pack(result['normalized'][y][v['key']][high]) for v in VARIABLES} for y in years},
        'heat': {y: {v['key']: np.round(heatmap_of_changes(result['normalized'][y][v['key']]), 4).tolist()
                     for v in VARIABLES} for y in years},
        'embed': {y: np.round(embeddings[i], 4).tolist() for i, y in enumerate(years)},
        'corr': {y: float(np.corrcoef(result['load'][y]['am'].ravel(), result['load'][y]['rev'].ravel())[0, 1]) for y in years},
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    for path in args.out:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(raw)
        print(f'{path}  {len(raw) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
