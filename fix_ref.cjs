const fs = require('fs');
let content = fs.readFileSync('src/components/StimulusReadingScreen.tsx', 'utf8');

content = content.replace('import React, { useState, useEffect, useCallback }', 'import React, { useState, useEffect, useRef, useCallback }');

fs.writeFileSync('src/components/StimulusReadingScreen.tsx', content);
console.log('Fixed ref');
