/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Admin session signing (forged cookies rejected) and F5 recovery of the
 * manipulation check answers.
 * Target: tests/admin_auth_and_recovery.test.ts
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  isAdminPasswordValid,
  isValidAdminSessionToken,
} from '../src/lib/adminAuth.ts';
import { POST as adminLoginPost } from '../src/app/api/admin/login/route.ts';
import {
  getHydratePayloadFromStorage,
  STORAGE_VERSION,
  type StoredSessionPayload,
} from '../src/lib/sessionRecovery.ts';
import { experimentReducer, getInitialExperimentState } from '../src/lib/experimentState.ts';
import { getParticipantNewsDeck } from '../src/data/stimuli.ts';

const PASSWORD = 'clave-de-prueba-admin';

describe('Admin session cookie', () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = PASSWORD;
  });

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
  });

  test('a token issued after login is valid until it expires', () => {
    const now = 1_800_000_000_000;
    const token = createAdminSessionToken(now);
    assert.ok(token);
    assert.equal(isValidAdminSessionToken(token, now), true);
    assert.equal(isValidAdminSessionToken(token, now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000 - 1), true);
    assert.equal(isValidAdminSessionToken(token, now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000), false);
  });

  test('the old fixed value and tampered tokens are rejected', () => {
    const now = 1_800_000_000_000;
    const token = createAdminSessionToken(now)!;
    const [expiresAt, signature] = token.split('.');

    assert.equal(isValidAdminSessionToken('authenticated', now), false);
    assert.equal(isValidAdminSessionToken(undefined, now), false);
    assert.equal(isValidAdminSessionToken('', now), false);
    // Extending the expiry invalidates the signature
    assert.equal(isValidAdminSessionToken(`${Number(expiresAt) + 1}.${signature}`, now), false);
    assert.equal(isValidAdminSessionToken(`${expiresAt}.${signature}x`, now), false);
    assert.equal(isValidAdminSessionToken(`${token}.extra`, now), false);
  });

  test('changing the password revokes issued sessions', () => {
    const now = 1_800_000_000_000;
    const token = createAdminSessionToken(now);
    process.env.ADMIN_PASSWORD = 'otra-clave';
    assert.equal(isValidAdminSessionToken(token, now), false);
  });

  test('without ADMIN_PASSWORD nobody can log in or hold a session', () => {
    const now = 1_800_000_000_000;
    const token = createAdminSessionToken(now);
    delete process.env.ADMIN_PASSWORD;
    assert.equal(isAdminPasswordValid(undefined), false);
    assert.equal(isAdminPasswordValid(''), false);
    assert.equal(createAdminSessionToken(now), null);
    assert.equal(isValidAdminSessionToken(token, now), false);
  });

  test('login sets a signed cookie only for the right password', async () => {
    const ok = await adminLoginPost(
      new Request('http://localhost:3000/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: PASSWORD }),
      })
    );
    assert.equal(ok.status, 200);
    const setCookie = ok.headers.get('set-cookie') || '';
    const value = setCookie.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`))?.[1];
    assert.ok(value && value !== 'authenticated');
    assert.equal(isValidAdminSessionToken(decodeURIComponent(value)), true);
    assert.match(setCookie, /HttpOnly/i);

    for (const body of [{ password: 'incorrecta' }, {}, { password: null }]) {
      const res = await adminLoginPost(
        new Request('http://localhost:3000/api/admin/login', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('set-cookie'), null);
    }
  });
});

describe('F5 recovery on the debriefing screen', () => {
  test('a reload keeps the manipulation check answers', () => {
    const stored: StoredSessionPayload = {
      version: STORAGE_VERSION,
      stage: 'debriefing',
      participantId: '6f1c2b0e-3a4d-4c5e-8f9a-0b1c2d3e4f5a',
      createdAt: '2026-10-16T20:00:00.000Z',
      completedAt: null,
      demographics: {
        age: 25,
        gender: 'Femenino',
        studiesPsychology: true,
        therapeuticOrientation: 'Psicoanálisis',
        university: 'Universidad Favaloro',
        residence: 'Ciudad Autónoma de Buenos Aires',
        hasMemoryCondition: false,
        hasVisualDifficulty: false,
      },
      isIncluded: true,
      exclusionReason: null,
      inductionGroup: 'emocional',
      fakeNewsSet: 'psicoanalisis',
      deck: getParticipantNewsDeck('Psicoanálisis', true, 7),
      currentTrialIndex: 19,
      currentReadingTimeMs: 15000,
      responses: [],
      telemetry: { deviceType: 'mobile', screenResolution: '390x844', userAgent: 'MockAgent' },
      mcReportedInduction: 'Emoción',
      mcEmotionUsage: 4,
      mcReasonUsage: 2,
      savedAt: '2026-10-16T20:09:00.000Z',
    };

    const state = experimentReducer(getInitialExperimentState(), {
      type: 'HYDRATE_STORAGE',
      payload: getHydratePayloadFromStorage(stored),
    });

    assert.equal(state.stage, 'debriefing');
    assert.equal(state.mcReportedInduction, 'Emoción');
    assert.equal(state.mcEmotionUsage, 4);
    assert.equal(state.mcReasonUsage, 2);
  });
});
