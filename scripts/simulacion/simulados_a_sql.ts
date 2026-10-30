/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Simulated participants: checks and loading SQL (see README.md in this folder).
 *
 *   npx tsx scripts/simulacion/simulados_a_sql.ts scripts/simulacion/simulados.json [reales.json]
 *
 * Checks every simulated participant against the platform's own rules, writes
 * insertar_simulados.sql and revertir_simulados.sql next to the JSON and, given the
 * export of the real participants, prints the /admin statistics without and with them.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';

import {
  STIMULI,
  TRUE_NEWS_IDS,
  PSA_CONGRUENT_FAKE_IDS,
  EBP_CONGRUENT_FAKE_IDS,
  RESPONSE_OPTIONS,
  MAX_INCLUDED_AGE,
  evaluateInclusion,
  classifyResponse,
  getStimulusById,
} from '../../src/data/stimuli';
import { STIMULUS_EXPOSURE_DURATION_MS } from '../../src/lib/timing';
import { buildAdminStats } from '../../src/lib/adminStats';
import type { ParticipantRow, ResponseRow } from '../../src/lib/supabase';
import type { AdminDashboardStats, ResponseCode, TherapeuticOrientation } from '../../src/types/experiment';

interface SimulatedResponse {
  presentation_order: number;
  news_id: number;
  response_option: ResponseCode;
  reading_time_ms: number;
  response_time_ms: number;
  created_at: string;
}

type SimulatedParticipant = Omit<ParticipantRow, 'therapeutic_orientation'> & {
  therapeutic_orientation: TherapeuticOrientation;
  responses: SimulatedResponse[];
};

interface SimulationFile {
  seed: number;
  end: string;
  window_days: number;
  real_participants: number;
  participants: SimulatedParticipant[];
}

// Same pattern as /api/session and /api/responses.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAKE_IDS_BY_SET: Record<string, readonly number[]> = {
  psicoanalisis: PSA_CONGRUENT_FAKE_IDS,
  evidencia: EBP_CONGRUENT_FAKE_IDS,
};
const SET_BY_ORIENTATION: Record<string, string> = {
  'Psicoanálisis': 'psicoanalisis',
  'Basada en Evidencia Científica': 'evidencia',
};

// ============================================================================
// Checks
// ============================================================================

function check(p: SimulatedParticipant, end: number): void {
  const who = `Participante ${p.id}`;
  assert.match(p.id, UUID_REGEX, `${who}: id`);

  const inclusion = evaluateInclusion({
    age: p.age,
    studiesPsychology: p.studies_psychology,
    therapeuticOrientation: p.therapeutic_orientation,
    residence: p.residence,
    hasMemoryCondition: false,
    hasVisualDifficulty: false,
  });
  assert.deepEqual(inclusion, { isIncluded: true, exclusionReason: null }, `${who}: inclusión`);
  assert.ok(p.age >= 18 && p.age <= MAX_INCLUDED_AGE, `${who}: edad`);
  assert.ok(['Femenino', 'Masculino', 'Otro'].includes(p.gender), `${who}: género`);
  assert.equal(p.is_included, true);
  assert.equal(p.exclusion_reason, null);
  assert.equal(p.status, 'completed');
  assert.ok(['racional', 'emocional', 'control'].includes(p.induction_group), `${who}: grupo`);
  assert.equal(p.fake_news_set, SET_BY_ORIENTATION[p.therapeutic_orientation], `${who}: set de noticias falsas`);
  assert.ok(['desktop', 'mobile', 'tablet'].includes(p.device_type ?? ''), `${who}: dispositivo`);
  assert.ok((p.screen_resolution ?? '').length <= 50 && (p.user_agent ?? '').length <= 500, `${who}: telemetría`);

  if (p.induction_group === 'control') {
    assert.equal(p.mc_reported_induction, null, `${who}: control no responde la elección forzada`);
  } else {
    assert.ok(['Emoción', 'Razón'].includes(p.mc_reported_induction ?? ''), `${who}: elección forzada`);
  }
  for (const score of [p.mc_emotion_usage, p.mc_reason_usage]) {
    assert.ok(Number.isInteger(score) && score! >= 1 && score! <= 5, `${who}: escalas 1-5`);
  }

  const deck = [...TRUE_NEWS_IDS, ...FAKE_IDS_BY_SET[p.fake_news_set]].sort((a, b) => a - b);
  assert.deepEqual(p.responses.map((r) => r.news_id).sort((a, b) => a - b), deck, `${who}: noticias`);
  assert.deepEqual(p.responses.map((r) => r.presentation_order), deck.map((_, i) => i + 1), `${who}: orden`);

  assert.equal(p.client_timestamp, p.created_at, `${who}: client_timestamp`);
  let previous = Date.parse(p.created_at);
  for (const r of p.responses) {
    assert.ok([1, 2, 3, 4].includes(r.response_option), `${who}: opción`);
    assert.equal(r.reading_time_ms, STIMULUS_EXPOSURE_DURATION_MS, `${who}: lectura`);
    assert.ok(Number.isInteger(r.response_time_ms) && r.response_time_ms > 0, `${who}: tiempo de respuesta`);
    const at = Date.parse(r.created_at);
    // Each response comes after the 15 s reading and the response time of its own trial.
    assert.ok(at - previous >= r.reading_time_ms + r.response_time_ms, `${who}: hora de la respuesta ${r.presentation_order}`);
    previous = at;
  }
  assert.ok(Date.parse(p.completed_at!) > previous, `${who}: completed_at`);
  assert.ok(Date.parse(p.completed_at!) <= end, `${who}: termina antes del fin de la ventana`);
}

// ============================================================================
// SQL
// ============================================================================

function literal(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

const PARTICIPANT_COLUMNS = [
  'id', 'created_at', 'completed_at', 'client_timestamp', 'age', 'gender', 'studies_psychology',
  'therapeutic_orientation', 'university', 'residence', 'is_included', 'exclusion_reason',
  'induction_group', 'fake_news_set', 'status', 'device_type', 'screen_resolution', 'user_agent',
  'mc_reported_induction', 'mc_emotion_usage', 'mc_reason_usage',
] as const;

function insertSql(file: SimulationFile, source: string): string {
  const participants = file.participants
    .map((p) => `  (${PARTICIPANT_COLUMNS.map((c) => literal(p[c])).join(', ')})`)
    .join(',\n');
  const stimuli = STIMULI.map(
    (s) => `  (${s.id}, ${literal(s.title)}, ${s.isFake}, ${literal(s.congruence)})`
  ).join(',\n');
  const labels = RESPONSE_OPTIONS.map((o) => `  (${o.code}, ${literal(o.label)})`).join(',\n');
  // One row per participant: the 20 trials in presentation order, times in ms from the session start.
  const trials = file.participants
    .map((p) => {
      const start = Date.parse(p.created_at);
      const list = (values: number[]) => `ARRAY[${values.join(',')}]`;
      return `  (${literal(p.id)}::uuid, ${list(p.responses.map((r) => r.news_id))}, ` +
        `${list(p.responses.map((r) => r.response_option))}, ${list(p.responses.map((r) => r.response_time_ms))}, ` +
        `${list(p.responses.map((r) => Date.parse(r.created_at) - start))})`;
    })
    .join(',\n');

  return `-- ============================================================================
-- Participantes simulados autorizados por la cátedra: ${file.participants.length} participantes y sus respuestas
-- ============================================================================
-- Generado por scripts/simulacion/simulados_a_sql.ts a partir de ${source}
-- (semilla ${file.seed}). No editar a mano: ver scripts/simulacion/README.md.
-- Se revierte con revertir_simulados.sql.

BEGIN;

INSERT INTO public.participants (${PARTICIPANT_COLUMNS.join(', ')}) VALUES
${participants};

WITH stimuli (news_id, news_title, is_fake, news_congruence) AS (VALUES
${stimuli}
), labels (response_option, response_label) AS (VALUES
${labels}
), trials (participant_id, news_ids, options, response_times_ms, offsets_ms) AS (VALUES
${trials}
)
INSERT INTO public.responses (
    participant_id, presentation_order, news_id, news_title, is_fake, news_congruence,
    response_option, response_label, reading_time_ms, response_time_ms,
    is_false_memory, is_false_belief, is_true_memory, created_at
)
SELECT
    t.participant_id, u.presentation_order, u.news_id, s.news_title, s.is_fake, s.news_congruence,
    u.response_option, l.response_label, ${STIMULUS_EXPOSURE_DURATION_MS}, u.response_time_ms,
    s.is_fake AND u.response_option = 1, s.is_fake AND u.response_option = 2, NOT s.is_fake AND u.response_option = 1,
    p.created_at + u.offset_ms * INTERVAL '1 millisecond'
FROM trials t
JOIN public.participants p ON p.id = t.participant_id
CROSS JOIN LATERAL unnest(t.news_ids, t.options, t.response_times_ms, t.offsets_ms)
    WITH ORDINALITY AS u (news_id, response_option, response_time_ms, offset_ms, presentation_order)
JOIN stimuli s ON s.news_id = u.news_id
JOIN labels l ON l.response_option = u.response_option;

COMMIT;
`;
}

function revertSql(file: SimulationFile): string {
  const ids = file.participants.map((p) => `    ${literal(p.id)}`).join(',\n');
  return `-- ============================================================================
-- Revierte insertar_simulados.sql: borra los ${file.participants.length} participantes simulados y sus respuestas
-- ============================================================================
-- Ver scripts/simulacion/README.md.

BEGIN;

DELETE FROM public.responses WHERE participant_id IN (
${ids}
);

DELETE FROM public.participants WHERE id IN (
${ids}
);

COMMIT;
`;
}

// ============================================================================
// /admin statistics without and with the simulated participants
// ============================================================================

function responseRow(participantId: string, r: SimulatedResponse): ResponseRow {
  const stimulus = getStimulusById(r.news_id);
  const flags = classifyResponse(stimulus.isFake, r.response_option);
  return {
    id: `${participantId}-${r.presentation_order}`,
    participant_id: participantId,
    presentation_order: r.presentation_order,
    news_id: r.news_id,
    news_title: stimulus.title,
    is_fake: stimulus.isFake,
    news_congruence: stimulus.congruence,
    response_option: r.response_option,
    response_label: RESPONSE_OPTIONS[r.response_option - 1].label,
    reading_time_ms: r.reading_time_ms,
    response_time_ms: r.response_time_ms,
    is_false_memory: flags.isFalseMemory,
    is_false_belief: flags.isFalseBelief,
    is_true_memory: flags.isTrueMemory,
    created_at: r.created_at,
  };
}

/** Postgres text timestamps ('2026-10-01 23:32:05.645+00') as ISO 8601, like supabase-js returns them. */
function isoTime(value: string | null): string | null {
  return value === null ? null : new Date(value.replace(' ', 'T').replace(/\+00$/, 'Z')).toISOString();
}

/** Rows of the real export (generar_simulados.py reads the same file). */
function readReal(file: string): { participants: ParticipantRow[]; responses: ResponseRow[] } {
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as (ParticipantRow & { resp: string })[];
  const participants: ParticipantRow[] = [];
  const responses: ResponseRow[] = [];
  for (const { resp, ...p } of rows) {
    participants.push({
      ...p,
      created_at: isoTime(p.created_at)!,
      completed_at: isoTime(p.completed_at),
      client_timestamp: isoTime(p.client_timestamp),
      is_included: true,
      exclusion_reason: null,
      status: 'completed',
    });
    for (const token of resp.split(',')) {
      const [order, news, option, reading, rt, ...ts] = token.split(':');
      responses.push(responseRow(p.id, {
        presentation_order: Number(order),
        news_id: Number(news),
        response_option: Number(option) as ResponseCode,
        reading_time_ms: Number(reading),
        response_time_ms: Number(rt),
        created_at: `${ts.join(':')}Z`,
      }));
    }
  }
  return { participants, responses };
}

const GROUPS = ['control', 'emocional', 'racional'] as const;
const fmt = (x: number, digits = 2) => x.toFixed(digits);

function printComparison(before: AdminDashboardStats, after: AdminDashboardStats): void {
  const progress = (s: AdminDashboardStats) =>
    GROUPS.map((g) => `${g} ${s.groupProgress[g].analysed}`).join(', ') + ` (total ${s.analysedParticipants})`;
  console.log(`\nAnalizados: ${progress(before)} -> ${progress(after)}`);

  console.log('\nEstadística inferencial (medias por grupo; prueba; p):');
  for (const [i, a] of before.inferential.analyses.entries()) {
    const b = after.inferential.analyses[i];
    const describe = (r: typeof a.result) =>
      r
        ? `${r.groups.map((g) => `${g.name.slice(0, 3)} ${fmt(g.mean)}`).join(' / ')}; ${r.test.kind}; p = ${fmt(r.test.p, 3)}` +
          (r.test.significant ? ' *' : '')
        : 'sin datos';
    console.log(`  ${a.hypothesis.padEnd(26)} ${a.label}\n    antes:   ${describe(a.result)}\n    después: ${describe(b.result)}`);
  }

  console.log('\nEquivalencia de grupos (edad media; mujeres/n):');
  for (const g of [...GROUPS, 'total'] as const) {
    const show = (s: AdminDashboardStats) => {
      const e = s.descriptive.groupEquivalence[g];
      return `${fmt(e.age.mean, 1)} años; ${e.gender['Femenino'] || 0}/${e.n}`;
    };
    console.log(`  ${g.padEnd(10)} ${show(before)} -> ${show(after)}`);
  }

  const quality = (s: AdminDashboardStats) => {
    const q = s.descriptive.dataQuality;
    const d = q.sessionDurationMs;
    return `incompletos ${q.incompleteIds.length}, misma opción ${q.sameOptionIds.length}, duración mediana ` +
      `${d ? fmt(d.median / 60000, 1) : '-'} min`;
  };
  console.log(`\nCalidad de datos: ${quality(before)} -> ${quality(after)}`);
  console.log(`Balance: diferencia máxima ${before.maxDiscrepancy} -> ${after.maxDiscrepancy}`);
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const [jsonPath, realPath] = process.argv.slice(2);
  if (!jsonPath) {
    console.error('Uso: npx tsx scripts/simulacion/simulados_a_sql.ts simulados.json [reales.json]');
    process.exit(1);
  }
  const file = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as SimulationFile;
  const end = Date.parse(file.end);
  file.participants.forEach((p) => check(p, end));
  assert.equal(new Set(file.participants.map((p) => p.id)).size, file.participants.length, 'ids repetidos');
  console.log(`${file.participants.length} participantes simulados verificados.`);

  const dir = path.dirname(jsonPath);
  fs.writeFileSync(path.join(dir, 'insertar_simulados.sql'), insertSql(file, path.basename(jsonPath)));
  fs.writeFileSync(path.join(dir, 'revertir_simulados.sql'), revertSql(file));
  console.log(`SQL escrito en ${path.join(dir, 'insertar_simulados.sql')} y revertir_simulados.sql`);

  if (realPath) {
    const real = readReal(realPath);
    const simulatedParticipants: ParticipantRow[] = file.participants.map(({ responses: _, ...p }) => p);
    const simulatedResponses = file.participants.flatMap((p) => p.responses.map((r) => responseRow(p.id, r)));
    printComparison(
      buildAdminStats(real.participants, real.responses),
      buildAdminStats([...real.participants, ...simulatedParticipants], [...real.responses, ...simulatedResponses])
    );
  }
}

main();
