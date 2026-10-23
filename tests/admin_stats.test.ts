/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Admin dashboard statistics and paged reads.
 * Target: tests/admin_stats.test.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdminStats,
  exportFileDate,
  fetchAllRows,
  IDEAL_PER_GROUP,
  MIN_PER_GROUP,
  quartiles,
} from '../src/lib/adminStats.ts';
import { EBP_CONGRUENT_FAKE_IDS, PSA_CONGRUENT_FAKE_IDS } from '../src/data/stimuli.ts';

let nextId = 0;
function participant(overrides: Record<string, unknown> = {}) {
  nextId += 1;
  return {
    id: `p-${String(nextId).padStart(4, '0')}-0000-0000-000000000000`,
    created_at: '2026-10-10T12:00:00Z',
    completed_at: '2026-10-10T12:20:00Z',
    age: 25,
    gender: 'Femenino',
    therapeutic_orientation: 'Psicoanálisis',
    residence: 'Provincia de Buenos Aires',
    is_included: true,
    exclusion_reason: null,
    induction_group: 'racional',
    status: 'completed',
    mc_reported_induction: 'Razón',
    mc_emotion_usage: 2,
    mc_reason_usage: 4,
    ...overrides,
  };
}

function responsesFor(p: { id: string; therapeutic_orientation: string }, falseMemories: number) {
  // 8 fake news of the participant's set (the first `falseMemories` clearly remembered,
  // the rest "creo que sucedió") and 12 true news (all clearly remembered).
  const fakeIds = p.therapeutic_orientation === 'Psicoanálisis' ? PSA_CONGRUENT_FAKE_IDS : EBP_CONGRUENT_FAKE_IDS;
  return Array.from({ length: 20 }, (_, i) => {
    const isFake = i < 8;
    const remembered = isFake ? i < falseMemories : true;
    return {
      participant_id: p.id,
      news_id: isFake ? fakeIds[i] : i - 7,
      response_option: remembered ? 1 : 2,
      is_fake: isFake,
      is_false_memory: isFake && remembered,
      is_false_belief: isFake && !remembered,
      is_true_memory: !isFake && remembered,
      reading_time_ms: 15000,
      response_time_ms: 2000,
    };
  });
}

describe('fetchAllRows', () => {
  test('reads past the 1000-row page limit', async () => {
    const table = Array.from({ length: 2345 }, (_, i) => ({ n: i }));
    const calls: [number, number][] = [];
    const rows = await fetchAllRows(async (from, to) => {
      calls.push([from, to]);
      return { data: table.slice(from, to + 1), error: null };
    });
    assert.equal(rows.length, 2345);
    assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
    assert.equal((rows[2344] as { n: number }).n, 2344);
  });

  test('asks for one more page when the last one is exactly full', async () => {
    const table = Array.from({ length: 2000 }, (_, i) => i);
    let calls = 0;
    const rows = await fetchAllRows(async (from, to) => {
      calls += 1;
      return { data: table.slice(from, to + 1), error: null };
    });
    assert.equal(rows.length, 2000);
    assert.equal(calls, 3);
  });

  test('throws the database error instead of returning partial data', async () => {
    const dbError = { code: '57014', message: 'canceling statement due to statement timeout' };
    await assert.rejects(
      fetchAllRows(async (from) =>
        from === 0 ? { data: new Array(1000).fill(0), error: null } : { data: null, error: dbError }
      ),
      (err) => err === dbError
    );
  });
});

describe('exportFileDate', () => {
  test('uses the Buenos Aires date, not the UTC one', () => {
    // 01:30 UTC on the 17th is still 22:30 of the 16th in Buenos Aires (UTC-3).
    assert.equal(exportFileDate(new Date('2026-10-17T01:30:00Z')), '2026-10-16');
    assert.equal(exportFileDate(new Date('2026-10-17T03:00:00Z')), '2026-10-17');
  });
});

describe('buildAdminStats', () => {
  const racional1 = participant({ induction_group: 'racional', age: 20 });
  const racional2 = participant({ induction_group: 'racional', age: 30, mc_reported_induction: 'Emoción' });
  const emocional = participant({
    induction_group: 'emocional',
    age: 25,
    mc_reported_induction: 'Razón',
    mc_emotion_usage: 3,
    mc_reason_usage: 5,
    therapeutic_orientation: 'Basada en Evidencia Científica',
    residence: null,
  });
  const controlInProgress = participant({
    induction_group: 'control',
    status: 'started',
    completed_at: null,
    mc_reported_induction: null,
    mc_emotion_usage: null,
    mc_reason_usage: null,
  });
  const excluded = participant({
    is_included: false,
    exclusion_reason: 'no_estudia_psicologia',
    induction_group: 'control',
    age: 60,
    gender: 'Masculino',
  });
  const abandoned = participant({
    is_included: false,
    exclusion_reason: 'session_timeout_1h',
    induction_group: 'emocional',
    status: 'abandoned',
    completed_at: null,
  });
  const participants = [racional1, racional2, emocional, controlInProgress, excluded, abandoned];
  const responses = [
    ...responsesFor(racional1, 4),
    ...responsesFor(racional2, 2),
    ...responsesFor(emocional, 8),
    ...responsesFor(excluded, 8), // excluded: must not count in the KPIs
  ];
  const stats = buildAdminStats(participants, responses);

  test('counts the analysed sample (included and completed) per group, with targets', () => {
    assert.equal(stats.analysedParticipants, 3);
    assert.deepEqual(stats.groupProgress, {
      racional: { analysed: 2, inProgress: 0 },
      emocional: { analysed: 1, inProgress: 0 },
      control: { analysed: 0, inProgress: 1 },
    });
    assert.deepEqual(stats.targets, { minPerGroup: MIN_PER_GROUP, idealPerGroup: IDEAL_PER_GROUP });
    assert.equal(stats.targets.minPerGroup, 25);
    assert.equal(stats.targets.idealPerGroup, 30);
    assert.equal(stats.inProgressParticipants, 1);
    assert.equal(stats.maxDiscrepancy, 2);
    assert.equal(stats.isBalanced, true);
  });

  test('keeps the overall counts over every participant', () => {
    assert.equal(stats.totalParticipants, 6);
    assert.equal(stats.completedParticipants, 4);
    assert.equal(stats.includedParticipants, 4);
    assert.equal(stats.excludedParticipants, 2);
    assert.deepEqual(stats.exclusionBreakdown, { no_estudia_psicologia: 1, session_timeout_1h: 1 });
  });

  test('computes the KPIs only over the analysed sample, without reading time', () => {
    // (4 + 2 + 8) false memories over 3 x 8 fake news.
    assert.equal(stats.kpis.overall.falseMemoryRate, (14 / 24) * 100);
    assert.equal(stats.kpis.byGroup.racional.falseMemoryRate, (6 / 16) * 100);
    assert.equal(stats.kpis.byGroup.emocional.falseMemoryRate, 100);
    assert.equal(stats.kpis.byGroup.control.falseMemoryRate, 0);
    assert.equal(stats.kpis.overall.trueMemoryRate, 100);
    assert.equal(stats.kpis.overall.avgResponseTimeMs, 2000);
    assert.equal('avgReadingTimeMs' in stats.kpis.overall, false);
  });

  test('crosses the assigned group with the reported induction', () => {
    assert.deepEqual(stats.manipulationCheck.reportedByGroup, {
      racional: { Razón: 1, Emoción: 1 },
      emocional: { Razón: 1 },
    });
    assert.deepEqual(stats.manipulationCheck.scoresByGroup.racional, {
      n: 2,
      avgEmotionUsage: 2,
      avgReasonUsage: 4,
    });
    assert.equal(stats.manipulationCheck.scoresByGroup.control.n, 0);
  });

  test('describes the analysed sample with the sample standard deviation', () => {
    assert.deepEqual(stats.demographics.age, { mean: 25, sd: 5, min: 20, max: 30 });
    assert.deepEqual(stats.demographics.gender, { Femenino: 3 });
    assert.deepEqual(stats.demographics.orientation, { Psicoanálisis: 2, 'Cognitivo-Conductual': 1 });
    assert.deepEqual(stats.demographics.residence, { 'Provincia de Buenos Aires': 2, 'Sin dato': 1 });
  });

  test('lists every participant with start date and residence', () => {
    assert.equal(stats.participantsList.length, 6);
    const row = stats.participantsList.find((p) => p.id === String(emocional.id).substring(0, 8));
    assert.ok(row);
    assert.equal(row.createdAt, '2026-10-10T12:00:00Z');
    assert.equal(row.residence, null);
    assert.equal(row.therapeuticOrientation, 'Cognitivo-Conductual');
  });

  test('runs no inferential test while a group has fewer than 3 participants', () => {
    assert.equal(stats.inferential.preliminary, true);
    assert.deepEqual(
      stats.inferential.analyses.map((a) => a.hypothesis),
      ['H1', 'C1', 'C2', 'C3', 'Control de la manipulación', 'Control de la manipulación']
    );
    assert.ok(stats.inferential.analyses.every((a) => a.result === null));
  });

  test('feeds each participant\'s counts and mean response time to the group comparison', () => {
    const groupOf = ['racional', 'emocional', 'control'] as const;
    const falseMemoriesByGroup = { racional: [1, 2, 3], emocional: [5, 6, 8], control: [0, 2, 1] };
    const ps: ReturnType<typeof participant>[] = [];
    const rs: ReturnType<typeof responsesFor> = [];
    for (const group of groupOf) {
      for (const count of falseMemoriesByGroup[group]) {
        const p = participant({ induction_group: group });
        ps.push(p);
        rs.push(...responsesFor(p, count));
      }
    }
    const result = buildAdminStats(ps, rs);
    const h1 = result.inferential.analyses.find((a) => a.key === 'falseMemories')!;
    assert.ok(h1.result);
    assert.deepEqual(h1.result.groups.map((g) => [g.name, g.n, g.mean]), [
      ['racional', 3, 2],
      ['emocional', 3, 19 / 3],
      ['control', 3, 1],
    ]);
    assert.deepEqual(
      h1.result.postHoc.comparisons.map((c) => `${c.a}-${c.b}`),
      ['emocional-racional', 'emocional-control', 'racional-control']
    );
    const rt = result.inferential.analyses.find((a) => a.key === 'responseTime')!;
    assert.equal(rt.result!.groups[0].mean, 2);
    assert.equal(result.inferential.preliminary, true);
  });

  test('returns zeros, not NaN, with no data', () => {
    const empty = buildAdminStats([], []);
    assert.equal(empty.analysedParticipants, 0);
    assert.equal(empty.completionRate, 0);
    assert.equal(empty.kpis.overall.falseMemoryRate, 0);
    assert.deepEqual(empty.demographics.age, { mean: 0, sd: 0, min: 0, max: 0 });
    assert.equal(empty.isBalanced, true);
    assert.deepEqual(empty.descriptive.groupEquivalence.total.age, { n: 0, mean: 0, sd: 0 });
    assert.equal(empty.descriptive.falseMemoryDistribution.control.quartiles, null);
    assert.equal(empty.descriptive.dataQuality.sessionDurationMs, null);
    assert.equal(empty.descriptive.items.length, 28);
    assert.ok(empty.descriptive.items.every((item) => item.options.every((count) => count === 0)));
  });

  describe('descriptive statistics', () => {
    const d = stats.descriptive;

    test('profiles each group and the whole analysed sample', () => {
      assert.equal(d.groupEquivalence.total.n, 3);
      assert.deepEqual(d.groupEquivalence.total.age, { n: 3, mean: 25, sd: 5 });
      assert.equal(d.groupEquivalence.racional.age.mean, 25);
      assert.ok(Math.abs(d.groupEquivalence.racional.age.sd - Math.sqrt(50)) < 1e-12);
      assert.deepEqual(d.groupEquivalence.racional.orientation, { Psicoanálisis: 2 });
      assert.deepEqual(d.groupEquivalence.emocional.orientation, { 'Cognitivo-Conductual': 1 });
      assert.deepEqual(d.groupEquivalence.control, { n: 0, age: { n: 0, mean: 0, sd: 0 }, gender: {}, orientation: {} });
    });

    test('counts participants by number of false memories', () => {
      const racional = d.falseMemoryDistribution.racional;
      assert.deepEqual(racional.histogram, [0, 0, 1, 0, 1, 0, 0, 0, 0]);
      assert.equal(racional.atLeastOne, 2);
      assert.deepEqual(racional.quartiles, { n: 2, q1: 2.5, median: 3, q3: 3.5 });
      assert.deepEqual(d.falseMemoryDistribution.emocional.histogram, [0, 0, 0, 0, 0, 0, 0, 0, 1]);
      assert.deepEqual(d.falseMemoryDistribution.control, {
        n: 0,
        histogram: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        atLeastOne: 0,
        quartiles: null,
      });
    });

    test('splits the response options by news type, without excluded participants', () => {
      // racional: (4 + 2) fake news clearly remembered, (4 + 6) "creo que sucedió".
      assert.deepEqual(d.responseDistribution.racional, { fake: [6, 10, 0, 0], true: [24, 0, 0, 0] });
      assert.deepEqual(d.responseDistribution.emocional, { fake: [8, 0, 0, 0], true: [12, 0, 0, 0] });
      assert.deepEqual(d.responseDistribution.control, { fake: [0, 0, 0, 0], true: [0, 0, 0, 0] });
    });

    test('describes false memories by orientation and group', () => {
      assert.deepEqual(
        d.falseMemoriesByOrientation.map((row) => row.orientation),
        ['Psicoanálisis', 'Cognitivo-Conductual']
      );
      const [psa, cc] = d.falseMemoriesByOrientation;
      assert.equal(psa.byGroup.racional.mean, 3);
      assert.ok(Math.abs(psa.byGroup.racional.sd - Math.SQRT2) < 1e-12);
      assert.deepEqual(psa.byGroup.emocional, { n: 0, mean: 0, sd: 0 });
      assert.deepEqual(cc.byGroup.emocional, { n: 1, mean: 8, sd: 0 });
      assert.deepEqual(cc.total, { n: 1, mean: 8, sd: 0 });
    });

    test('flags incomplete and same-option participants and times the session', () => {
      // The emocional participant answered option 1 to all 20 news.
      assert.deepEqual(d.dataQuality.incompleteIds, []);
      assert.deepEqual(d.dataQuality.sameOptionIds, [String(emocional.id).substring(0, 8)]);
      assert.deepEqual(d.dataQuality.sessionDurationMs, { n: 3, q1: 1200000, median: 1200000, q3: 1200000 });

      const p = participant();
      const partial = buildAdminStats([p], responsesFor(p, 3).slice(0, 19));
      assert.deepEqual(partial.descriptive.dataQuality.incompleteIds, [String(p.id).substring(0, 8)]);
    });

    test('lists true news, then each fake news set, with clear memories by group', () => {
      assert.deepEqual(
        d.items.map((item) => item.id),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, ...PSA_CONGRUENT_FAKE_IDS, ...EBP_CONGRUENT_FAKE_IDS]
      );
      const byId = new Map(d.items.map((item) => [item.id, item]));
      assert.deepEqual(byId.get(1)!.options, [3, 0, 0, 0]);
      assert.equal(byId.get(1)!.set, null);
      // Fake news 18 is the 3rd of the psychoanalysis set: only racional1 (4 false memories) remembers it.
      assert.equal(byId.get(18)!.set, 'Psicoanálisis');
      assert.deepEqual(byId.get(18)!.options, [1, 1, 0, 0]);
      assert.deepEqual(byId.get(18)!.byGroup, {
        racional: { shown: 2, clearMemory: 1 },
        emocional: { shown: 0, clearMemory: 0 },
        control: { shown: 0, clearMemory: 0 },
      });
      assert.equal(byId.get(13)!.set, 'Cognitivo-Conductual');
      assert.deepEqual(byId.get(13)!.byGroup.emocional, { shown: 1, clearMemory: 1 });
    });

    test('takes each participant\'s median response time before describing the group', () => {
      const a = participant();
      const b = participant();
      const withTimes = (p: ReturnType<typeof participant>, fakeMs: number[], trueMs: number) =>
        responsesFor(p, 0).map((r, i) => ({ ...r, response_time_ms: r.is_fake ? fakeMs[i] : trueMs }));
      // One fake news left open for 10 minutes does not move a's median.
      const rs = [
        ...withTimes(a, [4000, 4000, 4000, 4000, 4000, 4000, 4000, 600000], 2000),
        ...withTimes(b, new Array(8).fill(6000), 3000),
      ];
      const rt = buildAdminStats([a, b], rs).descriptive.responseTimeMs.racional;
      assert.deepEqual(rt.fake, { n: 2, q1: 4500, median: 5000, q3: 5500 });
      assert.deepEqual(rt.true, { n: 2, q1: 2250, median: 2500, q3: 2750 });
      assert.deepEqual(rt.all, { n: 2, q1: 2250, median: 2500, q3: 2750 });
    });
  });
});

describe('quartiles', () => {
  test('interpolates linearly between order statistics, like R and numpy', () => {
    assert.deepEqual(quartiles([4, 1, 3, 2]), { n: 4, q1: 1.75, median: 2.5, q3: 3.25 });
    assert.deepEqual(quartiles([7]), { n: 1, q1: 7, median: 7, q3: 7 });
    assert.equal(quartiles([]), null);
  });
});
