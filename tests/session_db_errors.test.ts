/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * /api/session must answer 500 (not a mock success) when the database write fails,
 * so the client keeps the registration or completion queued and retries it.
 * Target: tests/session_db_errors.test.ts
 *
 * Supabase is pointed at an unreachable local port before the route is imported,
 * so every database call fails the way a real outage would.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unreachable-anon-key-for-tests';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unreachable-service-key-for-tests';

const { NextRequest } = await import('next/server');
const { POST, PATCH } = await import('../src/app/api/session/route.ts');

const demographics = {
  participantId: crypto.randomUUID(),
  age: 24,
  gender: 'Femenino',
  studiesPsychology: true,
  therapeuticOrientation: 'Psicoanálisis',
  university: 'Universidad Favaloro',
  residence: 'Ciudad Autónoma de Buenos Aires',
  hasMemoryCondition: false,
  hasVisualDifficulty: false,
};

describe('/api/session with the database down', () => {
  test('registration answers 500 so the client replays it', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify(demographics),
      })
    );
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('a replay with the fallback group also answers 500', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({ ...demographics, inductionGroup: 'emocional' }),
      })
    );
    assert.equal(res.status, 500);
  });

  test('completion answers 500 so the client keeps it pending', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/session', {
        method: 'PATCH',
        body: JSON.stringify({
          participantId: demographics.participantId,
          status: 'completed',
          mcReportedInduction: 'Emoción',
          mcEmotionUsage: 4,
          mcReasonUsage: 2,
        }),
      })
    );
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.success, false);
  });
});
