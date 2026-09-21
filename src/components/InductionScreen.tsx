'use client';

import React from 'react';
import type { InductionGroup } from '@/types/experiment';
import { Brain, Sparkles, Compass, CheckCircle2, ArrowRight } from 'lucide-react';

export interface InductionScreenProps {
  inductionGroup: InductionGroup;
  onAcknowledge: () => void;
}

export const InductionScreen: React.FC<InductionScreenProps> = ({
  inductionGroup,
  onAcknowledge,
}) => {
  // Verbatim induction prompts per ORIGINAL_REQUEST.md and Tier 1 assertions
  const prompts = {
    racional: {
      badge: 'Instrucciones: Modo de Procesamiento',
      title: 'Pautas de Evaluación Analítica',
      icon: Brain,
      text: 'Mucha gente cree que la razón conduce a una buena toma de decisiones. Cuando usamos la lógica, en lugar de los sentimientos, tomamos decisiones racionalmente satisfactorias. Por favor, evalúe los siguientes titulares de noticias basándose en la razón, en lugar de en sus emociones.',
    },
    emocional: {
      badge: 'Instrucciones: Modo de Procesamiento',
      title: 'Pautas de Evaluación Intuitiva',
      icon: Sparkles,
      text: 'Mucha gente cree que la emoción conduce a una buena toma de decisiones. Cuando usamos los sentimientos, en lugar de la lógica, tomamos decisiones emocionalmente satisfactorias. Por favor, evalúe los siguientes titulares de noticias basándose en sus emociones, en lugar de en la razón.',
    },
    control: {
      badge: 'Instrucciones: Modo de Procesamiento',
      title: 'Pautas Generales de Evaluación',
      icon: Compass,
      text: 'A continuación se le presentará una serie de titulares de noticias reales de 2017-2018. Estamos interesados en su opinión sobre si los titulares son precisos o no.',
    },
  };

  const activePrompt = prompts[inductionGroup] || prompts.control;
  const IconComponent = activePrompt.icon;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Header Badge */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-sm">
          <IconComponent className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            {activePrompt.badge}
          </p>
          <h1 className="text-lg font-bold text-indigo-950">
            {activePrompt.title}
          </h1>
        </div>
      </div>

      {/* Induction Prime Callout Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6 space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Instrucción Fundamental
          </span>
          <blockquote className="p-5 sm:p-6 bg-slate-50 border-l-4 border-indigo-600 rounded-r-xl text-slate-900 text-lg sm:text-xl font-serif italic leading-relaxed">
            &ldquo;{activePrompt.text}&rdquo;
          </blockquote>
        </div>

        {/* Task Workflow Explanation */}
        <div className="border-t border-slate-100 pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
            Estructura del Experimento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Lectura del Titular (10 seg)</p>
                <p className="text-xs text-slate-600 mt-1 leading-normal">
                  Cada titular se mostrará durante 10 segundos continuos con una barra de progreso visual. Léalo detenidamente.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Evaluación de Memoria</p>
                <p className="text-xs text-slate-600 mt-1 leading-normal">
                  Luego indicará si recuerda el evento, cree que sucedió, lo recuerda diferente o no lo recuerda en absoluto.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-amber-700 shrink-0" />
          <p className="text-xs text-amber-900 leading-relaxed">
            Se evaluarán 20 titulares en total. Una vez comenzado el bloque, por favor no recargue ni cierre la página.
          </p>
        </div>
      </div>

      {/* Action CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAcknowledge}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <span>Comenzar Evaluación de Titulares</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InductionScreen;
