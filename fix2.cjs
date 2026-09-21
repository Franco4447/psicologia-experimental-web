const fs = require('fs');
let content = fs.readFileSync('src/components/StimulusReadingScreen.tsx', 'utf8');

const searchRegex = /\{\/\* Skeleton \/ Loading state before onLoad fires \*\/\}(.|\n)*?draggable=\{false\}\n\s*\/>\n\s*<\/div>/g;

const replacement = `{/* Skeleton / Loading state before onLoad fires */}
          {!imageLoaded && !hasError && (
            <div className="w-full h-[380px] bg-slate-100 flex flex-col items-center justify-center animate-pulse p-6 text-center">
              <Eye className="w-8 h-8 text-slate-400 mb-2 animate-bounce" />
              <p className="text-sm font-medium text-slate-500">Cargando estímulo visual...</p>
              <p className="text-xs text-slate-400 mt-1">El tiempo de lectura comenzará una vez visible</p>
            </div>
          )}

          {/* Headline Image Banner */}
          <div className={\`w-full flex justify-center bg-slate-50 transition-opacity duration-300 \${imageLoaded ? 'opacity-100 relative h-[380px]' : 'absolute opacity-0 pointer-events-none h-0 overflow-hidden'}\`}>
            <Image
              src={imageSrc}
              alt={stimulus.title}
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              style={{ objectFit: 'contain' }}
              onLoad={handleImageLoad}
              onError={handleImageError}
              priority
            />
          </div>`;

content = content.replace(searchRegex, replacement);
fs.writeFileSync('src/components/StimulusReadingScreen.tsx', content);
console.log('Done');
