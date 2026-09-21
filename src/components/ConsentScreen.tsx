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
            Universidad Favaloro
          </p>
        </div>
      </div>

      {/* Informed Consent Document Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-sm text-slate-700 leading-relaxed max-h-80 overflow-y-auto space-y-4">
          <p>
            Somos estudiantes de la Licenciatura en Psicología de la Universidad Favaloro. En el marco de la asignatura Psicología Experimental, nos encontramos realizando una investigación con fines exclusivamente académicos cuyo objetivo general es examinar la relación entre distintas modalidades de procesamiento de la información y el recuerdo de noticias. Se invita a participar a personas mayores de 18 años que sean estudiantes o graduadas de Psicología.
          </p>

          <p className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-900 mt-4">
            Procedimiento
          </p>
          <p>
            La participación consiste en completar un breve cuestionario sociodemográfico y académico, responder preguntas sobre la afinidad con distintas corrientes psicológicas, leer una serie de noticias y contestar consignas vinculadas con su interpretación y recuerdo. La actividad tendrá una duración aproximada de 10-15 minutos. Se solicita responder con atención y de acuerdo con la propia experiencia; no se evaluará el desempeño individual.
          </p>
          <p className="mt-2">
            Para evitar que el conocimiento anticipado de ciertos aspectos del estudio influya en las respuestas, parte de la información sobre sus objetivos específicos y los materiales utilizados se proporcionará al concluir todas las actividades. En esa instancia se explicará el propósito de la investigación y se podrán formular consultas sobre el procedimiento.
          </p>

          <p className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-900 mt-4">
            Riesgos y beneficios
          </p>
          <p>
            La participación no supone intervenciones físicas. No obstante, el contenido de algunas noticias podría ocasionar incomodidad o malestar emocional. Podrá interrumpir la actividad si lo considera necesario. La participación no es remunerada ni implica beneficios personales directos; sus resultados podrán contribuir a la comprensión académica de los procesos de evaluación y recuerdo de información.
          </p>

          <p className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-900 mt-4">
            Confidencialidad y participación voluntaria
          </p>
          <p>
            Las respuestas se utilizarán únicamente con fines académicos y se analizarán de forma grupal, sin divulgar información que permita identificar a quienes participen. Los datos se tratarán de manera confidencial, conforme a la normativa aplicable de protección de datos personales. La participación es voluntaria: puede negarse a participar o retirarse en cualquier momento, sin dar explicaciones ni sufrir consecuencias. Podrá solicitar la exclusión de sus respuestas mientras sea posible identificarlas; una vez anonimizadas, su eliminación individual podría no resultar posible.
          </p>

          <p className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-900 mt-4">
            Consultas
          </p>
          <p>
            Para solicitar información adicional sobre el estudio o realizar consultas relacionadas con la participación, podrá comunicarse con el equipo investigador a través del siguiente correo electrónico: pilardicriscenzo@gmail.com
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
