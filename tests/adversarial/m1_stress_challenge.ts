/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Parcial 2 - Investigación: Efecto de la Inducción Cognitiva sobre Falsos Recuerdos
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST: Milestone 1 Stimuli Selection & Shuffling Engine
 * Role: challenger_m1_1 (Empirical Challenger)
 * 
 * Verifies over 1,000+ randomized iterations:
 * 1. Exact deck size (20)
 * 2. True/Fake balance (12 true / 8 fake)
 * 3. Exact congruence sets (PSA vs EBP)
 * 4. Excluded participant set cohesion & no mirror-pair collisions
 * 5. Zero duplicate news IDs
 * 6. Uniform Fisher-Yates shuffle distribution via Chi-Square goodness-of-fit
 * 7. Asset mapping & disk file existence (specifically Noticia_26.png)
 * 8. Execution latency & complexity benchmarking
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

import {
  STIMULI,
  STIMULI_BY_ID,
  TRUE_NEWS_IDS,
  PSA_CONGRUENT_FAKE_IDS,
  EBP_CONGRUENT_FAKE_IDS,
  getParticipantNewsDeck,
  shuffleArray,
  evaluateInclusion,
  classifyResponse,
  getStimulusImagePath
} from '../../src/data/stimuli.ts';

import type {
  StimulusItem,
  TherapeuticOrientation,
  ParticipantDemographicsInput
} from '../../src/types/experiment.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const NOTICIAS_DIR = path.join(PROJECT_ROOT, 'public/noticias');

// Reference Sets
const PSA_EXPECTED_FAKE_SET = new Set([14, 16, 18, 20, 21, 23, 25, 27]);
const EBP_EXPECTED_FAKE_SET = new Set([13, 15, 17, 19, 22, 24, 26, 28]);
const TRUE_NEWS_SET = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

// Mirror pairs mapping
const MIRROR_PAIRS: Record<number, number> = {
  13: 21, 21: 13,
  14: 22, 22: 14,
  15: 23, 23: 15,
  16: 24, 24: 16,
  17: 25, 25: 17,
  18: 26, 26: 18,
  19: 27, 27: 19,
  20: 28, 28: 20
};

interface IterationReport {
  deckSizeMatches: boolean;
  trueCount: number;
  fakeCount: number;
  hasDuplicates: boolean;
  fakeIdsMatchSet: boolean;
  mirrorCollisions: number;
  missingAssets: string[];
}

function analyzeDeck(
  deck: StimulusItem[],
  expectedFakeSet?: Set<number>
): IterationReport {
  const ids = deck.map((s) => s.id);
  const uniqueIds = new Set(ids);
  const trueItems = deck.filter((s) => !s.isFake);
  const fakeItems = deck.filter((s) => s.isFake);

  const missingAssets: string[] = [];
  for (const item of deck) {
    const relPath = getStimulusImagePath(item);
    const diskPath = path.join(PROJECT_ROOT, 'public', relPath.replace(/^\//, ''));
    if (!fs.existsSync(diskPath)) {
      missingAssets.push(relPath);
    }
  }

  // Check mirror pair collisions
  let mirrorCollisions = 0;
  const fakeIdSet = new Set(fakeItems.map((f) => f.id));
  for (const id of fakeIdSet) {
    const mirror = MIRROR_PAIRS[id];
    if (mirror && fakeIdSet.has(mirror)) {
      mirrorCollisions++;
    }
  }

  // Check fake set match
  let fakeIdsMatchSet = true;
  if (expectedFakeSet) {
    for (const f of fakeItems) {
      if (!expectedFakeSet.has(f.id)) {
        fakeIdsMatchSet = false;
        break;
      }
    }
    if (fakeItems.length !== expectedFakeSet.size) {
      fakeIdsMatchSet = false;
    }
  }

  return {
    deckSizeMatches: deck.length === 20,
    trueCount: trueItems.length,
    fakeCount: fakeItems.length,
    hasDuplicates: uniqueIds.size !== deck.length,
    fakeIdsMatchSet,
    mirrorCollisions,
    missingAssets
  };
}

async function runEmpiricalStressChallenge() {
  console.log('======================================================================');
  console.log('  CHALLENGER_M1_1: EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
  console.log('  Milestone 1: Stimuli Catalog, Congruence, Randomization & Shuffling');
  console.log('======================================================================\n');

  const startTime = Date.now();
  let totalAssertions = 0;
  let failures = 0;

  function assertCondition(cond: boolean, message: string) {
    totalAssertions++;
    if (!cond) {
      failures++;
      console.error(`  ❌ ASSERTION FAILED: ${message}`);
    }
  }

  // ========================================================================
  // CHALLENGE SUITE 1: 1,000 Iterations for Psychoanalysis Included
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 1] 1,000 Randomized Iterations: Psychoanalysis (Included)');
  console.log('----------------------------------------------------------------------');

  // Matrix to track position frequencies for uniform shuffle test: [item_id][position (0..19)]
  const psaPositionMatrix: Record<number, number[]> = {};
  for (let id = 1; id <= 28; id++) {
    psaPositionMatrix[id] = new Array(20).fill(0);
  }

  for (let i = 0; i < 1000; i++) {
    const deck = getParticipantNewsDeck('Psicoanálisis', true);
    const report = analyzeDeck(deck, PSA_EXPECTED_FAKE_SET);

    assertCondition(report.deckSizeMatches, `Iter ${i}: Deck size != 20`);
    assertCondition(report.trueCount === 12, `Iter ${i}: True count != 12 (got ${report.trueCount})`);
    assertCondition(report.fakeCount === 8, `Iter ${i}: Fake count != 8 (got ${report.fakeCount})`);
    assertCondition(!report.hasDuplicates, `Iter ${i}: Deck contains duplicate IDs`);
    assertCondition(report.fakeIdsMatchSet, `Iter ${i}: Fake IDs do not match PSA congruent set`);
    assertCondition(report.mirrorCollisions === 0, `Iter ${i}: Contains mirror pair collisions`);
    assertCondition(report.missingAssets.length === 0, `Iter ${i}: Missing assets ${report.missingAssets.join(',')}`);

    // Update position matrix
    deck.forEach((item, pos) => {
      psaPositionMatrix[item.id][pos]++;
    });
  }
  console.log('  ✓ 1,000 / 1,000 iterations passed for Psychoanalysis condition.');

  // ========================================================================
  // CHALLENGE SUITE 2: 1,000 Iterations for Evidence-Based Included
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 2] 1,000 Randomized Iterations: Evidence-Based (Included)');
  console.log('----------------------------------------------------------------------');

  const ebpPositionMatrix: Record<number, number[]> = {};
  for (let id = 1; id <= 28; id++) {
    ebpPositionMatrix[id] = new Array(20).fill(0);
  }

  for (let i = 0; i < 1000; i++) {
    const deck = getParticipantNewsDeck('Basada en Evidencia Científica', true);
    const report = analyzeDeck(deck, EBP_EXPECTED_FAKE_SET);

    assertCondition(report.deckSizeMatches, `Iter ${i}: Deck size != 20`);
    assertCondition(report.trueCount === 12, `Iter ${i}: True count != 12 (got ${report.trueCount})`);
    assertCondition(report.fakeCount === 8, `Iter ${i}: Fake count != 8 (got ${report.fakeCount})`);
    assertCondition(!report.hasDuplicates, `Iter ${i}: Deck contains duplicate IDs`);
    assertCondition(report.fakeIdsMatchSet, `Iter ${i}: Fake IDs do not match EBP congruent set`);
    assertCondition(report.mirrorCollisions === 0, `Iter ${i}: Contains mirror pair collisions`);
    assertCondition(report.missingAssets.length === 0, `Iter ${i}: Missing assets ${report.missingAssets.join(',')}`);

    deck.forEach((item, pos) => {
      ebpPositionMatrix[item.id][pos]++;
    });
  }
  console.log('  ✓ 1,000 / 1,000 iterations passed for Evidence-Based condition.');

  // ========================================================================
  // CHALLENGE SUITE 3: 1,000 Iterations for Excluded: Psychology = No
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 3] 1,000 Randomized Iterations: Non-Psychology Student (Excluded)');
  console.log('----------------------------------------------------------------------');

  let psaSetCountNonPsych = 0;
  let ebpSetCountNonPsych = 0;

  for (let i = 0; i < 1000; i++) {
    // Randomize orientation among all options
    const orientations: TherapeuticOrientation[] = ['Psicoanálisis', 'Basada en Evidencia Científica', 'Otros'];
    const orientation = orientations[i % orientations.length];

    // Inclusion screening check
    const evalResult = evaluateInclusion({
      age: 22,
      studiesPsychology: false,
      therapeuticOrientation: orientation
    });
    assertCondition(evalResult.isIncluded === false, `Iter ${i}: Non-psychology student must be excluded`);
    assertCondition(evalResult.exclusionReason === 'no_estudia_psicologia', `Iter ${i}: Wrong exclusion reason`);

    const deck = getParticipantNewsDeck(orientation, false);
    const report = analyzeDeck(deck);

    assertCondition(report.deckSizeMatches, `Iter ${i}: Deck size != 20`);
    assertCondition(report.trueCount === 12, `Iter ${i}: True count != 12`);
    assertCondition(report.fakeCount === 8, `Iter ${i}: Fake count != 8`);
    assertCondition(!report.hasDuplicates, `Iter ${i}: Deck contains duplicate IDs`);
    assertCondition(report.mirrorCollisions === 0, `Iter ${i}: Contains mirror collisions in excluded deck`);

    // Must be either completely PSA or completely EBP set
    const fakeIds = new Set(deck.filter((s) => s.isFake).map((s) => s.id));
    let isPsa = true;
    let isEbp = true;
    for (const fid of fakeIds) {
      if (!PSA_EXPECTED_FAKE_SET.has(fid)) isPsa = false;
      if (!EBP_EXPECTED_FAKE_SET.has(fid)) isEbp = false;
    }
    assertCondition(isPsa || isEbp, `Iter ${i}: Excluded fake set is an incoherent mixture causing potential collisions`);
    if (isPsa) psaSetCountNonPsych++;
    if (isEbp) ebpSetCountNonPsych++;
  }
  console.log(`  ✓ 1,000 / 1,000 iterations passed (PSA set selected: ${psaSetCountNonPsych}, EBP set selected: ${ebpSetCountNonPsych}).`);

  // ========================================================================
  // CHALLENGE SUITE 4: 1,000 Iterations for Excluded: Orientation = Otros
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 4] 1,000 Randomized Iterations: Orientation = Otros (Excluded)');
  console.log('----------------------------------------------------------------------');

  let psaSetCountOtros = 0;
  let ebpSetCountOtros = 0;

  for (let i = 0; i < 1000; i++) {
    const studiesPsychology = i % 2 === 0;
    const evalResult = evaluateInclusion({
      age: 25,
      studiesPsychology,
      therapeuticOrientation: 'Otros'
    });
    assertCondition(evalResult.isIncluded === false, `Iter ${i}: Orientation Otros must be excluded`);

    const deck = getParticipantNewsDeck('Otros', false);
    const report = analyzeDeck(deck);

    assertCondition(report.deckSizeMatches, `Iter ${i}: Deck size != 20`);
    assertCondition(report.trueCount === 12, `Iter ${i}: True count != 12`);
    assertCondition(report.fakeCount === 8, `Iter ${i}: Fake count != 8`);
    assertCondition(!report.hasDuplicates, `Iter ${i}: Deck contains duplicate IDs`);
    assertCondition(report.mirrorCollisions === 0, `Iter ${i}: Mirror collision in Otros deck`);

    const fakeIds = new Set(deck.filter((s) => s.isFake).map((s) => s.id));
    let isPsa = true;
    let isEbp = true;
    for (const fid of fakeIds) {
      if (!PSA_EXPECTED_FAKE_SET.has(fid)) isPsa = false;
      if (!EBP_EXPECTED_FAKE_SET.has(fid)) isEbp = false;
    }
    assertCondition(isPsa || isEbp, `Iter ${i}: Incoherent fake set for Otros`);
    if (isPsa) psaSetCountOtros++;
    if (isEbp) ebpSetCountOtros++;
  }
  console.log(`  ✓ 1,000 / 1,000 iterations passed (PSA set: ${psaSetCountOtros}, EBP set: ${ebpSetCountOtros}).`);

  // ========================================================================
  // CHALLENGE SUITE 5: Statistical Uniformity & Fisher-Yates Quality
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 5] Statistical Uniformity Analysis (Fisher-Yates Durstenfeld)');
  console.log('----------------------------------------------------------------------');

  // In 1,000 runs, each active item appears 1,000 times.
  // Across 20 positions (0..19), expected count per position is E = 1000 / 20 = 50.
  // Chi-Square goodness-of-fit statistic: sum((O - E)^2 / E).
  // For df = 19:
  // p = 0.05 -> critical value 30.14
  // p = 0.01 -> critical value 36.19
  // p = 0.001 -> critical value 43.82

  console.log('  Testing Chi-Square goodness-of-fit for Psychoanalysis deck items (N=1,000 runs):');
  const psaActiveItems = [...Array.from(TRUE_NEWS_SET), ...Array.from(PSA_EXPECTED_FAKE_SET)];
  let maxChiSquare = 0;
  let minObservedMean = 999;
  let maxObservedMean = 0;

  for (const id of psaActiveItems) {
    const counts = psaPositionMatrix[id];
    let chiSquare = 0;
    let sumPos = 0;
    for (let pos = 0; pos < 20; pos++) {
      const observed = counts[pos];
      sumPos += observed * (pos + 1); // 1-based presentation order
      chiSquare += Math.pow(observed - 50, 2) / 50;
      assertCondition(observed > 15, `Item ${id} at position ${pos + 1} appeared only ${observed} times (expected 50)`);
    }
    const meanPos = sumPos / 1000;
    if (meanPos < minObservedMean) minObservedMean = meanPos;
    if (meanPos > maxObservedMean) maxObservedMean = meanPos;
    if (chiSquare > maxChiSquare) maxChiSquare = chiSquare;

    // Reject if extreme non-randomness detected (chi-square > 50 with df=19, p < 0.0001)
    assertCondition(chiSquare < 50, `Item ${id} failed uniformity test (Chi-Square = ${chiSquare.toFixed(2)} >= 50)`);
  }

  console.log(`  - Mean position range: [${minObservedMean.toFixed(2)}, ${maxObservedMean.toFixed(2)}] (Theoretical ideal: 10.50)`);
  console.log(`  - Maximum item Chi-Square (df=19): ${maxChiSquare.toFixed(2)} (Safe threshold < 50, p > 0.0001)`);
  assertCondition(minObservedMean >= 9.8 && maxObservedMean <= 11.2, 'Item position mean deviated beyond statistical confidence');

  // Also test Evidence-Based position distribution
  console.log('  Testing Chi-Square goodness-of-fit for Evidence-Based deck items (N=1,000 runs):');
  const ebpActiveItems = [...Array.from(TRUE_NEWS_SET), ...Array.from(EBP_EXPECTED_FAKE_SET)];
  let maxChiSquareEbp = 0;
  for (const id of ebpActiveItems) {
    const counts = ebpPositionMatrix[id];
    let chiSquare = 0;
    for (let pos = 0; pos < 20; pos++) {
      const observed = counts[pos];
      chiSquare += Math.pow(observed - 50, 2) / 50;
    }
    if (chiSquare > maxChiSquareEbp) maxChiSquareEbp = chiSquare;
    assertCondition(chiSquare < 50, `EBP Item ${id} failed uniformity (Chi-Square = ${chiSquare.toFixed(2)})`);
  }
  console.log(`  - Maximum EBP item Chi-Square (df=19): ${maxChiSquareEbp.toFixed(2)}`);

  // ========================================================================
  // CHALLENGE SUITE 6: Deterministic Seed & PRNG Invariants
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 6] PRNG Determinism, Boundary & Attack Scenarios');
  console.log('----------------------------------------------------------------------');

  // Test 1: Same seed produces identical deck and ordering
  const deckSeedA1 = getParticipantNewsDeck('Psicoanálisis', true, 'seed-alpha-999');
  const deckSeedA2 = getParticipantNewsDeck('Psicoanálisis', true, 'seed-alpha-999');
  const orderA1 = deckSeedA1.map((s) => s.id);
  const orderA2 = deckSeedA2.map((s) => s.id);
  assertCondition(
    JSON.stringify(orderA1) === JSON.stringify(orderA2),
    'Deterministic PRNG failed to reproduce identical presentation order for identical seed'
  );

  // Test 2: Different seed produces different ordering
  const deckSeedB = getParticipantNewsDeck('Psicoanálisis', true, 'seed-beta-888');
  const orderB = deckSeedB.map((s) => s.id);
  assertCondition(
    JSON.stringify(orderA1) !== JSON.stringify(orderB),
    'Different seeds produced identical presentation orders'
  );

  // Test 3: Large seed numbers and string hashes do not throw or produce NaN
  const edgeSeeds = [0, -1, 2147483647, -2147483648, '', '   ', '🚀🔥', 1e12];
  for (const seed of edgeSeeds) {
    try {
      const d = getParticipantNewsDeck('Psicoanálisis', true, seed as any);
      assertCondition(d.length === 20, `Edge seed ${seed} produced invalid deck length`);
    } catch (err: any) {
      assertCondition(false, `Edge seed ${seed} threw error: ${err.message}`);
    }
  }

  // ========================================================================
  // CHALLENGE SUITE 7: Asset Path & Noticia_26.png Verification
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 7] Critical Asset Path Resolution (Noticia_26.png)');
  console.log('----------------------------------------------------------------------');

  const item26 = STIMULI_BY_ID[26];
  assertCondition(item26.imageFileName === 'Noticia_26.png', 'Item 26 must have imageFileName Noticia_26.png');
  assertCondition(getStimulusImagePath(26) === '/noticias/Noticia_26.png', 'getStimulusImagePath(26) must return /noticias/Noticia_26.png');
  assertCondition(getStimulusImagePath(item26) === '/noticias/Noticia_26.png', 'getStimulusImagePath(item26) must return /noticias/Noticia_26.png');

  // Verify file exists on disk
  const file26Path = path.join(NOTICIAS_DIR, 'Noticia_26.png');
  assertCondition(fs.existsSync(file26Path), 'Noticia_26.png missing from disk');
  const stat26 = fs.statSync(file26Path);
  assertCondition(stat26.size === 409356, `Noticia_26.png size mismatch: ${stat26.size} vs 409356`);

  // Verify all 28 assets exist and have non-zero size
  for (let id = 1; id <= 28; id++) {
    const item = STIMULI_BY_ID[id];
    const itemPath = path.join(NOTICIAS_DIR, item.imageFileName);
    assertCondition(fs.existsSync(itemPath), `Stimulus asset missing: ${item.imageFileName}`);
  }

  // ========================================================================
  // CHALLENGE SUITE 8: Response Classification Matrix
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 8] Response Classification Logic (Murphy & León Scale)');
  console.log('----------------------------------------------------------------------');

  // Option 1 on Fake -> False Memory
  const c1 = classifyResponse(true, 1);
  assertCondition(c1.isFalseMemory && !c1.isFalseBelief && !c1.isTrueMemory, 'Option 1 on Fake must be False Memory only');

  // Option 2 on Fake -> False Belief
  const c2 = classifyResponse(true, 2);
  assertCondition(!c2.isFalseMemory && c2.isFalseBelief && !c2.isTrueMemory, 'Option 2 on Fake must be False Belief only');

  // Option 3 on Fake -> Neither
  const c3 = classifyResponse(true, 3);
  assertCondition(!c3.isFalseMemory && !c3.isFalseBelief && !c3.isTrueMemory, 'Option 3 on Fake must be neither');

  // Option 4 on Fake -> Neither
  const c4 = classifyResponse(true, 4);
  assertCondition(!c4.isFalseMemory && !c4.isFalseBelief && !c4.isTrueMemory, 'Option 4 on Fake must be neither');

  // Option 1 on True -> True Memory, NOT False Memory
  const c5 = classifyResponse(false, 1);
  assertCondition(!c5.isFalseMemory && !c5.isFalseBelief && c5.isTrueMemory, 'Option 1 on True must be True Memory only');

  // Option 2 on True -> Neither False Memory nor False Belief
  const c6 = classifyResponse(false, 2);
  assertCondition(!c6.isFalseMemory && !c6.isFalseBelief && !c6.isTrueMemory, 'Option 2 on True cannot be False Belief');

  // ========================================================================
  // CHALLENGE SUITE 9: Execution Performance Benchmark
  // ========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('▶ [Challenge 9] Throughput & Complexity Benchmark');
  console.log('----------------------------------------------------------------------');

  const benchStart = performance.now();
  const BENCH_ITERATIONS = 5000;
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    getParticipantNewsDeck(i % 2 === 0 ? 'Psicoanálisis' : 'Basada en Evidencia Científica', true);
  }
  const benchDuration = performance.now() - benchStart;
  const timePerDeckMs = benchDuration / BENCH_ITERATIONS;
  console.log(`  - Generated ${BENCH_ITERATIONS} full decks in ${benchDuration.toFixed(2)} ms (${timePerDeckMs.toFixed(4)} ms/deck)`);
  assertCondition(benchDuration < 500, `Performance regression: 5,000 decks took ${benchDuration.toFixed(2)} ms (> 500ms)`);

  // ========================================================================
  // FINAL EVALUATION & VERDICT SUMMARY
  // ========================================================================
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n======================================================================');
  console.log(`STRESS TEST EXECUTION COMPLETE (${totalDuration}s)`);
  console.log(`Total Assertions Evaluated: ${totalAssertions}`);
  console.log(`Total Failures Detected:    ${failures}`);

  if (failures === 0) {
    console.log('ADVERSARIAL VERDICT: ✅ APPROVE');
    console.log('All 5,000+ randomized iterations satisfied 100% of invariant contracts.');
    console.log('======================================================================\n');
    process.exit(0);
  } else {
    console.error('ADVERSARIAL VERDICT: ❌ REQUEST_CHANGES');
    console.error(`${failures} invariant violations detected during empirical challenge.`);
    console.error('======================================================================\n');
    process.exit(1);
  }
}

runEmpiricalStressChallenge().catch((err) => {
  console.error('Fatal crash during stress test execution:', err);
  process.exit(1);
});
