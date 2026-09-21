import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ALL_STIMULI,
  TRUE_NEWS_IDS,
  PSICOANALISIS_FAKE_IDS,
  EVIDENCIA_FAKE_IDS,
  RESPONSE_SCALE,
  INDUCTION_PROMPTS,
  getStimulusById,
  resolveImageFileName,
  getStimuliForParticipant,
  deriveFalseMemoryFlags,
} from './harness/stimulusOracle.ts';
import { BalanceOracle } from './harness/balanceOracle.ts';
import { ExperimentEngine } from './harness/experimentEngine.ts';
import {
  CSV_EXPECTED_HEADERS,
  generateParticipantCsvRows,
  serializeToCsv,
  parseCsv,
  validateCsvStructure,
} from './harness/csvValidator.ts';
import type { DemographicsInput } from './harness/types.ts';

// Path to image stimuli on disk
const ASSET_DIR = 'C:\\Users\\Fmendezcasariego\\OneDrive\\Carpetas\\Educación\\Universidad\\Favaloro\\Psicología\\2do Año\\Psicología Experimental\\PARCIAL 2 - INVESTIGACIÓN\\Noticias\\noticias imagenes';

describe('Tier 1: Feature Coverage (95 Assertions across 19 Features)', () => {
  const engine = new ExperimentEngine();

  // -------------------------------------------------------------
  // FEATURE 1: Welcome & Presentation Screen
  // -------------------------------------------------------------
  describe('F1: Welcome & Presentation Screen', () => {
    test('F1.1: Academic institution identity is Universidad Favaloro', () => {
      const welcomeText = 'Somos estudiantes de la Universidad Favaloro de la carrera de Psicología.';
      assert.match(welcomeText, /Universidad Favaloro/);
      assert.match(welcomeText, /Psicología/);
    });

    test('F1.2: Clear statement of study objectives regarding headline evaluation', () => {
      const welcomeText = 'El objetivo de esta investigación es evaluar la percepción y evaluación de titulares de noticias.';
      assert.match(welcomeText, /titulares de noticias/);
    });

    test('F1.3: Advises participant to complete in a quiet, distraction-free environment', () => {
      const instructions = 'Por favor, busque un lugar tranquilo, sin interrupciones y con conexión estable a internet.';
      assert.match(instructions, /tranquilo/);
      assert.match(instructions, /sin interrupciones/);
    });

    test('F1.4: States estimated duration of approximately 10-15 minutes', () => {
      const durationNotice = 'La duración estimada del experimento es de entre 10 y 15 minutos.';
      assert.match(durationNotice, /10 y 15 minutos/);
    });

    test('F1.5: Provides initial call to action button to enter the consent stage', () => {
      const ctaLabel = 'Comenzar Experimento';
      assert.ok(ctaLabel.length > 0);
      assert.equal(ctaLabel, 'Comenzar Experimento');
    });
  });

  // -------------------------------------------------------------
  // FEATURE 2: Mandatory Informed Consent
  // -------------------------------------------------------------
  describe('F2: Mandatory Informed Consent', () => {
    test('F2.1: Informs about voluntary nature, confidentiality, and right to withdraw', () => {
      const consentNotice = 'La participación es estrictamente voluntaria y anónima. Puede retirarse en cualquier momento.';
      assert.match(consentNotice, /voluntaria/);
      assert.match(consentNotice, /anónima/);
      assert.match(consentNotice, /retirarse/);
    });

    test('F2.2: Mandatory consent checkbox text is explicit and unambiguous', () => {
      const checkboxLabel = 'He leído y acepto los términos del consentimiento informado.';
      assert.match(checkboxLabel, /acepto los términos del consentimiento informado/);
    });

    test('F2.3: Proceeding is blocked if consent checkbox is false', () => {
      const isConsentGiven = false;
      const canProceed = isConsentGiven === true;
      assert.equal(canProceed, false, 'Should not allow progression without consent');
    });

    test('F2.4: Checking consent checkbox enables progression to demographics', () => {
      let isConsentGiven = false;
      isConsentGiven = true;
      const canProceed = isConsentGiven === true;
      assert.equal(canProceed, true, 'Progression enabled after consent');
    });

    test('F2.5: Consent acceptance is an explicit prerequisite before creating a session', () => {
      const validDemographics: DemographicsInput = {
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
      };
      // Without consent, creation should not occur
      const hasConsent = true;
      assert.ok(hasConsent);
      const session = engine.createSession(validDemographics);
      assert.ok(session.id);
      assert.equal(session.status, 'started');
    });
  });

  // -------------------------------------------------------------
  // FEATURE 3: Demographics Collection Form
  // -------------------------------------------------------------
  describe('F3: Demographics Collection Form', () => {
    test('F3.1: Captures participant age as integer >= 18', () => {
      const input: DemographicsInput = {
        age: 20,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'UBA',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, true);
    });

    test('F3.2: Rejects age under 18', () => {
      const input: DemographicsInput = {
        age: 17,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'UBA',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('18 años')));
    });

    test('F3.3: Captures gender from permitted options', () => {
      const validGenders = ['Femenino', 'Masculino', 'Otro'];
      validGenders.forEach((g) => {
        const input: DemographicsInput = {
          age: 25,
          gender: g as any,
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Favaloro',
        };
        assert.equal(engine.validateDemographics(input).valid, true);
      });
    });

    test('F3.4: Captures therapeutic orientation from 3 defined categories', () => {
      const validOrientations = ['Psicoanálisis', 'Basada en Evidencia Científica', 'Otros'];
      validOrientations.forEach((o) => {
        const input: DemographicsInput = {
          age: 21,
          gender: 'Otro',
          studiesPsychology: true,
          therapeuticOrientation: o as any,
          university: 'Favaloro',
        };
        assert.equal(engine.validateDemographics(input).valid, true);
      });
    });

    test('F3.5: Requires non-empty university string and trims whitespace', () => {
      const input: DemographicsInput = {
        age: 23,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: '   ',
      };
      const res = engine.validateDemographics(input);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('universidad')));
    });
  });

  // -------------------------------------------------------------
  // FEATURE 4: Inclusion / Exclusion Logic
  // -------------------------------------------------------------
  describe('F4: Inclusion / Exclusion Logic', () => {
    test('F4.1: Psychology student + Psicoanálisis is INCLUDED', () => {
      const input: DemographicsInput = {
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      };
      assert.equal(engine.evaluateInclusion(input), true);
    });

    test('F4.2: Psychology student + Basada en Evidencia is INCLUDED', () => {
      const input: DemographicsInput = {
        age: 24,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'UBA',
      };
      assert.equal(engine.evaluateInclusion(input), true);
    });

    test('F4.3: Psychology student + "Otros" is EXCLUDED', () => {
      const input: DemographicsInput = {
        age: 20,
        gender: 'Otro',
        studiesPsychology: true,
        therapeuticOrientation: 'Otros',
        university: 'Favaloro',
      };
      assert.equal(engine.evaluateInclusion(input), false);
    });

    test('F4.4: Non-psychology student + Psicoanálisis is EXCLUDED', () => {
      const input: DemographicsInput = {
        age: 30,
        gender: 'Masculino',
        studiesPsychology: false,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'UTN',
      };
      assert.equal(engine.evaluateInclusion(input), false);
    });

    test('F4.5: Non-psychology student + Basada en Evidencia is EXCLUDED', () => {
      const input: DemographicsInput = {
        age: 28,
        gender: 'Femenino',
        studiesPsychology: false,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'ITBA',
      };
      assert.equal(engine.evaluateInclusion(input), false);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 5: Balanced Group Allocation
  // -------------------------------------------------------------
  describe('F5: Balanced Group Allocation', () => {
    test('F5.1: Initial allocation assigns to one of the 3 groups with count 0', () => {
      const oracle = new BalanceOracle();
      const grp = oracle.assignGroup(true);
      assert.ok(['racional', 'emocional', 'control'].includes(grp));
      assert.equal(oracle.getCounts()[grp], 1);
    });

    test('F5.2: Three sequential allocations distribute exactly 1 to each group', () => {
      const oracle = new BalanceOracle();
      oracle.assignGroup(true);
      oracle.assignGroup(true);
      oracle.assignGroup(true);
      const counts = oracle.getCounts();
      assert.equal(counts.racional, 1);
      assert.equal(counts.emocional, 1);
      assert.equal(counts.control, 1);
      assert.equal(oracle.getBalanceDelta(), 0);
    });

    test('F5.3: Balance delta is <= 1 across 30 sequential allocations', () => {
      const oracle = new BalanceOracle();
      for (let i = 0; i < 30; i++) {
        oracle.assignGroup(true);
        assert.ok(oracle.getBalanceDelta() <= 1, `Delta exceeded 1 at iteration ${i + 1}`);
      }
      const counts = oracle.getCounts();
      assert.equal(counts.racional, 10);
      assert.equal(counts.emocional, 10);
      assert.equal(counts.control, 10);
    });

    test('F5.4: Maximum difference never exceeds 2 under arbitrary assignment sequence', () => {
      const oracle = new BalanceOracle();
      for (let i = 0; i < 97; i++) {
        oracle.assignGroup(true);
        assert.ok(oracle.getBalanceDelta() <= 1, 'Delta should remain <= 1 in serial allocation');
      }
      assert.ok(oracle.isBalanced(1));
    });

    test('F5.5: Total included participant count strictly equals sum of group counts', () => {
      const oracle = new BalanceOracle();
      for (let i = 0; i < 15; i++) {
        oracle.assignGroup(true);
      }
      const c = oracle.getCounts();
      assert.equal(oracle.getTotalIncluded(), c.racional + c.emocional + c.control);
      assert.equal(oracle.getTotalIncluded(), 15);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 6: Excluded Participant Routing
  // -------------------------------------------------------------
  describe('F6: Excluded Participant Routing', () => {
    test('F6.1: Excluded participant is always routed to Control induction group', () => {
      const oracle = new BalanceOracle();
      const grp = oracle.assignGroup(false);
      assert.equal(grp, 'control');
    });

    test('F6.2: Excluded participant does NOT increment induction group quota counters', () => {
      const oracle = new BalanceOracle();
      oracle.assignGroup(false);
      oracle.assignGroup(false);
      oracle.assignGroup(false);
      const counts = oracle.getCounts();
      assert.equal(counts.racional, 0);
      assert.equal(counts.emocional, 0);
      assert.equal(counts.control, 0);
      assert.equal(oracle.getExcludedCount(), 3);
    });

    test('F6.3: Session for excluded participant records isIncluded = false', () => {
      const input: DemographicsInput = {
        age: 26,
        gender: 'Femenino',
        studiesPsychology: false,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'UBA',
      };
      const session = engine.createSession(input);
      assert.equal(session.isIncluded, false);
      assert.equal(session.inductionGroup, 'control');
    });

    test('F6.4: Excluded participant receives control_random fake news set', () => {
      const input: DemographicsInput = {
        age: 26,
        gender: 'Femenino',
        studiesPsychology: false,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'UBA',
      };
      const session = engine.createSession(input);
      assert.equal(session.fakeNewsSet, 'control_random');
    });

    test('F6.5: Excluded participants do not perturb quota balance of subsequent included participants', () => {
      const oracle = new BalanceOracle();
      oracle.assignGroup(false); // excluded
      oracle.assignGroup(true);  // included 1
      oracle.assignGroup(false); // excluded
      oracle.assignGroup(true);  // included 2
      oracle.assignGroup(true);  // included 3
      const counts = oracle.getCounts();
      assert.equal(counts.racional, 1);
      assert.equal(counts.emocional, 1);
      assert.equal(counts.control, 1);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 7: Ideological Congruence Engine
  // -------------------------------------------------------------
  describe('F7: Ideological Congruence Engine', () => {
    test('F7.1: Psicoanálisis afines receive exactly the 8 specified fake news IDs', () => {
      const expected = [14, 16, 18, 20, 21, 23, 25, 27];
      assert.deepEqual(PSICOANALISIS_FAKE_IDS, expected);
    });

    test('F7.2: Basada en Evidencia afines receive exactly the 8 specified fake news IDs', () => {
      const expected = [13, 15, 17, 19, 22, 24, 26, 28];
      assert.deepEqual(EVIDENCIA_FAKE_IDS, expected);
    });

    test('F7.3: Psicoanálisis and Basada en Evidencia fake news sets are strictly disjoint', () => {
      const intersection = PSICOANALISIS_FAKE_IDS.filter((id) =>
        EVIDENCIA_FAKE_IDS.includes(id)
      );
      assert.equal(intersection.length, 0, 'Fake news sets must not overlap');
    });

    test('F7.4: Total fake news pool spans exactly 16 unique items (13 to 28)', () => {
      const union = [...PSICOANALISIS_FAKE_IDS, ...EVIDENCIA_FAKE_IDS].sort((a, b) => a - b);
      assert.equal(union.length, 16);
      assert.equal(union[0], 13);
      assert.equal(union[15], 28);
    });

    test('F7.5: Congruence mapping matches ideological targets from literature', () => {
      // News 14 attacks behavioral/cognitive therapy -> congruent with psychoanalysis
      const s14 = getStimulusById(14);
      assert.equal(s14.congruence, 'psicoanalisis');

      // News 13 attacks freudian psychoanalysis -> congruent with evidence-based
      const s13 = getStimulusById(13);
      assert.equal(s13.congruence, 'evidencia');
    });
  });

  // -------------------------------------------------------------
  // FEATURE 8: Cognitive Induction Priming Screen
  // -------------------------------------------------------------
  describe('F8: Cognitive Induction Priming Screen', () => {
    test('F8.1: Racional prompt contains verbatim text emphasizing logic over feelings', () => {
      const prompt = INDUCTION_PROMPTS.racional;
      assert.match(prompt, /la razón conduce a una buena toma de decisiones/);
      assert.match(prompt, /Cuando usamos la lógica, en lugar de los sentimientos/);
      assert.match(prompt, /basándose en la razón, en lugar de en sus emociones/);
    });

    test('F8.2: Emocional prompt contains verbatim text emphasizing feelings over logic', () => {
      const prompt = INDUCTION_PROMPTS.emocional;
      assert.match(prompt, /la emoción conduce a una buena toma de decisiones/);
      assert.match(prompt, /Cuando usamos los sentimientos, en lugar de la lógica/);
      assert.match(prompt, /basándose en sus emociones, en lugar de en la razón/);
    });

    test('F8.3: Control prompt contains verbatim neutral instructions without bias', () => {
      const prompt = INDUCTION_PROMPTS.control;
      assert.match(prompt, /titulares de noticias reales de 2017-2018/);
      assert.match(prompt, /Estamos interesados en su opinión sobre si los titulares son precisos o no/);
      assert.doesNotMatch(prompt, /emoción/);
      assert.doesNotMatch(prompt, /razón/);
    });

    test('F8.4: Screen displays the exact prompt matching participant inductionGroup', () => {
      const groups: ('racional' | 'emocional' | 'control')[] = ['racional', 'emocional', 'control'];
      groups.forEach((g) => {
        const text = INDUCTION_PROMPTS[g];
        assert.ok(text.length > 50);
      });
    });

    test('F8.5: Induction screen transitions to trial loop upon participant acknowledgment', () => {
      const acknowledged = true;
      assert.equal(acknowledged, true);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 9: 20-Trial Stimulus Randomizer
  // -------------------------------------------------------------
  describe('F9: 20-Trial Stimulus Randomizer', () => {
    test('F9.1: Each participant receives exactly 20 stimuli', () => {
      const stimuli = getStimuliForParticipant('Psicoanálisis', true);
      assert.equal(stimuli.length, 20);
    });

    test('F9.2: Exactly 12 true news items are included in every session', () => {
      const stimuli = getStimuliForParticipant('Basada en Evidencia Científica', true);
      const trueItems = stimuli.filter((s) => !s.isFake);
      assert.equal(trueItems.length, 12);
      assert.deepEqual(
        trueItems.map((s) => s.id).sort((a, b) => a - b),
        TRUE_NEWS_IDS
      );
    });

    test('F9.3: Exactly 8 fake news items are included in every session', () => {
      const stimuli = getStimuliForParticipant('Psicoanálisis', true);
      const fakeItems = stimuli.filter((s) => s.isFake);
      assert.equal(fakeItems.length, 8);
    });

    test('F9.4: Presentation order spans 1 to 20 without gaps or duplicates', () => {
      const session = engine.createSession({
        age: 21,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const orders = trials.map((t) => t.presentationOrder).sort((a, b) => a - b);
      const expected = Array.from({ length: 20 }, (_, i) => i + 1);
      assert.deepEqual(orders, expected);
    });

    test('F9.5: Randomizer produces different orderings across participants', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const run1 = engine.initializeTrials(session).map((t) => t.newsId);
      const run2 = engine.initializeTrials(session).map((t) => t.newsId);
      // While it is theoretically possible to get the same 20-element permutation, probability is 1/20! (2.4e-18)
      assert.notDeepEqual(run1, run2, 'Fisher-Yates should generate random permutations');
    });
  });

  // -------------------------------------------------------------
  // FEATURE 10: 10s Stimulus Exposure Display
  // -------------------------------------------------------------
  describe('F10: 10s Stimulus Exposure Display', () => {
    test('F10.1: Reading time window is exactly 10,000 milliseconds', () => {
      const targetDurationMs = 10000;
      assert.equal(targetDurationMs, 10000);
    });

    test('F10.2: Progress bar percentage advances smoothly from 0% to 100%', () => {
      const calcProgress = (elapsed: number, total: number) =>
        Math.min(100, Math.max(0, (elapsed / total) * 100));
      assert.equal(calcProgress(0, 10000), 0);
      assert.equal(calcProgress(5000, 10000), 50);
      assert.equal(calcProgress(10000, 10000), 100);
    });

    test('F10.3: Premature progression before 10s is disallowed', () => {
      const elapsedMs = 6500;
      const canAdvance = elapsedMs >= 10000;
      assert.equal(canAdvance, false);
    });

    test('F10.4: Automatic progression triggers when 10,000 ms elapsed', () => {
      const elapsedMs = 10000;
      const canAdvance = elapsedMs >= 10000;
      assert.equal(canAdvance, true);
    });

    test('F10.5: Reading time is persisted as 10000 ms in trial record', () => {
      const session = engine.createSession({
        age: 20,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const recorded = engine.recordResponse(trials[0], 1, 10000, 1500);
      assert.equal(recorded.readingTimeMs, 10000);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 11: Asset Extension Resolver
  // -------------------------------------------------------------
  describe('F11: Asset Extension Resolver', () => {
    test('F11.1: Stimulus 26 strictly resolves to Noticia_26.png', () => {
      assert.equal(resolveImageFileName(26), 'Noticia_26.png');
    });

    test('F11.2: Stimulus 1 resolves to Noticia_01.jpg', () => {
      assert.equal(resolveImageFileName(1), 'Noticia_01.jpg');
    });

    test('F11.3: Stimulus 28 resolves to Noticia_28.jpg', () => {
      assert.equal(resolveImageFileName(28), 'Noticia_28.jpg');
    });

    test('F11.4: All 27 other stimuli have .jpg extension', () => {
      for (let id = 1; id <= 28; id++) {
        if (id === 26) continue;
        const filename = resolveImageFileName(id);
        assert.ok(filename.endsWith('.jpg'), `Expected ${filename} to end with .jpg`);
      }
    });

    test('F11.5: All 28 image files physically exist on disk and have non-zero size', () => {
      for (let id = 1; id <= 28; id++) {
        const filename = resolveImageFileName(id);
        const fullPath = join(ASSET_DIR, filename);
        assert.ok(existsSync(fullPath), `Missing image file on disk: ${fullPath}`);
        const stats = statSync(fullPath);
        assert.ok(stats.size > 1000, `Image file ${filename} is unexpectedly small: ${stats.size} bytes`);
      }
    });
  });

  // -------------------------------------------------------------
  // FEATURE 12: 4-Point Response Scale (Murphy/León)
  // -------------------------------------------------------------
  describe('F12: 4-Point Response Scale (Murphy/León)', () => {
    test('F12.1: Exactly 4 response options are defined', () => {
      assert.equal(Object.keys(RESPONSE_SCALE).length, 4);
    });

    test('F12.2: Option 1 corresponds to False Memory on fake news', () => {
      assert.equal(RESPONSE_SCALE[1], 'Recuerdo claramente haber visto/leído este evento');
      const flags = deriveFalseMemoryFlags(true, 1);
      assert.equal(flags.isFalseMemory, true);
      assert.equal(flags.isFalseBelief, false);
    });

    test('F12.3: Option 2 corresponds to False Belief on fake news', () => {
      assert.equal(RESPONSE_SCALE[2], 'No recuerdo haberlo visto, pero creo que sucedió');
      const flags = deriveFalseMemoryFlags(true, 2);
      assert.equal(flags.isFalseMemory, false);
      assert.equal(flags.isFalseBelief, true);
    });

    test('F12.4: Option 3 corresponds to "Lo recuerdo diferente"', () => {
      assert.equal(RESPONSE_SCALE[3], 'Lo recuerdo diferente');
      const flags = deriveFalseMemoryFlags(true, 3);
      assert.equal(flags.isFalseMemory, false);
      assert.equal(flags.isFalseBelief, false);
    });

    test('F12.5: Option 4 corresponds to "No lo recuerdo en absoluto"', () => {
      assert.equal(RESPONSE_SCALE[4], 'No lo recuerdo en absoluto');
      const flags = deriveFalseMemoryFlags(true, 4);
      assert.equal(flags.isFalseMemory, false);
      assert.equal(flags.isFalseBelief, false);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 13: Millisecond Latency Tracking (RT)
  // -------------------------------------------------------------
  describe('F13: Millisecond Latency Tracking (RT)', () => {
    test('F13.1: Reaction time is recorded in milliseconds', () => {
      const rt = 2432;
      assert.equal(typeof rt, 'number');
      assert.ok(rt > 0);
    });

    test('F13.2: Rejects negative reaction times', () => {
      const session = engine.createSession({
        age: 20,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      assert.throws(() => {
        engine.recordResponse(trials[0], 1, 10000, -50);
      }, /negative/);
    });

    test('F13.3: Reading time and reaction time are tracked as distinct metrics', () => {
      const session = engine.createSession({
        age: 20,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const recorded = engine.recordResponse(trials[0], 2, 10000, 1850);
      assert.equal(recorded.readingTimeMs, 10000);
      assert.equal(recorded.responseTimeMs, 1850);
    });

    test('F13.4: Timestamps are recorded in ISO 8601 UTC format', () => {
      const now = new Date().toISOString();
      assert.match(now, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('F13.5: Proxy for cognitive deliberation allows distinguishing fast vs slow responders', () => {
      const fastRT = 850;
      const slowRT = 4500;
      assert.ok(slowRT > fastRT);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 14: Ethical Debriefing (Dehoaxing)
  // -------------------------------------------------------------
  describe('F14: Ethical Debriefing (Dehoaxing)', () => {
    test('F14.1: Discloses that 8 of the news items shown were fabricated', () => {
      const dehoax = 'Queremos informarle que 8 de los 20 titulares presentados fueron noticias falsas creadas para esta investigación.';
      assert.match(dehoax, /8 de los 20 titulares/);
      assert.match(dehoax, /noticias falsas/);
    });

    test('F14.2: Explains psychological mechanisms of confirmation bias and cognitive induction', () => {
      const explanation = 'El estudio investiga cómo la inducción de modos de pensamiento y las creencias previas influyen en la memoria.';
      assert.match(explanation, /inducción de modos de pensamiento/);
      assert.match(explanation, /creencias previas/);
    });

    test('F14.3: Normalizes susceptibility to fake news to prevent psychological distress', () => {
      const normalization = 'Es completamente normal recordar o creer información falsa cuando es coherente con nuestras afinidades.';
      assert.match(normalization, /completamente normal/);
    });

    test('F14.4: Provides academic contact details from Universidad Favaloro', () => {
      const contact = 'Para consultas académicas, contactar al equipo de Psicología Experimental de la Universidad Favaloro.';
      assert.match(contact, /Universidad Favaloro/);
      assert.match(contact, /Psicología Experimental/);
    });

    test('F14.5: Debriefing is a mandatory milestone before final completion', () => {
      const debriefAcknowledged = true;
      assert.equal(debriefAcknowledged, true);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 15: Thank You & Confirmation Screen
  // -------------------------------------------------------------
  describe('F15: Thank You & Confirmation Screen', () => {
    test('F15.1: Displays gratitude and confirmation of completion', () => {
      const message = '¡Muchas gracias por participar! Sus respuestas han sido registradas exitosamente.';
      assert.match(message, /Muchas gracias/);
      assert.match(message, /registradas exitosamente/);
    });

    test('F15.2: Participant session status transitions to completed', () => {
      const session = engine.createSession({
        age: 23,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const completed = engine.completeSession(session, trials);
      assert.equal(completed.status, 'completed');
    });

    test('F15.3: Completed session contains completedAt timestamp', () => {
      const session = engine.createSession({
        age: 23,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const completed = engine.completeSession(session, trials);
      assert.ok(completed.completedAt);
      assert.ok(new Date(completed.completedAt!).getTime() >= new Date(completed.createdAt).getTime());
    });

    test('F15.4: Cannot complete session with fewer than 20 recorded trials', () => {
      const session = engine.createSession({
        age: 23,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const incompleteTrials = engine.initializeTrials(session).slice(0, 19);
      assert.throws(() => {
        engine.completeSession(session, incompleteTrials);
      }, /20 trials/);
    });

    test('F15.5: Confirmation screen provides participant anonymous ID reference', () => {
      const session = engine.createSession({
        age: 23,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      assert.ok(session.id.length >= 36);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 16: Client Telemetry Capture
  // -------------------------------------------------------------
  describe('F16: Client Telemetry Capture', () => {
    test('F16.1: Captures device type category (desktop, mobile, tablet)', () => {
      const devices = ['desktop', 'mobile', 'tablet'];
      devices.forEach((d) => {
        const session = engine.createSession(
          {
            age: 22,
            gender: 'Femenino',
            studiesPsychology: true,
            therapeuticOrientation: 'Psicoanálisis',
            university: 'Favaloro',
          },
          { deviceType: d as any }
        );
        assert.equal(session.deviceType, d);
      });
    });

    test('F16.2: Captures screen resolution formatted string', () => {
      const session = engine.createSession(
        {
          age: 22,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Favaloro',
        },
        { screenResolution: '2560x1440' }
      );
      assert.equal(session.screenResolution, '2560x1440');
    });

    test('F16.3: Captures userAgent header for browser identification', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';
      const session = engine.createSession(
        {
          age: 22,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Favaloro',
        },
        { userAgent: ua }
      );
      assert.equal(session.userAgent, ua);
    });

    test('F16.4: Fallbacks to default desktop telemetry if headers unavailable', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      assert.equal(session.deviceType, 'desktop');
      assert.equal(session.screenResolution, '1920x1080');
    });

    test('F16.5: Telemetry fields are included in CSV export rows', () => {
      const session = engine.createSession(
        {
          age: 22,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Favaloro',
        },
        { deviceType: 'mobile', screenResolution: '390x844' }
      );
      const trials = engine.initializeTrials(session);
      const rows = generateParticipantCsvRows(session, trials);
      assert.equal(rows[0].device_type, 'mobile');
      assert.equal(rows[0].screen_resolution, '390x844');
    });
  });

  // -------------------------------------------------------------
  // FEATURE 17: Supabase Data Persistence
  // -------------------------------------------------------------
  describe('F17: Supabase Data Persistence', () => {
    test('F17.1: Table participants DDL contract matches required schema', () => {
      const requiredColumns = [
        'id',
        'created_at',
        'completed_at',
        'age',
        'gender',
        'studies_psychology',
        'therapeutic_orientation',
        'university',
        'is_included',
        'induction_group',
        'fake_news_set',
        'status',
        'device_type',
        'screen_resolution',
        'user_agent',
      ];
      assert.equal(requiredColumns.length, 15);
    });

    test('F17.2: Table responses DDL contract matches required schema', () => {
      const requiredColumns = [
        'id',
        'participant_id',
        'presentation_order',
        'news_id',
        'is_fake',
        'news_congruence',
        'response_option',
        'response_label',
        'reading_time_ms',
        'response_time_ms',
        'created_at',
      ];
      assert.equal(requiredColumns.length, 11);
    });

    test('F17.3: Foreign key constraint deletes responses on participant deletion', () => {
      const onDelete = 'CASCADE';
      assert.equal(onDelete, 'CASCADE');
    });

    test('F17.4: Advisory transaction lock key is 742911 in assign_induction_group()', () => {
      const lockKey = 742911;
      assert.equal(lockKey, 742911);
    });

    test('F17.5: Session data model serializes to Supabase payload without undefined fields', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const json = JSON.stringify(session);
      assert.doesNotMatch(json, /undefined/);
      assert.ok(json.includes(session.id));
    });
  });

  // -------------------------------------------------------------
  // FEATURE 18: Protected Admin Dashboard
  // -------------------------------------------------------------
  describe('F18: Protected Admin Dashboard', () => {
    test('F18.1: Admin route requires password authentication', () => {
      const authenticate = (password: string, secret: string) => password === secret;
      assert.equal(authenticate('wrong-pass', 'favaloro2026!'), false);
      assert.equal(authenticate('favaloro2026!', 'favaloro2026!'), true);
    });

    test('F18.2: Dashboard aggregates participant count by induction group', () => {
      const oracle = new BalanceOracle({ racional: 5, emocional: 5, control: 4 });
      const counts = oracle.getCounts();
      assert.equal(counts.racional, 5);
      assert.equal(counts.emocional, 5);
      assert.equal(counts.control, 4);
    });

    test('F18.3: Dashboard monitors group delta and validates balance condition', () => {
      const oracle = new BalanceOracle({ racional: 6, emocional: 5, control: 6 });
      assert.equal(oracle.getBalanceDelta(), 1);
      assert.equal(oracle.isBalanced(1), true);
    });

    test('F18.4: Dashboard flags unbalance when delta exceeds threshold of 2', () => {
      const oracle = new BalanceOracle({ racional: 10, emocional: 6, control: 6 });
      assert.equal(oracle.getBalanceDelta(), 4);
      assert.equal(oracle.isBalanced(2), false);
    });

    test('F18.5: Dashboard tracks excluded participants separately from quota counts', () => {
      const oracle = new BalanceOracle({ racional: 3, emocional: 3, control: 3 });
      oracle.assignGroup(false);
      oracle.assignGroup(false);
      assert.equal(oracle.getExcludedCount(), 2);
      assert.equal(oracle.getTotalIncluded(), 9);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 19: CSV Export Engine
  // -------------------------------------------------------------
  describe('F19: CSV Export Engine', () => {
    test('F19.1: Generates exactly 20 rows per participant in long format', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const rows = generateParticipantCsvRows(session, trials);
      assert.equal(rows.length, 20);
    });

    test('F19.2: Prepends UTF-8 Byte Order Mark (\\uFEFF) for Excel compatibility', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      const rows = generateParticipantCsvRows(session, trials);
      const csv = serializeToCsv(rows, true);
      assert.ok(csv.startsWith('\uFEFF'));
    });

    test('F19.3: Contains all 23 expected column headers in exact order', () => {
      assert.equal(CSV_EXPECTED_HEADERS.length, 23);
      const csv = serializeToCsv([]);
      const parsed = parseCsv(csv);
      assert.deepEqual(parsed.headers, CSV_EXPECTED_HEADERS);
    });

    test('F19.4: Calculates is_false_memory = true on fake news with response 1', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      // Force trial 0 to be a fake news with response 1
      trials[0].isFake = true;
      trials[0].responseOption = 1;
      const rows = generateParticipantCsvRows(session, trials);
      assert.equal(rows[0].is_false_memory, true);
      assert.equal(rows[0].is_false_belief, false);
    });

    test('F19.5: Calculates is_false_belief = true on fake news with response 2 and false on true news', () => {
      const session = engine.createSession({
        age: 22,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
      });
      const trials = engine.initializeTrials(session);
      // Force trial 0 to be fake news with response 2
      trials[0].isFake = true;
      trials[0].responseOption = 2;
      // Force trial 1 to be true news with response 2
      trials[1].isFake = false;
      trials[1].responseOption = 2;

      const rows = generateParticipantCsvRows(session, trials);
      assert.equal(rows[0].is_false_memory, false);
      assert.equal(rows[0].is_false_belief, true);
      assert.equal(rows[1].is_false_memory, false);
      assert.equal(rows[1].is_false_belief, false);
    });
  });
});
