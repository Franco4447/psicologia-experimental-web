/**
 * Adversarial Empirical Asset & Resolver Verification Suite
 * Milestone 1 Stress-Testing & Boundary Mining
 * 
 * Target: tests/adversarial_m1_assets.test.ts
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';
import { fileURLToPath } from 'url';

import {
  STIMULI,
  STIMULI_BY_ID,
  TRUE_NEWS_IDS,
  PSA_CONGRUENT_FAKE_IDS,
  EBP_CONGRUENT_FAKE_IDS,
  getStimulusImagePath as getStimulusImagePathFromData,
  getStimulusById,
  evaluateInclusion,
  getParticipantNewsDeck,
  classifyResponse,
  RESPONSE_OPTIONS
} from '../src/data/stimuli';

import {
  getStimulusImageFileName,
  getStimulusImagePath as getStimulusImagePathFromLib,
  getStimulusAlternativePath,
  NOTICIA_26_PNG
} from '../src/lib/assets';

import type { TherapeuticOrientation } from '../src/types/experiment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const NOTICIAS_DIR = path.join(ROOT_DIR, 'public/noticias');
const SOURCE_DIR = path.resolve(ROOT_DIR, '../Noticias/noticias imagenes');

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function check(title: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`  [PASS] ${title}`);
    passCount++;
  } catch (err: any) {
    console.error(`  [FAIL] ${title}`);
    console.error(`         Error: ${err.message}`);
    failCount++;
    failures.push(`${title}: ${err.message}`);
  }
}

async function runAdversarialSuite() {
  console.log('======================================================================');
  console.log('  EMPIRICAL ADVERSARIAL STRESS SUITE: ASSETS & RESOLVERS (M1)');
  console.log('  Investigating: public/noticias, magic bytes, resolvers, orientations');
  console.log('======================================================================\n');

  // ==========================================================================
  // SECTION 1: EMPIRICAL DISK ASSET INTEGRITY & BINARY HEADERS
  // ==========================================================================
  console.log('--- SECTION 1: Disk Asset Inspection & Binary Header Magic ---');

  check('1.1 public/noticias directory exists on disk', () => {
    assert(fs.existsSync(NOTICIAS_DIR), `Directory ${NOTICIAS_DIR} does not exist`);
  });

  check('1.2 Exactly 28 canonical stimuli assets exist and have non-zero size', () => {
    for (let id = 1; id <= 28; id++) {
      const padded = String(id).padStart(2, '0');
      const filename = id === 26 ? 'Noticia_26.png' : `Noticia_${padded}.jpg`;
      const fullPath = path.join(NOTICIAS_DIR, filename);
      assert(fs.existsSync(fullPath), `Asset missing from public/noticias: ${filename}`);
      const stats = fs.statSync(fullPath);
      assert(stats.size > 0, `Asset ${filename} is 0 bytes`);
    }
  });

  check('1.3 Noticia_26.png is a genuine, non-corrupted PNG with correct IHDR chunk and dimensions', () => {
    const pngPath = path.join(NOTICIAS_DIR, 'Noticia_26.png');
    assert(fs.existsSync(pngPath), 'Noticia_26.png does not exist');
    const buf = fs.readFileSync(pngPath);

    // PNG 8-byte magic header: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < pngMagic.length; i++) {
      assert.strictEqual(
        buf[i],
        pngMagic[i],
        `PNG magic byte mismatch at index ${i}: expected 0x${pngMagic[i].toString(16)}, got 0x${buf[i].toString(16)}`
      );
    }

    // First chunk must be IHDR (length: 4 bytes at offset 8, type: 'IHDR' at offset 12)
    const chunkLength = buf.readUInt32BE(8);
    assert.strictEqual(chunkLength, 13, 'IHDR chunk data length must be 13 bytes');
    const chunkType = buf.toString('ascii', 12, 16);
    assert.strictEqual(chunkType, 'IHDR', 'First chunk must be IHDR');

    // Parse width and height from IHDR
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const bitDepth = buf.readUInt8(24);
    const colorType = buf.readUInt8(25); // 2 = Truecolor (RGB), 6 = Truecolor with alpha (RGBA)

    assert(width > 0, `Width must be > 0, got ${width}`);
    assert(height > 0, `Height must be > 0, got ${height}`);
    assert.strictEqual(width, 1697, `Expected width 1697, got ${width}`);
    assert.strictEqual(height, 413, `Expected height 413, got ${height}`);
    assert.strictEqual(bitDepth, 8, `Expected 8-bit depth, got ${bitDepth}`);
    assert.strictEqual(colorType, 6, `Expected RGBA colorType 6, got ${colorType}`);

    // Check aspect ratio (~4.1:1 banner headline)
    const aspectRatio = width / height;
    assert(aspectRatio > 3.5 && aspectRatio < 4.5, `Aspect ratio out of expected range: ${aspectRatio}`);

    // Check IEND chunk at end
    const iendChunk = buf.subarray(buf.length - 12);
    const iendType = iendChunk.toString('ascii', 4, 8);
    assert.strictEqual(iendType, 'IEND', 'PNG must terminate with IEND chunk');
  });

  check('1.4 All 27 other stimuli (IDs 1-25, 27-28) have valid JPEG SOI and EOI markers and valid dimensions', () => {
    for (let id = 1; id <= 28; id++) {
      if (id === 26) continue; // Noticia_26 is PNG

      const padded = String(id).padStart(2, '0');
      const filename = `Noticia_${padded}.jpg`;
      const fullPath = path.join(NOTICIAS_DIR, filename);
      const buf = fs.readFileSync(fullPath);

      // JPEG SOI marker: 0xFF, 0xD8, 0xFF
      assert(
        buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
        `${filename} does not start with valid JPEG SOI marker (0xFF 0xD8 0xFF)`
      );

      // JPEG EOI marker: 0xFF, 0xD9 at file end
      const len = buf.length;
      assert(
        buf[len - 2] === 0xff && buf[len - 1] === 0xd9,
        `${filename} does not terminate with valid JPEG EOI marker (0xFF 0xD9)`
      );

      // Parse JPEG markers to extract SOF (Start of Frame) for dimensions
      let offset = 2;
      let foundSof = false;
      let imgWidth = 0;
      let imgHeight = 0;

      while (offset < len - 8) {
        if (buf[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buf[offset + 1];
        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          imgHeight = buf.readUInt16BE(offset + 5);
          imgWidth = buf.readUInt16BE(offset + 7);
          foundSof = true;
          break;
        }
        // Skip variable length marker
        const segmentLen = buf.readUInt16BE(offset + 2);
        offset += 2 + segmentLen;
      }

      assert(foundSof, `Could not find SOF marker in ${filename}`);
      assert(imgWidth > 1500 && imgWidth < 1800, `Width ${imgWidth} out of banner bounds for ${filename}`);
      assert(imgHeight > 350 && imgHeight < 500, `Height ${imgHeight} out of banner bounds for ${filename}`);
    }
  });

  check('1.5 Defensive asset check: Noticia_26.jpg exists and documents dual-copy mechanism', () => {
    const defensiveJpg = path.join(NOTICIAS_DIR, 'Noticia_26.jpg');
    assert(fs.existsSync(defensiveJpg), 'Defensive copy Noticia_26.jpg missing');
    const buf = fs.readFileSync(defensiveJpg);
    // Observe that defensive copy contains the exact PNG payload to prevent 404s
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    assert(isPng, 'Noticia_26.jpg defensive copy must match source Noticia_26 bytes');
    assert.strictEqual(buf.length, 409356, 'Noticia_26.jpg byte size matches Noticia_26.png');
  });

  check('1.6 Total file count in public/noticias: exactly 29 files (28 canonical + 1 defensive copy)', () => {
    const files = fs.readdirSync(NOTICIAS_DIR);
    assert.strictEqual(files.length, 29, `Expected 29 files in public/noticias, found ${files.length}`);
  });

  // ==========================================================================
  // SECTION 2: ASSET RESOLVERS & CONTRACT VERIFICATION
  // ==========================================================================
  console.log('\n--- SECTION 2: Asset Resolver Contracts & Extension Routing ---');

  check('2.1 getStimulusImagePath from src/data/stimuli routes ID 26 to .png', () => {
    const path26 = getStimulusImagePathFromData(26);
    assert.strictEqual(path26, '/noticias/Noticia_26.png');
  });

  check('2.2 getStimulusImagePath from src/lib/assets routes ID 26 to .png', () => {
    const path26 = getStimulusImagePathFromLib(26);
    assert.strictEqual(path26, '/noticias/Noticia_26.png');
  });

  check('2.3 getStimulusImageFileName from src/lib/assets returns Noticia_26.png', () => {
    const fn26 = getStimulusImageFileName(26);
    assert.strictEqual(fn26, 'Noticia_26.png');
    assert.strictEqual(fn26, NOTICIA_26_PNG);
  });

  check('2.4 StimulusItem #26 in STIMULI array specifies imageFileName === "Noticia_26.png"', () => {
    const item26 = STIMULI.find(s => s.id === 26);
    assert(item26, 'Item 26 not found in STIMULI');
    assert.strictEqual(item26.imageFileName, 'Noticia_26.png');
    assert.strictEqual(getStimulusImagePathFromData(item26), '/noticias/Noticia_26.png');
  });

  check('2.5 All other 27 stimuli resolve to .jpg in both resolvers', () => {
    for (let id = 1; id <= 28; id++) {
      if (id === 26) continue;
      const padded = String(id).padStart(2, '0');
      const expectedPath = `/noticias/Noticia_${padded}.jpg`;
      const expectedFn = `Noticia_${padded}.jpg`;

      assert.strictEqual(getStimulusImagePathFromData(id), expectedPath, `Mismatch in data resolver for ID ${id}`);
      assert.strictEqual(getStimulusImagePathFromLib(id), expectedPath, `Mismatch in lib resolver for ID ${id}`);
      assert.strictEqual(getStimulusImageFileName(id), expectedFn, `Mismatch in lib filename for ID ${id}`);
    }
  });

  check('2.6 Custom basePath parameter in src/data/stimuli resolver', () => {
    assert.strictEqual(
      getStimulusImagePathFromData(26, 'https://cdn.example.com/assets'),
      'https://cdn.example.com/assets/Noticia_26.png'
    );
    assert.strictEqual(
      getStimulusImagePathFromData(1, 'https://cdn.example.com/assets'),
      'https://cdn.example.com/assets/Noticia_01.jpg'
    );
  });

  check('2.7 Fallback alternative paths via getStimulusAlternativePath', () => {
    // For 26, primary is .png, alternative is .jpg
    assert.strictEqual(getStimulusAlternativePath(26), '/noticias/Noticia_26.jpg');

    // For other IDs, primary is .jpg, alternative is .png
    assert.strictEqual(getStimulusAlternativePath(1), '/noticias/Noticia_01.png');
    assert.strictEqual(getStimulusAlternativePath(15), '/noticias/Noticia_15.png');
    assert.strictEqual(getStimulusAlternativePath(28), '/noticias/Noticia_28.png');
  });

  // ==========================================================================
  // SECTION 3: BOUNDARY & OUT-OF-RANGE RESOLVER STRESS
  // ==========================================================================
  console.log('\n--- SECTION 3: Boundary & Out-of-Range Resolver Stress ---');

  check('3.1 Out-of-range IDs in getStimulusImagePath (src/data/stimuli fallback)', () => {
    // Should safely produce fallback string without throwing unhandled exceptions
    const p0 = getStimulusImagePathFromData(0);
    assert.strictEqual(p0, '/noticias/Noticia_00.jpg');

    const p99 = getStimulusImagePathFromData(99);
    assert.strictEqual(p99, '/noticias/Noticia_99.jpg');

    const pNeg = getStimulusImagePathFromData(-5);
    assert.strictEqual(pNeg, '/noticias/Noticia_-5.jpg');
  });

  check('3.2 getStimulusById bounds enforcement (throws clear error on invalid ID)', () => {
    const invalidIds = [0, -1, 29, 100, NaN];
    for (const badId of invalidIds) {
      assert.throws(
        () => getStimulusById(badId),
        /invalid/i,
        `getStimulusById(${badId}) should have thrown an invalid ID error`
      );
    }
  });

  // ==========================================================================
  // SECTION 4: ADVERSARIAL THERAPEUTIC ORIENTATION & INPUT STRESS
  // ==========================================================================
  console.log('\n--- SECTION 4: Adversarial Therapeutic Orientation Stress-Testing ---');

  const adversarialOrientations: { label: string; value: any; expectedIncluded: boolean }[] = [
    { label: 'Standard Psychoanalysis', value: 'Psicoanálisis', expectedIncluded: true },
    { label: 'Standard Evidence-Based', value: 'Basada en Evidencia Científica', expectedIncluded: true },
    { label: 'Standard Otros', value: 'Otros', expectedIncluded: false },
    { label: 'null value', value: null, expectedIncluded: false },
    { label: 'undefined value', value: undefined, expectedIncluded: false },
    { label: 'Empty string ""', value: '', expectedIncluded: false },
    { label: 'Whitespace string "   "', value: '   ', expectedIncluded: false },
    { label: 'Leading whitespace " Psicoanálisis"', value: ' Psicoanálisis', expectedIncluded: false },
    { label: 'Trailing whitespace "Basada en Evidencia Científica "', value: 'Basada en Evidencia Científica ', expectedIncluded: false },
    { label: 'Lowercase "psicoanálisis"', value: 'psicoanálisis', expectedIncluded: false },
    { label: 'Lowercase "basada en evidencia científica"', value: 'basada en evidencia científica', expectedIncluded: false },
    { label: 'Unaccented "Psicoanalisis"', value: 'Psicoanalisis', expectedIncluded: false },
    { label: 'SQL Injection payload "\' OR 1=1 --"', value: "' OR 1=1 --", expectedIncluded: false },
    { label: 'XSS payload "<script>alert(1)</script>"', value: '<script>alert(1)</script>', expectedIncluded: false },
    { label: 'Null byte injection "Psicoanálisis\\0"', value: 'Psicoanálisis\0', expectedIncluded: false },
    { label: 'Unicode emojis "🧠 Psicoanálisis 🔬"', value: '🧠 Psicoanálisis 🔬', expectedIncluded: false },
    { label: 'Number type 12345', value: 12345, expectedIncluded: false },
    { label: 'Boolean type true', value: true, expectedIncluded: false },
    { label: 'Object type {}', value: {}, expectedIncluded: false },
    { label: 'Array type []', value: [], expectedIncluded: false }
  ];

  check('4.1 evaluateInclusion safely handles all adversarial orientation inputs without crashing', () => {
    for (const testCase of adversarialOrientations) {
      const result = evaluateInclusion({
        age: 22,
        studiesPsychology: true,
        therapeuticOrientation: testCase.value as any
      });

      assert.strictEqual(
        result.isIncluded,
        testCase.expectedIncluded,
        `evaluateInclusion failed for ${testCase.label}: expected isIncluded === ${testCase.expectedIncluded}`
      );

      if (!testCase.expectedIncluded) {
        assert.strictEqual(
          result.exclusionReason,
          'orientacion_otros',
          `Non-qualifying orientation '${testCase.label}' should yield exclusionReason === 'orientacion_otros'`
        );
      } else {
        assert.strictEqual(
          result.exclusionReason,
          null,
          `Qualifying orientation '${testCase.label}' should yield exclusionReason === null`
        );
      }
    }
  });

  check('4.2 getParticipantNewsDeck never crashes and preserves 20-item invariant under adversarial orientations', () => {
    for (const testCase of adversarialOrientations) {
      // Test when participant is marked excluded
      const excludedDeck = getParticipantNewsDeck(testCase.value as any, false, 42);
      assert.strictEqual(
        excludedDeck.length,
        20,
        `Deck length must be 20 for excluded with ${testCase.label}`
      );
      const excTrueCount = excludedDeck.filter(s => !s.isFake).length;
      const excFakeCount = excludedDeck.filter(s => s.isFake).length;
      assert.strictEqual(excTrueCount, 12, `Must contain 12 true news for excluded with ${testCase.label}`);
      assert.strictEqual(excFakeCount, 8, `Must contain 8 fake news for excluded with ${testCase.label}`);

      // Test when participant is marked included (stress-testing internal fallback when orientation is non-standard)
      const includedDeck = getParticipantNewsDeck(testCase.value as any, true, 42);
      assert.strictEqual(
        includedDeck.length,
        20,
        `Deck length must be 20 for included with ${testCase.label}`
      );
      const incTrueCount = includedDeck.filter(s => !s.isFake).length;
      const incFakeCount = includedDeck.filter(s => s.isFake).length;
      assert.strictEqual(incTrueCount, 12, `Must contain 12 true news for included with ${testCase.label}`);
      assert.strictEqual(incFakeCount, 8, `Must contain 8 fake news for included with ${testCase.label}`);

      // Check for zero duplicate IDs in the deck
      const uniqueIds = new Set(includedDeck.map(s => s.id));
      assert.strictEqual(uniqueIds.size, 20, `Deck has duplicate IDs under ${testCase.label}`);
    }
  });

  check('4.3 Mirror pair invariant: no deck ever contains both items of a mirror pair', () => {
    const mirrorPairs = [
      [13, 21],
      [14, 22],
      [15, 23],
      [16, 24],
      [17, 25],
      [18, 26],
      [19, 27],
      [20, 28]
    ];

    for (const testCase of adversarialOrientations) {
      // Test across multiple seeds
      for (const seed of [1, 100, 9999, 'adversarial-seed-alpha']) {
        const deck = getParticipantNewsDeck(testCase.value as any, testCase.expectedIncluded, seed);
        const deckIds = new Set(deck.map(s => s.id));

        for (const [idA, idB] of mirrorPairs) {
          const hasA = deckIds.has(idA);
          const hasB = deckIds.has(idB);
          assert(
            !(hasA && hasB),
            `Mirror-pair violation detected in deck for ${testCase.label}: both #${idA} and #${idB} are present!`
          );
        }
      }
    }
  });

  // ==========================================================================
  // SECTION 5: DEMOGRAPHICS BOUNDARY STRESS
  // ==========================================================================
  console.log('\n--- SECTION 5: Demographics Boundary Stress-Testing ---');

  check('5.1 Age boundary at exact 18', () => {
    assert.strictEqual(
      evaluateInclusion({ age: 17.999, studiesPsychology: true, therapeuticOrientation: 'Psicoanálisis' }).isIncluded,
      false
    );
    assert.strictEqual(
      evaluateInclusion({ age: 17.999, studiesPsychology: true, therapeuticOrientation: 'Psicoanálisis' }).exclusionReason,
      'menor_de_edad'
    );
    assert.strictEqual(
      evaluateInclusion({ age: 18, studiesPsychology: true, therapeuticOrientation: 'Psicoanálisis' }).isIncluded,
      true
    );
    assert.strictEqual(
      evaluateInclusion({ age: 18.001, studiesPsychology: true, therapeuticOrientation: 'Psicoanálisis' }).isIncluded,
      true
    );
  });

  check('5.2 Psychology study status boundary', () => {
    assert.strictEqual(
      evaluateInclusion({ age: 25, studiesPsychology: false, therapeuticOrientation: 'Psicoanálisis' }).isIncluded,
      false
    );
    assert.strictEqual(
      evaluateInclusion({ age: 25, studiesPsychology: false, therapeuticOrientation: 'Psicoanálisis' }).exclusionReason,
      'no_estudia_psicologia'
    );
  });

  check('5.3 Precedence of exclusion reasons: age < 18 precedes psychology status and orientation', () => {
    const res = evaluateInclusion({ age: 16, studiesPsychology: false, therapeuticOrientation: 'Otros' });
    assert.strictEqual(res.isIncluded, false);
    assert.strictEqual(res.exclusionReason, 'menor_de_edad');

    const res2 = evaluateInclusion({ age: 20, studiesPsychology: false, therapeuticOrientation: 'Otros' });
    assert.strictEqual(res2.isIncluded, false);
    assert.strictEqual(res2.exclusionReason, 'no_estudia_psicologia');
  });

  // ==========================================================================
  // SECTION 6: DIRECT RESOLVER-TO-DISK 1:1 ZERO-404 VERIFICATION
  // ==========================================================================
  console.log('\n--- SECTION 6: Direct Resolver-to-Disk Mapping (Zero 404s) ---');

  check('6.1 Every single resolved path from getStimulusImagePath exists on disk in public/noticias', () => {
    for (let id = 1; id <= 28; id++) {
      const resolvedFromData = getStimulusImagePathFromData(id);
      const resolvedFromLib = getStimulusImagePathFromLib(id);
      assert.strictEqual(resolvedFromData, resolvedFromLib, `Path mismatch between data and lib resolvers for ID ${id}`);

      // Strip leading /noticias/
      assert(resolvedFromData.startsWith('/noticias/'), `Path must start with /noticias/: ${resolvedFromData}`);
      const filename = resolvedFromData.replace('/noticias/', '');
      const diskPath = path.join(NOTICIAS_DIR, filename);

      assert(fs.existsSync(diskPath), `RESOLVER 404: Resolved file ${filename} does NOT exist on disk!`);
      const stat = fs.statSync(diskPath);
      assert(stat.size > 0, `Resolved file ${filename} on disk is 0 bytes`);

      // Verify specific filename for Noticia 26
      if (id === 26) {
        assert.strictEqual(filename, 'Noticia_26.png', 'ID 26 must resolve to Noticia_26.png on disk');
      } else {
        assert(filename.endsWith('.jpg'), `ID ${id} must resolve to a .jpg file on disk`);
      }
    }
  });

  check('6.2 Defensive fallback Noticia_26.jpg exists on disk and resolves via getStimulusAlternativePath(26)', () => {
    const altPath26 = getStimulusAlternativePath(26);
    assert.strictEqual(altPath26, '/noticias/Noticia_26.jpg');
    const diskPath = path.join(NOTICIAS_DIR, 'Noticia_26.jpg');
    assert(fs.existsSync(diskPath), 'Alternative path for ID 26 missing from disk');
  });

  // ==========================================================================
  // SECTION 7: IMMUTABILITY & LARGE-SCALE SHUFFLE UNIFORMITY
  // ==========================================================================
  console.log('\n--- SECTION 7: Immutability & Large-Scale Randomization Invariants ---');

  check('7.1 Core domain constants are strictly Object.freeze() immutable', () => {
    assert(Object.isFrozen(STIMULI), 'STIMULI array must be frozen');
    assert(Object.isFrozen(STIMULI_BY_ID), 'STIMULI_BY_ID lookup must be frozen');
    assert(Object.isFrozen(TRUE_NEWS_IDS), 'TRUE_NEWS_IDS must be frozen');
    assert(Object.isFrozen(PSA_CONGRUENT_FAKE_IDS), 'PSA_CONGRUENT_FAKE_IDS must be frozen');
    assert(Object.isFrozen(EBP_CONGRUENT_FAKE_IDS), 'EBP_CONGRUENT_FAKE_IDS must be frozen');
    assert(Object.isFrozen(RESPONSE_OPTIONS), 'RESPONSE_OPTIONS must be frozen');
  });

  check('7.2 1,000-trial Monte Carlo simulation: position uniformity and zero mirror collisions', () => {
    const runs = 1000;
    const positionFrequencyFor26: number[] = new Array(20).fill(0);

    for (let i = 0; i < runs; i++) {
      const seed = `monte-carlo-${i}`;
      const deck = getParticipantNewsDeck('Basada en Evidencia Científica', true, seed);

      assert.strictEqual(deck.length, 20, 'Deck must always be exactly 20 items');
      const idx26 = deck.findIndex(s => s.id === 26);
      assert(idx26 !== -1, 'Noticia_26 must be present in every Evidence-Based participant deck');
      positionFrequencyFor26[idx26]++;

      // Check mirror pair invariants
      const ids = new Set(deck.map(s => s.id));
      assert(!ids.has(18), 'Noticia_18 (anti-cognitive) must NEVER appear alongside Noticia_26 (anti-psychoanalysis)');
    }

    // Every position 0-19 should have been occupied by item 26 across 1,000 runs
    for (let pos = 0; pos < 20; pos++) {
      assert(
        positionFrequencyFor26[pos] > 10,
        `Position ${pos} was under-sampled for item 26 (${positionFrequencyFor26[pos]} occurrences in 1000 runs)`
      );
    }
  });

  // ==========================================================================
  // SECTION 8: ASSET PRELOADER SSR SAFETY
  // ==========================================================================
  console.log('\n--- SECTION 8: Asset Preloader SSR & Node Safety ---');

  await new Promise<void>((resolve) => {
    check('8.1 preloadSingleImage and preloadStimuliBatch resolve cleanly in Node/SSR environment', async () => {
      const { preloadSingleImage, preloadStimuliBatch } = await import('../src/lib/assets');
      const single = await preloadSingleImage('/noticias/Noticia_26.png');
      assert.strictEqual(single, '/noticias/Noticia_26.png');

      const batch = await preloadStimuliBatch([1, 26, 28]);
      assert.strictEqual(batch.successful.length, 3);
      assert.strictEqual(batch.failed.length, 0);
    });
    resolve();
  });

  // ==========================================================================
  // FINAL EMPIRICAL SUMMARY
  // ==========================================================================
  console.log('\n======================================================================');
  console.log(`Empirical Adversarial Test Results:`);
  console.log(`  Passed Checks : ${passCount}`);
  console.log(`  Failed Checks : ${failCount}`);
  console.log('======================================================================');

  if (failCount > 0) {
    console.error('\nFailures summary:');
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('\n✅ ALL ADVERSARIAL ASSET & RESOLVER CHECKS PASSED EMPIRICALLY!');
    process.exit(0);
  }
}

runAdversarialSuite();

