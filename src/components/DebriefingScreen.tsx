'use client';

import React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';

export interface DebriefingScreenProps {
  onConfirmDebriefing?: () => void;
  onComplete?: () => void;
}

export const DebriefingScreen: React.FC<DebriefingScreenProps> = ({
  onConfirmDebriefing,
  onComplete,
}) => {
  const handleProceed = () => {
    if (onConfirmDebriefing) {
      onConfirmDebriefing();
    } else if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="p-2.5 bg-amber-600 text-white rounded-lg shadow-sm">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Información Ética Post-Experimental (Debriefing)
          </p>
          <h1 className="text-lg font-bold text-amber-950">
            Revelación del Diseño Experimental
          </h1>
        </div>
      </div>

      {/* Main Disclosure Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6 space-y-6">
        {/* Core Dehoaxing Statement */}
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl">
          <p className="text-sm font-bold text-rose-950 mb-1">
            Revelación de Contenido Falso:
          </p>
          <p className="text-sm text-rose-900 leading-relaxed font-medium">
            Queremos informarle que 8 de los 20 titulares presentados fueron noticias falsas creadas para esta investigación.
          </p>
        </div>

        {/* Theoretical Framework */}
        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            Propósito Científico de la Investigación
          </h2>
          <p>
            El estudio investiga cómo la inducción de modos de pensamiento y las creencias previas influyen en la memoria.
            Específicamente, evaluamos si la disposición hacia un procesamiento analítico/racional o emocional/intuitivo modula la probabilidad de formar falsos recuerdos (recordar claramente un evento inexistente) o falsas creencias (creer que un evento ocurrió aun sin recordarlo directamente) ante noticias alineadas con la propia orientación teórica.
          </p>

          {/* Psychological Normalization */}
          <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-indigo-950">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-1">
              Normalización Psicológica
            </h3>
            <p className="text-sm leading-relaxed">
              Es completamente normal recordar o creer información falsa cuando es coherente con nuestras afinidades.
              Numerosos estudios en psicología experimental (e.g., Murphy et al., 2019, 2021) han demostrado que la gran mayoría de las personas con alta formación académica y criterio crítico experimentan estos fenómenos debido a sesgos cognitivos automáticos de congruencia ideológica y familiaridad perceptiva.
            </p>
          </div>

          <p>
            Los 12 titulares restantes correspondían a noticias periodísticas reales ocurridas en 2017 y 2018. Los titulares ficticios no reflejan hechos reales ni buscan desprestigiar a ninguna institución o corriente profesional.
          </p>
        </div>

      </div>

      {/* Final Action CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleProceed}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <span>Finalizar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default DebriefingScreen;
