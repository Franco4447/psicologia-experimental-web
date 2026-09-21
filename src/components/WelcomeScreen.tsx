'use client';

import React from 'react';
import { FlaskConical, Clock, ShieldCheck, ArrowRight, Volume2 } from 'lucide-react';

export interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Institution Header Badge */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-sm">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            Universidad Favaloro · Facultad de Psicología
          </p>
          <p className="text-sm font-medium text-indigo-950">
            Psicología Experimental
          </p>
        </div>
      </div>

      {/* Main Title & Welcome Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4 leading-tight">
          Investigación sobre Percepción y Evaluación de Titulares
        </h1>

        <div className="prose prose-slate text-slate-700 space-y-4 text-base leading-relaxed">
          <p className="font-medium text-slate-900">
            Somos estudiantes de la Universidad Favaloro de la carrera de Psicología.
          </p>
          <p>
            El objetivo de esta investigación es evaluar la percepción y evaluación de titulares de noticias.
            A lo largo de la experiencia se le presentará una serie de estímulos periodísticos que deberá observar y evaluar conforme a pautas estandarizadas.
          </p>
          <p className="text-slate-600 text-sm">
            Su participación es fundamental para el avance del conocimiento científico en el área de la psicología cognitiva y la memoria humana.
          </p>
        </div>

        {/* 3 Pillars: Environment, Duration, Privacy */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-indigo-600 mb-1.5">
              <Volume2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Entorno</span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              Por favor, busque un lugar tranquilo, sin interrupciones y con conexión estable a internet.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-indigo-600 mb-1.5">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Tiempo Estimado</span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              La duración estimada del experimento es de entre 10 y 15 minutos.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-emerald-600 mb-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Confidencialidad</span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              Respuestas 100% anónimas tratadas con fines estrictamente académicos.
            </p>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <span>Comenzar Experimento</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
