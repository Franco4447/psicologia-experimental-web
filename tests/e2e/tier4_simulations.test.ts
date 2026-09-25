import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ExperimentEngine } from './harness/experimentEngine.ts';
import { BalanceOracle } from './harness/balanceOracle.ts';
import { SimulatedUser } from './harness/simulatedUser.ts';
import {
  generateParticipantCsvRows,
  serializeToCsv,
  validateCsvStructure,
} from './harness/csvValidator.ts';
import { PSICOANALISIS_FAKE_IDS, EVIDENCIA_FAKE_IDS } from './harness/stimulusOracle.ts';

describe('Tier 4: Real-World End-to-End Simulation Scenarios', () => {
  // -------------------------------------------------------------
  // SCENARIO 1: Included Psychoanalysis Student in Emotional Group
  // -------------------------------------------------------------
  test('Scenario 1: Complete flow for Psychoanalysis student in Emotional condition', async () => {
    const oracle = new BalanceOracle({ racional: 2, emocional: 0, control: 2 });
    const engine = new ExperimentEngine(oracle);
    const user = new SimulatedUser(engine);

    const result = await user.executeJourney({
      acceptConsent: true,
      demographics: {
        age: 21,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      },
      responseStrategy: 'realistic_mixed',
      telemetry: {
        deviceType: 'desktop',
        screenResolution: '1920x1080',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    assert.equal(result.completedSuccessfully, true);
    assert.equal(result.session.isIncluded, true);
    assert.equal(result.session.inductionGroup, 'emocional');
    assert.equal(result.session.fakeNewsSet, 'psicoanalisis');
    assert.equal(result.session.status, 'completed');
    assert.ok(result.session.completedAt);
    assert.equal(result.trials.length, 20);

    // Verify congruent fake news IDs
    const fakeNewsIds = result.trials
      .filter((t) => t.isFake)
      .map((t) => t.newsId)
      .sort((a, b) => a - b);
    assert.deepEqual(fakeNewsIds, PSICOANALISIS_FAKE_IDS);

    // Validate generated CSV export
    const rows = generateParticipantCsvRows(result.session, result.trials);
    assert.equal(rows.length, 20);
    const csvString = serializeToCsv(rows, true);
    const validation = validateCsvStructure(csvString, 1);
    assert.equal(validation.valid, true, `CSV validation errors: ${validation.errors.join(', ')}`);
  });

  // -------------------------------------------------------------
  // SCENARIO 2: Included Evidence-Based Student in Rational Group
  // -------------------------------------------------------------
  test('Scenario 2: Complete flow for Evidence-Based student in Rational condition', async () => {
    const oracle = new BalanceOracle({ racional: 0, emocional: 3, control: 3 });
    const engine = new ExperimentEngine(oracle);
    const user = new SimulatedUser(engine);

    const result = await user.executeJourney({
      acceptConsent: true,
      demographics: {
        age: 24,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'Universidad de Buenos Aires (UBA)',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      },
      responseStrategy: 'all_false_beliefs',
      telemetry: {
        deviceType: 'desktop',
        screenResolution: '2560x1440',
      },
    });

    assert.equal(result.completedSuccessfully, true);
    assert.equal(result.session.isIncluded, true);
    assert.equal(result.session.inductionGroup, 'racional');
    assert.equal(result.session.fakeNewsSet, 'evidencia');
    assert.equal(result.trials.length, 20);

    // Verify stimulus 26 (.png asset) is included
    const hasStimulus26 = result.trials.some((t) => t.newsId === 26);
    assert.equal(hasStimulus26, true);

    // Validate CSV rows
    const rows = generateParticipantCsvRows(result.session, result.trials);
    const csvString = serializeToCsv(rows, true);
    const validation = validateCsvStructure(csvString, 1);
    assert.equal(validation.valid, true);

    // Verify all 8 fake news are marked as false belief
    const fakeRows = rows.filter((r) => r.is_fake);
    assert.equal(fakeRows.length, 8);
    fakeRows.forEach((r) => {
      assert.equal(r.is_false_belief, true);
      assert.equal(r.is_false_memory, false);
    });
  });

  // -------------------------------------------------------------
  // SCENARIO 3: Included Psychoanalysis Student in Control Group
  // -------------------------------------------------------------
  test('Scenario 3: Complete flow for Psychoanalysis student in Control condition', async () => {
    const oracle = new BalanceOracle({ racional: 4, emocional: 4, control: 1 });
    const engine = new ExperimentEngine(oracle);
    const user = new SimulatedUser(engine);

    const result = await user.executeJourney({
      acceptConsent: true,
      demographics: {
        age: 22,
        gender: 'Otro',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      },
      responseStrategy: 'all_false_memories',
      telemetry: {
        deviceType: 'mobile',
        screenResolution: '390x844',
      },
    });

    assert.equal(result.completedSuccessfully, true);
    assert.equal(result.session.inductionGroup, 'control');
    assert.match(result.sawInductionText, /titulares de noticias reales de 2017-2018/);

    const rows = generateParticipantCsvRows(result.session, result.trials);
    const csvString = serializeToCsv(rows, true);
    const validation = validateCsvStructure(csvString, 1);
    assert.equal(validation.valid, true);

    const fakeRows = rows.filter((r) => r.is_fake);
    fakeRows.forEach((r) => {
      assert.equal(r.is_false_memory, true);
      assert.equal(r.is_false_belief, false);
    });
  });

  // -------------------------------------------------------------
  // SCENARIO 4: Excluded Participant (Non-Psychology Student)
  // -------------------------------------------------------------
  test('Scenario 4: Transparent flow for Excluded Participant without quota skew', async () => {
    const oracle = new BalanceOracle({ racional: 5, emocional: 5, control: 5 });
    const engine = new ExperimentEngine(oracle);
    const user = new SimulatedUser(engine);

    const result = await user.executeJourney({
      acceptConsent: true,
      demographics: {
        age: 30,
        gender: 'Masculino',
        studiesPsychology: false, // EXCLUDED
        therapeuticOrientation: 'Psicoanálisis',
        university: 'ITBA Ingeniería',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      },
      responseStrategy: 'skeptical_none',
    });

    assert.equal(result.completedSuccessfully, true);
    assert.equal(result.session.isIncluded, false);
    assert.equal(result.session.inductionGroup, 'control');
    assert.equal(result.session.fakeNewsSet, 'control_random');

    // Balance oracle counts MUST remain unaffected
    const counts = oracle.getCounts();
    assert.equal(counts.racional, 5);
    assert.equal(counts.emocional, 5);
    assert.equal(counts.control, 5);
    assert.equal(oracle.getExcludedCount(), 1);

    const rows = generateParticipantCsvRows(result.session, result.trials);
    assert.equal(rows[0].is_included, false);
    const csvString = serializeToCsv(rows, true);
    assert.equal(validateCsvStructure(csvString, 1).valid, true);
  });

  // -------------------------------------------------------------
  // SCENARIO 5: Network Disruption & Offline Buffer Recovery
  // -------------------------------------------------------------
  test('Scenario 5: Participant undergoes network disconnect at trials 14-16 and recovers', async () => {
    const oracle = new BalanceOracle();
    const engine = new ExperimentEngine(oracle);
    const user = new SimulatedUser(engine);

    const result = await user.executeJourney({
      acceptConsent: true,
      demographics: {
        age: 23,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'Universidad Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      },
      responseStrategy: 'realistic_mixed',
      simulateNetworkFailuresAtTrials: [14, 15, 16],
    });

    assert.equal(result.completedSuccessfully, true);
    assert.equal(result.offlineBufferedTrials.length, 3);
    assert.deepEqual(
      result.offlineBufferedTrials.map((t) => t.presentationOrder),
      [14, 15, 16]
    );

    // After reconnection flush, all 20 trials exist in order
    assert.equal(result.trials.length, 20);
    const orders = result.trials.map((t) => t.presentationOrder);
    const expected = Array.from({ length: 20 }, (_, i) => i + 1);
    assert.deepEqual(orders, expected);

    const rows = generateParticipantCsvRows(result.session, result.trials);
    const csvString = serializeToCsv(rows, true);
    assert.equal(validateCsvStructure(csvString, 1).valid, true);
  });

  // -------------------------------------------------------------
  // SCENARIO 6: Mass Batch Simulation (60 Participants) & Balance Stress Test
  // -------------------------------------------------------------
  test('Scenario 6: Mass batch of 60 participants preserves balance delta <= 1 and produces 1200-row CSV', async () => {
    const oracle = new BalanceOracle();
    const engine = new ExperimentEngine(oracle);
    const user = new SimulatedUser(engine);

    const allCsvRows: any[] = [];

    for (let i = 0; i < 60; i++) {
      const orientation =
        i % 2 === 0 ? 'Psicoanálisis' : 'Basada en Evidencia Científica';

      const result = await user.executeJourney({
        acceptConsent: true,
        demographics: {
          age: 20 + (i % 10),
          gender: i % 3 === 0 ? 'Femenino' : i % 3 === 1 ? 'Masculino' : 'Otro',
          studiesPsychology: true,
          therapeuticOrientation: orientation as any,
          university: 'Universidad Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      },
        responseStrategy: 'realistic_mixed',
      });

      assert.equal(result.completedSuccessfully, true);
      assert.ok(
        oracle.getBalanceDelta() <= 1,
        `Balance delta exceeded 1 at participant ${i + 1}`
      );

      const rows = generateParticipantCsvRows(result.session, result.trials);
      allCsvRows.push(...rows);
    }

    // After 60 participants, exactly 20 in each group
    const counts = oracle.getCounts();
    assert.equal(counts.racional, 20);
    assert.equal(counts.emocional, 20);
    assert.equal(counts.control, 20);
    assert.equal(oracle.getBalanceDelta(), 0);

    // Master CSV export has exactly 1,200 rows (60 * 20)
    assert.equal(allCsvRows.length, 1200);
    const masterCsv = serializeToCsv(allCsvRows, true);
    const validation = validateCsvStructure(masterCsv, 60);
    assert.equal(validation.valid, true, `Master CSV invalid: ${validation.errors.slice(0, 5).join('; ')}`);
    assert.equal(validation.rowCount, 1200);
  });
});
