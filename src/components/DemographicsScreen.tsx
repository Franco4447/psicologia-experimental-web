'use client';

import React, { useState, useRef, useEffect } from 'react';
import { argentineUniversities } from '@/data/universities';
import type {
  Gender,
  TherapeuticOrientation,
  ParticipantDemographicsInput,
} from '@/types/experiment';
import { UserCheck, AlertCircle, ArrowRight } from 'lucide-react';

export interface DemographicsScreenProps {
  onSubmit: (data: ParticipantDemographicsInput) => void;
  initialData?: Partial<ParticipantDemographicsInput>;
}

export const DemographicsScreen: React.FC<DemographicsScreenProps> = ({
  onSubmit,
  initialData,
}) => {
  const [age, setAge] = useState<string>(initialData?.age ? String(initialData.age) : '');
  const [gender, setGender] = useState<Gender | ''>(initialData?.gender || '');
  const [studiesPsychology, setStudiesPsychology] = useState<boolean | null>(
    typeof initialData?.studiesPsychology === 'boolean' ? initialData.studiesPsychology : null
  );
  const [therapeuticOrientation, setTherapeuticOrientation] = useState<TherapeuticOrientation | ''>(
    initialData?.therapeuticOrientation || ''
  );
  const [university, setUniversity] = useState<string>(initialData?.university || '');
  const [showUniversityDropdown, setShowUniversityDropdown] = useState(false);
  const universityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (universityDropdownRef.current && !universityDropdownRef.current.contains(event.target as Node)) {
        setShowUniversityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUniversities = argentineUniversities.filter(u => 
    u.toLowerCase().includes(university.toLowerCase())
  );

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState<boolean>(false);

  const validate = (): { isValid: boolean; newErrors: Record<string, string>; parsedData?: ParticipantDemographicsInput } => {
    const errs: Record<string, string> = {};

    // 1. Age validation
    const parsedAge = Number(age.trim());
    if (!age || age.trim() === '' || Number.isNaN(parsedAge)) {
      errs.age = 'La edad es obligatoria y debe ser un número.';
    } else if (!Number.isInteger(parsedAge)) {
      errs.age = 'La edad debe ser un número entero.';
    } else if (parsedAge < 18) {
      errs.age = 'Debe ser mayor o igual a 18 años para participar.';
    } else if (parsedAge > 120) {
      errs.age = 'Edad fuera del rango biológico válido.';
    }

    // 2. Gender validation
    if (!gender || !['Femenino', 'Masculino', 'Otro'].includes(gender)) {
      errs.gender = 'Debe seleccionar una opción de sexo/género válida.';
    }

    // 3. Psychology student validation
    if (studiesPsychology === null || typeof studiesPsychology !== 'boolean') {
      errs.studiesPsychology = 'Debe indicar si estudia o estudió psicología.';
    }

    // 4. Therapeutic orientation validation
    if (
      !therapeuticOrientation ||
      !['Psicoanálisis', 'Basada en Evidencia Científica', 'Otros'].includes(therapeuticOrientation)
    ) {
      errs.therapeuticOrientation = 'Debe seleccionar una orientación terapéutica válida.';
    }

    // 5. University validation
    if (!university || university.trim().length === 0) {
      errs.university = 'Debe indicar la universidad o institución.';
    }

    const isValid = Object.keys(errs).length === 0;

    return {
      isValid,
      newErrors: errs,
      parsedData: isValid
        ? {
            age: parsedAge,
            gender: gender as Gender,
            studiesPsychology: studiesPsychology as boolean,
            therapeuticOrientation: therapeuticOrientation as TherapeuticOrientation,
            university: university.trim(),
          }
        : undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    const { isValid, newErrors, parsedData } = validate();
    setErrors(newErrors);

    if (isValid && parsedData) {
      onSubmit(parsedData);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <div className="p-2.5 bg-indigo-600 text-white rounded-lg">
          <UserCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Cuestionario Demográfico y Académico
          </h1>
          <p className="text-xs text-slate-600">
            Por favor, complete los siguientes datos para contextualizar los resultados de la investigación.
          </p>
        </div>
      </div>

      {/* Global Error Banner */}
      {hasAttemptedSubmit && Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-800">
            <p className="font-semibold">Por favor corrija los siguientes errores antes de continuar:</p>
            <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-xs text-rose-700">
              {Object.values(errors).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Field 1: Age */}
        <div>
          <label htmlFor="age-input" className="block text-sm font-semibold text-slate-900 mb-1">
            1. Edad (años cumplidos) <span className="text-rose-500">*</span>
          </label>
          <input
            id="age-input"
            type="number"
            min="18"
            max="120"
            step="1"
            value={age}
            onChange={(e) => {
              setAge(e.target.value);
              if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
            }}
            placeholder="Ej: 22"
            className={`w-full max-w-xs px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
              errors.age
                ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/30'
                : 'border-slate-300 focus:ring-indigo-500 bg-white'
            }`}
          />
          {errors.age && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.age}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">Debe ser mayor o igual a 18 años.</p>
        </div>

        {/* Field 2: Gender */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            2. Sexo / Género <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['Femenino', 'Masculino', 'Otro'] as Gender[]).map((g) => (
              <label
                key={g}
                className={`flex items-center justify-center p-3 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                  gender === g
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  checked={gender === g}
                  onChange={() => {
                    setGender(g);
                    if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' }));
                  }}
                  className="sr-only"
                />
                <span>{g}</span>
              </label>
            ))}
          </div>
          {errors.gender && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.gender}</p>
          )}
        </div>

        {/* Field 3: Studies Psychology */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            3. ¿Estudia o estudió la carrera de Psicología? <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            {[
              { label: 'Sí', value: true },
              { label: 'No', value: false },
            ].map((opt) => (
              <label
                key={opt.label}
                className={`flex items-center justify-center p-3 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                  studiesPsychology === opt.value
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="studiesPsychology"
                  checked={studiesPsychology === opt.value}
                  onChange={() => {
                    setStudiesPsychology(opt.value);
                    if (errors.studiesPsychology) {
                      setErrors((prev) => ({ ...prev, studiesPsychology: '' }));
                    }
                  }}
                  className="sr-only"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {errors.studiesPsychology && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.studiesPsychology}</p>
          )}
        </div>

        {/* Field 4: Therapeutic Orientation */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            4. Orientación terapéutica con la que tiene mayor afinidad o interés{' '}
            <span className="text-rose-500">*</span>
          </label>
          <div className="space-y-2.5">
            {[
              {
                id: 'Psicoanálisis',
                title: 'Psicoanálisis',
                description: 'Enfoques psicodinámicos, teoría freudiana o lacaniana.',
              },
              {
                id: 'Basada en Evidencia Científica',
                title: 'Basada en Evidencia Científica',
                description: 'Terapia cognitivo-conductual (TCC), terapias conductuales contextuales o de tercera ola.',
              },
              {
                id: 'Otros',
                title: 'Otros / Ninguna en particular',
                description: 'Sistémica, humanista, neuropsicología, o sin preferencia definida.',
              },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                  therapeuticOrientation === opt.id
                    ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="therapeuticOrientation"
                  value={opt.id}
                  checked={therapeuticOrientation === opt.id}
                  onChange={() => {
                    setTherapeuticOrientation(opt.id as TherapeuticOrientation);
                    if (errors.therapeuticOrientation) {
                      setErrors((prev) => ({ ...prev, therapeuticOrientation: '' }));
                    }
                  }}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">{opt.title}</span>
                  <span className="text-xs text-slate-600">{opt.description}</span>
                </div>
              </label>
            ))}
          </div>
          {errors.therapeuticOrientation && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.therapeuticOrientation}</p>
          )}
        </div>

        {/* Field 5: University */}
        <div ref={universityDropdownRef} className="relative">
          <label htmlFor="university-input" className="block text-sm font-semibold text-slate-900 mb-1">
            5. Universidad o Institución Académica <span className="text-rose-500">*</span>
          </label>
          <input
            id="university-input"
            type="text"
            value={university}
            onChange={(e) => {
              setUniversity(e.target.value);
              setShowUniversityDropdown(true);
              if (errors.university) setErrors((prev) => ({ ...prev, university: '' }));
            }}
            onFocus={() => setShowUniversityDropdown(true)}
            onClick={() => setShowUniversityDropdown(true)}
            placeholder="Ej: Universidad Favaloro, UBA, etc. (Puede escribir otra)"
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
              errors.university
                ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/30'
                : 'border-slate-300 focus:ring-indigo-500 bg-white'
            }`}
          />
          {showUniversityDropdown && filteredUniversities.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg">
              {filteredUniversities.map((uni) => (
                <li
                  key={uni}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer"
                  onClick={() => {
                    setUniversity(uni);
                    setShowUniversityDropdown(false);
                    if (errors.university) setErrors((prev) => ({ ...prev, university: '' }));
                  }}
                >
                  {uni}
                </li>
              ))}
            </ul>
          )}
          {errors.university && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.university}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <span>Continuar a las Instrucciones</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default DemographicsScreen;
