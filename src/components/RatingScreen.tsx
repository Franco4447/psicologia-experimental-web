'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StimulusItem, ResponseCode } from '@/types/experiment';
import { RESPONSE_OPTIONS } from '@/data/stimuli';
import { getStimulusImagePath, getStimulusAlternativePath } from '@/lib/assets';
import { CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react';

export interface RatingSubmission {
  responseOption: ResponseCode;
  responseTimeMs: number;
}

export interface RatingScreenProps {
  stimulus: StimulusItem;
  trialNumber: number;          // Current trial index (1 to 20)
  totalTrials?: number;         // Default: 20
  onSubmitResponse?: (submission: RatingSubmission) => void;
  onSubmitRating?: (responseOption: ResponseCode, responseTimeMs: number) => void;
}

export const RatingScreen: React.FC<RatingScreenProps> = ({
  stimulus,
  trialNumber,
  totalTrials = 20,
  onSubmitResponse,
  onSubmitRating,
}) => {
  const [selectedOption, setSelectedOption] = useState<ResponseCode | null>(null);
  const [imageSrc, setImageSrc] = useState<string>(() => getStimulusImagePath(stimulus.id));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mount timestamp for millisecond reaction time capture
  const mountTimeRef = useRef<number>(0);
  const firstSelectionTimeRef = useRef<number | null>(null);

  useEffect(() => {
    mountTimeRef.current = performance.now();
  }, []);

  // Handle selection change
  const handleSelectOption = useCallback((code: ResponseCode) => {
    if (isSubmitting) return;
    if (firstSelectionTimeRef.current === null) {
      firstSelectionTimeRef.current = performance.now();
    }
    setSelectedOption(code);
  }, [isSubmitting]);

  // Handle confirmation and latency computation
  const handleSubmit = useCallback(() => {
    if (selectedOption === null || isSubmitting) return;

    setIsSubmitting(true);
    const now = performance.now();
    const elapsed = Math.round(now - mountTimeRef.current);
    // Boundary resilience: strictly guarantee non-negative integer >= 1
    const responseTimeMs = Math.max(1, elapsed);

    if (onSubmitResponse) {
      onSubmitResponse({
        responseOption: selectedOption,
        responseTimeMs,
      });
    }
    if (onSubmitRating) {
      onSubmitRating(selectedOption, responseTimeMs);
    }
  }, [selectedOption, isSubmitting, onSubmitResponse, onSubmitRating]);

  // Keyboard navigation shortcuts: keys 1-4 select options, Enter submits
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return;

      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const code = Number(e.key) as ResponseCode;
        handleSelectOption(code);
      } else if (e.key === 'Enter' && selectedOption !== null) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectOption, handleSubmit, isSubmitting, selectedOption]);

  const overallProgressPercent = Math.round((trialNumber / totalTrials) * 100);
  const isFinalTrial = trialNumber >= totalTrials;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center px-4 py-4 select-none">
      {/* Top Header: Trial Progress */}
      <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
            Evaluación de Memoria
          </span>
          <span className="text-sm font-medium text-slate-700">
            Noticia <strong className="text-slate-900">{trialNumber}</strong> de {totalTrials}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span>Progreso general: {overallProgressPercent}%</span>
        </div>
      </div>



      {/* Question Prompt */}
      <div className="w-full text-center mb-5">
        <div className="inline-flex items-center space-x-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
          <span>Pregunta de Evaluación</span>
        </div>
        <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-snug">
          ¿Recuerda haber visto o leído este evento con anterioridad?
        </h2>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          Seleccione la opción que mejor describa su experiencia o conocimiento:
        </p>
      </div>

      {/* 4-Point Response Options Radio Group (Murphy & León Scale) */}
      <div
        className="w-full space-y-3 mb-6"
        role="radiogroup"
        aria-label="Escala de memoria de 4 puntos de Murphy y León"
      >
        {RESPONSE_OPTIONS.map((option) => {
          const isSelected = selectedOption === option.code;

          return (
            <div
              key={option.code}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => handleSelectOption(option.code)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  handleSelectOption(option.code);
                }
              }}
              className={`w-full p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center space-x-3.5 ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-1 ring-indigo-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
              }`}
            >
              {/* Option Number Badge */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 border border-slate-300'
                }`}
              >
                {option.code}
              </div>

              {/* Radio Indicator */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'border-indigo-600 bg-white' : 'border-slate-300 bg-white'
                }`}
              >
                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
              </div>

              {/* Option Label Text */}
              <div className="flex-1 text-left">
                <span
                  className={`text-sm md:text-base font-medium leading-normal ${
                    isSelected ? 'text-indigo-950 font-semibold' : 'text-slate-800'
                  }`}
                >
                  {option.label}
                </span>
              </div>

              {/* Selection Checkmark */}
              {isSelected && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation & Advance Button */}
      <div className="w-full flex flex-col items-center">
        <button
          type="button"
          disabled={selectedOption === null || isSubmitting}
          onClick={handleSubmit}
          className={`w-full md:w-auto min-w-[240px] px-8 py-3.5 rounded-xl font-semibold text-sm md:text-base flex items-center justify-center space-x-2 transition-all shadow-sm ${
            selectedOption === null || isSubmitting
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 hover:shadow-md cursor-pointer'
          }`}
        >
          <span>
            {isSubmitting
              ? 'Registrando...'
              : isFinalTrial
              ? 'Finalizar y continuar al debriefing'
              : 'Siguiente noticia'}
          </span>
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>

        <p className="text-[11px] text-slate-400 mt-2 text-center">
          Atajo de teclado: presione las teclas 1, 2, 3 o 4 para seleccionar y Enter para avanzar.
        </p>
      </div>
    </div>
  );
};

export default RatingScreen;
