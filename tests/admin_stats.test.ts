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
} from '../src/lib/adminStats.ts';

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

function responsesFor(p: { id: string }, falseMemories: number) {
  // 8 fake news (the first `falseMemories` remembered) and 12 true news (all remembered).
  return Array.from({ length: 20 }, (_, i) => {
    const isFake = i < 8;
    const remembered = isFake ? i < falseMemories : true;
    return {
      participant_id: p.id,
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

  test('returns zeros, not NaN, with no data', () => {
    const empty = buildAdminStats([], []);
    assert.equal(empty.analysedParticipants, 0);
    assert.equal(empty.completionRate, 0);
    assert.equal(empty.kpis.overall.falseMemoryRate, 0);
    assert.deepEqual(empty.demographics.age, { mean: 0, sd: 0, min: 0, max: 0 });
    assert.equal(empty.isBalanced, true);
  });
});
