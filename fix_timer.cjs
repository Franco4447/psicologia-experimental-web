const fs = require('fs');
let content = fs.readFileSync('src/components/StimulusReadingScreen.tsx', 'utf8');

// Fix the timer loop
const timerBlock = \  // High-precision animation frame timer loop
  useEffect(() => {
    if (!imageLoaded || completedRef.current) return;
    
    const start = performance.now();

    const tick = () => {
      if (completedRef.current) return;
      const elapsed = performance.now() - start;

      if (elapsed >= EXPOSURE_DURATION_MS) {
        handleFinished();
      } else {
        setElapsedMs(elapsed);
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [imageLoaded, handleFinished]);\;

content = content.replace(/  \/\/ High-precision animation frame timer loop(.|\n)*?}, \[imageLoaded, handleFinished\]\);/, timerBlock);

// Remove startTimeRef entirely
content = content.replace(/  const startTimeRef = useRef<number \| null>\(null\);\n/, '');
content = content.replace(/    startTimeRef\.current = performance\.now\(\);\n/g, '');

// Also fix the unoptimized loading so it preloads correctly
content = content.replace(/priority/, 'priority\n              unoptimized={true}');

fs.writeFileSync('src/components/StimulusReadingScreen.tsx', content);
console.log('Timer fixed');
