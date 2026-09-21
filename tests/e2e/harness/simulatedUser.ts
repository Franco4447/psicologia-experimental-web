import type {
  DemographicsInput,
  ParticipantSession,
  TrialRecord,
  ResponseCode,
} from './types.ts';
import { ExperimentEngine } from './experimentEngine.ts';
import { INDUCTION_PROMPTS } from './stimulusOracle.ts';

export interface UserJourneyOptions {
  demographics: DemographicsInput;
  acceptConsent: boolean;
  responseStrategy: 'all_false_memories' | 'all_false_beliefs' | 'skeptical_none' | 'realistic_mixed';
  simulateNetworkFailuresAtTrials?: number[];
  customTrialResponses?: ResponseCode[];
  telemetry?: {
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    screenResolution?: string;
    userAgent?: string;
  };
}

export interface UserJourneyResult {
  session: ParticipantSession;
  trials: TrialRecord[];
  offlineBufferedTrials: TrialRecord[];
  completedSuccessfully: boolean;
  sawInductionText: string;
  sawDebriefing: boolean;
  totalTimeMs: number;
}

export class SimulatedUser {
  private engine: ExperimentEngine;

  constructor(engine: ExperimentEngine) {
    this.engine = engine;
  }

  /**
   * Runs a complete end-to-end user participant journey through all screens.
   */
  public async executeJourney(options: UserJourneyOptions): Promise<UserJourneyResult> {
    if (!options.acceptConsent) {
      throw new Error('User refused informed consent; experiment aborted at step 2.');
    }

    const session = this.engine.createSession(options.demographics, options.telemetry);
    const expectedInduction = INDUCTION_PROMPTS[session.inductionGroup];

    const initialTrials = this.engine.initializeTrials(session);
    const recordedTrials: TrialRecord[] = [];
    const offlineBuffered: TrialRecord[] = [];
    let totalTimeMs = 0;

    for (let i = 0; i < initialTrials.length; i++) {
      const trial = initialTrials[i];
      let choice: ResponseCode;

      if (options.customTrialResponses && options.customTrialResponses[i]) {
        choice = options.customTrialResponses[i];
      } else {
        switch (options.responseStrategy) {
          case 'all_false_memories':
            choice = 1;
            break;
          case 'all_false_beliefs':
            choice = 2;
            break;
          case 'skeptical_none':
            choice = 4;
            break;
          case 'realistic_mixed':
          default:
            // 35% false memory/belief on fake news, mostly choice 3 or 4 on true news
            if (trial.isFake) {
              const r = Math.random();
              choice = r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : 4;
            } else {
              const r = Math.random();
              choice = r < 0.1 ? 1 : r < 0.2 ? 2 : r < 0.5 ? 3 : 4;
            }
            break;
        }
      }

      const readingTimeMs = 10000; // standard 10s reading window
      const responseTimeMs = Math.floor(1200 + Math.random() * 3000); // 1.2s - 4.2s RT
      totalTimeMs += readingTimeMs + responseTimeMs;

      const recorded = this.engine.recordResponse(trial, choice, readingTimeMs, responseTimeMs);

      // Check if network failed on this trial
      if (
        options.simulateNetworkFailuresAtTrials &&
        options.simulateNetworkFailuresAtTrials.includes(trial.presentationOrder)
      ) {
        offlineBuffered.push(recorded);
      } else {
        recordedTrials.push(recorded);
      }
    }

    // Reconnection flush simulation
    if (offlineBuffered.length > 0) {
      // Offline queue flushed to server
      recordedTrials.push(...offlineBuffered);
      // Re-sort by presentationOrder
      recordedTrials.sort((a, b) => a.presentationOrder - b.presentationOrder);
    }

    const completedSession = this.engine.completeSession(session, recordedTrials);

    return {
      session: completedSession,
      trials: recordedTrials,
      offlineBufferedTrials: offlineBuffered,
      completedSuccessfully: true,
      sawInductionText: expectedInduction,
      sawDebriefing: true,
      totalTimeMs,
    };
  }
}
