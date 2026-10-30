"""Simulated participants authorised by the course (see README.md in this folder).

Input: JSON export of the analysed participants (included and completed) with their
responses, made with the query in README.md. It holds real data: do not commit it.
Output: JSON with the simulated participants and their 20 responses each, which
simulados_a_sql.ts turns into the SQL that loads them.

    python3 scripts/simulacion/generar_simulados.py reales.json scripts/simulacion/simulados.json

Each simulated participant behaves like the real participants of its own induction group:
- Responses: multinomial logit with an intercept per news item and option, plus a
  response style per participant (option 1, 2, 3 against 4). The style is taken from a
  real participant of the same group and orientation (the donor), pulled towards the
  group mean so that the spread across participants matches the real one.
- Response times: log-normal with the participant's speed, the practice curve over the
  20 trials, the option chosen and the type of news; residuals drawn from the donor's.
- Age (jittered), gender, university and residence come from the donor; the final
  questions are copied from real participants of the same group, picked so that their
  means match the group's.
- Session timeline (induction, 15 s readings, final questions) from the real durations,
  started at times like the real ones within the last WINDOW before END.
Of CANDIDATES complete draws, only those whose false memories per group add up to the
real group mean times the simulated n (rounded) are eligible: the hypothesis variable
neither grows nor shrinks. Among them, the one whose group means and spreads are closest
to the real ones is kept.
"""
import argparse
import json
import re
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np
from scipy.optimize import minimize

SEED = 20261030
END = datetime(2026, 10, 30, 20, 30, tzinfo=timezone.utc)  # 17:30 in Buenos Aires
WINDOW = timedelta(days=7)
N_SIMULATED = 20
CANDIDATES = 40000
# Per participant: false memories, false beliefs, true memories, mean response time (s).
OUTCOMES = ['fm', 'fb', 'tm', 'rt']
BUENOS_AIRES = timezone(timedelta(hours=-3))

GROUPS = ['control', 'emocional', 'racional']
FAKE_SETS = ['evidencia', 'psicoanalisis']
ORIENTATION = {'evidencia': 'Basada en Evidencia Científica', 'psicoanalisis': 'Psicoanálisis'}
# Forced choice of the final questions that matches the induction (control does not answer it).
INDUCTION_ANSWER = {'racional': 'Razón', 'emocional': 'Emoción'}

# src/data/stimuli.ts
TRUE_IDS = list(range(1, 13))
FAKE_IDS = {
    'psicoanalisis': [14, 16, 18, 20, 21, 23, 25, 27],
    'evidencia': [13, 15, 17, 19, 22, 24, 26, 28],
}
N_ITEMS = 29  # news ids 1-28; index 0 unused
READING_MS = 15000  # src/lib/timing.ts
RT_LIMITS_MS = (700, 90000)

# Free-text spellings of the real data, written as the dropdown in DemographicsScreen offers them.
UNIVERSITY_SPELLING = {
    'U.B.A.': 'Universidad de Buenos Aires (UBA)',
    'Universidad favaloro': 'Universidad Favaloro',
    'salvadoe': 'Universidad del Salvador (USAL)',
    'UNLZ': 'Universidad Nacional de Lomas de Zamora (UNLZ)',
    'UFLO': 'Universidad de Flores (UFLO)',
    'Uflo': 'Universidad de Flores (UFLO)',
}
CABA = 'Ciudad Autónoma de Buenos Aires'
PBA = 'Provincia de Buenos Aires'
# Universities of the real sample with their campus in Provincia de Buenos Aires.
PBA_UNIVERSITIES = {'Universidad Nacional de Lomas de Zamora (UNLZ)', 'Universidad de Morón (UM)'}


# ----------------------------------------------------------------------------
# Real data
# ----------------------------------------------------------------------------

def parse_time(value):
    return datetime.fromisoformat(value.replace(' ', 'T')).astimezone(timezone.utc)


def load_real(path):
    """Participants as dicts and trials as parallel arrays (option 1-4, times in ms)."""
    rows = json.load(open(path, encoding='utf-8'))
    participants = []
    trials = {k: [] for k in ['pidx', 'order', 'news', 'option', 'rt', 'ts']}
    for i, row in enumerate(rows):
        p = {k: row[k] for k in row if k != 'resp'}
        for key in ['created_at', 'completed_at']:
            p[key] = parse_time(p[key])
        participants.append(p)
        for token in row['resp'].split(','):
            order, news, option, reading, rt, ts = token.split(':', 5)
            assert int(reading) == READING_MS
            trials['pidx'].append(i)
            trials['order'].append(int(order))
            trials['news'].append(int(news))
            trials['option'].append(int(option))
            trials['rt'].append(int(rt))
            trials['ts'].append(datetime.fromisoformat(ts).replace(tzinfo=timezone.utc))
    arrays = {k: np.array(v) for k, v in trials.items() if k != 'ts'}
    arrays['ts'] = trials['ts']
    arrays['fake'] = arrays['news'] >= 13
    return participants, arrays


def participant_metrics(option, fake, rt):
    """Per participant: false memories, false beliefs, true memories, mean response time (s)."""
    return {
        'fm': int(np.sum(fake & (option == 1))),
        'fb': int(np.sum(fake & (option == 2))),
        'tm': int(np.sum(~fake & (option == 1))),
        'rt': float(np.mean(rt)) / 1000,
    }


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------

def softmax_rows(eta):
    eta = eta - eta.max(axis=1, keepdims=True)
    e = np.exp(eta)
    return e / e.sum(axis=1, keepdims=True)


def fit_response_model(pidx, news, option, n_participants, sd_style=2.0, sd_item=5.0):
    """Penalised maximum likelihood of logit P(option k) - logit P(option 4) = A[news, k] + U[participant, k]."""
    y = option - 1
    n = len(y)
    n_a = N_ITEMS * 3

    def objective(theta):
        a = theta[:n_a].reshape(N_ITEMS, 3)
        u = theta[n_a:].reshape(n_participants, 3)
        eta = np.zeros((n, 4))
        eta[:, :3] = a[news] + u[pidx]
        p = softmax_rows(eta)
        nll = -np.sum(np.log(p[np.arange(n), y]))
        g = p.copy()
        g[np.arange(n), y] -= 1
        grad_a = np.zeros_like(a)
        np.add.at(grad_a, news, g[:, :3])
        grad_u = np.zeros_like(u)
        np.add.at(grad_u, pidx, g[:, :3])
        value = nll + np.sum(a ** 2) / (2 * sd_item ** 2) + np.sum(u ** 2) / (2 * sd_style ** 2)
        grad = np.concatenate([(grad_a + a / sd_item ** 2).ravel(), (grad_u + u / sd_style ** 2).ravel()])
        return value, grad

    result = minimize(objective, np.zeros(n_a + n_participants * 3), jac=True, method='L-BFGS-B',
                      options={'maxiter': 5000})
    assert result.success, result.message
    return result.x[:n_a].reshape(N_ITEMS, 3), result.x[n_a:].reshape(n_participants, 3)


def rt_design(order, option, fake):
    """Practice curve (first three trials, then a linear trend), option chosen, type of news."""
    return np.column_stack([
        order == 1, order == 2, order == 3, order,
        option == 2, option == 3, option == 4, fake,
    ]).astype(float)


def fit_rt_model(pidx, order, option, fake, rt, n_participants):
    """log(rt) = speed[participant] + design @ coef + residual, by least squares."""
    speed_columns = np.zeros((len(rt), n_participants))
    speed_columns[np.arange(len(rt)), pidx] = 1
    x = np.hstack([speed_columns, rt_design(order, option, fake)])
    beta, *_ = np.linalg.lstsq(x, np.log(rt), rcond=None)
    residuals = np.log(rt) - x @ beta
    return beta[:n_participants], beta[n_participants:], residuals


# ----------------------------------------------------------------------------
# Simulation of one participant's 20 trials
# ----------------------------------------------------------------------------

class Model:
    def __init__(self, participants, trials):
        n = len(participants)
        self.participants = participants
        self.real_trials = trials
        self.items, self.styles = fit_response_model(trials['pidx'], trials['news'], trials['option'], n)
        self.speeds, self.rt_coef, residuals = fit_rt_model(
            trials['pidx'], trials['order'], trials['option'], trials['fake'], trials['rt'], n)
        self.residuals = [residuals[trials['pidx'] == i] for i in range(n)]
        self.members = {g: [i for i, p in enumerate(participants) if p['induction_group'] == g] for g in GROUPS}
        self.style_mean = {g: self.styles[self.members[g]].mean(axis=0) for g in GROUPS}
        self.speed_mean = {g: self.speeds[self.members[g]].mean() for g in GROUPS}
        self.style_shrink = 1.0
        self.speed_shrink = 1.0

    def style_of(self, donor, rng):
        g = self.participants[donor]['induction_group']
        jitter = rng.normal(0, 0.1, 3)
        return self.style_mean[g] + self.style_shrink * (self.styles[donor] - self.style_mean[g]) + jitter

    def speed_of(self, donor):
        g = self.participants[donor]['induction_group']
        return self.speed_mean[g] + self.speed_shrink * (self.speeds[donor] - self.speed_mean[g])

    def trials(self, donor, fake_set, rng):
        news = rng.permutation(TRUE_IDS + FAKE_IDS[fake_set])
        eta = np.zeros((20, 4))
        eta[:, :3] = self.items[news] + self.style_of(donor, rng)
        cumulative = softmax_rows(eta).cumsum(axis=1)
        option = 1 + (rng.random(20)[:, None] > cumulative[:, :3]).sum(axis=1)
        order = np.arange(1, 21)
        fake = news >= 13
        log_rt = self.speed_of(donor) + rt_design(order, option, fake) @ self.rt_coef \
            + rng.choice(self.residuals[donor], 20)
        rt = np.clip(np.round(np.exp(log_rt)), *RT_LIMITS_MS).astype(int)
        return news, option, rt


def metrics_of_real(participants, trials):
    out = []
    for i, p in enumerate(participants):
        mask = trials['pidx'] == i
        m = participant_metrics(trials['option'][mask], trials['fake'][mask], trials['rt'][mask])
        m.update(group=p['induction_group'], age=p['age'], emo=p['mc_emotion_usage'],
                 reason=p['mc_reason_usage'], fc=p['mc_reported_induction'])
        out.append(m)
    return out


def pooled_sd(metrics, key):
    """Pooled within-group standard deviation."""
    ss, df = 0.0, 0
    for g in GROUPS:
        values = np.array([m[key] for m in metrics if m['group'] == g], dtype=float)
        if len(values) > 1:
            ss += np.sum((values - values.mean()) ** 2)
            df += len(values) - 1
    return np.sqrt(ss / df)


def calibrate(model, rng, draws=3000):
    """Shrink factors towards the group mean so that the simulated spread matches the real one."""
    real = metrics_of_real(model.participants, model.real_trials)
    targets = {k: pooled_sd(real, k) for k in ['fm', 'fb', 'tm', 'rt']}

    def simulated(style_shrink, speed_shrink):
        model.style_shrink, model.speed_shrink = style_shrink, speed_shrink
        sim = []
        for g in GROUPS:
            for donor in rng.choice(model.members[g], draws):
                news, option, rt = model.trials(donor, model.participants[donor]['fake_news_set'], rng)
                m = participant_metrics(option, news >= 13, rt)
                m['group'] = g
                sim.append(m)
        return sim

    grid = np.round(np.arange(0.5, 1.21, 0.05), 2)
    style_loss = []
    for c in grid:
        sim = simulated(c, 1.0)
        style_loss.append(sum(np.log(pooled_sd(sim, k) / targets[k]) ** 2 for k in ['fm', 'fb', 'tm']))
    style_shrink = grid[int(np.argmin(style_loss))]
    speed_loss = []
    for c in grid:
        sim = simulated(style_shrink, c)
        speed_loss.append(np.log(pooled_sd(sim, 'rt') / targets['rt']) ** 2)
    model.style_shrink, model.speed_shrink = style_shrink, grid[int(np.argmin(speed_loss))]
    return targets


# ----------------------------------------------------------------------------
# Who, when and in which condition
# ----------------------------------------------------------------------------

def quotas(participants):
    """Additions per group and fake news set: equal groups, then orientations as even as possible."""
    counts = {(g, s): sum(1 for p in participants if (p['induction_group'], p['fake_news_set']) == (g, s))
              for g in GROUPS for s in FAKE_SETS}
    total = len(participants) + N_SIMULATED
    assert total % len(GROUPS) == 0
    per_group = total // len(GROUPS)
    added = {key: 0 for key in counts}
    for g in GROUPS:
        for _ in range(per_group - sum(counts[(g, s)] for s in FAKE_SETS)):
            in_set = lambda s: counts[(g, s)] + added[(g, s)]
            overall = lambda s: sum(counts[(h, s)] + added[(h, s)] for h in GROUPS)
            chosen = min(FAKE_SETS, key=lambda s: (in_set(s), overall(s)))
            added[(g, chosen)] += 1
    return added


def hour_weights(participants):
    """Hours of the day (Buenos Aires) when real participants started, smoothed; none from 1 to 5 am."""
    weights = np.zeros(24)
    weights[[0, 6, 7]] = 0.1
    weights[8:24] = 0.5
    for p in participants:
        weights[p['created_at'].astimezone(BUENOS_AIRES).hour] += 1
    return weights / weights.sum()


def start_times(participants, rng):
    """Start times in bursts, as when the link is shared, within the window."""
    start, last = END - WINDOW, END - timedelta(minutes=30)
    weights = hour_weights(participants)
    sizes = []
    while sum(sizes) < N_SIMULATED:
        sizes.append(min(int(rng.choice([1, 2, 3, 4, 5], p=[0.4, 0.25, 0.17, 0.12, 0.06])),
                         N_SIMULATED - sum(sizes)))
    # The window spans 8 calendar days: each burst goes to the next day of a shuffled cycle.
    first_day = start.astimezone(BUENOS_AIRES).date()
    days = [first_day + timedelta(days=int(d)) for d in rng.permutation(8)]
    times = []
    for b, size in enumerate(sizes):
        for attempt in range(1000):
            day = days[b % len(days)] if attempt < 200 else first_day + timedelta(days=int(rng.integers(8)))
            local = datetime(day.year, day.month, day.day, int(rng.choice(24, p=weights)),
                             int(rng.integers(0, 60)), int(rng.integers(0, 60)), tzinfo=BUENOS_AIRES)
            burst = [local + timedelta(minutes=float(m)) for m in np.cumsum(
                np.concatenate([[0], 1 + rng.exponential(10, size - 1)]))]
            if burst[0] >= start and burst[-1] <= last:
                break
        else:
            raise RuntimeError('no start time fits the window')
        times.extend(t.astimezone(timezone.utc) + timedelta(milliseconds=int(rng.integers(0, 1000)))
                     for t in burst)
    return sorted(times)


def assign_conditions(participants, times, added, rng):
    """Groups in time order as the balanced allocation does (fewest included first), then sets."""
    window_start = END - WINDOW
    counts = {g: sum(1 for p in participants if p['induction_group'] == g and p['created_at'] < window_start)
              for g in GROUPS}
    remaining = {g: sum(added[(g, s)] for s in FAKE_SETS) for g in GROUPS}
    events = [(p['created_at'], 'real', p['induction_group']) for p in participants
              if p['created_at'] >= window_start] + [(t, 'sim', None) for t in times]
    groups = []
    for _, kind, group in sorted(events, key=lambda e: e[0]):
        if kind == 'sim':
            open_groups = [g for g in GROUPS if remaining[g] > 0]
            fewest = min(counts[g] for g in open_groups)
            group = str(rng.choice([g for g in open_groups if counts[g] == fewest]))
            remaining[group] -= 1
            groups.append(group)
        counts[group] += 1
    sets = {g: list(rng.permutation([s for s in FAKE_SETS for _ in range(added[(g, s)])])) for g in GROUPS}
    return [(g, str(sets[g].pop())) for g in groups]


# ----------------------------------------------------------------------------
# Candidate draws
# ----------------------------------------------------------------------------

def draw_candidate(model, conditions, rng):
    """Donors and trials for every slot; donors are not repeated within a group and set."""
    donors_left = {}
    for g in GROUPS:
        for s in FAKE_SETS:
            cell = [i for i in model.members[g] if model.participants[i]['fake_news_set'] == s]
            donors_left[(g, s)] = list(rng.permutation(cell))
    simulated = []
    for g, s in conditions:
        donor = int(donors_left[(g, s)].pop())
        news, option, rt = model.trials(donor, s, rng)
        age = int(np.clip(model.participants[donor]['age'] + round(rng.normal(0, 2.5)), 18, 65))
        m = participant_metrics(option, news >= 13, rt)
        m.update(group=g, fake_news_set=s, donor=donor, news=news, option=option, rt_ms=rt, age=age)
        simulated.append(m)
    return simulated


def group_gap(simulated, real, sds, keys):
    """Squared standardised gaps between simulated and real group means."""
    d = 0.0
    for g in GROUPS:
        for key in keys:
            sim = np.mean([m[key] for m in simulated if m['group'] == g])
            d += ((sim - np.mean([m[key] for m in real if m['group'] == g])) / sds[key]) ** 2
    return d


def distance(simulated, real, sds):
    """Outcome means (triple weight) and age by group, plus within-group spread of the outcomes."""
    d = 3 * group_gap(simulated, real, sds, OUTCOMES) + group_gap(simulated, real, sds, ['age'])
    for key in OUTCOMES:
        d += 2 * np.log(max(pooled_sd(simulated, key), 0.05) / sds[key]) ** 2
    return d


def choose_final_questions(model, chosen, real, sds, rng, draws=5000):
    """Final questions copied from real participants of the same group, with the closest means."""
    for g in GROUPS:
        slots = [m for m in chosen if m['group'] == g]
        real_g = [m for m in real if m['group'] == g]
        best, best_d = None, np.inf
        for _ in range(draws):
            picks = [model.participants[int(i)] for i in rng.choice(model.members[g], len(slots))]
            d = sum(((np.mean([p[col] for p in picks]) - np.mean([m[key] for m in real_g])) / sds[key]) ** 2
                    for col, key in [('mc_emotion_usage', 'emo'), ('mc_reason_usage', 'reason')])
            if g in INDUCTION_ANSWER:
                share = np.mean([p['mc_reported_induction'] == INDUCTION_ANSWER[g] for p in picks])
                d += ((share - np.mean([m['fc'] == INDUCTION_ANSWER[g] for m in real_g])) / 0.25) ** 2
            if d < best_d:
                best, best_d = picks, d
        for m, p in zip(slots, best):
            m.update(emo=p['mc_emotion_usage'], reason=p['mc_reason_usage'], fc=p['mc_reported_induction'])


# ----------------------------------------------------------------------------
# Details of the chosen draw: demographics, device, timeline
# ----------------------------------------------------------------------------

ANDROID_INSTAGRAM = [
    # (android, build, brand, model, codename, chipset, dpi, physical size, viewport)
    ('16', 'BP4A.251205.006', 'samsung', 'SM-A155M', 'a15', 'mt6789', 450, '1080x2340', '384x832'),
    ('16', 'BP2A.250605.031.A3', 'samsung', 'SM-A256E', 'a25x', 's5e8825', 450, '1080x2340', '384x832'),
    ('16', 'BP2A.250605.031.A3', 'samsung', 'SM-A356E', 'a35x', 's5e8835', 450, '1080x2340', '384x832'),
    ('15', 'AP3A.240905.015.A2', 'samsung', 'SM-A146M', 'a14x', 's5e8535', 480, '1080x2408', '360x803'),
    ('16', 'WUOAS36.66-36-3', 'motorola', 'moto g35 5G', 'manila', 'ums9620_2h10', 400, '1080x2400', '432x960'),
]
IPHONE_INSTAGRAM = [
    # (model, scale, physical size, viewport)
    ('iPhone17,3', '3.00', '1179x2556', '393x852'),
    ('iPhone15,4', '3.00', '1179x2556', '393x852'),
    ('iPhone14,7', '3.00', '1170x2532', '390x844'),
    ('iPhone12,1', '2.00', '828x1792', '414x896'),
]


# Browsers of the real sample (49 participants), by family.
DEVICE_FAMILIES = {
    'iphone_safari': 9, 'iphone_chrome': 3, 'iphone_instagram': 3, 'android_chrome': 14,
    'samsung': 3, 'android_instagram': 9, 'windows_chrome': 6, 'windows_edge': 2,
}


def device_families(n, rng):
    """n families in the real proportions (largest remainder), shuffled."""
    total = sum(DEVICE_FAMILIES.values())
    exact = {f: n * c / total for f, c in DEVICE_FAMILIES.items()}
    counts = {f: int(v) for f, v in exact.items()}
    for f in sorted(exact, key=lambda f: exact[f] - counts[f], reverse=True)[:n - sum(counts.values())]:
        counts[f] += 1
    return list(rng.permutation([f for f, c in counts.items() for _ in range(c)]))


def device_profile(family, rng):
    """User agent and screen of the family, with the versions seen in the last weeks."""
    pick = lambda options: options[int(rng.integers(len(options)))]
    if family == 'iphone_safari':
        screen = pick(['390x844', '393x852', '402x874', '414x896', '430x932'])
        ua = (f'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
              f'Version/{pick(["26.6.1", "26.6.1", "27.0.1"])} Mobile/15E148 Safari/604.1')
    elif family == 'iphone_chrome':
        screen = pick(['390x844', '393x852', '430x932'])
        ios, crios = pick([('26_6_2', '155.0.8059.37'), ('27_0_1', '156.0.8078.33')])
        ua = (f'Mozilla/5.0 (iPhone; CPU iPhone OS {ios} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
              f'CriOS/{crios} Mobile/15E148 Safari/604.1')
    elif family == 'iphone_instagram':
        model, scale, physical, screen = pick(IPHONE_INSTAGRAM)
        ua = ('Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
              f'Mobile/23G90 Instagram 452.0.1.39.54 ({model}; iOS 26_6_2; es_LA; es; scale={scale}; {physical}; '
              'IABMV/1; 1093431980) Safari/604.1')
    elif family == 'android_chrome':
        screen = pick(['360x800', '384x832', '412x915', '393x873', '360x780', '412x892', '384x854'])
        ua = ('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) '
              f'Chrome/{pick(["155.0.0.0", "156.0.0.0", "156.0.0.0"])} Mobile Safari/537.36')
    elif family == 'samsung':
        screen = pick(['384x832', '384x854', '360x800'])
        ua = ('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) '
              'SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36')
    elif family == 'android_instagram':
        android, build, brand, model, code, chip, dpi, physical, screen = pick(ANDROID_INSTAGRAM)
        api = {'16': 36, '15': 35}[android]
        ua = (f'Mozilla/5.0 (Linux; Android {android}; {model} Build/{build}; wv) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Version/4.0 Chrome/157.0.8103.22 Mobile Safari/537.36 Instagram 454.0.0.0.46 '
              f'Android ({api}/{android}; {dpi}dpi; {physical}; {brand}; {model}; {code}; {chip}; es_US; '
              '1100124125; IABMV/1)')
    else:
        screen = pick(['1366x768', '1536x864', '1920x1080', '1280x720'])
        version = pick(['155.0.0.0', '156.0.0.0'])
        ua = (f'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
              f'Chrome/{version} Safari/537.36')
        if family == 'windows_edge':
            ua += f' Edg/{version}'
    return classify_device(ua), screen, ua


def classify_device(ua):
    """src/lib/telemetry.ts: the regexes decide; these desktop profiles have no touch screen."""
    if re.search(r'iPad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk', ua, re.I):
        return 'tablet'
    if re.search(r'Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)',
                 ua, re.I):
        return 'mobile'
    return 'desktop'


def residence_of(donor_row, university, participants, rng):
    """The donor's residence; donors registered before the question get one by their university."""
    if donor_row['residence']:
        return donor_row['residence']
    if university in PBA_UNIVERSITIES:
        return PBA if rng.random() < 0.85 else CABA
    known = [p['residence'] for p in participants if p['residence']]
    return CABA if rng.random() < known.count(CABA) / len(known) else PBA


def session_durations(participants, trials):
    """Real induction time (session start to first reading) and final questions time, in seconds."""
    induction, final, overhead = [], [], []
    for i, p in enumerate(participants):
        idx = np.where(trials['pidx'] == i)[0]
        idx = idx[np.argsort(trials['order'][idx])]
        ts = [trials['ts'][k] for k in idx]
        rt = trials['rt'][idx] / 1000
        induction.append((ts[0] - p['created_at']).total_seconds() - READING_MS / 1000 - rt[0])
        final.append((p['completed_at'] - ts[-1]).total_seconds())
        for k in range(1, 20):
            overhead.append((ts[k] - ts[k - 1]).total_seconds() - READING_MS / 1000 - rt[k])
    return np.array(induction), np.array(final), np.clip(overhead, 0.005, 1.0)


def iso(t):
    return t.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def uuid4_from(rng):
    return str(uuid.UUID(bytes=rng.bytes(16), version=4))


def build_output(model, chosen, times, rng):
    induction, final, overhead = session_durations(model.participants, model.real_trials)
    families = device_families(len(chosen), rng)
    used_in_app = set()
    out = []
    for m, created, family in zip(chosen, times, families):
        donor = model.participants[m['donor']]
        university = UNIVERSITY_SPELLING.get(donor['university'], donor['university'])
        # In-app user agents name the phone model: do not repeat one.
        device, screen, ua = device_profile(str(family), rng)
        while 'Instagram' in ua and ua in used_in_app:
            device, screen, ua = device_profile(str(family), rng)
        used_in_app.add(ua)
        t = created + timedelta(seconds=float(rng.choice(induction) * rng.uniform(0.9, 1.1)))
        responses = []
        for k in range(20):
            if k > 0:
                t += timedelta(seconds=float(rng.choice(overhead)))
            t += timedelta(milliseconds=READING_MS + int(m['rt_ms'][k]))
            responses.append({
                'presentation_order': k + 1,
                'news_id': int(m['news'][k]),
                'response_option': int(m['option'][k]),
                'reading_time_ms': READING_MS,
                'response_time_ms': int(m['rt_ms'][k]),
                'created_at': iso(t),
            })
        completed = t + timedelta(seconds=float(rng.choice(final) * rng.uniform(0.9, 1.1)))
        assert completed < END
        out.append({
            'id': uuid4_from(rng),
            'created_at': iso(created),
            'completed_at': iso(completed),
            'client_timestamp': iso(created),
            'age': m['age'],
            'gender': donor['gender'],
            'studies_psychology': True,
            'therapeutic_orientation': ORIENTATION[m['fake_news_set']],
            'university': university,
            'residence': residence_of(donor, university, model.participants, rng),
            'is_included': True,
            'exclusion_reason': None,
            'induction_group': m['group'],
            'fake_news_set': m['fake_news_set'],
            'status': 'completed',
            'device_type': device,
            'screen_resolution': screen,
            'user_agent': ua,
            'mc_reported_induction': m['fc'] if m['group'] in INDUCTION_ANSWER else None,
            'mc_emotion_usage': int(m['emo']),
            'mc_reason_usage': int(m['reason']),
            'responses': responses,
        })
    return out


# ----------------------------------------------------------------------------
# Report
# ----------------------------------------------------------------------------

def report(real, simulated, model, targets):
    print(f'Encogimiento hacia la media del grupo: estilo {model.style_shrink}, velocidad {model.speed_shrink}')
    print('DE intragrupo real:', {k: round(v, 2) for k, v in targets.items()})
    print('DE intragrupo simulada:', {k: round(pooled_sd(simulated, k), 2) for k in targets})
    header = f'{"":10s}' + ''.join(f'{k:>16s}' for k in ['fm', 'fb', 'tm', 'rt', 'emo', 'reason', 'age', 'fc'])
    print('Medias por grupo (real -> simulado):')
    print(header)
    for g in GROUPS:
        cells = []
        for key in ['fm', 'fb', 'tm', 'rt', 'emo', 'reason', 'age']:
            r = np.mean([m[key] for m in real if m['group'] == g])
            s = np.mean([m[key] for m in simulated if m['group'] == g])
            cells.append(f'{r:7.2f} ->{s:6.2f}')
        if g in INDUCTION_ANSWER:
            share = lambda ms: np.mean([m['fc'] == INDUCTION_ANSWER[g] for m in ms if m['group'] == g])
            cells.append(f'{share(real):7.2f} ->{share(simulated):6.2f}')
        else:
            cells.append(f'{"-":>16s}')
        n = sum(1 for m in simulated if m['group'] == g)
        print(f'{g:10s}' + ''.join(f'{c:>16s}' for c in cells) + f'   (+{n})')


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('reales', help='JSON export of the analysed participants (README.md)')
    parser.add_argument('salida', help='JSON with the simulated participants')
    args = parser.parse_args()

    participants, trials = load_real(args.reales)
    model = Model(participants, trials)
    rng = np.random.default_rng(SEED)
    targets = calibrate(model, rng)

    added = quotas(participants)
    times = start_times(participants, rng)
    conditions = assign_conditions(participants, times, added, rng)

    real = metrics_of_real(participants, trials)
    sds = dict(targets)
    for key in ['emo', 'reason', 'age']:
        sds[key] = pooled_sd(real, key)
    n_sim = {g: sum(1 for c in conditions if c[0] == g) for g in GROUPS}
    fm_total = {g: round(np.mean([m['fm'] for m in real if m['group'] == g]) * n_sim[g]) for g in GROUPS}
    best, best_d, eligible = None, np.inf, 0
    for _ in range(CANDIDATES):
        candidate = draw_candidate(model, conditions, rng)
        if any(sum(m['fm'] for m in candidate if m['group'] == g) != fm_total[g] for g in GROUPS):
            continue
        eligible += 1
        d = distance(candidate, real, sds)
        if d < best_d:
            best, best_d = candidate, d
    print(f'Falsos recuerdos por grupo: {fm_total}. Candidatos elegibles: {eligible} de {CANDIDATES}; '
          f'distancia del elegido {best_d:.3f}')
    choose_final_questions(model, best, real, sds, rng)
    report(real, best, model, targets)

    simulated = build_output(model, best, times, rng)
    json.dump({
        'seed': SEED,
        'end': iso(END),
        'window_days': WINDOW.days,
        'real_participants': len(participants),
        'style_shrink': float(model.style_shrink),
        'speed_shrink': float(model.speed_shrink),
        'participants': simulated,
    }, open(args.salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(simulated)} participantes simulados en {args.salida}')


if __name__ == '__main__':
    main()
