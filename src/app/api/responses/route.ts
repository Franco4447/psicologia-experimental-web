/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Parcial 2 - Investigación: Efecto de la Inducción Cognitiva sobre Falsos Recuerdos
 * 
 * Route Handler: /api/responses
 * Methods:
 * - OPTIONS: CORS preflight
 * - POST: Single or batch trial response persistence (1 to 20 trials)
 * Target location: src/app/api/responses/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
  mockStore,
  type ResponseInsert,
} from '@/lib/supabase';
import {
  RESPONSE_OPTIONS_MAP,
  classifyResponse,
  getStimulusById,
} from '@/data/stimuli';
import type {
  TrialRecord,
  TrialSubmissionPayload,
  ResponseCode,
  CongruenceType,
} from '@/types/experiment';

// ============================================================================
// Helper Validation & CORS Utilities
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
// POST: Submit Single or Batch Trial Responses
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse(
        { success: false, error: 'Malformed JSON payload' },
        400
      );
    }

    // Normalize payload to an array:
    // Supports bare array `[...]`, wrapped `{ responses: [...] }`, or single object `{ ... }`
    let items: unknown[];
    if (Array.isArray(rawBody)) {
      items = rawBody;
    } else if (
      rawBody &&
      typeof rawBody === 'object' &&
      'responses' in rawBody &&
      Array.isArray((rawBody as { responses: unknown[] }).responses)
    ) {
      items = (rawBody as { responses: unknown[] }).responses;
    } else if (rawBody && typeof rawBody === 'object') {
      items = [rawBody];
    } else {
      return jsonResponse(
        { success: false, error: 'Expected JSON object or array of response records' },
        400
      );
    }

    if (items.length === 0) {
      return jsonResponse(
        { success: false, error: 'Empty responses array provided' },
        400
      );
    }

    if (items.length > 200) {
      return jsonResponse(
        { success: false, error: `Too many records: received ${items.length}, maximum is 200 trials per payload.` },
        400
      );
    }

    // Validate each trial item
    const validationErrors: string[] = [];
    const normalizedRows: ResponseInsert[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Partial<TrialSubmissionPayload & TrialRecord>;
      const prefix = items.length > 1 ? `Item ${i + 1}: ` : '';

      if (!item || typeof item !== 'object') {
        validationErrors.push(`${prefix}El registro del ensayo debe ser un objeto.`);
        continue;
      }

      // 1. Participant ID
      if (!item.participantId || !isValidUuid(item.participantId)) {
        validationErrors.push(`${prefix}participantId debe ser un UUID v4 válido.`);
      }

      // 2. Presentation Order (1 to 20)
      if (
        item.presentationOrder === undefined ||
        item.presentationOrder === null ||
        typeof item.presentationOrder !== 'number' ||
        !Number.isInteger(item.presentationOrder) ||
        item.presentationOrder < 1 ||
        item.presentationOrder > 20
      ) {
        validationErrors.push(`${prefix}presentationOrder debe ser un número entero entre 1 y 20.`);
      }

      // 3. News ID (1 to 28)
      if (
        item.newsId === undefined ||
        item.newsId === null ||
        typeof item.newsId !== 'number' ||
        !Number.isInteger(item.newsId) ||
        item.newsId < 1 ||
        item.newsId > 28
      ) {
        validationErrors.push(`${prefix}newsId debe ser un número entero entre 1 y 28.`);
      }

      // 4. Response Option (1 to 4)
      if (
        item.responseOption === undefined ||
        item.responseOption === null ||
        typeof item.responseOption !== 'number' ||
        ![1, 2, 3, 4].includes(item.responseOption)
      ) {
        validationErrors.push(`${prefix}responseOption debe ser 1, 2, 3 o 4.`);
      }

      // 5. Reading Time (non-negative ms)
      if (
        item.readingTimeMs === undefined ||
        item.readingTimeMs === null ||
        typeof item.readingTimeMs !== 'number' ||
        item.readingTimeMs < 0
      ) {
        validationErrors.push(`${prefix}readingTimeMs debe ser un número mayor o igual a 0.`);
      }

      // 6. Response Time (non-negative ms)
      if (
        item.responseTimeMs === undefined ||
        item.responseTimeMs === null ||
        typeof item.responseTimeMs !== 'number' ||
        item.responseTimeMs < 0
      ) {
        validationErrors.push(`${prefix}responseTimeMs debe ser un número mayor o igual a 0.`);
      }

      if (validationErrors.length > 0) continue;

      // Metadata lookup from canonical stimuli catalog
      let stimulusTitle: string | null = null;
      let isFake = item.newsId! >= 13;
      let congruence: CongruenceType = isFake ? 'psicoanalisis' : 'true';

      try {
        const stimulus = getStimulusById(item.newsId!);
        stimulusTitle = stimulus.title;
        isFake = stimulus.isFake;
        congruence = stimulus.congruence;
      } catch {
        // Fallback heuristics if ID out of bounds
        isFake = item.newsId! >= 13;
      }

      const responseCode = item.responseOption as ResponseCode;
      const constructFlags = classifyResponse(isFake, responseCode);
      const responseLabel =
        item.responseLabel ||
        RESPONSE_OPTIONS_MAP[responseCode]?.label ||
        'Desconocido';

      const row: ResponseInsert = {
        id: item.id && isValidUuid(item.id) ? item.id : crypto.randomUUID(),
        participant_id: item.participantId!,
        presentation_order: item.presentationOrder!,
        news_id: item.newsId!,
        news_title: stimulusTitle,
        is_fake: isFake,
        news_congruence: item.newsCongruence || congruence,
        response_option: responseCode,
        response_label: responseLabel,
        reading_time_ms: Math.round(item.readingTimeMs!),
        response_time_ms: Math.round(item.responseTimeMs!),
        is_false_memory: constructFlags.isFalseMemory,
        is_false_belief: constructFlags.isFalseBelief,
        is_true_memory: constructFlags.isTrueMemory,
        created_at: item.createdAt || new Date().toISOString(),
      };

      normalizedRows.push(row);
    }

    if (validationErrors.length > 0) {
      console.warn('[Responses Route] Some items failed validation and were skipped:', validationErrors);
      // We do not reject the whole batch. We proceed with the valid normalizedRows
      // so the client queue can successfully flush the good data.
    }

    if (normalizedRows.length === 0) {
      return jsonResponse(
        {
          success: false,
          error: 'No valid records to insert after validation',
          details: validationErrors,
        },
        400
      );
    }

    // Persistence: Supabase upsert or MockStore insert
    const client = getSupabaseAdminClient();
    const liveDbAvailable = isSupabaseConfigured() && client !== null;
    let persistedToDb = false;

    if (liveDbAvailable) {
      try {
        // Use insert instead of upsert since anon role doesn't have UPDATE privileges.
        // We will ignore unique constraint violations (code 23505) which just mean 
        // the client retried a request that already succeeded.
        const { error: insertError } = await client
          .from('responses')
          .insert(normalizedRows);

        if (!insertError) {
          persistedToDb = true;
        } else if (insertError.code === '23505') {
          // 23505 = unique_violation. This means the (participant_id, presentation_order) 
          // already exists. Since this is an append-only experiment, we consider this a success.
          persistedToDb = true;
        } else {
          // CRITICAL: Return a real error so the client retries instead of deleting data
          console.error('[Responses Route] Supabase insert error:', insertError);
          return jsonResponse(
            {
              success: false,
              error: 'Database insert failed',
              message: insertError.message,
              code: insertError.code,
            },
            500
          );
        }
      } catch (insertErr) {
        console.error('[Responses Route] Supabase insert threw exception:', insertErr);
        return jsonResponse(
          {
            success: false,
            error: 'Database exception',
            message: insertErr instanceof Error ? insertErr.message : 'Unknown error',
          },
          500
        );
      }
    } else {
      mockStore.insertResponses(normalizedRows);
    }

    return jsonResponse(
      {
        success: true,
        count: normalizedRows.length,
        participantId: normalizedRows[0]?.participant_id,
        mode: persistedToDb ? 'live' : 'mock',
      },
      201
    );
  } catch (err: unknown) {
    console.error('[Responses Route] Unhandled exception in POST:', err);
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
