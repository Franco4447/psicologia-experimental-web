'use client';

import React from 'react';
import { CheckCircle2, FlaskConical } from 'lucide-react';

export interface ThankYouScreenProps {
  participantId: string;
}

export const ThankYouScreen: React.FC<ThankYouScreenProps> = () => {

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 text-center">
      {/* Animated Success Badge */}
      <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full mb-6 ring-8 ring-emerald-50">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      {/* Gratitude Heading */}
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
        ¡Muchas gracias por participar! Sus respuestas han sido registradas exitosamente.
      </h1>

      <p className="text-slate-600 text-base mb-8 max-w-lg mx-auto leading-relaxed">
        Su aporte es de enorme valor para la investigación en psicología cognitiva y experimental de la Universidad Favaloro.
      </p>



      {/* Safety Notice */}
      <p className="text-xs text-slate-400 mb-8 max-w-sm mx-auto">
        Sus datos han sido guardados con éxito en la base de datos segura. Ya puede cerrar esta ventana del navegador tranquilamente.
      </p>



      {/* Footer Attribution */}
      <div className="pt-6 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-center gap-2">
        <FlaskConical className="w-4 h-4 text-slate-400" />
        <span>Universidad Favaloro · Facultad de Psicología · Psicología Experimental</span>
      </div>
    </div>
  );
};

export default ThankYouScreen;
