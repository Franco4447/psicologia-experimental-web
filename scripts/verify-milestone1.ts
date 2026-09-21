import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';
import { fileURLToPath } from 'url';

import {
  STIMULI,
  TRUE_NEWS_IDS,
  PSA_CONGRUENT_FAKE_IDS,
  EBP_CONGRUENT_FAKE_IDS,
  getParticipantNewsDeck,
  classifyResponse
} from '../src/data/stimuli';

import {
  getStimulusImagePath,
  getStimulusImageFileName,
  getStimulusAlternativePath
} from '../src/lib/assets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const NOTICIAS_DIR = path.join(ROOT_DIR, 'public/noticias');
const SOURCE_DIR = path.resolve(ROOT_DIR, '../Noticias/noticias imagenes');

console.log('====================================================');
console.log('Milestone 1 Verification Suite');
console.log('Universidad Favaloro - Psicología Experimental');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

async function test(description: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${description}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${description}`);
    console.error(`       Error: ${err.message}`);
    process.exit(1);
  }
}

async function runSuite() {
  // ----------------------------------------------------
  // 1. Asset Verification
  // ----------------------------------------------------
  await test('public/noticias directory contains all 28 canonical stimuli images', () => {
    assert(fs.existsSync(NOTICIAS_DIR), 'public/noticias directory must exist');
    for (let id = 1; id <= 28; id++) {
      const padded = String(id).padStart(2, '0');
      const filename = id === 26 ? 'Noticia_26.png' : `Noticia_${padded}.jpg`;
      const filePath = path.join(NOTICIAS_DIR, filename);
      assert(fs.existsSync(filePath), `Asset missing: ${filename}`);
      const stat = fs.statSync(filePath);
      assert(stat.size > 0, `Asset ${filename} is empty (0 bytes)`);
    }
  });

  await test('Noticia_26.png is valid and matches canonical SHA-256 hash', () => {
    const pngPath = path.join(NOTICIAS_DIR, 'Noticia_26.png');
    const buffer = fs.readFileSync(pngPath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const expectedHash = 'd33d7e9689dc1ccbc8ecf43ee79ab781e25a70331e5a315465f75593521ea908';
    assert.strictEqual(hash, expectedHash, 'Noticia_26.png hash mismatch');
    // Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    assert(isPng, 'Noticia_26.png does not have valid PNG magic header bytes');
  });

  await test('All 28 assets match 100% byte-for-byte with source directory', () => {
    for (let id = 1; id <= 28; id++) {
      const padded = String(id).padStart(2, '0');
      const filename = id === 26 ? 'Noticia_26.png' : `Noticia_${padded}.jpg`;
      const srcPath = path.join(SOURCE_DIR, filename);
      const destPath = path.join(NOTICIAS_DIR, filename);
      const srcBuf = fs.readFileSync(srcPath);
      const destBuf = fs.readFileSync(destPath);
      assert.strictEqual(srcBuf.length, destBuf.length, `Length mismatch for ${filename}`);
      const srcHash = crypto.createHash('sha256').update(srcBuf).digest('hex');
      const destHash = crypto.createHash('sha256').update(destBuf).digest('hex');
      assert.strictEqual(srcHash, destHash, `Hash mismatch for ${filename}`);
    }
  });

  // ----------------------------------------------------
  // 2. Data & Algorithmic Invariants Verification
  // ----------------------------------------------------
  await test('Dataset contracts and partitions in stimuli.ts and assets.ts', () => {
    // Total count
    assert.strictEqual(STIMULI.length, 28, 'Stimuli universe must have exactly 28 items');

    // True news count
    assert.strictEqual(TRUE_NEWS_IDS.length, 12, 'True news count must be 12');
    TRUE_NEWS_IDS.forEach(id => {
      const item = STIMULI.find(s => s.id === id);
      assert(item, `Item ${id} not found in STIMULI`);
      assert.strictEqual(item.isFake, false, `Item ${id} should have isFake === false`);
      assert.strictEqual(item.congruence, 'true', `Item ${id} should have congruence === 'true'`);
    });

    // Fake news count & partitioning
    assert.strictEqual(PSA_CONGRUENT_FAKE_IDS.length, 8, 'PSA fake set must have 8 items');
    assert.strictEqual(EBP_CONGRUENT_FAKE_IDS.length, 8, 'EBP fake set must have 8 items');

    const psaSet = new Set(PSA_CONGRUENT_FAKE_IDS);
    const ebpSet = new Set(EBP_CONGRUENT_FAKE_IDS);

    // Disjoint check
    psaSet.forEach((id) => {
      assert(!ebpSet.has(id), `Item ${id} cannot be in both PSA and EBP sets`);
    });

    // Union check: all 16 fake news from 13 to 28
    const combinedFake = new Set([...PSA_CONGRUENT_FAKE_IDS, ...EBP_CONGRUENT_FAKE_IDS]);
    assert.strictEqual(combinedFake.size, 16, 'Combined fake set must have exactly 16 unique items');
    for (let id = 13; id <= 28; id++) {
      assert(combinedFake.has(id), `Fake item ${id} missing from sets`);
    }


    // Image resolver
    assert.strictEqual(getStimulusImageFileName(26), 'Noticia_26.png', 'Item 26 filename must be Noticia_26.png');
    assert.strictEqual(getStimulusImagePath(26), '/noticias/Noticia_26.png', 'Item 26 path must be /noticias/Noticia_26.png');
    assert.strictEqual(getStimulusAlternativePath(26), '/noticias/Noticia_26.jpg', 'Item 26 alt path must be /noticias/Noticia_26.jpg');
    assert.strictEqual(getStimulusImageFileName(1), 'Noticia_01.jpg', 'Item 1 filename must be Noticia_01.jpg');
    assert.strictEqual(getStimulusImagePath(1), '/noticias/Noticia_01.jpg', 'Item 1 path must be /noticias/Noticia_01.jpg');

    // Deck assembly for Psychoanalysis participant
    const psaDeck = getParticipantNewsDeck('Psicoanálisis', true, 12345);
    assert.strictEqual(psaDeck.length, 20, 'Participant deck must contain exactly 20 items');
    const psaTrueCount = psaDeck.filter(s => !s.isFake).length;
    const psaFakeCount = psaDeck.filter(s => s.isFake).length;
    assert.strictEqual(psaTrueCount, 12, 'Deck must contain 12 true news');
    assert.strictEqual(psaFakeCount, 8, 'Deck must contain 8 fake news');
    psaDeck.filter(s => s.isFake).forEach(s => {
      assert(psaSet.has(s.id), `Psychoanalysis participant received invalid fake item: ${s.id}`);
    });

    // Deck assembly for Evidence-Based participant
    const ebpDeck = getParticipantNewsDeck('Basada en Evidencia Científica', true, 67890);
    assert.strictEqual(ebpDeck.length, 20, 'Participant deck must contain exactly 20 items');
    const ebpTrueCount = ebpDeck.filter(s => !s.isFake).length;
    const ebpFakeCount = ebpDeck.filter(s => s.isFake).length;
    assert.strictEqual(ebpTrueCount, 12, 'Deck must contain 12 true news');
    assert.strictEqual(ebpFakeCount, 8, 'Deck must contain 8 fake news');
    ebpDeck.filter(s => s.isFake).forEach(s => {
      assert(ebpSet.has(s.id), `Evidence-based participant received invalid fake item: ${s.id}`);
    });

    // Response classification
    const fm = classifyResponse(true, 1);
    assert.strictEqual(fm.isFalseMemory, true, 'Option 1 on fake news must be False Memory');
    assert.strictEqual(fm.isFalseBelief, false);

    const fb = classifyResponse(true, 2);
    assert.strictEqual(fb.isFalseMemory, false);
    assert.strictEqual(fb.isFalseBelief, true, 'Option 2 on fake news must be False Belief');

    const tm = classifyResponse(false, 1);
    assert.strictEqual(tm.isTrueMemory, true, 'Option 1 on true news must be True Memory');
    assert.strictEqual(tm.isFalseMemory, false);
  });

  // ----------------------------------------------------
  // 3. Project Configuration Files Check
  // ----------------------------------------------------
  await test('Configuration files exist and have valid structure', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'tailwind.config.ts',
      'postcss.config.mjs',
      'next.config.mjs',
      '.eslintrc.json',
      '.gitignore',
      '.env.example',
      '.env.local'
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.join(ROOT_DIR, relPath);
      assert(fs.existsSync(fullPath), `Required config file missing: ${relPath}`);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
    assert(pkg.dependencies.next, 'Missing next in dependencies');
    assert(pkg.dependencies.react, 'Missing react in dependencies');
    assert(pkg.dependencies['lucide-react'], 'Missing lucide-react in dependencies');
    assert(pkg.dependencies['@supabase/supabase-js'], 'Missing @supabase/supabase-js in dependencies');
  });

  console.log(`\n====================================================`);
  console.log(`Summary: ${passedTests} of ${totalTests} verification checks passed.`);
  console.log(`Milestone 1 Implementation 100% Genuine and Verified.`);
  console.log(`====================================================\n`);
}

runSuite();
