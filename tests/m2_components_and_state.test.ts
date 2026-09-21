import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  experimentReducer,
  getInitialExperimentState,
  getBalancedLocalGroup,
  generateParticipantId,
} from '../src/lib/experimentState.ts';
import { captureClientTelemetry } from '../src/lib/telemetry.ts';
import {
  saveSessionToStorage,
  loadSessionFromStorage,
  clearSessionFromStorage,
} from '../src/lib/sessionRecovery.ts';
import type { ParticipantDemographicsInput } from '../src/types/experiment.ts';

describe('Milestone 2: Component Architecture & State Machine Tests', () => {
  describe('Experiment State Reducer', () => {
    test('M2.1: Initial state starts at welcome with zero trials and unhydrated', () => {
      const state = getInitialExperimentState();
      assert.equal(state.stage, 'welcome');
      assert.equal(state.isHydrated, false);
      assert.equal(state.deck.length, 0);
      assert.equal(state.responses.length, 0);
      assert.equal(state.currentTrialIndex, 0);
    });

    test('M2.2: Transitions welcome -> consent -> demographics', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      assert.equal(state.stage, 'consent');

      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });
      assert.equal(state.stage, 'demographics');
    });

    test('M2.3: Submitting valid demographics for included participant assigns congruent fake news and balanced group', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 23,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
      };
      const telemetry = captureClientTelemetry();

      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry, assignedGroup: 'emocional' },
      });

      assert.equal(state.stage, 'induction');
      assert.equal(state.isIncluded, true);
      assert.equal(state.inductionGroup, 'emocional');
      assert.equal(state.fakeNewsSet, 'psicoanalisis');
      assert.equal(state.deck.length, 20);
      assert.ok(state.participantId.length >= 36);

      // Verify deck contains exactly 12 true and 8 fake news
      const trueCount = state.deck.filter((item) => !item.isFake).length;
      const fakeCount = state.deck.filter((item) => item.isFake).length;
      assert.equal(trueCount, 12);
      assert.equal(fakeCount, 8);

      // Verify all fake items are in Psicoanálisis set
      state.deck.filter((item) => item.isFake).forEach((item) => {
        assert.equal(item.congruence, 'psicoanalisis');
      });
    });

    test('M2.4: Submitting demographics for excluded participant forces Control group', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 20,
        gender: 'Masculino',
        studiesPsychology: false, // Excluded
        therapeuticOrientation: 'Otros',
        university: 'UBA',
      };
      const telemetry = captureClientTelemetry();

      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry },
      });

      assert.equal(state.stage, 'induction');
      assert.equal(state.isIncluded, false);
      assert.equal(state.inductionGroup, 'control');
      assert.equal(state.fakeNewsSet, 'control_random');
      assert.equal(state.deck.length, 20);
    });

    test('M2.5: Full 20-trial loop transitions from reading to rating and concludes in debriefing', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 25,
        gender: 'Otro',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'Universidad Favaloro',
      };
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, telemetry: captureClientTelemetry(), assignedGroup: 'racional' },
      });

      // Induction acknowledge -> Trial 1 reading
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });
      assert.equal(state.stage, 'reading');
      assert.equal(state.currentTrialIndex, 0);

      // Loop through all 20 trials
      for (let i = 0; i < 20; i++) {
        assert.equal(state.stage, 'reading');
        assert.equal(state.currentTrialIndex, i);

        // 10s reading completion
        state = experimentReducer(state, {
          type: 'FINISH_READING',
          payload: { readingTimeMs: 10000 },
        });
        assert.equal(state.stage, 'rating');

        // Submit rating (alternating response 1 and 2)
        const responseOption = (i % 2 === 0 ? 1 : 2) as 1 | 2;
        state = experimentReducer(state, {
          type: 'RECORD_TRIAL_RESPONSE',
          payload: { responseOption, responseTimeMs: 2450 },
        });

        assert.equal(state.responses.length, i + 1);
        const record = state.responses[i];
        assert.equal(record.presentationOrder, i + 1);
        assert.equal(record.readingTimeMs, 10000);
        assert.equal(record.responseTimeMs, 2450);

        if (record.isFake) {
          if (responseOption === 1) {
            assert.equal(record.isFalseMemory, true);
            assert.equal(record.isFalseBelief, false);
          } else {
            assert.equal(record.isFalseMemory, false);
            assert.equal(record.isFalseBelief, true);
          }
        }
      }

      // After 20th trial, stage transitions to debriefing
      assert.equal(state.stage, 'debriefing');

      // Complete debriefing -> thankyou
      state = experimentReducer(state, { type: 'COMPLETE_DEBRIEFING' });
      assert.equal(state.stage, 'thankyou');
      assert.ok(state.completedAt);
    });

    test('M2.6: RESET_EXPERIMENT resets state to initial welcome screen', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'RESET_EXPERIMENT' });
      assert.equal(state.stage, 'welcome');
      assert.equal(state.isHydrated, true);
    });
  });

  describe('Client Telemetry Module', () => {
    test('M2.7: captureClientTelemetry returns valid device type, screen resolution, and user agent', () => {
      const telemetry = captureClientTelemetry();
      assert.ok(['desktop', 'mobile', 'tablet'].includes(telemetry.deviceType));
      assert.match(telemetry.screenResolution, /^\d+x\d+$/);
      assert.ok(typeof telemetry.userAgent === 'string');
    });
  });

  describe('Session Storage Recovery Manager', () => {
    test('M2.8: Correctly handles storage operations in non-window environment safely', () => {
      // In Node.js environment without window, these functions gracefully return false/null without throwing
      const saved = saveSessionToStorage(getInitialExperimentState());
      assert.equal(saved, false);

      const loaded = loadSessionFromStorage();
      assert.equal(loaded, null);

      // clearSessionFromStorage does not throw
      assert.doesNotThrow(() => clearSessionFromStorage());
    });
  });
});
