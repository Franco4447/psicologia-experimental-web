"""Reference values from scipy / statsmodels for tests/inferential.test.ts.

Regenerate (made with scipy 1.18.1, statsmodels 0.15.0 and scikit-posthocs 0.17.1):
    python tests/fixtures/inferential_reference.py > tests/fixtures/inferential_reference.json
"""
import json
import numpy as np
from scipy import stats
from statsmodels.stats.oneway import anova_oneway
from statsmodels.stats.multicomp import pairwise_tukeyhsd
import scikit_posthocs as sp

# Datasets shared with the TypeScript test (keep in sync).
SW_SAMPLES = {
    "n3": [1.0, 2.0, 4.0],
    "n4": [2.1, 3.4, 1.9, 5.6],
    "n5": [10, 12, 9, 15, 30],
    "n7": [3, 3, 4, 5, 5, 6, 9],
    "n11": [0, 1, 1, 2, 2, 2, 3, 3, 4, 5, 8],
    "n12": [2.3, 4.1, 3.3, 5.0, 2.8, 3.9, 4.4, 3.1, 2.2, 6.7, 3.6, 4.0],
    "n30_counts": [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 0, 1, 2, 3, 0, 1, 7, 8],
    "n25_rt": [2.31, 3.05, 2.87, 4.12, 3.33, 2.95, 3.78, 2.64, 3.10, 5.21, 2.99, 3.45, 3.02,
               2.71, 3.88, 4.45, 2.58, 3.21, 3.67, 2.93, 3.14, 6.02, 2.80, 3.36, 3.09],
}

# Three-group designs: (racional, emocional, control)
DESIGNS = {
    "counts": [
        [0, 1, 1, 2, 2, 3, 0, 1, 4, 2, 1, 0, 3, 2, 1],
        [2, 3, 4, 4, 5, 3, 2, 6, 4, 3, 5, 7, 2, 4],
        [1, 2, 0, 2, 3, 1, 2, 4, 1, 0, 2, 3, 1],
    ],
    "normal_equal_var": [
        [5.1, 4.8, 6.2, 5.5, 4.9, 5.7, 6.0, 5.3, 4.6, 5.9, 5.2, 5.4],
        [6.3, 5.9, 7.1, 6.6, 6.0, 6.8, 7.4, 6.2, 5.8, 6.9, 6.5],
        [5.0, 5.6, 4.7, 5.8, 5.2, 4.9, 6.1, 5.4, 5.1, 5.5, 4.8, 5.3, 5.7],
    ],
    "normal_unequal_var": [
        [5.0, 5.2, 4.9, 5.1, 5.3, 4.8, 5.0, 5.2, 4.9, 5.1],
        [3.0, 8.0, 5.5, 9.5, 2.0, 7.0, 4.5, 10.0, 6.0, 1.5, 8.5, 6.5],
        [5.6, 6.4, 5.1, 6.9, 5.8, 6.2, 4.9, 7.1, 6.0, 5.5, 6.6],
    ],
    "skewed": [
        [0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 8, 0],
        [3, 4, 2, 5, 3, 4, 3, 6, 2, 4, 5],
        [1, 0, 2, 1, 0, 1, 3, 0, 1, 2, 1, 0, 1],
    ],
}

out = {"shapiro": {}, "designs": {}, "dist": {}}
for name, x in SW_SAMPLES.items():
    r = stats.shapiro(x)
    out["shapiro"][name] = {"w": float(r.statistic), "p": float(r.pvalue)}

for name, groups in DESIGNS.items():
    g = [np.array(v, dtype=float) for v in groups]
    labels = np.concatenate([[i] * len(v) for i, v in enumerate(g)])
    values = np.concatenate(g)
    f = stats.f_oneway(*g)
    lev = stats.levene(*g, center="median")
    welch = anova_oneway(g, use_var="unequal", welch_correction=True)
    kw = stats.kruskal(*g)
    tukey = pairwise_tukeyhsd(values, labels)
    # statsmodels orders pairs (0,1), (0,2), (1,2); meandiff = mean(j) - mean(i)
    tk = {f"{a}-{b}": float(p) for (a, b), p in zip([(0, 1), (0, 2), (1, 2)], tukey.pvalues)}
    # Games-Howell from its definition, with scipy's studentized range
    gh = {}
    for a, b in [(0, 1), (0, 2), (1, 2)]:
        va, vb = g[a].var(ddof=1) / len(g[a]), g[b].var(ddof=1) / len(g[b])
        q = abs(g[a].mean() - g[b].mean()) / np.sqrt((va + vb) / 2)
        df = (va + vb) ** 2 / (va ** 2 / (len(g[a]) - 1) + vb ** 2 / (len(g[b]) - 1))
        gh[f"{a}-{b}"] = float(stats.studentized_range.sf(q, 3, df))
    out["designs"][name] = {
        "anova": {"f": float(f.statistic), "p": float(f.pvalue)},
        "levene": {"f": float(lev.statistic), "p": float(lev.pvalue)},
        "welch": {"f": float(welch.statistic), "df2": float(welch.df[1]), "p": float(welch.pvalue)},
        "kruskal": {"h": float(kw.statistic), "p": float(kw.pvalue)},
        "tukey": tk,
        "gamesHowell": gh,
        # Dunn with the tie correction, Holm over the three pairs
        "dunnHolm": {f"{a}-{b}": float(sp.posthoc_dunn(list(g), p_adjust="holm").iloc[a, b])
                     for a, b in [(0, 1), (0, 2), (1, 2)]},
        "shapiro": [float(stats.shapiro(v).pvalue) for v in g],
    }

out["dist"] = {
    "fSf": [[f, d1, d2, float(stats.f.sf(f, d1, d2))] for f, d1, d2 in
            [(0.5, 2, 30), (3.2, 2, 40), (12.7, 2, 75), (45.0, 2, 87), (2.1, 2, 18.37)]],
    "chi2Sf": [[x, k, float(stats.chi2.sf(x, k))] for x, k in [(0.3, 2), (5.99, 2), (18.4, 2), (40.0, 2), (3.0, 1)]],
    "normalSf": [[z, float(stats.norm.sf(z))] for z in [-2.0, 0.0, 1.0, 1.96, 3.5, 6.0]],
    "normalQuantile": [[p, float(stats.norm.ppf(p))] for p in [1e-10, 0.001, 0.025, 0.3, 0.5, 0.8, 0.975, 0.9999]],
    "tukeySf": [[q, k, df, float(stats.studentized_range.sf(q, k, df))] for q, k, df in
                [(1.0, 3, 20), (2.5, 3, 40), (3.5, 3, 72), (4.2, 3, 12), (0.4, 3, 87), (5.5, 3, 150), (3.0, 3, 19.6)]],
}
print(json.dumps(out, indent=1))
