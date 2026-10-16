/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Admin Session Authentication (signed cookie)
 * Target: src/lib/adminAuth.ts
 *
 * The admin cookie carries `<expiresAtMs>.<signature>`, where the signature is an
 * HMAC-SHA256 of the expiry keyed with ADMIN_PASSWORD. It cannot be forged without
 * the password, it expires on its own, and changing the password revokes every
 * session already issued.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day

function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  return password && password.length > 0 ? password : null;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/** Constant-time string comparison that also hides length differences. */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/** Checks a login attempt. Always false when ADMIN_PASSWORD is not configured. */
export function isAdminPasswordValid(candidate: unknown): boolean {
  const password = getAdminPassword();
  if (!password || typeof candidate !== 'string') return false;
  return safeEqual(candidate, password);
}

/** Issues a signed session token, or null when ADMIN_PASSWORD is not configured. */
export function createAdminSessionToken(nowMs: number = Date.now()): string | null {
  const password = getAdminPassword();
  if (!password) return null;
  const expiresAt = String(nowMs + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${sign(expiresAt, password)}`;
}

export function isValidAdminSessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now()
): boolean {
  const password = getAdminPassword();
  if (!password || !token) return false;

  const [expiresAt, signature, ...rest] = token.split('.');
  if (rest.length > 0 || !expiresAt || !signature || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= nowMs) return false;

  return safeEqual(signature, sign(expiresAt, password));
}

/** True when the current request carries a valid admin session cookie. */
export function isAdminRequest(): boolean {
  return isValidAdminSessionToken(cookies().get(ADMIN_SESSION_COOKIE)?.value);
}
