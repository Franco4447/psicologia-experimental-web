/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Inferential statistics for comparing the three independent induction groups.
 * Target location: src/lib/inferential.ts
 *
 * Decision flow (alpha = .05):
 *   1. Assumptions: Shapiro-Wilk in each group and Levene's test (median-centred,
 *      Brown-Forsythe) across groups.
 *   2. Every group normal and variances homogeneous -> one-way ANOVA + Tukey-Kramer.
 *      Every group normal, variances heterogeneous  -> Welch's ANOVA + Games-Howell.
 *      Some group not normal                          -> Kruskal-Wallis + Dunn (Holm).
 *
 * No dependencies: the distribution functions follow the classic algorithms
 * (Lanczos log-gamma, Numerical Recipes incomplete gamma/beta, Wichura AS 241
 * normal quantile, Royston 1995 Shapiro-Wilk as in R's swilk.c, and R's ptukey
 * for the studentized range). tests/inferential.test.ts checks them against
 * scipy and statsmodels.
 */

export const ALPHA = 0.05;

// ============================================================================
// 1. Special functions and distributions
// ============================================================================

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const FPMIN = 1e-300;
const EPS = 1e-15;

/** Regularized incomplete gamma by its series (good for x < a + 1). */
function gammaSeries(a: number, x: number): number {
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let n = 0; n < 10000; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

/** Regularized upper incomplete gamma by its continued fraction (x >= a + 1). */
function gammaContinuedFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Regularized upper incomplete gamma Q(a, x). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function betaI(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaContinuedFraction(x, a, b)) / a
    : 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Upper tail of the F distribution. */
export function fSf(f: number, df1: number, df2: number): number {
  if (!(f > 0)) return 1;
  return betaI(df2 / (df2 + df1 * f), df2 / 2, df1 / 2);
}

/** Upper tail of the chi-square distribution. */
export function chiSquareSf(x: number, df: number): number {
  return gammaQ(df / 2, x / 2);
}

/** Complementary error function. */
function erfc(x: number): number {
  return x >= 0 ? gammaQ(0.5, x * x) : 2 - gammaQ(0.5, x * x);
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Standard normal upper tail, accurate far into the tail. */
export function normalSf(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

/** Standard normal quantile (Wichura 1988, AS 241). */
export function normalQuantile(p: number): number {
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return (
      (q *
        (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r +
          45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r +
          133.14166789178437745) * r + 3.387132872796366608)) /
      (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r +
        21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r +
        42.313330701600911252) * r + 1)
    );
  }
  let r = Math.sqrt(-Math.log(q < 0 ? p : 1 - p));
  let value: number;
  if (r <= 5) {
    r -= 1.6;
    value =
      (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r +
        1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r +
        4.6303378461565452959) * r + 1.42343711074968357734) /
      (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r +
        0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r +
        2.05319162663775882187) * r + 1);
  } else {
    r -= 5;
    value =
      (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r +
        0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r +
        5.4637849111641143699) * r + 6.6579046435011037772) /
      (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r +
        7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r +
        0.59983220655588793769) * r + 1);
  }
  return q < 0 ? -value : value;
}

// --- Studentized range (port of R's nmath/ptukey.c, one range) ---------------

const XLEG = [
  0.981560634246719250690549090149, 0.904117256370474856678465866119,
  0.769902674194304687036893833213, 0.587317954286617447296702418941,
  0.367831498998180193752691536644, 0.125233408511468915472441369464,
];
const ALEG = [
  0.047175336386511827194615961485, 0.106939325995318430960254718194,
  0.160078328543346226334652529543, 0.20316742672306592174906445581,
  0.233492536538354808760849898925, 0.249147045813402785000562436043,
];

/** P(range of cc standard normals < w). */
function rangeProbability(w: number, cc: number): number {
  const qsqz = w * 0.5;
  if (qsqz >= 8) return 1;

  let prW = 2 * normalCdf(qsqz) - 1;
  prW = prW >= Math.exp(-50 / cc) ? Math.pow(prW, cc) : 0;

  const wincr = w > 3 ? 2 : 3;
  let blb = qsqz;
  const binc = (8 - qsqz) / wincr;
  let bub = blb + binc;
  let einsum = 0;
  const cc1 = cc - 1;

  for (let wi = 1; wi <= wincr; wi++) {
    let elsum = 0;
    const a = 0.5 * (bub + blb);
    const b = 0.5 * (bub - blb);
    for (let jj = 1; jj <= 12; jj++) {
      let j: number;
      let xx: number;
      if (6 < jj) {
        j = 12 - jj + 1;
        xx = XLEG[j - 1];
      } else {
        j = jj;
        xx = -XLEG[j - 1];
      }
      const ac = a + b * xx;
      const qexpo = ac * ac;
      if (qexpo > 60) break;
      const pplus = 2 * normalCdf(ac);
      const pminus = 2 * normalCdf(ac - w);
      let rinsum = pplus * 0.5 - pminus * 0.5;
      if (rinsum >= Math.exp(-30 / cc1)) {
        rinsum = ALEG[j - 1] * Math.exp(-(0.5 * qexpo)) * Math.pow(rinsum, cc1);
        elsum += rinsum;
      }
    }
    elsum *= (2 * b * cc) / Math.sqrt(2 * Math.PI);
    einsum += elsum;
    blb = bub;
    bub += binc;
  }

  prW += einsum;
  if (prW <= Math.exp(-30)) return 0;
  return Math.min(1, prW);
}

const XLEGQ = [
  0.98940093499164993259615417345, 0.944575023073232576077988415535,
  0.865631202387831743880467897712, 0.755404408355003033895101194847,
  0.617876244402643748446671764049, 0.458016777657227386342419442984,
  0.28160355077925891323046050146, 0.095012509837637440185319335425,
];
const ALEGQ = [
  0.027152459411754094851780572456, 0.062253523938647892862843836994,
  0.095158511682492784809925107602, 0.124628971255533872052476282192,
  0.149595988816576732081501730547, 0.16915651939500253818931207903,
  0.182603415044923588866763667969, 0.189450610455068496285396723208,
];

/** P(studentized range of k means with df degrees of freedom < q). */
export function studentizedRangeCdf(q: number, k: number, df: number): number {
  if (q <= 0) return 0;
  if (!Number.isFinite(q)) return 1;
  if (df < 2 || k < 2) return NaN;
  if (df > 25000) return rangeProbability(q, k);

  const f2 = df * 0.5;
  let f2lf = f2 * Math.log(df) - df * Math.LN2 - lnGamma(f2);
  const f21 = f2 - 1;
  const ff4 = df * 0.25;
  const ulen = df <= 100 ? 1 : df <= 800 ? 0.5 : df <= 5000 ? 0.25 : 0.125;
  f2lf += Math.log(ulen);

  let ans = 0;
  for (let i = 1; i <= 50; i++) {
    let otsum = 0;
    const twa1 = (2 * i - 1) * ulen;
    for (let jj = 1; jj <= 16; jj++) {
      let j: number;
      let t1: number;
      if (8 < jj) {
        j = jj - 8 - 1;
        t1 = f2lf + f21 * Math.log(twa1 + XLEGQ[j] * ulen) - (XLEGQ[j] * ulen + twa1) * ff4;
      } else {
        j = jj - 1;
        t1 = f2lf + f21 * Math.log(twa1 - XLEGQ[j] * ulen) + (XLEGQ[j] * ulen - twa1) * ff4;
      }
      if (t1 >= -30) {
        const qsqz =
          8 < jj
            ? q * Math.sqrt((XLEGQ[j] * ulen + twa1) * 0.5)
            : q * Math.sqrt((-(XLEGQ[j] * ulen) + twa1) * 0.5);
        otsum += rangeProbability(qsqz, k) * ALEGQ[j] * Math.exp(t1);
      }
    }
    if (i * ulen >= 1 && otsum <= 1e-14) break;
    ans += otsum;
  }
  return Math.min(1, ans);
}

// ============================================================================
// 2. Descriptives
// ============================================================================

export function mean(x: number[]): number {
  return x.reduce((a, b) => a + b, 0) / x.length;
}

/** Sample variance (n - 1). */
export function variance(x: number[]): number {
  const m = mean(x);
  return x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1);
}

export function median(x: number[]): number {
  const s = [...x].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ============================================================================
// 3. Tests
// ============================================================================

export interface ShapiroWilkResult {
  w: number;
  p: number;
}

/**
 * Shapiro-Wilk W test (Royston 1995, AS R94), as in R's swilk.c, for 3 <= n <= 5000.
 * Returns null when every value is equal (W is undefined).
 */
export function shapiroWilk(values: number[]): ShapiroWilkResult | null {
  const n = values.length;
  if (n < 3 || n > 5000) return null;
  const x = [0, ...[...values].sort((a, b) => a - b)]; // 1-based
  const range = x[n] - x[1];
  if (range < 1e-19) return null;

  const poly = (cc: number[], v: number) => {
    let result = cc[0];
    if (cc.length > 1) {
      let p2 = v * cc[cc.length - 1];
      for (let j = cc.length - 2; j > 0; j--) p2 = (p2 + cc[j]) * v;
      result += p2;
    }
    return result;
  };
  const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

  const nn2 = Math.floor(n / 2);
  const a = new Array<number>(nn2 + 1).fill(0); // 1-based
  const an = n;

  if (n === 3) {
    a[1] = Math.SQRT1_2;
  } else {
    const an25 = an + 0.25;
    const m = new Array<number>(nn2 + 1).fill(0);
    let summ2 = 0;
    for (let i = 1; i <= nn2; i++) {
      m[i] = normalQuantile((i - 0.375) / an25);
      summ2 += m[i] * m[i];
    }
    summ2 *= 2;
    const ssumm2 = Math.sqrt(summ2);
    const rsn = 1 / Math.sqrt(an);
    const a1 = poly([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - m[1] / ssumm2;
    let i1: number;
    let fac: number;
    if (n > 5) {
      i1 = 3;
      const a2 = -m[2] / ssumm2 + poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn);
      fac = Math.sqrt(
        (summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2)
      );
      a[2] = a2;
    } else {
      i1 = 2;
      fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1));
    }
    a[1] = a1;
    for (let i = i1; i <= nn2; i++) a[i] = -m[i] / fac;
  }

  // i walks x[2..n]; j is the mirror position n + 1 - i.
  let sx = x[1] / range;
  let sa = -a[1];
  for (let i = 1, j = n - 1; i < n; j--) {
    sx += x[i + 1] / range;
    i++;
    if (i !== j) sa += sign(i - j) * a[Math.min(i, j)];
  }

  sa /= n;
  sx /= n;
  let ssa = 0;
  let ssx = 0;
  let sax = 0;
  for (let i = 1, j = n; i <= n; i++, j--) {
    const asa = i !== j ? sign(i - j) * a[Math.min(i, j)] - sa : -sa;
    const xsx = x[i] / range - sx;
    ssa += asa * asa;
    ssx += xsx * xsx;
    sax += asa * xsx;
  }
  const ssassx = Math.sqrt(ssa * ssx);
  const w1 = ((ssassx - sax) * (ssassx + sax)) / (ssa * ssx);
  const w = 1 - w1;

  if (n === 3) {
    const p = (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.PI / 3);
    return { w, p: Math.max(0, p) };
  }

  let y = Math.log(w1);
  const lxx = Math.log(an);
  let mu: number;
  let sigma: number;
  if (n <= 11) {
    const gamma = poly([-2.273, 0.459], an);
    if (y >= gamma) return { w, p: 1e-99 };
    y = -Math.log(gamma - y);
    mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], an);
    sigma = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], an));
  } else {
    mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], lxx);
    sigma = Math.exp(poly([-0.4803, -0.082676, 0.0030302], lxx));
  }
  return { w, p: normalSf((y - mu) / sigma) };
}

export interface FTestResult {
  f: number;
  df1: number;
  df2: number;
  p: number;
}

/** Classic one-way ANOVA. */
export function oneWayAnova(groups: number[][]): FTestResult & { etaSquared: number; msWithin: number } {
  const all = groups.flat();
  const grand = mean(all);
  const k = groups.length;
  const n = all.length;
  const ssBetween = groups.reduce((s, g) => s + g.length * (mean(g) - grand) ** 2, 0);
  const ssWithin = groups.reduce((s, g) => {
    const m = mean(g);
    return s + g.reduce((t, v) => t + (v - m) ** 2, 0);
  }, 0);
  const df1 = k - 1;
  const df2 = n - k;
  const msWithin = ssWithin / df2;
  const f = ssBetween / df1 / msWithin;
  const ssTotal = ssBetween + ssWithin;
  return {
    f,
    df1,
    df2,
    p: fSf(f, df1, df2),
    etaSquared: ssTotal > 0 ? ssBetween / ssTotal : 0,
    msWithin,
  };
}

/** Levene's test centred on the median (Brown-Forsythe), as scipy's default. */
export function leveneMedian(groups: number[][]): FTestResult {
  const deviations = groups.map((g) => {
    const md = median(g);
    return g.map((v) => Math.abs(v - md));
  });
  const { f, df1, df2, p } = oneWayAnova(deviations);
  // All deviations equal (e.g. every group constant): no evidence against homogeneity.
  return Number.isFinite(f) ? { f, df1, df2, p } : { f: 0, df1, df2, p: 1 };
}

/** Welch's ANOVA for unequal variances. */
export function welchAnova(groups: number[][]): FTestResult {
  const k = groups.length;
  const ns = groups.map((g) => g.length);
  const means = groups.map(mean);
  const weights = groups.map((g, i) => ns[i] / variance(g));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const weightedMean = weights.reduce((s, w, i) => s + w * means[i], 0) / sumW;
  const a = weights.reduce((s, w, i) => s + w * (means[i] - weightedMean) ** 2, 0) / (k - 1);
  const lambda = weights.reduce((s, w, i) => s + (1 - w / sumW) ** 2 / (ns[i] - 1), 0);
  const b = 1 + ((2 * (k - 2)) / (k * k - 1)) * lambda;
  const f = a / b;
  const df1 = k - 1;
  const df2 = (k * k - 1) / (3 * lambda);
  return { f, df1, df2, p: fSf(f, df1, df2) };
}

/** Average ranks (1-based) with ties sharing the mean rank. */
function rankWithTies(values: number[]): { ranks: number[]; tieTerm: number } {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(values.length);
  let tieTerm = 0; // sum of (t^3 - t) over tied blocks
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) ranks[order[t][1]] = avg;
    const size = j - i + 1;
    tieTerm += size ** 3 - size;
    i = j + 1;
  }
  return { ranks, tieTerm };
}

export interface KruskalResult {
  h: number;
  df: number;
  p: number;
  epsilonSquared: number;
  meanRanks: number[];
  /** Variance term for Dunn's test: N(N+1)/12 - sum(t^3 - t) / (12(N-1)). */
  dunnVariance: number;
}

/** Kruskal-Wallis H with the correction for ties. */
export function kruskalWallis(groups: number[][]): KruskalResult {
  const all = groups.flat();
  const n = all.length;
  const { ranks, tieTerm } = rankWithTies(all);
  const meanRanks: number[] = [];
  let offset = 0;
  let sum = 0;
  for (const g of groups) {
    const r = ranks.slice(offset, offset + g.length);
    offset += g.length;
    const rankSum = r.reduce((a, b) => a + b, 0);
    meanRanks.push(rankSum / g.length);
    sum += (rankSum * rankSum) / g.length;
  }
  const correction = 1 - tieTerm / (n ** 3 - n);
  const hRaw = (12 / (n * (n + 1))) * sum - 3 * (n + 1);
  const h = correction > 0 ? hRaw / correction : 0;
  const df = groups.length - 1;
  return {
    h,
    df,
    p: correction > 0 ? chiSquareSf(h, df) : 1,
    epsilonSquared: h / (n - 1),
    meanRanks,
    dunnVariance: (n * (n + 1)) / 12 - tieTerm / (12 * (n - 1)),
  };
}

/** Holm's step-down adjustment, returned in the original order. */
export function holmAdjust(pValues: number[]): number[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const adjusted = new Array<number>(m);
  let running = 0;
  order.forEach(([p, i], rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}

type PairRow = { difference: number; statistic: number; p: number };

/** Tukey-Kramer: Tukey's HSD with the harmonic correction for unequal n. */
export function tukeyKramer(groups: number[][], pairs: [number, number][]): PairRow[] {
  const { msWithin, df2 } = oneWayAnova(groups);
  return pairs.map(([i, j]) => {
    const difference = mean(groups[i]) - mean(groups[j]);
    const se = Math.sqrt((msWithin / 2) * (1 / groups[i].length + 1 / groups[j].length));
    const q = Math.abs(difference) / se;
    return { difference, statistic: q, p: 1 - studentizedRangeCdf(q, groups.length, df2) };
  });
}

/** Games-Howell: pairwise comparisons without assuming equal variances. */
export function gamesHowell(groups: number[][], pairs: [number, number][]): PairRow[] {
  return pairs.map(([i, j]) => {
    const vi = variance(groups[i]) / groups[i].length;
    const vj = variance(groups[j]) / groups[j].length;
    const difference = mean(groups[i]) - mean(groups[j]);
    const q = Math.abs(difference) / Math.sqrt((vi + vj) / 2);
    const df = (vi + vj) ** 2 / (vi ** 2 / (groups[i].length - 1) + vj ** 2 / (groups[j].length - 1));
    return { difference, statistic: q, p: 1 - studentizedRangeCdf(q, groups.length, df) };
  });
}

/** Dunn's test on the Kruskal-Wallis ranks, two-sided, Holm-adjusted over the pairs given. */
export function dunnHolm(
  groups: number[][],
  pairs: [number, number][],
  kw: KruskalResult = kruskalWallis(groups)
): PairRow[] {
  const raw = pairs.map(([i, j]) => {
    const difference = kw.meanRanks[i] - kw.meanRanks[j];
    const z = difference / Math.sqrt(kw.dunnVariance * (1 / groups[i].length + 1 / groups[j].length));
    return { difference, statistic: z, p: Math.min(1, 2 * normalSf(Math.abs(z))) };
  });
  const adjusted = holmAdjust(raw.map((r) => r.p));
  return raw.map((r, idx) => ({ ...r, p: adjusted[idx] }));
}

// ============================================================================
// 4. Decision flow
// ============================================================================

export type TestKind = 'anova' | 'welch' | 'kruskal';

export interface PairComparison {
  a: string;
  b: string;
  /** Mean difference (a - b); mean rank difference for Dunn. */
  difference: number;
  statistic: number;
  p: number;
  significant: boolean;
}

export interface GroupComparison {
  groups: { name: string; n: number; mean: number; sd: number; median: number }[];
  normality: { name: string; w: number | null; p: number | null; normal: boolean }[];
  levene: FTestResult & { homogeneous: boolean };
  allNormal: boolean;
  test: {
    kind: TestKind;
    statistic: number;
    df1: number;
    df2: number | null;
    p: number;
    significant: boolean;
    effectSize: { name: 'η²' | 'ε²'; value: number };
  };
  postHoc: { method: 'Tukey-Kramer' | 'Games-Howell' | 'Dunn (Holm)'; comparisons: PairComparison[] };
}

/** Minimum per group: Shapiro-Wilk needs 3 values. */
export const MIN_N_PER_GROUP = 3;

/**
 * Runs the whole flow on named independent groups. Returns null if any group has
 * fewer than MIN_N_PER_GROUP values. `pairs` lists the post hoc comparisons, by
 * index, in the order they are shown.
 */
export function compareGroups(
  named: { name: string; values: number[] }[],
  pairs: [number, number][],
  alpha: number = ALPHA
): GroupComparison | null {
  if (named.some((g) => g.values.length < MIN_N_PER_GROUP)) return null;
  const groups = named.map((g) => g.values);

  const normality = named.map((g) => {
    const sw = shapiroWilk(g.values);
    // A constant group has no spread: it cannot be normal.
    return { name: g.name, w: sw?.w ?? null, p: sw?.p ?? null, normal: sw !== null && sw.p > alpha };
  });
  const allNormal = normality.every((g) => g.normal);
  const leveneResult = leveneMedian(groups);
  const levene = { ...leveneResult, homogeneous: leveneResult.p > alpha };

  const descriptives = named.map((g) => ({
    name: g.name,
    n: g.values.length,
    mean: mean(g.values),
    sd: Math.sqrt(variance(g.values)),
    median: median(g.values),
  }));
  const anova = oneWayAnova(groups);

  let test: GroupComparison['test'];
  let postHoc: GroupComparison['postHoc'];
  const withNames = (rows: Omit<PairComparison, 'a' | 'b' | 'significant'>[]) =>
    rows.map((row, idx) => ({
      a: named[pairs[idx][0]].name,
      b: named[pairs[idx][1]].name,
      ...row,
      significant: row.p < alpha,
    }));

  if (allNormal && levene.homogeneous) {
    test = {
      kind: 'anova',
      statistic: anova.f,
      df1: anova.df1,
      df2: anova.df2,
      p: anova.p,
      significant: anova.p < alpha,
      effectSize: { name: 'η²', value: anova.etaSquared },
    };
    postHoc = { method: 'Tukey-Kramer', comparisons: withNames(tukeyKramer(groups, pairs)) };
  } else if (allNormal) {
    const welch = welchAnova(groups);
    test = {
      kind: 'welch',
      statistic: welch.f,
      df1: welch.df1,
      df2: welch.df2,
      p: welch.p,
      significant: welch.p < alpha,
      effectSize: { name: 'η²', value: anova.etaSquared },
    };
    postHoc = { method: 'Games-Howell', comparisons: withNames(gamesHowell(groups, pairs)) };
  } else {
    const kw = kruskalWallis(groups);
    test = {
      kind: 'kruskal',
      statistic: kw.h,
      df1: kw.df,
      df2: null,
      p: kw.p,
      significant: kw.p < alpha,
      effectSize: { name: 'ε²', value: kw.epsilonSquared },
    };
    postHoc = { method: 'Dunn (Holm)', comparisons: withNames(dunnHolm(groups, pairs, kw)) };
  }

  return { groups: descriptives, normality, levene, allNormal, test, postHoc };
}
