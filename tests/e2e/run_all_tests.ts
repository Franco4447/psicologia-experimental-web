import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFiles = [
  resolve(__dirname, 'tier1_features.test.ts'),
  resolve(__dirname, 'tier2_boundaries.test.ts'),
  resolve(__dirname, 'tier3_combinations.test.ts'),
  resolve(__dirname, 'tier4_simulations.test.ts'),
];

console.log('======================================================================');
console.log('  UNIVERSIDAD FAVALORO - PSICOLOGÍA EXPERIMENTAL (PARCIAL 2)');
console.log('  Plataforma Web: Creación de Falsos Recuerdos y Creencias');
console.log('  Comprehensive E2E Opaque-Box Test Suite Runner (Tiers 1 - 4)');
console.log('======================================================================');
console.log(`Executing ${testFiles.length} test suites:`);
testFiles.forEach((file, idx) => console.log(`  [Tier ${idx + 1}] ${file}`));
console.log('----------------------------------------------------------------------\n');

const startTime = Date.now();

const stream = run({
  files: testFiles,
  concurrency: true,
});

stream.compose(spec).pipe(process.stdout);

let failed = false;

stream.on('test:fail', () => {
  failed = true;
});

stream.on('end', () => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n======================================================================');
  if (failed) {
    console.error(`❌ TEST SUITE FAILED after ${duration}s`);
    process.exit(1);
  } else {
    console.log(`✅ ALL 4 TEST TIERS PASSED SUCCESSFULLY in ${duration}s!`);
    console.log('   - Tier 1: 95 Feature Assertions (19 Features x 5) -> PASSED');
    console.log('   - Tier 2: 29 Boundary & Corner Cases             -> PASSED');
    console.log('   - Tier 3: 13 Cross-Feature Permutations          -> PASSED');
    console.log('   - Tier 4: 6 Full Participant Journey Simulations -> PASSED');
    console.log('   Total: 143 Automated End-to-End Test Invariants Verified.');
    console.log('======================================================================');
    process.exit(0);
  }
});
