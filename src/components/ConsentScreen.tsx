'use client';

import React, { useState } from 'react';
import { FileText, ArrowRight } from 'lucide-react';

export interface ConsentScreenProps {
  onAcceptConsent?: () => void;
  onAccept?: () => void;
  onDeclineConsent?: () => void;
  onBack?: () => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  onAcceptConsent,
  onAccept,
  onDeclineConsent,
  onBack,
}) => {
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);

  const handleContinue = () => {
    if (!hasAgreed) return;
    if (onAcceptConsent) {
      onAcceptConsent();
    } else if (onAccept) {
      onAccept();
    }
  };

  const handleDecline = () => {
    if (onDeclineConsent) {
      onDeclineConsent();
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-slate-100 border border-slate-200 rounded-xl">
        <div className="p-2.5 bg-slate-800 text-white rounded-lg">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Formulario de Consentimiento Informado
          </h1>
          <p className="text-xs text-slate-600">
            Universidad Favaloro · Comité de Ética en Investigación Psicológica
          </p>
        </div>
      </div>

      {/* Informed Consent Document Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-sm text-slate-700 leading-relaxed max-h-80 overflow-y-auto space-y-4">
          <p className="font-semibold text-slate-900">
            Información al participante:
          </p>
          <p>
            Usted ha sido invitado/a a participar en un estudio científico llevado a cabo por investigadores y estudiantes de la carrera de Psicología de la Universidad Favaloro. El propósito de este estudio es explorar cómo las personas procesan, evalúan y recuerdan información periodística contemporánea.
          </p>
          <p className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-900">
            Voluntariedad y Anonimato
          </p>
          <p>
            La participación es estrictamente voluntaria y anónima. Puede retirarse en cualquier momento sin necesidad de justificación y sin que ello conlleve perjuicio alguno. No se recopilarán datos de filiación directa (tales como nombre, apellido, DNI ni dirección IP personal). Toda la información recolectada se identificará únicamente mediante un código alfanumérico aleatorio y se empleará exclusivamente para análisis estadístico grupal.
          </p>
          <p className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-900">
            Procedimiento
          </p>
          <p>
            Completará un breve cuestionario demográfico, seguido de la lectura guiada de una serie de titulares de noticias de interés general y preguntas breves sobre su recuerdo o familiaridad con ellos. La duración total no superará los 15 minutos.
          </p>
          <p className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-900">
            Riesgos y Beneficios
          </p>
          <p>
            La participación no presenta riesgos físicos, psicológicos ni legales superiores a los de la lectura habitual de noticias en medios digitales. Al concluir, se brindará una explicación detallada sobre los objetivos y diseño del experimento.
          </p>
        </div>

        {/* Mandatory Checkbox */}
        <label
          htmlFor="consent-checkbox"
          className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer select-none ${
            hasAgreed
              ? 'bg-indigo-50/70 border-indigo-300'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <input
            id="consent-checkbox"
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <div className="text-sm font-medium text-slate-800">
            <span>He leído y acepto los términos del consentimiento informado.</span>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Confirmo que soy mayor de 18 años y acepto participar voluntariamente en esta investigación.
            </p>
          </div>
        </label>
      </div>

      {/* Buttons */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
        {(onDeclineConsent || onBack) && (
          <button
            type="button"
            onClick={handleDecline}
            className="w-full sm:w-auto px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            No deseo participar
          </button>
        )}
        <div className="flex justify-end w-full sm:w-auto ml-auto">
          <button
            type="button"
            disabled={!hasAgreed}
            onClick={handleContinue}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white transition-all w-full sm:w-auto ${
              hasAgreed
                ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm cursor-pointer'
                : 'bg-slate-300 cursor-not-allowed text-slate-500'
            }`}
          >
            <span>Continuar a Datos Demográficos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentScreen;
