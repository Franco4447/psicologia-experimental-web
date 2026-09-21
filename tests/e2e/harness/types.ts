/**
 * Core TypeScript contracts for the Universidad Favaloro Experimental Psychology Web Platform.
 * Strictly aligned with PROJECT.md Interface Contracts and ORIGINAL_REQUEST.md.
 */

export type InductionGroup = 'racional' | 'emocional' | 'control';
export type TherapeuticOrientation = 'Psicoanálisis' | 'Basada en Evidencia Científica' | 'Otros';
export type FakeNewsSet = 'psicoanalisis' | 'evidencia' | 'control_random';
export type ResponseCode = 1 | 2 | 3 | 4;
export type GenderOption = 'Femenino' | 'Masculino' | 'Otro';
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface StimulusItem {
  id: number; // 1 to 28
  title: string;
  isFake: boolean;
  imageFileName: string; // e.g. "Noticia_01.jpg" or "Noticia_26.png"
  congruence: 'psicoanalisis' | 'evidencia' | 'true';
}

export interface DemographicsInput {
  age: number;
  gender: GenderOption;
  studiesPsychology: boolean;
  therapeuticOrientation: TherapeuticOrientation;
  university: string;
}

export interface ParticipantSession {
  id: string; // UUID v4
  createdAt: string;
  completedAt?: string;
  age: number;
  gender: string;
  studiesPsychology: boolean;
  therapeuticOrientation: TherapeuticOrientation;
  university: string;
  isIncluded: boolean;
  inductionGroup: InductionGroup;
  fakeNewsSet: FakeNewsSet;
  status: 'started' | 'reading' | 'rating' | 'debriefing' | 'completed';
  deviceType: DeviceType;
  screenResolution: string;
  userAgent: string;
}

export interface TrialRecord {
  participantId: string;
  presentationOrder: number; // 1 to 20
  newsId: number;
  isFake: boolean;
  newsCongruence: string;
  responseOption: ResponseCode;
  responseLabel: string;
  readingTimeMs: number;
  responseTimeMs: number;
  createdAt?: string;
}

export interface CsvRowData {
  participant_id: string;
  created_at: string;
  completed_at: string;
  age: number;
  gender: string;
  studies_psychology: boolean;
  therapeutic_orientation: string;
  university: string;
  is_included: boolean;
  induction_group: string;
  fake_news_set: string;
  presentation_order: number;
  news_id: number;
  is_fake: boolean;
  news_congruence: string;
  response_option: number;
  response_label: string;
  is_false_memory: boolean;
  is_false_belief: boolean;
  reading_time_ms: number;
  response_time_ms: number;
  device_type: string;
  screen_resolution: string;
}

export interface AdminStats {
  totalParticipants: number;
  includedCount: number;
  excludedCount: number;
  groupCounts: {
    racional: number;
    emocional: number;
    control: number;
  };
  balanceDelta: number;
  isBalanced: boolean;
}
