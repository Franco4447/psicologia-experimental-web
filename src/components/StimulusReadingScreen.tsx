'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StimulusItem } from '@/types/experiment';
import { getStimulusImagePath, getStimulusAlternativePath } from '@/lib/assets';
import { Clock, Eye, AlertTriangle } from 'lucide-react';

export interface StimulusReadingScreenProps {
  stimulus: StimulusItem;
  trialNumber: number;        // Current trial index (1 to 20)
  totalTrials?: number;       // Default: 20
  onComplete?: (readingTimeMs: number) => void;
  onExposureComplete?: (readingTimeMs: number) => void;
}

const EXPOSURE_DURATION_MS = 10000; // Exact 10.0-second exposure window

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

  const imgRef = useRef<HTMLImageElement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Trigger countdown completion
  const handleFinished = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setElapsedMs(EXPOSURE_DURATION_MS);
    if (onExposureComplete) {
      onExposureComplete(EXPOSURE_DURATION_MS);
    }
    if (onComplete) {
      onComplete(EXPOSURE_DURATION_MS);
    }
  }, [onComplete, onExposureComplete]);

  // Latch timer start strictly when image is loaded
  const handleImageLoad = useCallback(() => {
    if (imageLoaded || completedRef.current) return;
    setImageLoaded(true);
    startTimeRef.current = performance.now();
  }, [imageLoaded]);

  // Handle asset load failure with fallback to alternative extension
  const handleImageError = useCallback(() => {
    const altPath = getStimulusAlternativePath(stimulus.id);
    if (imageSrc !== altPath) {
      setImageSrc(altPath);
    } else {
      setHasError(true);
      // Even if image totally fails to load from disk, do not lock user out:
      // start timer so participant can read fallback headline text card.
      if (!imageLoaded) {
        setImageLoaded(true);
        startTimeRef.current = performance.now();
      }
    }
  }, [imageSrc, stimulus.id, imageLoaded]);

  // Check if image is already cached and loaded immediately
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && !imageLoaded) {
      handleImageLoad();
    }
  }, [handleImageLoad, imageLoaded]);

  // High-precision animation frame timer loop
  useEffect(() => {
    if (!imageLoaded || completedRef.current) return;

    const tick = () => {
      if (!startTimeRef.current || completedRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;

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
  }, [imageLoaded, handleFinished]);

  // Derived progress metrics
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / EXPOSURE_DURATION_MS) * 100));
  const remainingSeconds = Math.max(0, Math.ceil((EXPOSURE_DURATION_MS - elapsedMs) / 1000));

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center px-4 py-6 select-none">
      {/* Top Header: Trial indicator & Status */}
      <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            Fase de Lectura
          </span>
          <span className="text-sm font-medium text-slate-700">
            Noticia <strong className="text-slate-900">{trialNumber}</strong> de {totalTrials}
          </span>
        </div>

        {/* Loading Badge */}
        {!imageLoaded && (
          <div className="flex items-center space-x-2 text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
            <Clock className="w-4 h-4 animate-spin-slow" />
            <span className="text-xs font-semibold">
              Cargando titular...
            </span>
          </div>
        )}
      </div>

      {/* Stimulus Banner Card */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col items-center">
        {/* Skeleton / Loading state before onLoad fires */}
        {!imageLoaded && !hasError && (
          <div className="w-full h-48 md:h-56 bg-slate-100 flex flex-col items-center justify-center animate-pulse p-6 text-center">
            <Eye className="w-8 h-8 text-slate-400 mb-2 animate-bounce" />
            <p className="text-sm font-medium text-slate-500">Cargando estímulo visual...</p>
            <p className="text-xs text-slate-400 mt-1">El tiempo de lectura comenzará una vez visible</p>
          </div>
        )}

        {/* Headline Image Banner */}
        <div className={`w-full flex justify-center bg-slate-50 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
          <img
            ref={imgRef}
            src={imageSrc}
            alt={stimulus.title}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="w-full max-h-[380px] object-contain shadow-inner"
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

        {/* Exposure Progress Indicator Bar */}
        <div className="w-full bg-slate-100 p-4 border-t border-slate-200">


          {/* Progress track */}
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-[width] duration-75 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default StimulusReadingScreen;
