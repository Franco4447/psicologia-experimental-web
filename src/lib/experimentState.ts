/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Experiment State Machine Reducer & Types
 * Target: src/lib/experimentState.ts
 */

import type {
  InductionGroup,
  FakeNewsSet,
  ExclusionReason,
  StimulusItem,
  ParticipantDemographicsInput,
  TrialRecord,
  ResponseCode,
} from '../types/experiment';
import {
  evaluateInclusion,
  getParticipantNewsDeck,
  classifyResponse,
  RESPONSE_OPTIONS_MAP,
} from '../data/stimuli';
import type { ClientTelemetry } from './telemetry';
import type { ExperimentStage } from './sessionRecovery';
import { STIMULUS_EXPOSURE_DURATION_MS } from './timing';

export interface ExperimentState {
  isHydrated: boolean;
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
  currentTrialIndex: number; // 0 to 19 (maps to presentationOrder 1 to 20)
  currentReadingTimeMs: number;
  responses: TrialRecord[];
  telemetry: ClientTelemetry;
  isSaving: boolean;
  error: string | null;
}

export type ExperimentAction =
  | { type: 'HYDRATE_STORAGE'; payload: Partial<ExperimentState> }
  | { type: 'START_CONSENT' }
  | { type: 'ACCEPT_CONSENT' }
  | {
      type: 'SUBMIT_DEMOGRAPHICS';
      payload: {
        demographics: ParticipantDemographicsInput;
        telemetry: ClientTelemetry;
        assignedGroup?: InductionGroup;
        participantId: string;
      };
    }
  | { type: 'ACKNOWLEDGE_INDUCTION' }
  | { type: 'FINISH_READING'; payload: { readingTimeMs: number } }
  | {
      type: 'RECORD_TRIAL_RESPONSE';
      payload: {
        responseOption: ResponseCode;
        responseTimeMs: number;
      };
    }
  | { type: 'COMPLETE_DEBRIEFING' }
  | { type: 'RESET_EXPERIMENT' };

export function generateParticipantId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getInitialExperimentState(): ExperimentState {
  return {
    isHydrated: false,
    stage: 'welcome',
    participantId: '',
    createdAt: new Date().toISOString(),
    completedAt: null,
    demographics: null,
    isIncluded: false,
    exclusionReason: null,
    inductionGroup: null,
    fakeNewsSet: null,
    deck: [],
    currentTrialIndex: 0,
    currentReadingTimeMs: STIMULUS_EXPOSURE_DURATION_MS,
    responses: [],
    telemetry: {
      deviceType: 'desktop',
      screenResolution: '1920x1080',
      userAgent: '',
    },
    isSaving: false,
    error: null,
  };
}

/**
 * Balanced group allocation generator for local client-side sessions (M2).
 * Minimizes group discrepancies across sessions stored locally.
 */
export function getBalancedLocalGroup(): InductionGroup {
  if (typeof window === 'undefined') return 'control';
  try {
    const raw = localStorage.getItem('favaloro_local_group_counts');
    const counts: Record<InductionGroup, number> = raw
      ? JSON.parse(raw)
      : { racional: 0, emocional: 0, control: 0 };

    const minVal = Math.min(counts.racional, counts.emocional, counts.control);
    const candidates = (['racional', 'emocional', 'control'] as InductionGroup[]).filter(
      (g) => counts[g] === minVal
    );
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    counts[chosen] = (counts[chosen] || 0) + 1;
    localStorage.setItem('favaloro_local_group_counts', JSON.stringify(counts));
    return chosen;
  } catch {
    const groups: InductionGroup[] = ['racional', 'emocional', 'control'];
    return groups[Math.floor(Math.random() * groups.length)];
  }
}

// ============================================================================
// State Machine Reducer
// ============================================================================

export function experimentReducer(
  state: ExperimentState,
  action: ExperimentAction
): ExperimentState {
  switch (action.type) {
    case 'HYDRATE_STORAGE': {
      return {
        ...state,
        ...action.payload,
        isHydrated: true,
      };
    }

    case 'START_CONSENT': {
      if (state.stage !== 'welcome') return state;
      return { ...state, stage: 'consent' };
    }

    case 'ACCEPT_CONSENT': {
      if (state.stage !== 'consent') return state;
      return { ...state, stage: 'demographics' };
    }

    case 'SUBMIT_DEMOGRAPHICS': {
      if (state.stage !== 'demographics') return state;
      const { demographics, telemetry, assignedGroup } = action.payload;

      // 1. Evaluate inclusion criteria
      const evaluation = evaluateInclusion(demographics);
      const isIncluded = evaluation.isIncluded;
      const exclusionReason = evaluation.exclusionReason;

      // 2. Assign Induction Group:
      // Excluded participants strictly receive 'control' prompt.
      // Included participants receive balanced group.
      const inductionGroup: InductionGroup = !isIncluded
        ? 'control'
        : assignedGroup || getBalancedLocalGroup();

      // 3. Determine Fake News Set
      let fakeNewsSet: FakeNewsSet;
      if (!isIncluded) {
        fakeNewsSet = 'control_random';
      } else if (demographics.therapeuticOrientation === 'Psicoanálisis') {
        fakeNewsSet = 'psicoanalisis';
      } else {
        fakeNewsSet = 'evidencia';
      }

      // 4. Assemble 20-news randomized deck (12 true + 8 fake)
      const deck = getParticipantNewsDeck(demographics.therapeuticOrientation, isIncluded);

      // 5. Use the participant UUID generated by the sync manager
      const participantId = action.payload.participantId;

      return {
        ...state,
        stage: 'induction',
        participantId,
        demographics,
        isIncluded,
        exclusionReason,
        inductionGroup,
        fakeNewsSet,
        deck,
        currentTrialIndex: 0,
        currentReadingTimeMs: STIMULUS_EXPOSURE_DURATION_MS,
        responses: [],
        telemetry,
      };
    }

    case 'ACKNOWLEDGE_INDUCTION': {
      if (state.stage !== 'induction') return state;
      return {
        ...state,
        stage: 'reading',
        currentTrialIndex: 0,
      };
    }

    case 'FINISH_READING': {
      if (state.stage !== 'reading') return state;
      return {
        ...state,
        stage: 'rating',
        currentReadingTimeMs: action.payload.readingTimeMs,
      };
    }

    case 'RECORD_TRIAL_RESPONSE': {
      if (state.stage !== 'rating') return state;
      const currentStimulus = state.deck[state.currentTrialIndex];
      if (!currentStimulus) return state;

      const { responseOption, responseTimeMs } = action.payload;
      const flags = classifyResponse(currentStimulus.isFake, responseOption);

      const trialRecord: TrialRecord = {
        id: generateParticipantId(),
        participantId: state.participantId,
        presentationOrder: state.currentTrialIndex + 1,
        newsId: currentStimulus.id,
        isFake: currentStimulus.isFake,
        newsCongruence: currentStimulus.congruence,
        responseOption,
        responseLabel: RESPONSE_OPTIONS_MAP[responseOption]?.label ?? '',
        readingTimeMs: state.currentReadingTimeMs,
        responseTimeMs,
        isFalseMemory: flags.isFalseMemory,
        isFalseBelief: flags.isFalseBelief,
        isTrueMemory: flags.isTrueMemory,
        createdAt: new Date().toISOString(),
      };

      const updatedResponses = [...state.responses, trialRecord];
      const nextIndex = state.currentTrialIndex + 1;
      const isComplete = nextIndex >= state.deck.length;

      return {
        ...state,
        responses: updatedResponses,
        currentTrialIndex: isComplete ? state.currentTrialIndex : nextIndex,
        stage: isComplete ? 'debriefing' : 'reading',
        currentReadingTimeMs: STIMULUS_EXPOSURE_DURATION_MS,
      };
    }

    case 'COMPLETE_DEBRIEFING': {
      if (state.stage !== 'debriefing') return state;
      return {
        ...state,
        stage: 'thankyou',
        completedAt: new Date().toISOString(),
      };
    }

    case 'RESET_EXPERIMENT': {
      return {
        ...getInitialExperimentState(),
        isHydrated: true,
      };
    }

    default:
      return state;
  }
}
