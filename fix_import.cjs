const fs = require('fs');
let content = fs.readFileSync('src/components/StimulusReadingScreen.tsx', 'utf8');

if (!content.includes('import Image from')) {
  content = content.replace('import React, {', 'import Image from \'next/image\';\nimport React, {');
}

content = content.replace(/Cargando est.*?mulo visual\.\.\./, 'Cargando estímulo visual...');
content = content.replace(/El tiempo de lectura comenzar.*? una vez visible/, 'El tiempo de lectura comenzará una vez visible');

// Also remove useEffect checking img.complete since next/image handles onLoad properly and imgRef is obsolete on next/image!
const oldUseEffect = /useEffect\(\(\) => \{\n\s*const img = imgRef\.current;\n\s*if \(img && img\.complete(.|\\n)*?imageLoaded\]\);/gm;
content = content.replace(oldUseEffect, '');

fs.writeFileSync('src/components/StimulusReadingScreen.tsx', content);
console.log('Fixed imports and text');
