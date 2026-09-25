import type {
  DemographicsInput,
  ParticipantSession,
  TrialRecord,
  ResponseCode,
  StimulusItem,
  InductionGroup,
  FakeNewsSet,
} from './types.ts';
import {
  getStimuliForParticipant,
  RESPONSE_SCALE,
  deriveFalseMemoryFlags,
} from './stimulusOracle.ts';
import { BalanceOracle } from './balanceOracle.ts';
import { randomUUID } from 'node:crypto';

export class ExperimentEngine {
  private balanceOracle: BalanceOracle;

  constructor(balanceOracle?: BalanceOracle) {
    this.balanceOracle = balanceOracle ?? new BalanceOracle();
  }

  public getBalanceOracle(): BalanceOracle {
    return this.balanceOracle;
  }

  /**
   * Validates demographic form inputs strictly adhering to inclusion/exclusion requirements.
   */
  public validateDemographics(input: DemographicsInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (input.age === undefined || input.age === null || Number.isNaN(input.age)) {
      errors.push('La edad es obligatoria y debe ser un número.');
    } else if (!Number.isInteger(input.age)) {
      errors.push('La edad debe ser un número entero.');
    } else if (input.age < 18) {
      errors.push('Debe ser mayor o igual a 18 años para participar.');
    } else if (input.age > 120) {
      errors.push('Edad fuera del rango biológico válido.');
    }

    if (!input.gender || !['Femenino', 'Masculino', 'Otro'].includes(input.gender)) {
      errors.push('Debe seleccionar una opción de sexo/género válida.');
    }

    if (typeof input.studiesPsychology !== 'boolean') {
      errors.push('Debe indicar si estudia o estudió psicología.');
    }

    if (
      !input.therapeuticOrientation ||
      !['Psicoanálisis', 'Basada en Evidencia Científica', 'Otros'].includes(
        input.therapeuticOrientation
      )
    ) {
      errors.push('Debe seleccionar una orientación terapéutica válida.');
    }

    if (!input.university || input.university.trim().length === 0) {
      errors.push('Debe indicar la universidad o institución.');
    }

    if (typeof input.hasMemoryCondition !== 'boolean') { errors.push('Debe indicar si presenta condición de memoria.'); }
    if (typeof input.hasVisualDifficulty !== 'boolean') { errors.push('Debe indicar si presenta dificultad visual.'); }
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Evaluates inclusion/exclusion criteria.
   * Participant is included if:
   * 1. Studies or studied psychology === true
   * 2. Orientation is either 'Psicoanálisis' or 'Basada en Evidencia Científica'
   */
  public evaluateInclusion(input: DemographicsInput): boolean {
    return (
      input.studiesPsychology === true &&
      (input.therapeuticOrientation === 'Psicoanálisis' ||
        input.therapeuticOrientation === 'Basada en Evidencia Científica')
    );
  }

  /**
   * Creates an active participant session.
   */
  public createSession(
    input: DemographicsInput,
    telemetry?: { deviceType?: 'desktop' | 'mobile' | 'tablet'; screenResolution?: string; userAgent?: string }
  ): ParticipantSession {
    const validation = this.validateDemographics(input);
    if (!validation.valid) {
      throw new Error(`Demographics validation failed: ${validation.errors.join('; ')}`);
    }

    const isIncluded = this.evaluateInclusion(input);
    const inductionGroup: InductionGroup = this.balanceOracle.assignGroup(isIncluded);

    let fakeNewsSet: FakeNewsSet;
    if (!isIncluded) {
      fakeNewsSet = 'control_random';
    } else if (input.therapeuticOrientation === 'Psicoanálisis') {
      fakeNewsSet = 'psicoanalisis';
    } else {
      fakeNewsSet = 'evidencia';
    }

    const session: ParticipantSession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      age: input.age,
      gender: input.gender,
      studiesPsychology: input.studiesPsychology,
      therapeuticOrientation: input.therapeuticOrientation,
      university: input.university.trim(),
      isIncluded,
      inductionGroup,
      fakeNewsSet,
      status: 'started',
      deviceType: telemetry?.deviceType ?? 'desktop',
      screenResolution: telemetry?.screenResolution ?? '1920x1080',
      userAgent: telemetry?.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestHarness/1.0',
    };

    return session;
  }

  /**
   * Selects 20 stimuli (12 true + 8 fake) and applies Fisher-Yates shuffle.
   */
  public initializeTrials(session: ParticipantSession, seedRng?: () => number): TrialRecord[] {
    const stimuli: StimulusItem[] = getStimuliForParticipant(
      session.therapeuticOrientation,
      session.isIncluded
    );

    if (stimuli.length !== 20) {
      throw new Error(`Expected exactly 20 stimuli, but received ${stimuli.length}`);
    }

    // Fisher-Yates shuffle
    const shuffled = [...stimuli];
    const rng = seedRng || Math.random;
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.map((item, index) => ({
      participantId: session.id,
      presentationOrder: index + 1,
      newsId: item.id,
      isFake: item.isFake,
      newsCongruence: item.congruence,
      responseOption: 4, // default uncommitted
      responseLabel: RESPONSE_SCALE[4],
      readingTimeMs: 10000,
      responseTimeMs: 0,
    }));
  }

  /**
   * Commits a participant rating for a specific trial.
   */
  public recordResponse(
    trial: TrialRecord,
    option: ResponseCode,
    readingTimeMs: number,
    responseTimeMs: number
  ): TrialRecord {
    if (![1, 2, 3, 4].includes(option)) {
      throw new Error(`Invalid response option code: ${option}. Allowed values are 1, 2, 3, 4.`);
    }
    if (readingTimeMs < 0) {
      throw new Error(`Reading time cannot be negative: ${readingTimeMs}`);
    }
    if (responseTimeMs < 0) {
      throw new Error(`Response time cannot be negative: ${responseTimeMs}`);
    }

    return {
      ...trial,
      responseOption: option,
      responseLabel: RESPONSE_SCALE[option],
      readingTimeMs,
      responseTimeMs,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Finalizes the session upon debriefing completion.
   */
  public completeSession(session: ParticipantSession, trials: TrialRecord[]): ParticipantSession {
    if (trials.length !== 20) {
      throw new Error(`Cannot complete session: participant only has ${trials.length}/20 trials.`);
    }

    return {
      ...session,
      completedAt: new Date().toISOString(),
      status: 'completed',
    };
  }
}
