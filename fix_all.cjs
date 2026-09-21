const fs = require('fs');

let reading = fs.readFileSync('src/components/StimulusReadingScreen.tsx', 'utf8');

const newTimer = \  // High-precision animation frame timer loop
  useEffect(() => {
    if (!imageLoaded) return;
    
    let isUnmounted = false;
    let rafId = null;
    const start = performance.now();

    const tick = () => {
      if (isUnmounted) return;
      const elapsed = performance.now() - start;

      if (elapsed >= EXPOSURE_DURATION_MS) {
        setElapsedMs(EXPOSURE_DURATION_MS);
        if (onExposureComplete) onExposureComplete(EXPOSURE_DURATION_MS);
        if (onComplete) onComplete(EXPOSURE_DURATION_MS);
      } else {
        setElapsedMs(elapsed);
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      isUnmounted = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageLoaded]);\;

reading = reading.replace(/  \/\/ High-precision animation frame timer loop[\s\S]*?\}, \[imageLoaded, handleFinished\]\);/, newTimer);
fs.writeFileSync('src/components/StimulusReadingScreen.tsx', reading);

function fixEncoding(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(//g, 'ó')
                   .replace(/o/g, 'á')
                   .replace(/g/g, 'ú')
                   .replace(//g, 'í')
                   .replace(//g, 'ñ')
                   .replace(/?/g, 'é')
                   .replace(/Estímulo visual\.\.\./g, 'estímulo visual...')
                   .replace(/Cargando est.*?mulo visual/g, 'Cargando estímulo visual');
  fs.writeFileSync(filepath, content);
}

const files = [
  'src/components/InductionScreen.tsx',
  'src/components/StimulusReadingScreen.tsx',
  'src/components/WelcomeScreen.tsx',
  'src/components/ConsentScreen.tsx',
  'src/components/DemographicsScreen.tsx',
  'src/components/RatingScreen.tsx',
  'src/components/DebriefingScreen.tsx',
  'src/components/ThankYouScreen.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    fixEncoding(file);
  }
}
console.log('Fixed timer and encodings');
