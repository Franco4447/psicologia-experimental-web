/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Admin dashboard: paged reads from Supabase and the statistics shown in /admin.
 * Target location: src/lib/adminStats.ts
 *
 * The "analysed sample" is every participant who is included and completed the
 * session: it is the sample the report analyses and the one the group targets count.
 */

import type { AdminDashboardStats, InductionGroup } from '@/types/experiment';
import type { ParticipantRow, ResponseRow } from '@/lib/supabase';

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

export function buildAdminStats(
  participants: ParticipantRow[],
  responses: ResponseRow[]
): AdminDashboardStats {
  const analysed = participants.filter((p) => p.is_included && p.status === 'completed');
  const analysedIds = new Set(analysed.map((p) => p.id));
  const analysedResponses = responses.filter((r) => analysedIds.has(r.participant_id));
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
  const ageMean = mean(ages);
  const ageSd =
    ages.length > 1
      ? Math.sqrt(ages.reduce((sum, a) => sum + (a - ageMean) ** 2, 0) / (ages.length - 1))
      : 0;

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
        mean: ageMean,
        sd: ageSd,
        min: ages.length > 0 ? Math.min(...ages) : 0,
        max: ages.length > 0 ? Math.max(...ages) : 0,
      },
      gender: countBy(analysed, (p) => p.gender),
      orientation: countBy(analysed, (p) => p.therapeutic_orientation && orientationLabel(p.therapeutic_orientation)),
      // Participants registered before the residence question have no value.
      residence: countBy(analysed, (p) => p.residence || 'Sin dato'),
    },
  };
}
