/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Milestone 2 Adversarial Stress Test Harness
 * 
 * Target: tests/m2_adversarial_stress.test.ts
 * Role: challenger_m2_2 (Empirical Challenger)
 * 
 * Verifies:
 * 1. Full 20-trial journeys across participant profiles (Psychoanalysis, Evidence-based, Excluded).
 * 2. Accidental reload (F5 / hydration) simulation with sessionStorage recovery at multiple stages.
 * 3. Strict prevention of illegal state transitions and out-of-order action gating.
 * 4. Storage corruption and tampering resilience.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  experimentReducer,
  getInitialExperimentState,
  generateParticipantId,
  type ExperimentState,
  type ExperimentAction,
} from '../src/lib/experimentState.ts';
import {
  saveSessionToStorage,
  loadSessionFromStorage,
  clearSessionFromStorage,
  SESSION_STORAGE_KEY,
  STORAGE_VERSION,
} from '../src/lib/sessionRecovery.ts';
import { captureClientTelemetry } from '../src/lib/telemetry.ts';
import type { ParticipantDemographicsInput, ResponseCode } from '../src/types/experiment.ts';

// In-memory mock for browser window and sessionStorage
class MockSessionStorage {
  private store: Map<string, string> = new Map();
  public throwOnSet: boolean = false;

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError: DOMException');
    }
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }
}

let mockStorage: MockSessionStorage;

function setupMockBrowser() {
  mockStorage = new MockSessionStorage();
  (globalThis as any).window = {
    sessionStorage: mockStorage,
  };
  (globalThis as any).sessionStorage = mockStorage;
}

describe('M2 Adversarial Challenge Suite: State Machine & Session Recovery', () => {
  beforeEach(() => {
    setupMockBrowser();
  });

  // ==========================================================================
  // 1. FULL 20-TRIAL PARTICIPANT JOURNEYS
  // ==========================================================================
  describe('1. Full 20-Trial Participant Journeys', () => {
    test('Journey A: Psychoanalysis student completes full 20-trial study with congruent fake news', () => {
      let state = getInitialExperimentState();
      assert.equal(state.stage, 'welcome');

      // Start consent
      state = experimentReducer(state, { type: 'START_CONSENT' });
      assert.equal(state.stage, 'consent');

      // Accept consent
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      assert.equal(state.stage, 'demographics');

      // Submit valid Psychoanalysis student demographics
      const demographics: ParticipantDemographicsInput = {
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
      };
      const telemetry = captureClientTelemetry();

      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry, assignedGroup: 'racional' },
      });

      assert.equal(state.stage, 'induction');
      assert.equal(state.isIncluded, true);
      assert.equal(state.exclusionReason, null);
      assert.equal(state.inductionGroup, 'racional');
      assert.equal(state.fakeNewsSet, 'psicoanalisis');
      assert.equal(state.deck.length, 20);

      // Verify deck composition: 12 true + 8 fake
      const trueItems = state.deck.filter((item) => !item.isFake);
      const fakeItems = state.deck.filter((item) => item.isFake);
      assert.equal(trueItems.length, 12);
      assert.equal(fakeItems.length, 8);

      // Verify no duplicates
      const uniqueIds = new Set(state.deck.map((i) => i.id));
      assert.equal(uniqueIds.size, 20);

      // Verify fake news set corresponds to Psychoanalysis congruent list (anti-CBT): 14, 16, 18, 20, 21, 23, 25, 27
      const expectedFakeIds = new Set([14, 16, 18, 20, 21, 23, 25, 27]);
      fakeItems.forEach((item) => {
        assert.ok(expectedFakeIds.has(item.id), `Unexpected fake news ID ${item.id} for psychoanalysis`);
        assert.equal(item.congruence, 'psicoanalisis');
      });

      // Advance from induction to trials
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });
      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 0);

      // Execute all 20 trials with cycling response codes (1, 2, 3, 4)
      for (let trial = 0; trial < 20; trial++) {
        assert.equal(state.stage, 'reading');
        assert.equal(state.currentTrialIndex, trial);

        // 10s reading exposure
        state = experimentReducer(state, {
          type: 'FINISH_READING',
          payload: { readingTimeMs: 10000 },
        });
        assert.equal(state.stage, 'rating');

        const stimulus = state.deck[trial];
        const chosenOption = ((trial % 4) + 1) as ResponseCode; // 1, 2, 3, 4
        const responseLatency = 1200 + trial * 85;

        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: chosenOption, responseTimeMs: responseLatency },
        });

        assert.equal(state.responses.length, trial + 1);
        const record = state.responses[trial];
        assert.equal(record.presentationOrder, trial + 1);
        assert.equal(record.newsId, stimulus.id);
        assert.equal(record.isFake, stimulus.isFake);
        assert.equal(record.responseOption, chosenOption);
        assert.equal(record.readingTimeMs, 10000);
        assert.equal(record.responseTimeMs, responseLatency);

        // Verify classification logic
        if (stimulus.isFake) {
          if (chosenOption === 1) {
            assert.equal(record.isFalseMemory, true);
            assert.equal(record.isFalseBelief, false);
          } else if (chosenOption === 2) {
            assert.equal(record.isFalseMemory, false);
            assert.equal(record.isFalseBelief, true);
          } else {
            assert.equal(record.isFalseMemory, false);
            assert.equal(record.isFalseBelief, false);
          }
        } else {
          // True news
          assert.equal(record.isFalseMemory, false);
          assert.equal(record.isFalseBelief, false);
          if (chosenOption === 1) {
            assert.equal(record.isTrueMemory, true);
          } else {
            assert.equal(record.isTrueMemory, false);
          }
        }

        if (trial < 19) {
          assert.equal(state.stage, 'reading');
          assert.equal(state.currentTrialIndex, trial + 1);
        } else {
          assert.equal(state.stage, 'debriefing');
        }
      }

      // Complete debriefing
      state = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(state.stage, 'thankyou');
      assert.ok(state.completedAt);
      assert.equal(state.responses.length, 20);
    });

    test('Journey B: Evidence-Based student completes full 20-trial study with Noticia_26.png', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 26,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'UBA',
      };

      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry: captureClientTelemetry(), assignedGroup: 'emocional' },
      });

      assert.equal(state.isIncluded, true);
      assert.equal(state.inductionGroup, 'emocional');
      assert.equal(state.fakeNewsSet, 'evidencia');

      // Verify fake news set corresponds to Evidence-based congruent list: 13, 15, 17, 19, 22, 24, 26, 28
      const expectedFakeIds = new Set([13, 15, 17, 19, 22, 24, 26, 28]);
      const fakeItems = state.deck.filter((i) => i.isFake);
      assert.equal(fakeItems.length, 8);
      fakeItems.forEach((item) => {
        assert.ok(expectedFakeIds.has(item.id));
        assert.equal(item.congruence, 'evidencia');
      });

      // Special check: Stimulus 26 is included and has Noticia_26.png asset
      const item26 = state.deck.find((i) => i.id === 26);
      assert.ok(item26, 'Stimulus 26 must be in the Evidence-Based deck');
      assert.equal(item26.imageFileName, 'Noticia_26.png');

      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      for (let trial = 0; trial < 20; trial++) {
        state = experimentReducer(state, {
          type: 'FINISH_READING',
          payload: { readingTimeMs: 10000 },
        });
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: 1, responseTimeMs: 950 },
        });
      }

      assert.equal(state.stage, 'debriefing');
      state = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(state.stage, 'thankyou');
      assert.equal(state.responses.length, 20);
    });

    test('Journey C: Excluded participant (non-psychology student) is forced to Control group and completes study', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 34,
        gender: 'Otro',
        studiesPsychology: false, // Disqualifying criteria
        therapeuticOrientation: 'Psicoanálisis',
        university: 'UTN',
      };

      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry: captureClientTelemetry(), assignedGroup: 'racional' },
      });

      assert.equal(state.isIncluded, false);
      assert.equal(state.exclusionReason, 'no_estudia_psicologia');
      // Even though assignedGroup was requested as 'racional', exclusion strictly forces 'control'
      assert.equal(state.inductionGroup, 'control');
      assert.equal(state.fakeNewsSet, 'control_random');
      assert.equal(state.deck.length, 20);

      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      for (let trial = 0; trial < 20; trial++) {
        state = experimentReducer(state, {
          type: 'FINISH_READING',
          payload: { readingTimeMs: 10000 },
        });
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: 4, responseTimeMs: 3100 },
        });
      }

      assert.equal(state.stage, 'debriefing');
      state = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(state.stage, 'thankyou');
    });

    test('Journey D: Excluded participant with orientation "Otros" is marked with exclusionReason orientacion_otros', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 21,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Otros', // Disqualifying orientation
        university: 'Universidad Favaloro',
      };

      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry: captureClientTelemetry() },
      });

      assert.equal(state.isIncluded, false);
      assert.equal(state.exclusionReason, 'orientacion_otros');
      assert.equal(state.inductionGroup, 'control');
      assert.equal(state.fakeNewsSet, 'control_random');
      assert.equal(state.deck.length, 20);
    });

    test('Journey E: Underage participant (<18) is marked with exclusionReason menor_de_edad', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 17,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Secundario',
      };

      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry: captureClientTelemetry() },
      });

      assert.equal(state.isIncluded, false);
      assert.equal(state.exclusionReason, 'menor_de_edad');
      assert.equal(state.inductionGroup, 'control');
    });
  });

  // ==========================================================================
  // 2. SESSION RECOVERY & ACCIDENTAL RELOAD (F5) HYDRATION
  // ==========================================================================
  describe('2. Session Recovery & Accidental Reload (F5) Hydration', () => {
    function simulateF5Reload(currentState: ExperimentState): ExperimentState {
      // 1. Save current state to storage (as page.tsx does on every state change)
      saveSessionToStorage(currentState);

      // 2. Simulate browser reload: New JS environment starts with initial unhydrated state
      let reloadedState = getInitialExperimentState();

      // 3. Mount effect: load from storage and dispatch HYDRATE_STORAGE
      const stored = loadSessionFromStorage();
      assert.ok(stored, 'Stored session payload should exist on simulated reload');

      reloadedState = experimentReducer(reloadedState, {
        type: 'HYDRATE_STORAGE',
        payload: {
          stage: stored.stage,
          participantId: stored.participantId,
          createdAt: stored.createdAt,
          completedAt: stored.completedAt,
          demographics: stored.demographics,
          isIncluded: stored.isIncluded,
          exclusionReason: stored.exclusionReason,
          inductionGroup: stored.inductionGroup,
          fakeNewsSet: stored.fakeNewsSet,
          deck: stored.deck,
          currentTrialIndex: stored.currentTrialIndex,
          currentReadingTimeMs: stored.currentReadingTimeMs,
          responses: stored.responses,
          telemetry: stored.telemetry,
        },
      });

      return reloadedState;
    }

    test('F5 at Induction: Restores exact deck, participant ID, and stage', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 23,
            gender: 'Femenino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
          assignedGroup: 'control',
        },
      });

      const participantIdBefore = state.participantId;
      const deckBefore = [...state.deck];

      // Simulate F5
      state = simulateF5Reload(state);

      assert.equal(state.stage, 'induction');
      assert.equal(state.isHydrated, true);
      assert.equal(state.participantId, participantIdBefore);
      assert.equal(state.deck.length, 20);
      assert.deepEqual(state.deck, deckBefore);
      assert.equal(state.currentTrialIndex, 0);
      assert.equal(state.responses.length, 0);
    });

    test('F5 during Trial 5 Reading: Restores trial index 4 and 4 accumulated responses', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 25,
            gender: 'Masculino',
            studiesPsychology: true,
            therapeuticOrientation: 'Basada en Evidencia Científica',
            university: 'UBA',
          },
          telemetry: captureClientTelemetry(),
          assignedGroup: 'racional',
        },
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      // Complete first 4 trials (indices 0, 1, 2, 3)
      for (let i = 0; i < 4; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: 1, responseTimeMs: 1500 },
        });
      }

      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 4);
      assert.equal(state.responses.length, 4);

      // Participant reloads while reading trial 5
      state = simulateF5Reload(state);

      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 4);
      assert.equal(state.responses.length, 4);

      // Can continue trial 5 seamlessly
      state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
      assert.equal(state.stage, 'rating');

      state = experimentReducer(state, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 2, responseTimeMs: 2200 },
      });

      assert.equal(state.responses.length, 5);
      assert.equal(state.responses[4].presentationOrder, 5);
      assert.equal(state.responses[4].responseOption, 2);
      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 5);
    });

    test('F5 during Trial 12 Rating: Restores rating stage with previous 11 responses preserved', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 22,
            gender: 'Femenino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
          assignedGroup: 'emocional',
        },
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      // Advance through 11 full trials
      for (let i = 0; i < 11; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: 3, responseTimeMs: 1100 },
        });
      }

      // Start trial 12 reading and finish reading to enter rating
      state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
      assert.equal(state.stage, 'rating');
      assert.equal(state.currentTrialIndex, 11);
      assert.equal(state.responses.length, 11);

      // F5 during rating!
      state = simulateF5Reload(state);

      assert.equal(state.stage, 'rating');
      assert.equal(state.currentTrialIndex, 11);
      assert.equal(state.responses.length, 11);

      // Confirm response for trial 12
      state = experimentReducer(state, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 1, responseTimeMs: 1800 },
      });

      assert.equal(state.responses.length, 12);
      assert.equal(state.responses[11].presentationOrder, 12);
      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 12);
    });

    test('F5 at Debriefing stage: Restores debriefing screen with all 20 responses intact', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 20,
            gender: 'Otro',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
        },
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      // Complete all 20 trials
      for (let i = 0; i < 20; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: 1, responseTimeMs: 1000 },
        });
      }

      assert.equal(state.stage, 'debriefing');
      assert.equal(state.responses.length, 20);

      // F5 at debriefing
      state = simulateF5Reload(state);

      assert.equal(state.stage, 'debriefing');
      assert.equal(state.responses.length, 20);

      // Complete debriefing
      state = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(state.stage, 'thankyou');
      assert.ok(state.completedAt);
    });

    test('Multi-F5 Stress Test: 5 consecutive reloads during experiment lifecycle without data loss', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 27,
            gender: 'Femenino',
            studiesPsychology: true,
            therapeuticOrientation: 'Basada en Evidencia Científica',
            university: 'UBA',
          },
          telemetry: captureClientTelemetry(),
        },
      });

      // Reload 1 at induction
      state = simulateF5Reload(state);
      assert.equal(state.stage, 'induction');
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      // Run trials 1 to 5
      for (let i = 0; i < 5; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 2, responseTimeMs: 1200 } });
      }

      // Reload 2 at trial 6 reading
      state = simulateF5Reload(state);
      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 5);
      assert.equal(state.responses.length, 5);

      // Run trials 6 to 10
      for (let i = 5; i < 10; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 1, responseTimeMs: 1400 } });
      }

      // Reload 3 at trial 11 reading
      state = simulateF5Reload(state);
      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 10);
      assert.equal(state.responses.length, 10);

      // Run trials 11 to 19
      for (let i = 10; i < 19; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 3, responseTimeMs: 1300 } });
      }

      // Reload 4 at trial 20 rating
      state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
      assert.equal(state.stage, 'rating');
      assert.equal(state.currentTrialIndex, 19);
      assert.equal(state.responses.length, 19);

      state = simulateF5Reload(state);
      assert.equal(state.stage, 'rating');
      assert.equal(state.currentTrialIndex, 19);
      assert.equal(state.responses.length, 19);

      // Finish trial 20
      state = experimentReducer(state, { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 4, responseTimeMs: 2000 } });
      assert.equal(state.stage, 'debriefing');
      assert.equal(state.responses.length, 20);

      // Reload 5 at debriefing
      state = simulateF5Reload(state);
      assert.equal(state.stage, 'debriefing');
      assert.equal(state.responses.length, 20);

      state = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(state.stage, 'thankyou');
    });

    test('Restart clears sessionStorage completely', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 23,
            gender: 'Femenino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
        },
      });

      saveSessionToStorage(state);
      assert.ok(mockStorage.getItem(SESSION_STORAGE_KEY));

      // User restarts
      clearSessionFromStorage();
      assert.equal(mockStorage.getItem(SESSION_STORAGE_KEY), null);
      assert.equal(loadSessionFromStorage(), null);
    });
  });

  // ==========================================================================
  // 3. ILLEGAL STATE TRANSITION & STAGE SKIPPING PREVENTION
  // ==========================================================================
  describe('3. Illegal State Transition & Stage Skipping Prevention', () => {
    test('Cannot skip from Welcome directly to any subsequent stage', () => {
      const initial = getInitialExperimentState();

      // Illegal attempts
      const illegalActions: ExperimentAction[] = [
        { type: 'ACCEPT_CONSENT' },
        {
          type: 'SUBMIT_DEMOGRAPHICS',
          payload: {
            demographics: {
              age: 20,
              gender: 'Masculino',
              studiesPsychology: true,
              therapeuticOrientation: 'Psicoanálisis',
              university: 'UBA',
            },
            telemetry: captureClientTelemetry(),
          },
        },
        { type: 'ACKNOWLEDGE_INDUCTION' },
        { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } },
        { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 1, responseTimeMs: 1500 } },
        { type: 'COMPLETE_DEBRIEFING' },
      ];

      for (const action of illegalActions) {
        const nextState = experimentReducer(initial, action);
        assert.equal(nextState.stage, 'welcome', `Action ${action.type} should not mutate welcome state`);
        assert.equal(nextState.responses.length, 0);
        assert.equal(nextState.deck.length, 0);
      }
    });

    test('Cannot skip from Consent directly to trials or debriefing', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      assert.equal(state.stage, 'consent');

      const illegalActions: ExperimentAction[] = [
        { type: 'START_CONSENT' },
        { type: 'ACKNOWLEDGE_INDUCTION' },
        { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } },
        { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 1, responseTimeMs: 1500 } },
        { type: 'COMPLETE_DEBRIEFING' },
      ];

      for (const action of illegalActions) {
        const nextState = experimentReducer(state, action);
        assert.equal(nextState.stage, 'consent', `Action ${action.type} should not mutate consent state`);
      }
    });

    test('Cannot skip Demographics form to start trials', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      assert.equal(state.stage, 'demographics');

      const illegalActions: ExperimentAction[] = [
        { type: 'START_CONSENT' },
        { type: 'ACCEPT_CONSENT' },
        { type: 'ACKNOWLEDGE_INDUCTION' },
        { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } },
        { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 1, responseTimeMs: 1500 } },
        { type: 'COMPLETE_DEBRIEFING' },
      ];

      for (const action of illegalActions) {
        const nextState = experimentReducer(state, action);
        assert.equal(nextState.stage, 'demographics', `Action ${action.type} should not bypass demographics`);
      }
    });

    test('Cannot submit response while in Reading stage', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 25,
            gender: 'Femenino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
        },
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });
      assert.equal(state.stage, 'reading');

      // Attempt to submit rating before FINISH_READING
      const stateBefore = { ...state };
      const nextState = experimentReducer(state, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 1, responseTimeMs: 50 },
      });

      assert.equal(nextState.stage, 'reading');
      assert.equal(nextState.responses.length, 0);
      assert.deepEqual(nextState, stateBefore);
    });

    test('Cannot double-submit or re-finish reading while in Rating stage', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 25,
            gender: 'Femenino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
        },
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });
      state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
      assert.equal(state.stage, 'rating');

      // Attempt to FINISH_READING again while rating
      const nextState = experimentReducer(state, {
        type: 'FINISH_READING',
        payload: { readingTimeMs: 5000 },
      });
      assert.equal(nextState.stage, 'rating');

      // Record first response -> moves to reading trial 2
      const afterFirstResponse = experimentReducer(state, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 2, responseTimeMs: 1400 },
      });
      assert.equal(afterFirstResponse.stage, 'reading');
      assert.equal(afterFirstResponse.currentTrialIndex, 1);
      assert.equal(afterFirstResponse.responses.length, 1);

      // Immediate duplicate submission attempt (e.g. rapid double click)
      const afterDoubleResponse = experimentReducer(afterFirstResponse, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 2, responseTimeMs: 1400 },
      });
      // Should be rejected because stage is now 'reading', not 'rating'
      assert.equal(afterDoubleResponse.stage, 'reading');
      assert.equal(afterDoubleResponse.responses.length, 1);
    });

    test('Cannot jump to Debriefing before all 20 trials are completed', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 22,
            gender: 'Masculino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
        },
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      // Run 5 trials
      for (let i = 0; i < 5; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: 1, responseTimeMs: 1200 },
        });
      }

      assert.equal(state.responses.length, 5);

      // Attempt to force complete debriefing mid-experiment
      const stateBefore = { ...state };
      const nextState = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(nextState.stage, 'reading');
      assert.deepEqual(nextState, stateBefore);
    });

    test('Cannot inject trial responses or modify data once in ThankYou stage', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: {
          demographics: {
            age: 22,
            gender: 'Masculino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Universidad Favaloro',
          },
          telemetry: captureClientTelemetry(),
        },
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });

      for (let i = 0; i < 20; i++) {
        state = experimentReducer(state, { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } });
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption: 1, responseTimeMs: 1000 },
        });
      }
      state = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(state.stage, 'thankyou');
      assert.ok(state.completedAt);

      const illegalActions: ExperimentAction[] = [
        { type: 'START_CONSENT' },
        { type: 'ACCEPT_CONSENT' },
        { type: 'ACKNOWLEDGE_INDUCTION' },
        { type: 'FINISH_READING', payload: { readingTimeMs: 10000 } },
        { type: 'RECORD_TRIAL_RESPONSE', payload: { responseOption: 1, responseTimeMs: 1000 } },
        { type: 'COMPLETE_DEBRIEFING' },
      ];

      for (const action of illegalActions) {
        const nextState = experimentReducer(state, action);
        assert.equal(nextState.stage, 'thankyou', `Action ${action.type} should not alter thankyou stage`);
        assert.equal(nextState.responses.length, 20);
      }
    });
  });

  // ==========================================================================
  // 4. STORAGE CORRUPTION & TAMPERING RESILIENCE
  // ==========================================================================
  describe('4. Storage Corruption & Tampering Resilience', () => {
    test('Invalid JSON in sessionStorage returns null without crashing', () => {
      mockStorage.setItem(SESSION_STORAGE_KEY, '{ invalid_json_syntax ...');
      const loaded = loadSessionFromStorage();
      assert.equal(loaded, null);
    });

    test('Mismatched storage version returns null', () => {
      const validPayload = {
        version: 999, // Incompatible version
        stage: 'reading',
        participantId: '12345678-1234-1234-1234-123456789abc',
        deck: new Array(20).fill({ id: 1, isFake: false }),
        currentTrialIndex: 5,
        responses: [],
      };
      mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(validPayload));
      assert.equal(loadSessionFromStorage(), null);
    });

    test('Incomplete deck (e.g. 19 items) is rejected by loadSessionFromStorage', () => {
      const payload = {
        version: STORAGE_VERSION,
        stage: 'reading',
        participantId: '12345678-1234-1234-1234-123456789abc',
        deck: new Array(19).fill({ id: 1, isFake: false }), // Incomplete!
        currentTrialIndex: 0,
        responses: [],
      };
      mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
      assert.equal(loadSessionFromStorage(), null);
    });

    test('Out-of-bounds currentTrialIndex is rejected by loadSessionFromStorage', () => {
      // Negative index
      const payloadNeg = {
        version: STORAGE_VERSION,
        stage: 'reading',
        participantId: '12345678-1234-1234-1234-123456789abc',
        deck: new Array(20).fill({ id: 1, isFake: false }),
        currentTrialIndex: -1,
        responses: [],
      };
      mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payloadNeg));
      assert.equal(loadSessionFromStorage(), null);

      // Index > 20
      const payloadHigh = {
        ...payloadNeg,
        currentTrialIndex: 25,
      };
      mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payloadHigh));
      assert.equal(loadSessionFromStorage(), null);
    });

    test('Missing participantId is rejected by loadSessionFromStorage', () => {
      const payload = {
        version: STORAGE_VERSION,
        stage: 'reading',
        participantId: '',
        deck: new Array(20).fill({ id: 1, isFake: false }),
        currentTrialIndex: 2,
        responses: [],
      };
      mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
      assert.equal(loadSessionFromStorage(), null);
    });

    test('QuotaExceededError in sessionStorage does not crash saveSessionToStorage', () => {
      mockStorage.throwOnSet = true;
      const state = getInitialExperimentState();
      state.stage = 'reading';
      state.participantId = '12345678-1234-1234-1234-123456789abc';

      const result = saveSessionToStorage(state);
      assert.equal(result, false);
    });
  });
});
