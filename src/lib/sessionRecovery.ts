/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Session Storage & F5 Recovery Manager
 * Target: src/lib/sessionRecovery.ts
 */

import type {
  InductionGroup,
  FakeNewsSet,
  ExclusionReason,
  StimulusItem,
  ParticipantDemographicsInput,
  TrialRecord,
} from '../types/experiment';
import type { ClientTelemetry } from './telemetry';

export const SESSION_STORAGE_KEY = 'favaloro_exp_session_v1';
export const STORAGE_VERSION = 1;

export type ExperimentStage =
  | 'welcome'
  | 'consent'
  | 'demographics'
  | 'induction'
  | 'reading'
  | 'rating'
  | 'debriefing'
  | 'thankyou';

export interface StoredSessionPayload {
  version: number;
  stage: ExperimentStage;
  participantId: string;
  createdAt: string;
  completedAt?: string | null;
  demographics: ParticipantDemographicsInput | null;
  isIncluded: boolean;
  exclusionReason: ExclusionReason;
  inductionGroup: InductionGroup | null;
  fakeNewsSet: FakeNewsSet | null;
  deck: StimulusItem[];
  currentTrialIndex: number;
  currentReadingTimeMs: number;
  responses: TrialRecord[];
  telemetry: ClientTelemetry;
  savedAt: string;
}

export type SavableState = {
  stage: ExperimentStage;
  participantId: string;
  createdAt: string;
  completedAt?: string | null;
  demographics: ParticipantDemographicsInput | null;
  isIncluded: boolean;
  exclusionReason: ExclusionReason;
  inductionGroup: InductionGroup | null;
  fakeNewsSet: FakeNewsSet | null;
  deck: StimulusItem[];
  currentTrialIndex: number;
  currentReadingTimeMs: number;
  responses: TrialRecord[];
  telemetry: ClientTelemetry;
};

/**
 * Safely persists current experiment state to sessionStorage.
 */
export function saveSessionToStorage(state: SavableState): boolean {
  if (typeof window === 'undefined') return false;
  // Do not store initial unconfigured states or completed states if reset
  if (state.stage === 'welcome' || state.stage === 'consent') return false;

  try {
    const payload: StoredSessionPayload = {
      version: STORAGE_VERSION,
      stage: state.stage,
      participantId: state.participantId,
      createdAt: state.createdAt,
      completedAt: state.completedAt,
      demographics: state.demographics,
      isIncluded: state.isIncluded,
      exclusionReason: state.exclusionReason,
      inductionGroup: state.inductionGroup,
      fakeNewsSet: state.fakeNewsSet,
      deck: state.deck,
      currentTrialIndex: state.currentTrialIndex,
      currentReadingTimeMs: state.currentReadingTimeMs,
      responses: state.responses,
      telemetry: state.telemetry,
      savedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('[SessionRecovery] Failed to save session to sessionStorage:', error);
    return false;
  }
}

/**
 * Safely retrieves and validates stored experiment state.
 */
export function loadSessionFromStorage(): StoredSessionPayload | null {
  if (typeof window === 'undefined') return null;

  try {
    const serialized = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!serialized) return null;

    const parsed = JSON.parse(serialized) as StoredSessionPayload;

    // Integrity validations
    if (parsed.version !== STORAGE_VERSION) return null;
    if (!parsed.participantId || !parsed.deck || !Array.isArray(parsed.deck)) return null;
    if (parsed.deck.length !== 20) return null;
    if (
      typeof parsed.currentTrialIndex !== 'number' ||
      parsed.currentTrialIndex < 0 ||
      parsed.currentTrialIndex > 20
    ) {
      return null;
    }
    if (!Array.isArray(parsed.responses)) return null;

    return parsed;
  } catch (error) {
    console.warn('[SessionRecovery] Failed to parse stored session:', error);
    return null;
  }
}

/**
 * Clears stored session upon test reset or experiment restart.
 */
export function clearSessionFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('[SessionRecovery] Failed to clear sessionStorage:', error);
  }
}
