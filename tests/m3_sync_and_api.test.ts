/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Parcial 2 - Investigación: Efecto de la Inducción Cognitiva sobre Falsos Recuerdos
 * 
 * Milestone 3 Test Suite: Supabase Integration, API Handlers & Client Sync
 * Target: tests/m3_sync_and_api.test.ts
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import {
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
  getSupabaseClient,
  mockStore,
  InMemoryMockStore,
} from '../src/lib/supabase.ts';

import {
  POST as sessionPost,
  PATCH as sessionPatch,
  OPTIONS as sessionOptions,
} from '../src/app/api/session/route.ts';

import {
  POST as responsesPost,
  OPTIONS as responsesOptions,
} from '../src/app/api/responses/route.ts';

import {
  registerSession,
  syncTrialResponse,
  completeSession,
  flushPendingSync,
  getPendingSyncCount,
  clearSyncStorage,
} from '../src/lib/sync.ts';

import type {
  ParticipantDemographicsInput,
  TrialRecord,
  InductionGroup,
} from '../src/types/experiment.ts';
import type { ClientTelemetry } from '../src/lib/telemetry.ts';

describe('Milestone 3: Database, Balanced RPC, API Routes & Client Sync', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockStore.reset();
    clearSyncStorage();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockStore.reset();
    clearSyncStorage();
  });

  // ==========================================================================
  // Section 1: Supabase Configuration & In-Memory Balanced Allocation
  // ==========================================================================
  describe('1. Supabase Environment & Mock Store Balancing', () => {
    test('1.1: Placeholder credentials correctly detect unconfigured Supabase', () => {
      // In local dev without live keys, should return false gracefully
      const isConfigured = isSupabaseConfigured();
      assert.equal(typeof isConfigured, 'boolean');
      const isAdminConfigured = isSupabaseAdminConfigured();
      assert.equal(typeof isAdminConfigured, 'boolean');
      if (!isConfigured) {
        assert.equal(getSupabaseClient(), null);
      }
    });

    test('1.2: MockStore maintains serial group balance delta <= 1 over 300 sequential participants', () => {
      const store = new InMemoryMockStore();
      const counts: Record<InductionGroup, number> = { racional: 0, emocional: 0, control: 0 };

      for (let i = 1; i <= 300; i++) {
        const assigned = store.assignGroup(true);
        counts[assigned]++;
        const minVal = Math.min(counts.racional, counts.emocional, counts.control);
        const maxVal = Math.max(counts.racional, counts.emocional, counts.control);
        const delta = maxVal - minVal;
        assert.ok(
          delta <= 1,
          `Balance invariant violated at iteration ${i}! Counts: ${JSON.stringify(counts)}, delta=${delta}`
        );
      }

      assert.equal(counts.racional, 100);
      assert.equal(counts.emocional, 100);
      assert.equal(counts.control, 100);
    });

    test('1.3: Excluded participants do not skew included group quotas', () => {
      const store = new InMemoryMockStore();
      // Add 15 excluded participants
      for (let i = 0; i < 15; i++) {
        const group = store.assignGroup(false);
        assert.equal(group, 'control');
      }

      // Quotas for included should still be 0-0-0
      const stats = store.getStats();
      assert.equal(stats.counts.racional, 0);
      assert.equal(stats.counts.emocional, 0);
      assert.equal(stats.counts.control, 0);
      assert.equal(stats.excluded, 0); // No participant rows yet, just assignGroup calls
    });

    test('1.4: MockStore supports participant creation, retrieval, and status updates', () => {
      const store = new InMemoryMockStore();
      const created = store.createParticipant({
        age: 21,
        gender: 'Femenino',
        studies_psychology: true,
        therapeutic_orientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
        is_included: true,
        induction_group: 'racional',
        fake_news_set: 'psicoanalisis',
        status: 'started',
      });

      assert.ok(created.id);
      assert.equal(created.age, 21);
      assert.equal(store.getParticipant(created.id)?.id, created.id);

      const updated = store.updateParticipant(created.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      assert.ok(updated);
      assert.equal(updated.status, 'completed');
      assert.ok(updated.completed_at);
    });
  });

  // ==========================================================================
  // Section 2: API Route /api/session
  // ==========================================================================
  describe('2. API Route: /api/session', () => {
    test('2.1: OPTIONS returns CORS preflight with HTTP 204', async () => {
      const res = await sessionOptions();
      assert.equal(res.status, 204);
      assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    });

    test('2.2: POST rejects invalid demographics with HTTP 400', async () => {
      // Underage (< 18)
      const reqUnderage = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          age: 17,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        }),
      });
      const resUnderage = await sessionPost(reqUnderage);
      assert.equal(resUnderage.status, 400);
      const dataUnderage = await resUnderage.json();
      assert.ok(dataUnderage.details.some((e: string) => e.includes('18 años')));

      // Extreme age (> 120)
      const reqExtreme = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          age: 125,
          gender: 'Masculino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        }),
      });
      const resExtreme = await sessionPost(reqExtreme);
      assert.equal(resExtreme.status, 400);

      // Invalid orientation
      const reqBadOrientation = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          age: 22,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Invalida',
          university: 'Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        }),
      });
      const resBadOrientation = await sessionPost(reqBadOrientation);
      assert.equal(resBadOrientation.status, 400);

      // Empty university
      const reqNoUni = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          age: 22,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: '   ',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        }),
      });
      const resNoUni = await sessionPost(reqNoUni);
      assert.equal(resNoUni.status, 400);
    });

    test('2.3: POST successfully initializes session for included Psychoanalysis participant', async () => {
      const req = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          age: 22,
          gender: 'Femenino',
          studiesPsychology: true,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'Universidad Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        }),
      });
      const res = await sessionPost(req);
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.session.isIncluded, true);
      assert.equal(data.session.fakeNewsSet, 'psicoanalisis');
      assert.ok(['racional', 'emocional', 'control'].includes(data.session.inductionGroup));
      assert.equal(data.session.status, 'started');
    });

    test('2.4: POST correctly routes and marks excluded participant (non-psychology student)', async () => {
      const req = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          age: 25,
          gender: 'Masculino',
          studiesPsychology: false,
          therapeuticOrientation: 'Psicoanálisis',
          university: 'UBA',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        }),
      });
      const res = await sessionPost(req);
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.session.isIncluded, false);
      assert.equal(data.session.exclusionReason, 'no_estudia_psicologia');
      assert.equal(data.session.inductionGroup, 'control');
      assert.equal(data.session.fakeNewsSet, 'control_random');
    });

    test('2.5: POST correctly routes and marks excluded participant ("Otros" orientation)', async () => {
      const req = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          age: 23,
          gender: 'Otro',
          studiesPsychology: true,
          therapeuticOrientation: 'Otros',
          university: 'Favaloro',
          hasMemoryCondition: false,
          hasVisualDifficulty: false,
        }),
      });
      const res = await sessionPost(req);
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.session.isIncluded, false);
      assert.equal(data.session.exclusionReason, 'orientacion_otros');
      assert.equal(data.session.inductionGroup, 'control');
      assert.equal(data.session.fakeNewsSet, 'control_random');
    });

    test('2.6: PATCH updates participant session status and sets completed_at', async () => {
      const pId = crypto.randomUUID();
      mockStore.createParticipant({
        id: pId,
        age: 22,
        gender: 'Femenino',
        studies_psychology: true,
        therapeutic_orientation: 'Psicoanálisis',
        university: 'Favaloro',
        is_included: true,
        induction_group: 'racional',
        fake_news_set: 'psicoanalisis',
        status: 'started',
      });

      const patchReq = new NextRequest('http://localhost:3000/api/session', {
        method: 'PATCH',
        body: JSON.stringify({
          participantId: pId,
          status: 'completed',
        }),
      });

      const patchRes = await sessionPatch(patchReq);
      assert.equal(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.equal(patchData.success, true);
      assert.equal(patchData.status, 'completed');
      assert.ok(patchData.completedAt);
    });

    test('2.7: PATCH rejects invalid participantId with HTTP 400', async () => {
      const patchReq = new NextRequest('http://localhost:3000/api/session', {
        method: 'PATCH',
        body: JSON.stringify({
          participantId: 'not-a-valid-uuid',
          status: 'completed',
        }),
      });

      const patchRes = await sessionPatch(patchReq);
      assert.equal(patchRes.status, 400);
    });
  });

  // ==========================================================================
  // Section 3: API Route /api/responses
  // ==========================================================================
  describe('3. API Route: /api/responses', () => {
    test('3.1: OPTIONS returns CORS preflight with HTTP 204', async () => {
      const res = await responsesOptions();
      assert.equal(res.status, 204);
      assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    });

    test('3.2: POST rejects invalid response payloads with HTTP 400', async () => {
      // Empty array
      const reqEmpty = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify([]),
      });
      assert.equal((await responsesPost(reqEmpty)).status, 400);

      // Over 20 items
      const oversized = Array.from({ length: 201 }, (_, i) => ({
        participantId: crypto.randomUUID(),
        presentationOrder: (i % 20) + 1,
        newsId: 1,
        responseOption: 1,
        readingTimeMs: 10000,
        responseTimeMs: 2000,
      }));
      const reqOversized = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify(oversized),
      });
      assert.equal((await responsesPost(reqOversized)).status, 400);

      // Invalid option (5)
      const reqBadOption = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify({
          participantId: crypto.randomUUID(),
          presentationOrder: 1,
          newsId: 1,
          responseOption: 5,
          readingTimeMs: 10000,
          responseTimeMs: 2000,
        }),
      });
      assert.equal((await responsesPost(reqBadOption)).status, 400);

      // Negative response time
      const reqNegTime = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify({
          participantId: crypto.randomUUID(),
          presentationOrder: 1,
          newsId: 1,
          responseOption: 2,
          readingTimeMs: 10000,
          responseTimeMs: -50,
        }),
      });
      assert.equal((await responsesPost(reqNegTime)).status, 400);
    });

    test('3.3: POST successfully accepts single response and computes psychological constructs', async () => {
      const participantId = crypto.randomUUID();

      // Submit fake news (newsId = 14) with responseOption = 1 -> should compute is_false_memory = true
      const req = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify({
          participantId,
          presentationOrder: 1,
          newsId: 14,
          responseOption: 1,
          readingTimeMs: 10000,
          responseTimeMs: 2350,
        }),
      });

      const res = await responsesPost(req);
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.count, 1);

      const storedResponses = mockStore.getResponses(participantId);
      assert.equal(storedResponses.length, 1);
      const r = storedResponses[0];
      assert.equal(r.is_fake, true);
      assert.equal(r.is_false_memory, true);
      assert.equal(r.is_false_belief, false);
      assert.equal(r.is_true_memory, false);
      assert.equal(r.response_label, 'Recuerdo claramente haber visto/leído este evento');
    });

    test('3.4: POST computes is_false_belief = true for fake news with response option 2', async () => {
      const participantId = crypto.randomUUID();

      const req = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify({
          participantId,
          presentationOrder: 2,
          newsId: 16, // Fake news
          responseOption: 2,
          readingTimeMs: 10000,
          responseTimeMs: 3100,
        }),
      });

      const res = await responsesPost(req);
      assert.equal(res.status, 201);

      const stored = mockStore.getResponses(participantId)[0];
      assert.equal(stored.is_fake, true);
      assert.equal(stored.is_false_memory, false);
      assert.equal(stored.is_false_belief, true);
      assert.equal(stored.is_true_memory, false);
    });

    test('3.5: POST computes is_true_memory = true for real news with response option 1', async () => {
      const participantId = crypto.randomUUID();

      const req = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify({
          participantId,
          presentationOrder: 3,
          newsId: 2, // Real news
          responseOption: 1,
          readingTimeMs: 10000,
          responseTimeMs: 1900,
        }),
      });

      const res = await responsesPost(req);
      assert.equal(res.status, 201);

      const stored = mockStore.getResponses(participantId)[0];
      assert.equal(stored.is_fake, false);
      assert.equal(stored.is_false_memory, false);
      assert.equal(stored.is_false_belief, false);
      assert.equal(stored.is_true_memory, true);
    });

    test('3.6: POST handles batch submission of 20 trials with idempotent upsert', async () => {
      const participantId = crypto.randomUUID();
      const batch = Array.from({ length: 20 }, (_, i) => ({
        participantId,
        presentationOrder: i + 1,
        newsId: (i % 28) + 1,
        responseOption: ((i % 4) + 1) as 1 | 2 | 3 | 4,
        readingTimeMs: 10000,
        responseTimeMs: 1500 + i * 50,
      }));

      const req1 = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify({ responses: batch }),
      });

      const res1 = await responsesPost(req1);
      assert.equal(res1.status, 201);
      assert.equal(mockStore.getResponses(participantId).length, 20);

      // Re-posting batch with updated RT should upsert rather than duplicate
      batch[0].responseTimeMs = 9999;
      const req2 = new NextRequest('http://localhost:3000/api/responses', {
        method: 'POST',
        body: JSON.stringify({ responses: batch }),
      });

      const res2 = await responsesPost(req2);
      assert.equal(res2.status, 201);
      const responsesAfter = mockStore.getResponses(participantId);
      assert.equal(responsesAfter.length, 20); // Still exactly 20
      assert.equal(responsesAfter[0].response_time_ms, 9999); // Updated
    });
  });

  // ==========================================================================
  // Section 4: Client Synchronization & Offline Resiliency (sync.ts)
  // ==========================================================================
  describe('4. Client Synchronization & Offline Resiliency', () => {
    test('4.1: registerSession receives assigned group from server when online', async () => {
      globalThis.fetch = async (url: RequestInfo | URL) => {
        if (String(url).includes('/api/session')) {
          return new Response(
            JSON.stringify({
              success: true,
              session: {
                id: 'part-uuid-online',
                inductionGroup: 'emocional',
                fakeNewsSet: 'psicoanalisis',
                isIncluded: true,
                exclusionReason: null,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      };

      const demographics: ParticipantDemographicsInput = {
        age: 21,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };
      const telemetry: ClientTelemetry = {
        deviceType: 'desktop',
        screenResolution: '1920x1080',
        userAgent: 'MockAgent',
      };

      const result = await registerSession(demographics, telemetry, {
        participantId: 'part-uuid-online',
        timeoutMs: 1000,
      });

      assert.equal(result.success, true);
      assert.equal(result.participantId, 'part-uuid-online');
      assert.equal(result.inductionGroup, 'emocional');
      assert.equal(result.fakeNewsSet, 'psicoanalisis');
      assert.equal(result.isOffline, false);
    });

    test('4.2: registerSession falls back to local balanced allocation on network timeout', async () => {
      globalThis.fetch = async () => {
        throw new Error('Connection timeout');
      };

      const demographics: ParticipantDemographicsInput = {
        age: 23,
        gender: 'Masculino',
        studiesPsychology: true,
        therapeuticOrientation: 'Basada en Evidencia Científica',
        university: 'Favaloro',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      };
      const telemetry: ClientTelemetry = {
        deviceType: 'desktop',
        screenResolution: '1920x1080',
        userAgent: 'MockAgent',
      };

      const result = await registerSession(demographics, telemetry, {
        participantId: 'part-uuid-offline',
        timeoutMs: 100,
      });

      assert.equal(result.success, true);
      assert.equal(result.participantId, 'part-uuid-offline');
      assert.ok(['racional', 'emocional', 'control'].includes(result.inductionGroup));
      assert.equal(result.fakeNewsSet, 'evidencia');
      assert.equal(result.isOffline, true);
    });

    test('4.3: syncTrialResponse executes synchronously in < 10ms with zero UI blocking', () => {
      const trial: TrialRecord = {
        id: crypto.randomUUID(),
        participantId: 'part-uuid-timing',
        presentationOrder: 1,
        newsId: 10,
        isFake: false,
        newsCongruence: 'true',
        responseOption: 1,
        responseLabel: 'Recuerdo claramente haber visto/leído este evento',
        readingTimeMs: 10000,
        responseTimeMs: 1420,
        isFalseMemory: false,
        isFalseBelief: false,
        isTrueMemory: true,
        createdAt: new Date().toISOString(),
      };

      const t0 = performance.now();
      syncTrialResponse(trial);
      const latency = performance.now() - t0;

      assert.ok(latency < 10, `syncTrialResponse took ${latency}ms, expected < 10ms`);
      assert.equal(getPendingSyncCount(), 1);
    });

    test('4.4: syncTrialResponse deduplicates identical presentationOrder', () => {
      const trial: TrialRecord = {
        id: crypto.randomUUID(),
        participantId: 'part-uuid-dedup',
        presentationOrder: 1,
        newsId: 10,
        isFake: false,
        newsCongruence: 'true',
        responseOption: 1,
        responseLabel: 'Recuerdo claramente',
        readingTimeMs: 10000,
        responseTimeMs: 1420,
        isFalseMemory: false,
        isFalseBelief: false,
        isTrueMemory: true,
      };

      syncTrialResponse(trial);
      syncTrialResponse({ ...trial, responseTimeMs: 2500 });

      assert.equal(getPendingSyncCount(), 1);
    });

    test('4.5: flushPendingSync drains queue in batch to /api/responses', async () => {
      let postedBatch: any = null;
      globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/responses')) {
          postedBatch = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ success: true, count: 3 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      // Queue 3 responses
      for (let i = 1; i <= 3; i++) {
        syncTrialResponse({
          id: `trial-${i}`,
          participantId: 'part-flush',
          presentationOrder: i,
          newsId: i,
          isFake: i === 3,
          newsCongruence: i === 3 ? 'psicoanalisis' : 'true',
          responseOption: 1,
          responseLabel: 'Recuerdo claramente',
          readingTimeMs: 10000,
          responseTimeMs: 2000,
          isFalseMemory: i === 3,
          isFalseBelief: false,
          isTrueMemory: i !== 3,
        });
      }

      assert.equal(getPendingSyncCount(), 3);

      const flushResult = await flushPendingSync('part-flush', { timeoutMs: 2000 });
      assert.equal(flushResult.success, true);
      assert.equal(flushResult.pendingCount, 0);
      assert.ok(postedBatch?.responses);
      assert.equal(postedBatch.responses.length, 3);
    });
  });
});
