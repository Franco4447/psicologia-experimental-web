import type { StimulusItem, TherapeuticOrientation, ResponseCode } from './types.ts';

export const ALL_STIMULI: StimulusItem[] = [
  // 12 True News items
  {
    id: 1,
    title: 'Las agencias de medicamentos son una invención del capitalismo neoliberal de la década de 1990.',
    isFake: false,
    imageFileName: 'Noticia_01.jpg',
    congruence: 'true',
  },
  {
    id: 2,
    title: 'Mario Bunge: el psicoanálisis y otras pseudociencias son perjudiciales.',
    isFake: false,
    imageFileName: 'Noticia_02.jpg',
    congruence: 'true',
  },
  {
    id: 3,
    title: 'Una pandemia de adaptación y neoliberalismo conductual en la educación.',
    isFake: false,
    imageFileName: 'Noticia_03.jpg',
    congruence: 'true',
  },
  {
    id: 4,
    title: 'Científicos explican por qué los sueños no tienen significados ocultos.',
    isFake: false,
    imageFileName: 'Noticia_04.jpg',
    congruence: 'true',
  },
  {
    id: 5,
    title: 'El pequeño Albert: un cruel experimento con un bebé de 11 meses para estudiar las fobias.',
    isFake: false,
    imageFileName: 'Noticia_05.jpg',
    congruence: 'true',
  },
  {
    id: 6,
    title: 'La comunidad reúne firmas contra las terapias psicoanalíticas públicas en casos de autismo.',
    isFake: false,
    imageFileName: 'Noticia_06.jpg',
    congruence: 'true',
  },
  {
    id: 7,
    title: 'La caja de Skinner: juegos como Candy Crush están diseñados para volverte adicto.',
    isFake: false,
    imageFileName: 'Noticia_07.jpg',
    congruence: 'true',
  },
  {
    id: 8,
    title: 'Wilhelm Reich: los controvertidos tratamientos sexuales de uno de los psicoanalistas más radicales de la historia.',
    isFake: false,
    imageFileName: 'Noticia_08.jpg',
    congruence: 'true',
  },
  {
    id: 9,
    title: 'El psiquiatra que aplicaba electroshocks a personas homosexuales.',
    isFake: false,
    imageFileName: 'Noticia_09.jpg',
    congruence: 'true',
  },
  {
    id: 10,
    title: 'La feminista que refutó a Freud y su concepto de envidia del pene.',
    isFake: false,
    imageFileName: 'Noticia_10.jpg',
    congruence: 'true',
  },
  {
    id: 11,
    title: 'Expertos piden revisar los métodos actuales de diagnóstico del trastorno bipolar.',
    isFake: false,
    imageFileName: 'Noticia_11.jpg',
    congruence: 'true',
  },
  {
    id: 12,
    title: 'La historia del sobrino argentino de Freud: es psicoanalista y cuestiona la idea de ser trans antes de la pubertad.',
    isFake: false,
    imageFileName: 'Noticia_12.jpg',
    congruence: 'true',
  },

  // Fake News Set 1 (Attacks Psychoanalysis / Congruent with Evidencia)
  {
    id: 13,
    title: 'El terapeuta freudiano que hipnotizaba a sus pacientes con descargas eléctricas irá a juicio.',
    isFake: true,
    imageFileName: 'Noticia_13.jpg',
    congruence: 'evidencia',
  },
  {
    id: 14,
    title: 'Abraham Low, el pediatra y cognitivista británico que afirmaba que el autismo se curaba con terapia conductual.',
    isFake: true,
    imageFileName: 'Noticia_14.jpg',
    congruence: 'psicoanalisis',
  },
  {
    id: 15,
    title: 'Horror en Formosa: la joven hospitalizada por inanición cerró el refrigerador con un candado como parte de su terapia psicoanalítica.',
    isFake: true,
    imageFileName: 'Noticia_15.jpg',
    congruence: 'evidencia',
  },
  {
    id: 16,
    title: 'Investigan un caso de mala praxis: llevaba 5 años con depresión y su terapeuta cognitivo se negaba a darle un diagnóstico.',
    isFake: true,
    imageFileName: 'Noticia_16.jpg',
    congruence: 'psicoanalisis',
  },
  {
    id: 17,
    title: 'Texas: una joven se suicida después de recibir el alta de una terapia psicoanalítica.',
    isFake: true,
    imageFileName: 'Noticia_17.jpg',
    congruence: 'evidencia',
  },
  {
    id: 18,
    title: 'Suspenden la licencia de un terapeuta cognitivo que desvestía a sus pacientes para ayudarlos a conectarse con sus cuerpos.',
    isFake: true,
    imageFileName: 'Noticia_18.jpg',
    congruence: 'psicoanalisis',
  },
  {
    id: 19,
    title: 'Un tirador en la ciudad de Dakota: "había superado todas las técnicas proyectivas; era una persona normal".',
    isFake: true,
    imageFileName: 'Noticia_19.jpg',
    congruence: 'evidencia',
  },
  {
    id: 20,
    title: 'Hallazgos recientes de neuroimagen refutan el concepto de "condicionamiento" de Watson.',
    isFake: true,
    imageFileName: 'Noticia_20.jpg',
    congruence: 'psicoanalisis',
  },

  // Fake News Set 2 (Attacks Cognitive-Behavioral / Congruent with Psicoanálisis)
  {
    id: 21,
    title: 'El terapeuta cognitivo que entrenaba a sus pacientes con descargas eléctricas irá a juicio.',
    isFake: true,
    imageFileName: 'Noticia_21.jpg',
    congruence: 'psicoanalisis',
  },
  {
    id: 22,
    title: 'Donald Winnicott, el pediatra y psicoanalista británico que afirmaba que el autismo se curaba mediante hipnosis.',
    isFake: true,
    imageFileName: 'Noticia_22.jpg',
    congruence: 'evidencia',
  },
  {
    id: 23,
    title: 'Horror en Formosa: la joven hospitalizada por inanición cerró el refrigerador con un candado como parte de su terapia cognitiva.',
    isFake: true,
    imageFileName: 'Noticia_23.jpg',
    congruence: 'psicoanalisis',
  },
  {
    id: 24,
    title: 'Investigan un caso de mala praxis: llevaba 5 años con depresión y su terapeuta psicoanalista se negaba a darle un diagnóstico.',
    isFake: true,
    imageFileName: 'Noticia_24.jpg',
    congruence: 'evidencia',
  },
  {
    id: 25,
    title: 'Texas: una joven se suicida después de recibir el alta de una terapia cognitiva breve.',
    isFake: true,
    imageFileName: 'Noticia_25.jpg',
    congruence: 'psicoanalisis',
  },
  {
    id: 26,
    title: 'Suspenden la licencia de un psicoanalista que desvestía a sus pacientes para ayudarlos a conectarse con sus cuerpos.',
    isFake: true,
    imageFileName: 'Noticia_26.png', // CRITICAL: Only stimulus with .png extension!
    congruence: 'evidencia',
  },
  {
    id: 27,
    title: 'Un tirador en la ciudad de Dakota: "había superado todas las técnicas psicométricas; era una persona normal".',
    isFake: true,
    imageFileName: 'Noticia_27.jpg',
    congruence: 'psicoanalisis',
  },
  {
    id: 28,
    title: 'Hallazgos recientes de neuroimagen refutan el concepto de "superyó" de Freud.',
    isFake: true,
    imageFileName: 'Noticia_28.jpg',
    congruence: 'evidencia',
  },
];

export const TRUE_NEWS_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const PSICOANALISIS_FAKE_IDS = [14, 16, 18, 20, 21, 23, 25, 27];
export const EVIDENCIA_FAKE_IDS = [13, 15, 17, 19, 22, 24, 26, 28];

export const RESPONSE_SCALE: Record<ResponseCode, string> = {
  1: 'Recuerdo claramente haber visto/leído este evento',
  2: 'No recuerdo haberlo visto, pero creo que sucedió',
  3: 'Lo recuerdo diferente',
  4: 'No lo recuerdo en absoluto',
};

export const INDUCTION_PROMPTS = {
  racional:
    'Mucha gente cree que la razón conduce a una buena toma de decisiones. Cuando usamos la lógica, en lugar de los sentimientos, tomamos decisiones racionalmente satisfactorias. Por favor, evalúe los siguientes titulares de noticias basándose en la razón, en lugar de en sus emociones.',
  emocional:
    'Mucha gente cree que la emoción conduce a una buena toma de decisiones. Cuando usamos los sentimientos, en lugar de la lógica, tomamos decisiones emocionalmente satisfactorias. Por favor, evalúe los siguientes titulares de noticias basándose en sus emociones, en lugar de en la razón.',
  control:
    'A continuación se le presentará una serie de titulares de noticias reales de 2017-2018. Estamos interesados en su opinión sobre si los titulares son precisos o no.',
};

/**
 * Returns the stimulus by internal ID.
 */
export function getStimulusById(id: number): StimulusItem {
  const item = ALL_STIMULI.find((s) => s.id === id);
  if (!item) {
    throw new Error(`Stimulus ID ${id} not found in authoritative catalog.`);
  }
  return item;
}

/**
 * Correctly resolves the asset filename and extension for any stimulus ID.
 */
export function resolveImageFileName(id: number): string {
  if (id < 1 || id > 28) {
    throw new Error(`Invalid stimulus ID: ${id}. Valid range is 1-28.`);
  }
  if (id === 26) {
    return 'Noticia_26.png';
  }
  const padded = id.toString().padStart(2, '0');
  return `Noticia_${padded}.jpg`;
}

/**
 * Returns the exact 20 stimuli (12 true + 8 fake) for a participant given orientation and inclusion status.
 */
export function getStimuliForParticipant(
  orientation: TherapeuticOrientation,
  isIncluded: boolean
): StimulusItem[] {
  const trueItems = TRUE_NEWS_IDS.map(getStimulusById);
  let fakeIds: number[];

  if (!isIncluded) {
    // Excluded participants receive 8 fake news (either balanced subset or deterministic pool for reproducibility)
    fakeIds = [13, 14, 15, 16, 17, 18, 19, 20];
  } else if (orientation === 'Psicoanálisis') {
    fakeIds = PSICOANALISIS_FAKE_IDS;
  } else if (orientation === 'Basada en Evidencia Científica') {
    fakeIds = EVIDENCIA_FAKE_IDS;
  } else {
    fakeIds = [13, 14, 15, 16, 17, 18, 19, 20];
  }

  const fakeItems = fakeIds.map(getStimulusById);
  return [...trueItems, ...fakeItems];
}

/**
 * Derives the scientific false memory and false belief boolean flags.
 * Murphy & León criteria:
 * - Option 1 ("Recuerdo claramente haber visto/leído") on a Fake News -> is_false_memory = true
 * - Option 2 ("No recuerdo haberlo visto, pero creo que sucedió") on a Fake News -> is_false_belief = true
 * - True news can NEVER yield false memory or false belief of fake news.
 */
export function deriveFalseMemoryFlags(
  isFake: boolean,
  responseOption: number
): { isFalseMemory: boolean; isFalseBelief: boolean } {
  return {
    isFalseMemory: isFake && responseOption === 1,
    isFalseBelief: isFake && responseOption === 2,
  };
}
