'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from 'react';
import type { StimulusItem } from '@/types/experiment';
import { getStimulusImagePath, getStimulusAlternativePath } from '@/lib/assets';
import { STIMULUS_EXPOSURE_DURATION_MS, STIMULUS_EXPOSURE_DURATION_SECONDS } from '@/lib/timing';
import { Clock, Eye, AlertTriangle } from 'lucide-react';

export interface StimulusReadingScreenProps {
  stimulus: StimulusItem;
  trialNumber: number;
  totalTrials?: number;
  onComplete?: (readingTimeMs: number) => void;
  onExposureComplete?: (readingTimeMs: number) => void;
}

export const StimulusReadingScreen: React.FC<StimulusReadingScreenProps> = ({
  stimulus,
  trialNumber,
  totalTrials = 20,
  onComplete,
  onExposureComplete,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>(() => getStimulusImagePath(stimulus.id));
  const [hasError, setHasError] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // ========================================================================
  // CRITICAL FIX: Store callback props in refs so the timer effect
  // NEVER depends on them and NEVER restarts when parent re-renders.
  // This is the definitive fix for the frozen progress bar.
  // ========================================================================
  const onCompleteRef = useRef(onComplete);
  const onExposureCompleteRef = useRef(onExposureComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onExposureCompleteRef.current = onExposureComplete; }, [onExposureComplete]);

  // Track whether completion callback has already fired
  const completedRef = useRef(false);

  // Handle image load
  const handleImageLoad = () => {
    if (!imageLoaded) {
      setImageLoaded(true);
    }
  };

  // Handle image error with fallback
  const handleImageError = () => {
    const altPath = getStimulusAlternativePath(stimulus.id);
    if (imageSrc !== altPath) {
      setImageSrc(altPath);
    } else {
      setHasError(true);
      if (!imageLoaded) {
        setImageLoaded(true);
      }
    }
  };

  // Detect already-cached images on mount
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && !imageLoaded) {
      setImageLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========================================================================
  // THE TIMER: requestAnimationFrame loop with ZERO re-render dependencies.
  // Depends ONLY on imageLoaded. Uses refs for everything else.
  // This effect runs exactly ONCE when imageLoaded becomes true.
  // ========================================================================
  useEffect(() => {
    if (!imageLoaded) return;
    if (completedRef.current) return;

    const start = performance.now();
    let rafId: number | null = null;
    let stopped = false;

    const tick = () => {
      if (stopped) return;

      const elapsed = performance.now() - start;

      if (elapsed >= STIMULUS_EXPOSURE_DURATION_MS) {
        // Done! Fire the callback exactly once.
        if (!completedRef.current) {
          completedRef.current = true;
          setElapsedMs(STIMULUS_EXPOSURE_DURATION_MS);
          const cb = onExposureCompleteRef.current || onCompleteRef.current;
          if (cb) cb(STIMULUS_EXPOSURE_DURATION_MS);
        }
      } else {
        setElapsedMs(elapsed);
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [imageLoaded]); // <-- ONLY depends on imageLoaded. Nothing else.

  // Derived progress metrics
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / STIMULUS_EXPOSURE_DURATION_MS) * 100));
  const remainingSeconds = Math.max(0, Math.ceil((STIMULUS_EXPOSURE_DURATION_MS - elapsedMs) / 1000));

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center px-4 py-4 sm:py-6 pb-20 sm:pb-6 select-none">
      {/* Top Header: Trial indicator & Status */}
      <div className="w-full flex items-center justify-between mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            Fase de Lectura
          </span>
          <span className="text-sm font-medium text-slate-700">
            Noticia <strong className="text-slate-900">{trialNumber}</strong> de {totalTrials}
          </span>
        </div>

        {/* Loading Badge or Live Countdown */}
        {!imageLoaded ? (
          <div className="flex items-center space-x-2 text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
            <Clock className="w-4 h-4 animate-spin-slow" />
            <span className="text-xs font-semibold">
              Cargando titular...
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span>{remainingSeconds}s restantes</span>
          </div>
        )}
      </div>

      {/* Stimulus Banner Card */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col items-center relative">
        {/* Visual Frame */}
        <div className="relative w-full h-[260px] sm:h-[320px] md:h-[380px] bg-slate-50 flex items-center justify-center overflow-hidden">
          {/* Skeleton placeholder */}
          {!imageLoaded && !hasError && (
            <div className="absolute inset-0 z-10 bg-slate-100 flex flex-col items-center justify-center animate-pulse p-6 text-center">
              <Eye className="w-8 h-8 text-slate-400 mb-2 animate-bounce" />
              <p className="text-sm font-medium text-slate-500">Cargando estímulo visual...</p>
              <p className="text-xs text-slate-400 mt-1">El tiempo de lectura comenzará una vez visible</p>
            </div>
          )}

          {/* Stimulus Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt={stimulus.title}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            draggable={false}
          />
        </div>

        {/* Fallback Text Headline (if image missing/corrupt) */}
        {hasError && (
          <div className="w-full p-6 bg-amber-50/50 border-b border-amber-100 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Titular de la Noticia</p>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 mt-1">{stimulus.title}</h2>
            </div>
          </div>
        )}

        {/* In-Card Exposure Progress Indicator Bar */}
        <div className="w-full bg-slate-50 p-4 sm:p-5 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Tiempo de lectura obligatoria ({STIMULUS_EXPOSURE_DURATION_SECONDS} segundos)
            </span>
            <span className="text-xs font-mono font-bold text-indigo-600">
              {remainingSeconds}s
            </span>
          </div>

          {/* Progress track */}
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-none"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      {/* Fixed Bottom Screen Bar for Mobile */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-lg px-4 py-2.5 sm:hidden"
        role="region"
        aria-label="Temporizador de lectura inferior"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 flex-shrink-0">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Lectura: {remainingSeconds}s</span>
          </div>
          <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StimulusReadingScreen;
