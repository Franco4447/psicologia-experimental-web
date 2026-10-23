/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Admin dashboard: paged reads from Supabase and the statistics shown in /admin.
 * Target location: src/lib/adminStats.ts
 *
 * The "analysed sample" is every participant who is included and completed the
 * session: it is the sample the report analyses and the one the group targets count.
 */

import type { AdminDashboardStats, InductionGroup, MeanSd, Quartiles } from '@/types/experiment';
import type { ParticipantRow, ResponseRow } from '@/lib/supabase';
import { ALPHA, compareGroups, median } from '@/lib/inferential';
import { STIMULI } from '@/data/stimuli';

/** Included and completed participants each group needs (team decision, 2026-10-16). */
export const MIN_PER_GROUP = 25;
export const IDEAL_PER_GROUP = 30;

/** PostgREST returns at most this many rows per request. */
export const SUPABASE_PAGE_SIZE = 1000;

const GROUPS: InductionGroup[] = ['racional', 'emocional', 'control'];
const IN_PROGRESS_STATUSES = new Set(['started', 'reading']);

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Reads every row of a query page by page, so results past the PostgREST row
 * limit are not silently dropped. The query must have a stable order.
 * Throws the first database error.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PageResult<T>,
  pageSize: number = SUPABASE_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

/** Date for export file names, in Buenos Aires time (YYYY-MM-DD). */
export function exportFileDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** The platform called the evidence-based option by its former name until 2026-10-02. */
function orientationLabel(orientation: string): string {
  return orientation === 'Basada en Evidencia Científica' ? 'Cognitivo-Conductual' : orientation;
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    if (value) counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function meanSd(values: number[]): MeanSd {
  const m = mean(values);
  const sd =
    values.length > 1
      ? Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1))
      : 0;
  return { n: values.length, mean: m, sd };
}

/** Quartiles by linear interpolation between order statistics (R type 7). */
export function quartiles(values: number[]): Quartiles | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => {
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.min(lo + 1, sorted.length - 1);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  };
  return { n: sorted.length, q1: at(0.25), median: at(0.5), q3: at(0.75) };
}

type ResponseFlag = 'is_false_memory' | 'is_false_belief' | 'is_true_memory';

function calcKpis(responses: ResponseRow[]) {
  const fake = responses.filter((r) => r.is_fake);
  const real = responses.filter((r) => !r.is_fake);
  const rate = (subset: ResponseRow[], flag: ResponseFlag) =>
    subset.length > 0 ? (subset.filter((r) => r[flag]).length / subset.length) * 100 : 0;
  return {
    falseMemoryRate: rate(fake, 'is_false_memory'),
    falseBeliefRate: rate(fake, 'is_false_belief'),
    trueMemoryRate: rate(real, 'is_true_memory'),
    avgResponseTimeMs: mean(responses.map((r) => r.response_time_ms || 0)),
  };
}

/** Variables compared across groups, in the order of the report's analysis plan. */
const INFERENTIAL_VARIABLES: {
  key: string;
  label: string;
  hypothesis: string;
  scale: string;
  value: (p: ParticipantRow, responses: ResponseRow[]) => number | null;
}[] = [
  {
    key: 'falseMemories',
    label: 'Falsos recuerdos',
    hypothesis: 'H1',
    scale: '0-8',
    value: (_, rs) => rs.filter((r) => r.is_false_memory).length,
  },
  {
    key: 'falseBeliefs',
    label: 'Falsas creencias',
    hypothesis: 'C1',
    scale: '0-8',
    value: (_, rs) => rs.filter((r) => r.is_false_belief).length,
  },
  {
    key: 'trueMemories',
    label: 'Recuerdos verdaderos',
    hypothesis: 'C2',
    scale: '0-12',
    value: (_, rs) => rs.filter((r) => r.is_true_memory).length,
  },
  {
    key: 'responseTime',
    label: 'Tiempo de respuesta promedio (s)',
    hypothesis: 'C3',
    scale: 'segundos',
    value: (_, rs) => (rs.length > 0 ? mean(rs.map((r) => r.response_time_ms)) / 1000 : null),
  },
  {
    key: 'emotionUsage',
    label: 'Uso de emoción',
    hypothesis: 'Control de la manipulación',
    scale: '1-5',
    value: (p) => p.mc_emotion_usage,
  },
  {
    key: 'reasonUsage',
    label: 'Uso de razón',
    hypothesis: 'Control de la manipulación',
    scale: '1-5',
    value: (p) => p.mc_reason_usage,
  },
];

// Emocional against the other two first: those are the comparisons H1 predicts.
const COMPARISON_PAIRS: [number, number][] = [
  [GROUPS.indexOf('emocional'), GROUPS.indexOf('racional')],
  [GROUPS.indexOf('emocional'), GROUPS.indexOf('control')],
  [GROUPS.indexOf('racional'), GROUPS.indexOf('control')],
];

function groupByParticipant(responses: ResponseRow[]): Map<string, ResponseRow[]> {
  const byParticipant = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const list = byParticipant.get(r.participant_id);
    if (list) list.push(r);
    else byParticipant.set(r.participant_id, [r]);
  }
  return byParticipant;
}

function buildInferential(
  analysed: ParticipantRow[],
  byParticipant: Map<string, ResponseRow[]>,
  preliminary: boolean
): AdminDashboardStats['inferential'] {
  return {
    alpha: ALPHA,
    preliminary,
    analyses: INFERENTIAL_VARIABLES.map((variable) => {
      const named = GROUPS.map((group) => ({
        name: group,
        values: analysed
          .filter((p) => p.induction_group === group)
          .map((p) => variable.value(p, byParticipant.get(p.id) || []))
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
      }));
      return {
        key: variable.key,
        label: variable.label,
        hypothesis: variable.hypothesis,
        scale: variable.scale,
        result: compareGroups(named, COMPARISON_PAIRS),
      };
    }),
  };
}

const NEWS_PER_PARTICIPANT = 20;
const FAKE_NEWS_PER_PARTICIPANT = 8;
const RESPONSE_OPTIONS = [1, 2, 3, 4];

/** Fake news sets by the orientation that sees them (src/data/stimuli.ts). */
const FAKE_SET_LABELS: Record<string, string> = {
  psicoanalisis: 'Psicoanálisis',
  evidencia: 'Cognitivo-Conductual',
};
const ORIENTATION_ORDER = ['Psicoanálisis', 'Cognitivo-Conductual'];

function byOrientationOrder(a: string, b: string): number {
  const rank = (o: string) => (ORIENTATION_ORDER.includes(o) ? ORIENTATION_ORDER.indexOf(o) : ORIENTATION_ORDER.length);
  return rank(a) - rank(b) || a.localeCompare(b);
}

function optionCounts(responses: ResponseRow[]): number[] {
  return RESPONSE_OPTIONS.map((option) => responses.filter((r) => r.response_option === option).length);
}

function buildDescriptive(
  analysed: ParticipantRow[],
  byParticipant: Map<string, ResponseRow[]>
): AdminDashboardStats['descriptive'] {
  const responsesOf = (p: ParticipantRow) => byParticipant.get(p.id) || [];
  const falseMemoriesOf = (p: ParticipantRow) => responsesOf(p).filter((r) => r.is_false_memory).length;
  const orientationOf = (p: ParticipantRow) => orientationLabel(p.therapeutic_orientation);
  const shortId = (p: ParticipantRow) => String(p.id).substring(0, 8);
  const membersByGroup = {} as Record<InductionGroup, ParticipantRow[]>;
  for (const group of GROUPS) membersByGroup[group] = analysed.filter((p) => p.induction_group === group);

  const profile = (members: ParticipantRow[]) => ({
    n: members.length,
    age: meanSd(members.map((p) => p.age).filter((a): a is number => typeof a === 'number')),
    gender: countBy(members, (p) => p.gender),
    orientation: countBy(members, (p) => p.therapeutic_orientation && orientationOf(p)),
  });
  const groupEquivalence = { total: profile(analysed) } as AdminDashboardStats['descriptive']['groupEquivalence'];

  const falseMemoryDistribution = {} as AdminDashboardStats['descriptive']['falseMemoryDistribution'];
  const responseDistribution = {} as AdminDashboardStats['descriptive']['responseDistribution'];
  const responseTimeMs = {} as AdminDashboardStats['descriptive']['responseTimeMs'];

  // Each participant's median, so one trial left open for minutes does not weigh in.
  const medianTimes = (members: ParticipantRow[], keep: (r: ResponseRow) => boolean) =>
    quartiles(
      members
        .map((p) => responsesOf(p).filter(keep).map((r) => r.response_time_ms))
        .filter((times) => times.length > 0)
        .map(median)
    );

  for (const group of GROUPS) {
    const members = membersByGroup[group];
    groupEquivalence[group] = profile(members);

    const counts = members.map(falseMemoriesOf);
    const histogram: number[] = new Array(Math.max(FAKE_NEWS_PER_PARTICIPANT, ...counts) + 1).fill(0);
    for (const count of counts) histogram[count] += 1;
    falseMemoryDistribution[group] = {
      n: members.length,
      histogram,
      atLeastOne: counts.filter((count) => count > 0).length,
      quartiles: quartiles(counts),
    };

    const groupResponses = members.flatMap(responsesOf);
    responseDistribution[group] = {
      fake: optionCounts(groupResponses.filter((r) => r.is_fake)),
      true: optionCounts(groupResponses.filter((r) => !r.is_fake)),
    };

    responseTimeMs[group] = {
      fake: medianTimes(members, (r) => r.is_fake),
      true: medianTimes(members, (r) => !r.is_fake),
      all: medianTimes(members, () => true),
    };
  }

  const orientations = Array.from(new Set(analysed.map(orientationOf).filter(Boolean))).sort(byOrientationOrder);
  const falseMemoriesByOrientation = orientations.map((orientation) => {
    const byGroup = {} as Record<InductionGroup, MeanSd>;
    for (const group of GROUPS) {
      byGroup[group] = meanSd(membersByGroup[group].filter((p) => orientationOf(p) === orientation).map(falseMemoriesOf));
    }
    return {
      orientation,
      byGroup,
      total: meanSd(analysed.filter((p) => orientationOf(p) === orientation).map(falseMemoriesOf)),
    };
  });

  const durations = analysed
    .map((p) => (p.created_at && p.completed_at ? Date.parse(p.completed_at) - Date.parse(p.created_at) : NaN))
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const groupOf = new Map(analysed.map((p) => [p.id, p.induction_group]));
  const analysedResponses = analysed.flatMap(responsesOf);
  const items = STIMULI.map((stimulus) => {
    const shown = analysedResponses.filter((r) => r.news_id === stimulus.id);
    const byGroup = {} as Record<InductionGroup, { shown: number; clearMemory: number }>;
    for (const group of GROUPS) {
      const inGroup = shown.filter((r) => groupOf.get(r.participant_id) === group);
      byGroup[group] = { shown: inGroup.length, clearMemory: inGroup.filter((r) => r.response_option === 1).length };
    }
    return {
      id: stimulus.id,
      title: stimulus.title,
      isFake: stimulus.isFake,
      set: stimulus.isFake ? FAKE_SET_LABELS[stimulus.congruence] || stimulus.congruence : null,
      options: optionCounts(shown),
      byGroup,
    };
  }).sort(
    (a, b) =>
      Number(a.isFake) - Number(b.isFake) || byOrientationOrder(a.set || '', b.set || '') || a.id - b.id
  );

  return {
    groupEquivalence,
    dataQuality: {
      incompleteIds: analysed.filter((p) => responsesOf(p).length < NEWS_PER_PARTICIPANT).map(shortId),
      sameOptionIds: analysed
        .filter((p) => {
          const rs = responsesOf(p);
          return rs.length > 1 && rs.every((r) => r.response_option === rs[0].response_option);
        })
        .map(shortId),
      sessionDurationMs: quartiles(durations),
    },
    falseMemoryDistribution,
    responseDistribution,
    falseMemoriesByOrientation,
    responseTimeMs,
    items,
  };
}

export function buildAdminStats(
  participants: ParticipantRow[],
  responses: ResponseRow[]
): AdminDashboardStats {
  const analysed = participants.filter((p) => p.is_included && p.status === 'completed');
  const analysedIds = new Set(analysed.map((p) => p.id));
  const analysedResponses = responses.filter((r) => analysedIds.has(r.participant_id));
  const responsesByParticipant = groupByParticipant(analysedResponses);
  const completed = participants.filter((p) => p.status === 'completed');

  const groupProgress = {} as AdminDashboardStats['groupProgress'];
  for (const group of GROUPS) {
    groupProgress[group] = {
      analysed: analysed.filter((p) => p.induction_group === group).length,
      inProgress: participants.filter(
        (p) => p.is_included && p.induction_group === group && IN_PROGRESS_STATUSES.has(p.status)
      ).length,
    };
  }
  const analysedCounts = GROUPS.map((g) => groupProgress[g].analysed);
  const maxDiscrepancy = Math.max(...analysedCounts) - Math.min(...analysedCounts);

  const kpisByGroup: AdminDashboardStats['kpis']['byGroup'] = {};
  const scoresByGroup: AdminDashboardStats['manipulationCheck']['scoresByGroup'] = {};
  for (const group of GROUPS) {
    const members = analysed.filter((p) => p.induction_group === group);
    const ids = new Set(members.map((p) => p.id));
    kpisByGroup[group] = calcKpis(analysedResponses.filter((r) => ids.has(r.participant_id)));

    const answered = members.filter(
      (p) => typeof p.mc_emotion_usage === 'number' && typeof p.mc_reason_usage === 'number'
    );
    scoresByGroup[group] = {
      n: answered.length,
      avgEmotionUsage: mean(answered.map((p) => p.mc_emotion_usage as number)),
      avgReasonUsage: mean(answered.map((p) => p.mc_reason_usage as number)),
    };
  }

  // Only the induction groups answer the forced choice (Emoción / Razón).
  const reportedByGroup: AdminDashboardStats['manipulationCheck']['reportedByGroup'] = {};
  for (const group of ['racional', 'emocional'] as const) {
    reportedByGroup[group] = countBy(
      analysed.filter((p) => p.induction_group === group),
      (p) => p.mc_reported_induction
    );
  }

  const ages = analysed.map((p) => p.age).filter((a): a is number => typeof a === 'number');
  const age = meanSd(ages);

  return {
    totalParticipants: participants.length,
    completedParticipants: completed.length,
    includedParticipants: participants.filter((p) => p.is_included).length,
    excludedParticipants: participants.filter((p) => !p.is_included).length,
    completionRate: participants.length > 0 ? (completed.length / participants.length) * 100 : 0,
    inProgressParticipants: participants.filter((p) => IN_PROGRESS_STATUSES.has(p.status)).length,
    analysedParticipants: analysed.length,
    targets: { minPerGroup: MIN_PER_GROUP, idealPerGroup: IDEAL_PER_GROUP },
    groupProgress,
    isBalanced: maxDiscrepancy <= 2,
    maxDiscrepancy,

    participantsList: participants.map((p) => ({
      id: String(p.id).substring(0, 8),
      createdAt: p.created_at || null,
      age: p.age,
      gender: p.gender,
      residence: p.residence || null,
      therapeuticOrientation: orientationLabel(p.therapeutic_orientation),
      inductionGroup: p.induction_group,
      status: p.status,
      isIncluded: p.is_included,
      exclusionReason: p.exclusion_reason || null,
      completedAt: p.completed_at || null,
    })),

    exclusionBreakdown: countBy(
      participants.filter((p) => !p.is_included),
      (p) => p.exclusion_reason
    ),

    kpis: { overall: calcKpis(analysedResponses), byGroup: kpisByGroup },

    manipulationCheck: { reportedByGroup, scoresByGroup },

    demographics: {
      age: {
        mean: age.mean,
        sd: age.sd,
        min: ages.length > 0 ? Math.min(...ages) : 0,
        max: ages.length > 0 ? Math.max(...ages) : 0,
      },
      gender: countBy(analysed, (p) => p.gender),
      orientation: countBy(analysed, (p) => p.therapeutic_orientation && orientationLabel(p.therapeutic_orientation)),
      // Participants registered before the residence question have no value.
      residence: countBy(analysed, (p) => p.residence || 'Sin dato'),
    },

    descriptive: buildDescriptive(analysed, responsesByParticipant),

    inferential: buildInferential(
      analysed,
      responsesByParticipant,
      analysedCounts.some((count) => count < MIN_PER_GROUP)
    ),
  };
}
