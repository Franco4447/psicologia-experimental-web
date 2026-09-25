const fs = require('fs');

function fix(file) {
    let code = fs.readFileSync(file, 'utf8');
    
    // For stringified payloads in m3
    code = code.replace(/university:\s*'([^']+)',\n\s*}\)/g, "university: '$1',\n          hasMemoryCondition: false,\n          hasVisualDifficulty: false,\n        })");
    
    // For DemographicsInput objects
    code = code.replace(/university:\s*'([^']+)',\n\s*}/g, "university: '$1',\n        hasMemoryCondition: false,\n        hasVisualDifficulty: false,\n      }");
    
    // Fix empty university payload in test 2.2
    code = code.replace(/university:\s*'   ',\n\s*}\)/g, "university: '   ',\n          hasMemoryCondition: false,\n          hasVisualDifficulty: false,\n        })");

    fs.writeFileSync(file, code);
}

const files = [
    'tests/m3_sync_and_api.test.ts',
    'tests/e2e/tier1_features.test.ts',
    'tests/e2e/tier2_boundaries.test.ts',
    'tests/e2e/tier3_combinations.test.ts',
    'tests/e2e/tier4_simulations.test.ts'
];

for (const file of files) {
    try { fix(file); } catch (e) { console.error('Error on', file, e); }
}

let typesPath = 'tests/e2e/harness/types.ts';
let typesCode = fs.readFileSync(typesPath, 'utf8');
if (!typesCode.includes('hasMemoryCondition')) {
    typesCode = typesCode.replace('university: string;', 'university: string;\n  hasMemoryCondition: boolean;\n  hasVisualDifficulty: boolean;');
    fs.writeFileSync(typesPath, typesCode);
}

let enginePath = 'tests/e2e/harness/experimentEngine.ts';
let engineCode = fs.readFileSync(enginePath, 'utf8');
if (!engineCode.includes('hasMemoryCondition')) {
    engineCode = engineCode.replace('return {\n      valid: errors.length === 0,', 
    "if (typeof input.hasMemoryCondition !== 'boolean') { errors.push('Debe indicar si presenta condición de memoria.'); }\n    if (typeof input.hasVisualDifficulty !== 'boolean') { errors.push('Debe indicar si presenta dificultad visual.'); }\n    return {\n      valid: errors.length === 0,");
    fs.writeFileSync(enginePath, engineCode);
}

console.log('Fixed tests');
