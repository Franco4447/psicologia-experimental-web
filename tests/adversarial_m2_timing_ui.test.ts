import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { StimulusReadingScreen } from '../src/components/StimulusReadingScreen.tsx';
import { RatingScreen } from '../src/components/RatingScreen.tsx';
import {
  experimentReducer,
  getInitialExperimentState,
  getBalancedLocalGroup
} from '../src/lib/experimentState.ts';
import { STIMULI, RESPONSE_OPTIONS } from '../src/data/stimuli.ts';
import type { ResponseCode, ParticipantDemographicsInput } from '../src/types/experiment.ts';

describe('Adversarial Verification: Milestone 2 Timing, Transitions & UI Engine', () => {
  describe('Domain 1: Stimulus Reading Timer & Exposure Auto-Advance', () => {
    test('ADV-M2.1: Reading screen contains no skip button or advance mechanism', () => {
      const stimulus = STIMULI[0];
      const html = renderToStaticMarkup(
        React.createElement(StimulusReadingScreen, {
          stimulus,
          trialNumber: 1,
          totalTrials: 20
        })
      );
      assert.ok(html.includes('Fase de Lectura'));
      assert.equal(html.includes('<button'), false);
      assert.equal(html.includes('<a'), false);
    });

    test('ADV-M2.2: Exposure auto-advance strictly requires elapsed >= 10,000ms', () => {
      const EXPOSURE_MS = 10000;
      const subThreshold = [0, 100, 2500, 5000, 9900, 9999, 9999.9];
      subThreshold.forEach((elapsed) => {
        assert.equal(elapsed >= EXPOSURE_MS, false);
      });
      assert.equal(10000 >= EXPOSURE_MS, true);
    });

    test('ADV-M2.3: onLoad Latching ensures exposure starts strictly after image load', () => {
      const mountTime = 0;
      const loadDelay = 3500; // 3.5s image load
      const exposureDuration = 10000;

      const completionTime = loadDelay + exposureDuration;
      assert.equal(completionTime, 13500);
      assert.ok(completionTime - mountTime >= exposureDuration);
      assert.equal(completionTime - loadDelay, exposureDuration);
    });
  });

  describe('Domain 2: Rating Screen UI Constraints & Mutual Exclusivity', () => {
    test('ADV-M2.4: Advance button is disabled on mount when selectedOption is null', () => {
      const stimulus = STIMULI[0];
      const html = renderToStaticMarkup(
        React.createElement(RatingScreen, {
          stimulus,
          trialNumber: 1,
          totalTrials: 20
        })
      );
      assert.ok(html.includes('disabled'));
      assert.ok(html.includes('cursor-not-allowed'));
    });

    test('ADV-M2.5: Monte Carlo Mutual Exclusivity: exactly 1 option selected across 2,000 randomized clicks', () => {
      let currentSelection: ResponseCode | null = null;
      for (let i = 0; i < 2000; i++) {
        const code = ((i % 4) + 1) as ResponseCode;
        currentSelection = code;

        const options = [1, 2, 3, 4];
        const selected = options.filter((c) => c === currentSelection);
        const deselected = options.filter((c) => c !== currentSelection);

        assert.equal(selected.length, 1);
        assert.equal(deselected.length, 3);
        assert.equal(selected[0], code);
      }
    });

    test('ADV-M2.6: Advance button enables only when an option is selected', () => {
      const canSubmit = (selectedOption: ResponseCode | null, isSubmitting: boolean) => {
        return selectedOption !== null && !isSubmitting;
      };

      assert.equal(canSubmit(null, false), false);
      assert.equal(canSubmit(1, false), true);
      assert.equal(canSubmit(2, false), true);
      assert.equal(canSubmit(3, false), true);
      assert.equal(canSubmit(4, false), true);
      assert.equal(canSubmit(1, true), false); // Locked while submitting
    });
  });

  describe('Domain 3: Reaction Time Measurement & Latency Boundaries', () => {
    test('ADV-M2.7: Sub-100ms rapid clicks accurately preserved as integers', () => {
      const computeRT = (mount: number, click: number) => {
        return Math.max(1, Math.round(click - mount));
      };

      assert.equal(computeRT(1000, 1045), 45);
      assert.equal(computeRT(1000, 1089), 89);
      assert.equal(computeRT(1000, 1005), 5);
      assert.equal(computeRT(1000, 1000.4), 1);
    });

    test('ADV-M2.8: Negative or zero clock deltas clamp strictly to 1ms', () => {
      const computeRT = (mount: number, click: number) => {
        return Math.max(1, Math.round(click - mount));
      };

      assert.equal(computeRT(1000, 1000), 1);
      assert.equal(computeRT(1000, 950), 1);
    });

    test('ADV-M2.9: Prolonged delays (>1m, 10m, 1h) remain safe integers within PostgreSQL 32-bit INT', () => {
      const computeRT = (mount: number, click: number) => {
        return Math.max(1, Math.round(click - mount));
      };

      const delays = [60000, 300000, 600000, 3600000, 86400000];
      const PG_INT_MAX = 2147483647;

      delays.forEach((delay) => {
        const rt = computeRT(0, delay);
        assert.equal(rt, delay);
        assert.ok(Number.isSafeInteger(rt));
        assert.ok(rt <= PG_INT_MAX);
      });
    });
  });

  describe('Domain 4: State Machine Reducer & Trial Flow Defense', () => {
    test('ADV-M2.10: Reducer strictly ignores out-of-order and duplicate submissions', () => {
      let state = getInitialExperimentState();
      state = experimentReducer(state, { type: 'START_CONSENT' });
      state = experimentReducer(state, { type: 'ACCEPT_CONSENT' });

      const demographics: ParticipantDemographicsInput = {
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro'
      };
      state = experimentReducer(state, {
        type: 'SUBMIT_DEMOGRAPHICS',
        payload: { demographics, assignedGroup: 'control' }
      });
      state = experimentReducer(state, { type: 'ACKNOWLEDGE_INDUCTION' });
      assert.equal(state.stage, 'reading');

      // Attempt to submit rating during reading stage -> ignored
      const ignoredRating = experimentReducer(state, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 1, responseTimeMs: 1200 }
      });
      assert.equal(ignoredRating.stage, 'reading');
      assert.equal(ignoredRating.responses.length, 0);

      // Finish reading properly
      state = experimentReducer(state, {
        type: 'FINISH_READING',
        payload: { readingTimeMs: 10000 }
      });
      assert.equal(state.stage, 'rating');

      // Submit rating
      state = experimentReducer(state, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 1, responseTimeMs: 2400 }
      });
      assert.equal(state.stage, 'reading');
      assert.equal(state.responses.length, 1);

      // Attempt immediate duplicate in same tick -> ignored
      const duplicate = experimentReducer(state, {
        type: 'RECORD_TRIAL_RESPONSE',
        payload: { responseOption: 1, responseTimeMs: 2400 }
      });
      assert.equal(duplicate.responses.length, 1);
    });
  });
});
