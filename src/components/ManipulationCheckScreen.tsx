'use client';

import React, { useState } from 'react';
import type { InductionGroup } from '@/types/experiment';
import { ClipboardCheck, ArrowRight, AlertCircle } from 'lucide-react';

export interface ManipulationCheckData {
  reportedInduction?: 'Emoción' | 'Razón';
  emotionUsage: number;
  reasonUsage: number;
}

export interface ManipulationCheckScreenProps {
  inductionGroup: InductionGroup;
  onSubmit: (data: ManipulationCheckData) => void;
}

export const ManipulationCheckScreen: React.FC<ManipulationCheckScreenProps> = ({
  inductionGroup,
  onSubmit,
}) => {
  const [reportedInduction, setReportedInduction] = useState<'Emoción' | 'Razón' | null>(null);
  const [emotionUsage, setEmotionUsage] = useState<number | null>(null);
  const [reasonUsage, setReasonUsage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showForcedChoice = inductionGroup === 'racional' || inductionGroup === 'emocional';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showForcedChoice && !reportedInduction) {
      setError('Por favor, responda la primera pregunta.');
      return;
    }
    
    if (!emotionUsage || !reasonUsage) {
      setError('Por favor, responda todas las preguntas en las escalas del 1 al 5.');
      return;
    }
    
    setError(null);
    onSubmit({
      reportedInduction: showForcedChoice ? reportedInduction! : undefined,
      emotionUsage,
      reasonUsage,
    });
  };

  const renderLikertScale = (
    label: string, 
    value: number | null, 
    onChange: (val: number) => void
  ) => (
    <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-slate-800 mb-4">{label}</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <span className="text-xs text-slate-500 font-medium">1 (Nada)</span>
        <div className="flex-1 flex justify-between w-full sm:w-auto px-2">
          {[1, 2, 3, 4, 5].map((num) => (
            <label key={num} className="flex flex-col items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name={label}
                value={num}
                checked={value === num}
                onChange={() => onChange(num)}
                className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                {num}
              </span>
            </label>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-medium">5 (Muchísimo)</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-sm">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-indigo-950">
            Preguntas Finales
          </h1>
          <p className="text-sm text-indigo-800 mt-1">
            Por favor responda sinceramente las siguientes preguntas sobre su experiencia.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        
        {showForcedChoice && (
          <div className="mb-8 p-5 bg-blue-50/50 border border-blue-100 rounded-xl">
            <p className="text-sm font-semibold text-slate-900 mb-4">
              Al principio del estudio, se le pidió que evaluara las noticias confiando en su:
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-3 p-3 flex-1 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="forcedChoice"
                  value="Emoción"
                  checked={reportedInduction === 'Emoción'}
                  onChange={() => setReportedInduction('Emoción')}
                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Emoción</span>
              </label>
              <label className="flex items-center gap-3 p-3 flex-1 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="forcedChoice"
                  value="Razón"
                  checked={reportedInduction === 'Razón'}
                  onChange={() => setReportedInduction('Razón')}
                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Razón</span>
              </label>
            </div>
          </div>
        )}

        {renderLikertScale(
          "¿En qué medida usó la emoción al evaluar las noticias?",
          emotionUsage,
          setEmotionUsage
        )}
        
        {renderLikertScale(
          "¿En qué medida usó la razón al evaluar las noticias?",
          reasonUsage,
          setReasonUsage
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <span>Continuar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManipulationCheckScreen;
