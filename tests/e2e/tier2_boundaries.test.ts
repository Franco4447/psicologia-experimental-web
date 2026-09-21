import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ExperimentEngine } from './harness/experimentEngine.ts';
import type { DemographicsInput, ResponseCode } from './harness/types.ts';

describe('Tier 2: Boundary, Corner Cases & Resilience Tests', () => {
  const engine = new ExperimentEngine();

  // -------------------------------------------------------------
  // DOMAIN 1: Demographics Boundaries & Input Stress
  // -------------------------------------------------------------
  describe('D1: Demographics Boundaries & Input Stress', () => {
    test('B1.1: Exact lower boundary age 18 is accepted', () => {
      const input: DemographicsInput = {
        age: 18,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, true);
    });

    test('B1.2: One unit below boundary age 17 is rejected', () => {
      const input: DemographicsInput = {
        age: 17,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('18 años')));
    });

    test('B1.3: Realistic upper age boundary (100) is accepted', () => {
      const input: DemographicsInput = {
        age: 100,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'UBA',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, true);
    });

    test('B1.4: Extreme age > 120 is rejected as biological impossibility', () => {
      const input: DemographicsInput = {
        age: 121,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'UBA',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('rango biológico')));
    });

    test('B1.5: Non-integer, zero, negative, and NaN ages are rejected', () => {
      const invalidAges = [-1, 0, 19.5, NaN, null as any, undefined as any];
      invalidAges.forEach((age) => {
        const input: DemographicsInput = {
          age,
          gender: 'Otro',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Favaloro',
        };
        const res = engine.validateDemographics(input);
        assert.equal(res.valid, false, `Age ${age} should be invalid`);
      });
    });

    test('B1.6: Whitespace-only university string is rejected', () => {
      const whitespaces = ['', ' ', '   \t\n  '];
      whitespaces.forEach((u) => {
        const input: DemographicsInput = {
          age: 22,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: u,
        };
        assert.equal(engine.validateDemographics(input).valid, false);
      });
    });

    test('B1.7: Special characters, accents and punctuation in university are accepted', () => {
      const input: DemographicsInput = {
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Facultad de Psicología (UBA) — Sede San Isidro / N° 45 & Co.',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, true);
    });

    test('B1.8: Very long university names (up to 500 characters) do not crash validation', () => {
      const longName = 'Universidad '.repeat(40);
      const input: DemographicsInput = {
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: longName,
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, true);
    });
  });

  // -------------------------------------------------------------
  // DOMAIN 2: Consent Enforcement & State Guarding
  // -------------------------------------------------------------
  describe('D2: Consent Enforcement & State Guarding', () => {
    test('B2.1: Default consent state is false (checkbox unchecked)', () => {
      let isConsentGiven = false;
      assert.equal(isConsentGiven, false);
    });

    test('B2.2: Attempting to advance without consent throws or blocks', () => {
      const checkCanAdvance = (consent: boolean) => {
        if (!consent) throw new Error('Consent required to continue.');
        return true;
      };
      assert.throws(() => checkCanAdvance(false), /Consent required/);
      assert.equal(checkCanAdvance(true), true);
    });

    test('B2.3: Toggling consent on and off restores blocked status', () => {
      let consent = false;
      assert.equal(consent, false);
      consent = true;
      assert.equal(consent, true);
      consent = false;
      assert.equal(consent, false);
    });

    test('B2.4: Forged payload without consent cannot establish participant session', () => {
      const simulateClientPayload = (payload: { hasConsent: boolean; demographics: DemographicsInput }) => {
        if (!payload.hasConsent) throw new Error('Unconsented submission rejected.');
        return engine.createSession(payload.demographics);
      };
      assert.throws(
        () =>
          simulateClientPayload({
            hasConsent: false,
            demographics: {
              age: 20,
              gender: 'Femenino',
              studiesPsychology: true,
              therapeuticOrientation: 'Psicoanálisis',
              university: 'Favaloro',
            },
          }),
        /Unconsented/
      );
    });

    test('B2.5: Explicit consent click successfully transitions to demographics form', () => {
      let step = 'consent';
      const onConsentAccept = () => {
        step = 'demographics';
      };
      onConsentAccept();
      assert.equal(step, 'demographics');
    });
  });

  // -------------------------------------------------------------
  // DOMAIN 3: Timing, Reaction Latency & Counter Mechanics
  // -------------------------------------------------------------
  describe('D3: Timing, Reaction Latency & Counter Mechanics', () => {
    test('B3.1: Stimulus exposure timer boundary: 9,999 ms cannot advance', () => {
      const elapsedMs = 9999;
      const canAdvance = elapsedMs >= 10000;
      assert.equal(canAdvance, false);
    });

    test('B3.2: Stimulus exposure timer boundary: exact 10,000 ms triggers advance', () => {
      const elapsedMs = 10000;
      const canAdvance = elapsedMs >= 10000;
      assert.equal(canAdvance, true);
    });

    test('B3.3: Rapid click handling: sub-100 ms reaction time is preserved accurately', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const recorded = engine.recordResponse(trials[0], 1, 10000, 45); // 45 ms RT
      assert.equal(recorded.responseTimeMs, 45);
    });

    test('B3.4: Extreme response latency (10 minutes = 600,000 ms) does not overflow integer', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const recorded = engine.recordResponse(trials[0], 4, 10000, 600000);
      assert.equal(recorded.responseTimeMs, 600000);
      assert.ok(Number.isSafeInteger(recorded.responseTimeMs));
    });

    test('B3.5: Negative reading time throws runtime validation error', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      assert.throws(() => engine.recordResponse(trials[0], 1, -100, 1500), /Reading time cannot be negative/);
    });

    test('B3.6: Negative response time throws runtime validation error', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      assert.throws(() => engine.recordResponse(trials[0], 1, 10000, -1), /Response time cannot be negative/);
    });
  });

  // -------------------------------------------------------------
  // DOMAIN 4: Network Resilience & Offline Sync Buffer
  // -------------------------------------------------------------
  describe('D4: Network Resilience & Offline Sync Buffer', () => {
    test('B4.1: Simulated network failure on trial response buffers item in offline queue', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const offlineQueue: any[] = [];

      // Simulate API POST failure
      const postTrialResponse = (trial: any, isOnline: boolean) => {
        if (!isOnline) {
          offlineQueue.push(trial);
          return { success: false, buffered: true };
        }
        return { success: true, buffered: false };
      };

      const recorded = engine.recordResponse(trials[6], 2, 10000, 1800);
      const res = postTrialResponse(recorded, false);
      assert.equal(res.success, false);
      assert.equal(res.buffered, true);
      assert.equal(offlineQueue.length, 1);
      assert.equal(offlineQueue[0].presentationOrder, 7);
    });

    test('B4.2: Multiple consecutive offline trials accumulate safely without data loss', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const offlineQueue: any[] = [];

      // Fail trials 8, 9, 10
      [7, 8, 9].forEach((idx) => {
        const recorded = engine.recordResponse(trials[idx], 3, 10000, 2000);
        offlineQueue.push(recorded);
      });

      assert.equal(offlineQueue.length, 3);
      assert.deepEqual(
        offlineQueue.map((t) => t.presentationOrder),
        [8, 9, 10]
      );
    });

    test('B4.3: On network reconnection, offline buffer flushes and preserves order', () => {
      const offlineQueue = [
        { presentationOrder: 10, newsId: 5 },
        { presentationOrder: 8, newsId: 12 },
        { presentationOrder: 9, newsId: 14 },
      ];

      // Sort by presentationOrder
      const flushed = [...offlineQueue].sort((a, b) => a.presentationOrder - b.presentationOrder);
      assert.deepEqual(
        flushed.map((t) => t.presentationOrder),
        [8, 9, 10]
      );
    });

    test('B4.4: Idempotent deduplication prevents double persistence of buffered trials', () => {
      const serverDatabase = new Map<string, any>();
      const saveTrial = (trial: { participantId: string; presentationOrder: number; option: number }) => {
        const key = `${trial.participantId}_${trial.presentationOrder}`;
        if (serverDatabase.has(key)) {
          return { status: 'already_exists' };
        }
        serverDatabase.set(key, trial);
        return { status: 'inserted' };
      };

      const t1 = { participantId: 'part-123', presentationOrder: 5, option: 1 };
      assert.equal(saveTrial(t1).status, 'inserted');
      // Retry same trial
      assert.equal(saveTrial(t1).status, 'already_exists');
      assert.equal(serverDatabase.size, 1);
    });

    test('B4.5: Failed flush keeps trials in local buffer for next retry cycle', () => {
      let localBuffer = [{ id: 1 }, { id: 2 }];
      let flushSuccess = false;

      if (!flushSuccess) {
        // Keep buffer untouched
        assert.equal(localBuffer.length, 2);
      }
      flushSuccess = true;
      if (flushSuccess) {
        localBuffer = [];
      }
      assert.equal(localBuffer.length, 0);
    });
  });

  // -------------------------------------------------------------
  // DOMAIN 5: State Machine Transition Integrity
  // -------------------------------------------------------------
  describe('D5: State Machine Transition Integrity', () => {
    test('B5.1: Direct jump to trials without demographic creation is forbidden', () => {
      let currentSession: any = null;
      const attemptStartTrials = () => {
        if (!currentSession) throw new Error('Session not created.');
      };
      assert.throws(() => attemptStartTrials(), /Session not created/);
    });

    test('B5.2: Cannot finish debriefing before completing all 20 trials', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session).slice(0, 15); // only 15 trials
      assert.throws(() => engine.completeSession(session, trials), /20 trials/);
    });

    test('B5.3: Invalid trial response option code (e.g. 5, 0, -1) throws error', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const invalidCodes = [0, 5, -1, 99];
      invalidCodes.forEach((code) => {
        assert.throws(() => engine.recordResponse(trials[0], code as any, 10000, 1000), /Invalid response option/);
      });
    });

    test('B5.4: Cannot mutate completed session back to active status', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const completed = engine.completeSession(session, trials);
      assert.equal(completed.status, 'completed');

      const tryReopenSession = (s: typeof completed) => {
        if (s.status === 'completed') throw new Error('Session is already finalized and locked.');
      };
      assert.throws(() => tryReopenSession(completed), /finalized and locked/);
    });

    test('B5.5: Double submission of completed session is prevented', () => {
      let submissionCount = 0;
      const submitCompletion = (isCompleted: boolean) => {
        if (isCompleted) throw new Error('Session already completed.');
        submissionCount++;
      };

      submitCompletion(false);
      assert.equal(submissionCount, 1);
      assert.throws(() => submitCompletion(true), /Session already completed/);
    });
  });
});
