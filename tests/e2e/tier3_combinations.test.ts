import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ExperimentEngine } from './harness/experimentEngine.ts';
import { BalanceOracle } from './harness/balanceOracle.ts';
import {
  PSICOANALISIS_FAKE_IDS,
  EVIDENCIA_FAKE_IDS,
  INDUCTION_PROMPTS,
} from './harness/stimulusOracle.ts';
import { generateParticipantCsvRows } from './harness/csvValidator.ts';
import type { DemographicsInput, ResponseCode } from './harness/types.ts';

describe('Tier 3: Cross-Feature Combinations (Pairwise Permutations)', () => {
  // -------------------------------------------------------------
  // PERMUTATION SUITE 1: Included Participants (Orientation x Induction Group)
  // -------------------------------------------------------------
  describe('P1: Included Participants (Psychology Student = true)', () => {
    test('C1: Psicoanálisis + Student + Racional Induction', () => {
      const oracle = new BalanceOracle({ racional: 0, emocional: 5, control: 5 });
      const engine = new ExperimentEngine(oracle);

      const input: DemographicsInput = {
        age: 21,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, true);
      assert.equal(session.inductionGroup, 'racional');
      assert.equal(session.fakeNewsSet, 'psicoanalisis');

      const trials = engine.initializeTrials(session);
      assert.equal(trials.length, 20);

      const fakeIds = trials.filter((t) => t.isFake).map((t) => t.newsId).sort((a, b) => a - b);
      assert.deepEqual(fakeIds, PSICOANALISIS_FAKE_IDS);
      assert.equal(INDUCTION_PROMPTS[session.inductionGroup], INDUCTION_PROMPTS.racional);
    });

    test('C2: Psicoanálisis + Student + Emocional Induction', () => {
      const oracle = new BalanceOracle({ racional: 5, emocional: 0, control: 5 });
      const engine = new ExperimentEngine(oracle);

      const input: DemographicsInput = {
        age: 23,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'UBA',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, true);
      assert.equal(session.inductionGroup, 'emocional');
      assert.equal(session.fakeNewsSet, 'psicoanalisis');
      assert.equal(INDUCTION_PROMPTS[session.inductionGroup], INDUCTION_PROMPTS.emocional);
    });

    test('C3: Psicoanálisis + Student + Control Induction', () => {
      const oracle = new BalanceOracle({ racional: 5, emocional: 5, control: 0 });
      const engine = new ExperimentEngine(oracle);

      const input: DemographicsInput = {
        age: 24,
        gender: 'Otro',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad de Belgrano',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, true);
      assert.equal(session.inductionGroup, 'control');
      assert.equal(session.fakeNewsSet, 'psicoanalisis');
      assert.equal(INDUCTION_PROMPTS[session.inductionGroup], INDUCTION_PROMPTS.control);
    });

    test('C4: Basada en Evidencia + Student + Racional Induction', () => {
      const oracle = new BalanceOracle({ racional: 0, emocional: 3, control: 3 });
      const engine = new ExperimentEngine(oracle);

      const input: DemographicsInput = {
        age: 26,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, true);
      assert.equal(session.inductionGroup, 'racional');
      assert.equal(session.fakeNewsSet, 'evidencia');

      const trials = engine.initializeTrials(session);
      const fakeIds = trials.filter((t) => t.isFake).map((t) => t.newsId).sort((a, b) => a - b);
      assert.deepEqual(fakeIds, EVIDENCIA_FAKE_IDS);
      // Verify stimulus 26 is included in Evidencia set
      assert.ok(fakeIds.includes(26), 'Stimulus 26 (.png) must be present in Evidencia set');
    });

    test('C5: Basada en Evidencia + Student + Emocional Induction', () => {
      const oracle = new BalanceOracle({ racional: 4, emocional: 1, control: 4 });
      const engine = new ExperimentEngine(oracle);

      const input: DemographicsInput = {
        age: 22,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'Universidad Torcuato Di Tella',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, true);
      assert.equal(session.inductionGroup, 'emocional');
      assert.equal(session.fakeNewsSet, 'evidencia');
    });

    test('C6: Basada en Evidencia + Student + Control Induction', () => {
      const oracle = new BalanceOracle({ racional: 2, emocional: 2, control: 0 });
      const engine = new ExperimentEngine(oracle);

      const input: DemographicsInput = {
        age: 25,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'UBA',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, true);
      assert.equal(session.inductionGroup, 'control');
      assert.equal(session.fakeNewsSet, 'evidencia');
    });
  });

  // -------------------------------------------------------------
  // PERMUTATION SUITE 2: Excluded Participants Permutations
  // -------------------------------------------------------------
  describe('P2: Excluded Participants (Any Non-Qualifying Combination)', () => {
    test('C7: Psychology Student + "Otros" Orientation -> EXCLUDED', () => {
      const engine = new ExperimentEngine();
      const input: DemographicsInput = {
        age: 22,
        gender: 'Otro',
        studiesPsychology: true,
        therapeuticOrientation: 'Otros',
        university: 'Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, false);
      assert.equal(session.inductionGroup, 'control');
      assert.equal(session.fakeNewsSet, 'control_random');
    });

    test('C8: Non-Psychology Student + Psicoanálisis Orientation -> EXCLUDED', () => {
      const engine = new ExperimentEngine();
      const input: DemographicsInput = {
        age: 35,
        gender: 'Masculino',
        studiesPsychology: false,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'UADE',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, false);
      assert.equal(session.inductionGroup, 'control');
      assert.equal(session.fakeNewsSet, 'control_random');
    });

    test('C9: Non-Psychology Student + Basada en Evidencia Orientation -> EXCLUDED', () => {
      const engine = new ExperimentEngine();
      const input: DemographicsInput = {
        age: 29,
        gender: 'Femenino',
        studiesPsychology: false,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'San Andrés',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, false);
      assert.equal(session.inductionGroup, 'control');
      assert.equal(session.fakeNewsSet, 'control_random');
    });

    test('C10: Non-Psychology Student + "Otros" Orientation -> EXCLUDED', () => {
      const engine = new ExperimentEngine();
      const input: DemographicsInput = {
        age: 40,
        gender: 'Masculino',
        studiesPsychology: false,
        therapeuticOrientation: 'Otros',
        university: 'UBA Medicina',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };

      const session = engine.createSession(input);
      assert.equal(session.isIncluded, false);
      assert.equal(session.inductionGroup, 'control');
      assert.equal(session.fakeNewsSet, 'control_random');
    });
  });

  // -------------------------------------------------------------
  // PERMUTATION SUITE 3: Response Matrix & Murphy/León Transformations
  // -------------------------------------------------------------
  describe('P3: Response Matrix & False Memory Flag Combinations', () => {
    test('C11: Homogeneous Option 1 (All False Memories on fake news)', () => {
      const engine = new ExperimentEngine();
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        });
      const trials = engine.initializeTrials(session);

      // Participant answers Option 1 to all 20 trials
      const answered = trials.map((t) => engine.recordResponse(t, 1, 10000, 1500));
      const csvRows = generateParticipantCsvRows(session, answered);

      const fakeRows = csvRows.filter((r) => r.is_fake);
      const trueRows = csvRows.filter((r) => !r.is_fake);

      assert.equal(fakeRows.length, 8);
      assert.equal(trueRows.length, 12);

      // On all 8 fake news, is_false_memory MUST be true and is_false_belief false
      fakeRows.forEach((r) => {
        assert.equal(r.is_false_memory, true);
        assert.equal(r.is_false_belief, false);
      });

      // On all 12 true news, both flags MUST be false
      trueRows.forEach((r) => {
        assert.equal(r.is_false_memory, false);
        assert.equal(r.is_false_belief, false);
      });
    });

    test('C12: Homogeneous Option 2 (All False Beliefs on fake news)', () => {
      const engine = new ExperimentEngine();
      const session = engine.createSession({
        age: 24,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        });
      const trials = engine.initializeTrials(session);

      // Participant answers Option 2 to all 20 trials
      const answered = trials.map((t) => engine.recordResponse(t, 2, 10000, 2000));
      const csvRows = generateParticipantCsvRows(session, answered);

      const fakeRows = csvRows.filter((r) => r.is_fake);
      const trueRows = csvRows.filter((r) => !r.is_fake);

      fakeRows.forEach((r) => {
        assert.equal(r.is_false_memory, false);
        assert.equal(r.is_false_belief, true);
      });
      trueRows.forEach((r) => {
        assert.equal(r.is_false_memory, false);
        assert.equal(r.is_false_belief, false);
      });
    });

    test('C13: Homogeneous Option 4 (Skeptical / No memory on all items)', () => {
      const engine = new ExperimentEngine();
      const session = engine.createSession({
        age: 21,
        gender: 'Otro',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        });
      const trials = engine.initializeTrials(session);

      const answered = trials.map((t) => engine.recordResponse(t, 4, 10000, 1200));
      const csvRows = generateParticipantCsvRows(session, answered);

      csvRows.forEach((r) => {
        assert.equal(r.is_false_memory, false);
        assert.equal(r.is_false_belief, false);
      });
    });
  });
});
