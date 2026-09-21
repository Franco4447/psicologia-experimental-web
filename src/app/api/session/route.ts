/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Parcial 2 - Investigación: Efecto de la Inducción Cognitiva sobre Falsos Recuerdos
 * 
 * Route Handler: /api/session
 * Methods:
 * - OPTIONS: CORS preflight
 * - POST: Participant session registration, demographics validation, balanced group allocation
 * - PATCH: Participant session completion and status update
 * Target location: src/app/api/session/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
  mockStore,
  type ParticipantInsert,
  type ParticipantUpdate,
} from '@/lib/supabase';
import { evaluateInclusion } from '@/data/stimuli';
import type {
  InductionGroup,
  TherapeuticOrientation,
  Gender,
  FakeNewsSet,
  DeviceType,
  SessionStatus,
  ParticipantSession,
} from '@/types/experiment';

// ============================================================================
// Helper Validation & CORS Utilities
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// ============================================================================
// POST: Initialize Participant Session
// ============================================================================

export interface SessionCreateBody {
  id?: string;
  age: number;
  gender: Gender;
  studiesPsychology: boolean;
  therapeuticOrientation: TherapeuticOrientation;
  university: string;
  deviceType?: DeviceType;
  screenResolution?: string;
  userAgent?: string;
  clientTimestamp?: string;
}

export async function POST(req: NextRequest) {
  try {
    let body: SessionCreateBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { success: false, error: 'Malformed JSON payload' },
        400
      );
    }

    const {
      id,
      age,
      gender,
      studiesPsychology,
      therapeuticOrientation,
      university,
      deviceType,
      screenResolution,
      userAgent,
      clientTimestamp,
    } = body;

    // 1. Rigorous Demographics Validation
    const errors: string[] = [];

    if (age === undefined || age === null || typeof age !== 'number' || Number.isNaN(age)) {
      errors.push('La edad es obligatoria y debe ser un número.');
    } else if (!Number.isInteger(age)) {
      errors.push('La edad debe ser un número entero.');
    } else if (age < 18) {
      errors.push('Debe ser mayor o igual a 18 años para participar.');
    } else if (age > 120) {
      errors.push('Edad fuera del rango válido (máximo 120 años).');
    }

    if (!gender || !['Femenino', 'Masculino', 'Otro'].includes(gender)) {
      errors.push("El género debe ser 'Femenino', 'Masculino' u 'Otro'.");
    }

    if (studiesPsychology === undefined || typeof studiesPsychology !== 'boolean') {
      errors.push('Debe indicar si estudia o estudió psicología (booleano).');
    }

    if (
      !therapeuticOrientation ||
      !['Psicoanálisis', 'Basada en Evidencia Científica', 'Otros'].includes(therapeuticOrientation)
    ) {
      errors.push("Orientación terapéutica no válida. Opciones: 'Psicoanálisis', 'Basada en Evidencia Científica', 'Otros'.");
    }

    if (!university || typeof university !== 'string' || university.trim().length === 0) {
      errors.push('La institución o universidad es obligatoria.');
    }

    if (errors.length > 0) {
      return jsonResponse(
        {
          success: false,
          error: 'Validation failed',
          details: errors,
        },
        400
      );
    }

    // 2. Evaluate Inclusion Criteria
    const inclusionEval = evaluateInclusion({
      age,
      studiesPsychology,
      therapeuticOrientation,
    });
    const isIncluded = inclusionEval.isIncluded;
    const exclusionReason = inclusionEval.exclusionReason;

    // 3. Determine Induction Group & Fake News Set
    let inductionGroup: InductionGroup = 'control';
    let fakeNewsSet: FakeNewsSet = 'control_random';

    const client = getSupabaseAdminClient();
    const liveDbAvailable = isSupabaseConfigured() && client !== null;

    if (!isIncluded) {
      // Excluded participants strictly routed to Control condition + control_random deck
      inductionGroup = 'control';
      fakeNewsSet = 'control_random';
    } else {
      // Included participants:
      // Fake news set based on ideological orientation
      if (therapeuticOrientation === 'Psicoanálisis') {
        fakeNewsSet = 'psicoanalisis';
      } else if (therapeuticOrientation === 'Basada en Evidencia Científica') {
        fakeNewsSet = 'evidencia';
      }

      // Group allocation: Call Supabase RPC assign_induction_group() or fallback to local balancing
      let assignedFromDb = false;

      if (liveDbAvailable) {
        try {
          const { data: rpcGroup, error: rpcError } = await client.rpc('assign_induction_group');
          if (!rpcError && rpcGroup && ['racional', 'emocional', 'control'].includes(rpcGroup)) {
            inductionGroup = rpcGroup as InductionGroup;
            assignedFromDb = true;
          } else {
            console.warn('[Session Route] RPC assign_induction_group error or unexpected return:', rpcError, rpcGroup);
          }
        } catch (rpcErr) {
          console.warn('[Session Route] RPC call threw exception:', rpcErr);
        }
      }

      // Fallback balancing via in-memory mock store if live RPC was not used
      if (!assignedFromDb) {
        inductionGroup = mockStore.assignGroup(true);
      }
    }

    // 4. Session ID: Client-supplied UUID or generate new UUID v4
    const participantId = id && isValidUuid(id) ? id : crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const participantData: ParticipantInsert = {
      id: participantId,
      created_at: nowIso,
      completed_at: null,
      age,
      gender,
      studies_psychology: studiesPsychology,
      therapeutic_orientation: therapeuticOrientation,
      university: university.trim().slice(0, 200),
      is_included: isIncluded,
      exclusion_reason: exclusionReason,
      induction_group: inductionGroup,
      fake_news_set: fakeNewsSet,
      status: 'started' as const,
      device_type: deviceType || null,
      screen_resolution: screenResolution ? screenResolution.slice(0, 50) : null,
      user_agent: userAgent ? userAgent.slice(0, 500) : null,
      client_timestamp: clientTimestamp || nowIso,
    };

    // 5. Database Insertion
    let persistedToDb = false;

    if (liveDbAvailable) {
      try {
        const { error: insertError } = await client
          .from('participants')
          .insert(participantData);

        if (!insertError) {
          persistedToDb = true;
        } else {
          console.error('[Session Route] Supabase participant insert error:', insertError);
          mockStore.createParticipant(participantData);
        }
      } catch (insertErr) {
        console.error('[Session Route] Supabase insert threw exception:', insertErr);
        mockStore.createParticipant(participantData);
      }
    } else {
      mockStore.createParticipant(participantData);
    }

    // 6. Return Structured ParticipantSession
    const sessionResponse: ParticipantSession = {
      id: participantId,
      createdAt: nowIso,
      completedAt: null,
      age,
      gender,
      studiesPsychology,
      therapeuticOrientation,
      university: university.trim(),
      isIncluded,
      exclusionReason,
      inductionGroup,
      fakeNewsSet,
      status: 'started',
      deviceType,
      screenResolution,
      userAgent,
    };

    return jsonResponse(
      {
        success: true,
        session: sessionResponse,
        mode: persistedToDb ? 'live' : 'mock',
      },
      201
    );
  } catch (err: unknown) {
    console.error('[Session Route] Unhandled exception in POST:', err);
    return jsonResponse(
      {
        success: false,
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
}

// ============================================================================
// PATCH: Update Participant Session (Status / Completion)
// ============================================================================

export interface SessionUpdateBody {
  participantId: string;
  status?: SessionStatus;
  completedAt?: string;
  clientTimestamp?: string;
}

export async function PATCH(req: NextRequest) {
  try {
    let body: SessionUpdateBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { success: false, error: 'Malformed JSON payload' },
        400
      );
    }

    const { participantId, status, completedAt, clientTimestamp } = body;

    if (!participantId || !isValidUuid(participantId)) {
      return jsonResponse(
        { success: false, error: 'A valid participantId (UUID) is required.' },
        400
      );
    }

    if (
      status &&
      !['started', 'reading', 'completed', 'abandoned'].includes(status)
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid status value. Allowed: 'started', 'reading', 'completed', 'abandoned'.",
        },
        400
      );
    }

    const nowIso = new Date().toISOString();
    const updatePayload: ParticipantUpdate = {};

    if (status) {
      updatePayload.status = status;
    }

    if (status === 'completed' || completedAt) {
      updatePayload.completed_at = completedAt || nowIso;
    }

    if (clientTimestamp) {
      updatePayload.client_timestamp = clientTimestamp;
    }

    const client = getSupabaseAdminClient();
    const liveDbAvailable = isSupabaseConfigured() && client !== null;
    let updatedInDb = false;

    if (liveDbAvailable) {
      try {
        const { error: updateError } = await client
          .from('participants')
          .update(updatePayload)
          .eq('id', participantId);

        if (!updateError) {
          updatedInDb = true;
        } else {
          console.warn('[Session Route] Supabase participant update error:', updateError);
          mockStore.updateParticipant(participantId, updatePayload);
        }
      } catch (updateErr) {
        console.warn('[Session Route] Supabase update threw exception:', updateErr);
        mockStore.updateParticipant(participantId, updatePayload);
      }
    } else {
      mockStore.updateParticipant(participantId, updatePayload);
    }

    return jsonResponse({
      success: true,
      participantId,
      status: updatePayload.status || 'completed',
      completedAt: updatePayload.completed_at || null,
      mode: updatedInDb ? 'live' : 'mock',
    });
  } catch (err: unknown) {
    console.error('[Session Route] Unhandled exception in PATCH:', err);
    return jsonResponse(
      {
        success: false,
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
}
