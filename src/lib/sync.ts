/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Asynchronous Client-Side Synchronization, Offline Buffering & Resiliency Manager
 * Target: src/lib/sync.ts
 */

import type {
  InductionGroup,
  FakeNewsSet,
  ExclusionReason,
  ParticipantDemographicsInput,
  TrialRecord,
  Gender,
  DeviceType,
} from '@/types/experiment';
import { evaluateInclusion } from '@/data/stimuli';
import { getBalancedLocalGroup, generateParticipantId } from '@/lib/experimentState';
import type { ClientTelemetry } from '@/lib/telemetry';

// ============================================================================
// Storage Keys & Constants
// ============================================================================

export const SYNC_QUEUE_STORAGE_KEY = 'favaloro_sync_queue_v1';
export const PENDING_SESSION_KEY = 'favaloro_pending_session_v1';
export const PENDING_COMPLETION_KEY = 'favaloro_pending_completion_v1';
export const SYNC_STATUS_KEY = 'favaloro_sync_status_v1';

export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
export const SESSION_INIT_TIMEOUT_MS = 2500;
export const MAX_RETRY_COUNT = 5;

// In-memory fallback if localStorage is unavailable (e.g. strict Safari private mode, SSR)
const inMemoryStore = new Map<string, string>();

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface PendingTrialQueueItem extends TrialRecord {
  _retryCount: number;
  _enqueuedAt: string;
  _lastAttemptAt?: string;
  _lastError?: string;
}

export interface SessionRegistrationPayload {
  participantId: string;
  age: number;
  gender: Gender;
  studiesPsychology: boolean;
  therapeuticOrientation: string;
  university: string;
  isIncluded: boolean;
  exclusionReason: ExclusionReason;
  deviceType: DeviceType;
  screenResolution: string;
  userAgent: string;
}

export interface SessionRegistrationResult {
  success: boolean;
  participantId: string;
  inductionGroup: InductionGroup;
  fakeNewsSet: FakeNewsSet;
  isIncluded: boolean;
  exclusionReason: ExclusionReason;
  isOffline: boolean;
  error?: string;
}

export interface SessionCompletionPayload {
  participantId: string;
  status: 'completed';
  completedAt: string;
}

export interface SyncStateSummary {
  status: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type SyncStatusSubscriber = (summary: SyncStateSummary) => void;

// ============================================================================
// Storage Helpers
// ============================================================================

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return inMemoryStore.get(key) || null;
  try {
    return localStorage.getItem(key);
  } catch {
    return inMemoryStore.get(key) || null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    inMemoryStore.set(key, value);
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    inMemoryStore.set(key, value);
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') {
    inMemoryStore.delete(key);
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    inMemoryStore.delete(key);
  }
}

function checkIsOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

// ============================================================================
// Synchronization State & Event Subscriptions
// ============================================================================

let currentSyncStatus: SyncStatus = 'idle';
let lastSyncedTimestamp: string | null = null;
let lastSyncError: string | null = null;
let isDrainingQueue = false;
let retryTimerId: ReturnType<typeof setTimeout> | null = null;

const statusSubscribers = new Set<SyncStatusSubscriber>();

function emitSyncStatus(): void {
  const summary: SyncStateSummary = {
    status: currentSyncStatus,
    pendingCount: getPendingSyncCount(),
    isOnline: checkIsOnline(),
    lastSyncedAt: lastSyncedTimestamp,
    lastError: lastSyncError,
  };
  statusSubscribers.forEach((callback) => {
    try {
      callback(summary);
    } catch (err) {
      console.error('[SyncManager] Error in subscriber callback:', err);
    }
  });
}

export function subscribeSyncStatus(callback: SyncStatusSubscriber): () => void {
  statusSubscribers.add(callback);
  callback({
    status: currentSyncStatus,
    pendingCount: getPendingSyncCount(),
    isOnline: checkIsOnline(),
    lastSyncedAt: lastSyncedTimestamp,
    lastError: lastSyncError,
  });
  return () => {
    statusSubscribers.delete(callback);
  };
}

export function getPendingSyncCount(): number {
  const queue = getQueueFromStorage();
  let count = queue.length;
  if (safeGetItem(PENDING_SESSION_KEY)) count += 1;
  if (safeGetItem(PENDING_COMPLETION_KEY)) count += 1;
  return count;
}

function getQueueFromStorage(): PendingTrialQueueItem[] {
  const raw = safeGetItem(SYNC_QUEUE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueueToStorage(queue: PendingTrialQueueItem[]): void {
  safeSetItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

// ============================================================================
// Exponential Backoff with Random Jitter
// ============================================================================

function calculateBackoffDelay(retryCount: number): number {
  const baseDelayMs = 1000;
  const maxDelayMs = 30000;
  const exponential = baseDelayMs * Math.pow(2, Math.min(retryCount, 5));
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
  return Math.min(Math.round(exponential + jitter), maxDelayMs);
}

// ============================================================================
// Session Registration Flow (/api/session)
// ============================================================================

/**
 * Registers participant session with the server.
 * Invokes `/api/session` to obtain balanced induction group via Supabase RPC.
 * If offline or network exceeds timeout, falls back to local balanced allocation.
 */
export async function registerSession(
  demographics: ParticipantDemographicsInput,
  telemetry: ClientTelemetry,
  options?: { timeoutMs?: number; participantId?: string }
): Promise<SessionRegistrationResult> {
  const timeoutMs = options?.timeoutMs ?? SESSION_INIT_TIMEOUT_MS;
  const participantId = options?.participantId || generateParticipantId();

  // 1. Evaluate inclusion criteria locally
  const { isIncluded, exclusionReason } = evaluateInclusion(demographics);

  // 2. Determine fake news set
  let fakeNewsSet: FakeNewsSet;
  if (!isIncluded) {
    fakeNewsSet = 'control_random';
  } else if (demographics.therapeuticOrientation === 'Psicoanálisis') {
    fakeNewsSet = 'psicoanalisis';
  } else {
    fakeNewsSet = 'evidencia';
  }

  const payload: SessionRegistrationPayload = {
    participantId,
    age: demographics.age,
    gender: demographics.gender,
    studiesPsychology: demographics.studiesPsychology,
    therapeuticOrientation: demographics.therapeuticOrientation,
    university: demographics.university,
    isIncluded,
    exclusionReason,
    deviceType: telemetry.deviceType,
    screenResolution: telemetry.screenResolution,
    userAgent: telemetry.userAgent,
  };

  // Always buffer session registration payload for offline safety
  safeSetItem(PENDING_SESSION_KEY, JSON.stringify(payload));

  // If client is already detected as offline, bypass network call immediately
  if (!checkIsOnline()) {
    currentSyncStatus = 'offline';
    emitSyncStatus();
    const localGroup: InductionGroup = !isIncluded ? 'control' : getBalancedLocalGroup();
    return {
      success: true,
      participantId,
      inductionGroup: localGroup,
      fakeNewsSet,
      isIncluded,
      exclusionReason,
      isOffline: true,
    };
  }

  // Attempt server registration with strict AbortController timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    currentSyncStatus = 'syncing';
    emitSyncStatus();

    const response = await fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Successfully created on server -> clear pending session buffer
    safeRemoveItem(PENDING_SESSION_KEY);
    currentSyncStatus = 'synced';
    lastSyncedTimestamp = new Date().toISOString();
    lastSyncError = null;
    emitSyncStatus();

    const inductionGroup: InductionGroup =
      data.session?.inductionGroup || data.inductionGroup || (!isIncluded ? 'control' : getBalancedLocalGroup());

    return {
      success: true,
      participantId,
      inductionGroup,
      fakeNewsSet,
      isIncluded,
      exclusionReason,
      isOffline: false,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[SyncManager] Session registration fallback triggered:', errorMessage);

    lastSyncError = errorMessage;
    currentSyncStatus = checkIsOnline() ? 'error' : 'offline';
    emitSyncStatus();

    // Fall back gracefully to local balanced group heuristic
    const localGroup: InductionGroup = !isIncluded ? 'control' : getBalancedLocalGroup();

    return {
      success: true,
      participantId,
      inductionGroup: localGroup,
      fakeNewsSet,
      isIncluded,
      exclusionReason,
      isOffline: true,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Asynchronous Non-Blocking Trial Submission (/api/responses)
// ============================================================================

/**
 * Enqueues a trial record and triggers background synchronization.
 * Synchronous execution is < 0.5ms with zero delay to UI interaction or timing.
 */
export function syncTrialResponse(trialRecord: TrialRecord): void {
  try {
    const queue = getQueueFromStorage();

    // Deduplication / Idempotency check: update existing record if already present
    const existingIndex = queue.findIndex(
      (item) =>
        item.participantId === trialRecord.participantId &&
        item.presentationOrder === trialRecord.presentationOrder
    );

    const pendingItem: PendingTrialQueueItem = {
      ...trialRecord,
      _retryCount: existingIndex >= 0 ? queue[existingIndex]._retryCount : 0,
      _enqueuedAt:
        existingIndex >= 0 ? queue[existingIndex]._enqueuedAt : new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = pendingItem;
    } else {
      queue.push(pendingItem);
    }

    saveQueueToStorage(queue);
    emitSyncStatus();

    // Trigger background queue drain asynchronously
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(() => triggerBackgroundDrain());
    } else {
      setTimeout(() => triggerBackgroundDrain(), 0);
    }
  } catch (err) {
    console.error('[SyncManager] Error enqueueing trial response:', err);
  }
}

// ============================================================================
// Session Completion Submission (PATCH /api/session)
// ============================================================================

/**
 * Marks session as completed and enqueues completion payload.
 */
export function completeSession(participantId: string, completedAt?: string): void {
  const payload: SessionCompletionPayload = {
    participantId,
    status: 'completed',
    completedAt: completedAt || new Date().toISOString(),
  };

  safeSetItem(PENDING_COMPLETION_KEY, JSON.stringify(payload));
  emitSyncStatus();

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => triggerBackgroundDrain());
  } else {
    setTimeout(() => triggerBackgroundDrain(), 0);
  }
}

// ============================================================================
// Background Queue Drain & Batch Sync Engine
// ============================================================================

export function triggerBackgroundDrain(): void {
  if (isDrainingQueue) return;
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  drainQueue().catch((err) => {
    console.warn('[SyncManager] Unhandled background drain warning:', err);
  });
}

async function drainQueue(): Promise<void> {
  if (isDrainingQueue) return;
  if (!checkIsOnline()) {
    currentSyncStatus = 'offline';
    emitSyncStatus();
    return;
  }

  isDrainingQueue = true;
  currentSyncStatus = 'syncing';
  emitSyncStatus();

  try {
    // 1. Drain pending session registration first if present
    const rawPendingSession = safeGetItem(PENDING_SESSION_KEY);
    if (rawPendingSession) {
      try {
        const sessionPayload = JSON.parse(rawPendingSession);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionPayload),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          safeRemoveItem(PENDING_SESSION_KEY);
        }
      } catch (err) {
        console.warn('[SyncManager] Background session sync attempt failed, will retry:', err);
      }
    }

    // 2. Drain pending trial records in batch
    const queue = getQueueFromStorage();

    if (queue.length > 0) {
      // Clean internal metadata fields before sending to API
      const payloadBatch: TrialRecord[] = queue.map((item) => ({
        id: item.id,
        participantId: item.participantId,
        presentationOrder: item.presentationOrder,
        newsId: item.newsId,
        isFake: item.isFake,
        newsCongruence: item.newsCongruence,
        responseOption: item.responseOption,
        responseLabel: item.responseLabel,
        readingTimeMs: item.readingTimeMs,
        responseTimeMs: item.responseTimeMs,
        isFalseMemory: item.isFalseMemory,
        isFalseBelief: item.isFalseBelief,
        isTrueMemory: item.isTrueMemory,
        createdAt: item.createdAt,
      }));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: payloadBatch }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        // Clear all synced trials from queue
        saveQueueToStorage([]);
        lastSyncedTimestamp = new Date().toISOString();
        lastSyncError = null;
      } else {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
    }

    // 3. Drain pending session completion if present and trials are done
    const remainingQueue = getQueueFromStorage();
    if (remainingQueue.length === 0) {
      const rawPendingCompletion = safeGetItem(PENDING_COMPLETION_KEY);
      if (rawPendingCompletion) {
        try {
          const completionPayload = JSON.parse(rawPendingCompletion);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

          const res = await fetch('/api/session', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completionPayload),
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (res.ok) {
            safeRemoveItem(PENDING_COMPLETION_KEY);
          }
        } catch (err) {
          console.warn('[SyncManager] Completion sync attempt failed, will retry:', err);
        }
      }
    }

    // Check final status
    const remainingCount = getPendingSyncCount();
    if (remainingCount === 0) {
      currentSyncStatus = 'synced';
    } else {
      currentSyncStatus = 'error';
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    lastSyncError = errorMessage;
    currentSyncStatus = checkIsOnline() ? 'error' : 'offline';

    // Increment retry counts on queue items
    const queue = getQueueFromStorage();
    let minRetries = MAX_RETRY_COUNT;

    const updatedQueue = queue.map((item) => {
      const newRetries = (item._retryCount || 0) + 1;
      if (newRetries < minRetries) minRetries = newRetries;
      return {
        ...item,
        _retryCount: newRetries,
        _lastAttemptAt: new Date().toISOString(),
        _lastError: errorMessage,
      };
    });

    saveQueueToStorage(updatedQueue);

    // Schedule next backoff retry if under threshold and online
    if (checkIsOnline() && minRetries <= MAX_RETRY_COUNT) {
      const delay = calculateBackoffDelay(minRetries);
      retryTimerId = setTimeout(() => triggerBackgroundDrain(), delay);
    }
  } finally {
    isDrainingQueue = false;
    emitSyncStatus();
  }
}

// ============================================================================
// Explicit Flush Gateway (Debriefing / Thank You Screens)
// ============================================================================

/**
 * Explicitly forces a batch drain with a configurable deadline.
 * Guaranteed to resolve and never trap participant on a hanging screen.
 */
export async function flushPendingSync(
  participantId?: string,
  options?: { timeoutMs?: number }
): Promise<{ success: boolean; pendingCount: number; isOffline: boolean; error?: string }> {
  const timeoutMs = options?.timeoutMs ?? 6000;

  if (!checkIsOnline()) {
    currentSyncStatus = 'offline';
    emitSyncStatus();
    return {
      success: false,
      pendingCount: getPendingSyncCount(),
      isOffline: true,
      error: 'Dispositivo sin conexión a internet. Respuestas resguardadas localmente.',
    };
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const pendingCount = getPendingSyncCount();
        resolve({
          success: pendingCount === 0,
          pendingCount,
          isOffline: !checkIsOnline(),
          error: pendingCount > 0 ? 'Tiempo de espera de sincronización agotado' : undefined,
        });
      }
    }, timeoutMs);

    triggerBackgroundDrain();

    // Check periodically if queue has completed
    const interval = setInterval(() => {
      if (getPendingSyncCount() === 0) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          clearInterval(interval);
          resolve({
            success: true,
            pendingCount: 0,
            isOffline: false,
          });
        }
      } else if (!isDrainingQueue && !resolved) {
        // Drain finished but items remain (e.g. server error)
        resolved = true;
        clearTimeout(timer);
        clearInterval(interval);
        resolve({
          success: false,
          pendingCount: getPendingSyncCount(),
          isOffline: !checkIsOnline(),
          error: lastSyncError || 'Error al persistir registros en el servidor',
        });
      }
    }, 200);
  });
}

// ============================================================================
// Reset & Cleanup
// ============================================================================

export function clearSyncStorage(): void {
  safeRemoveItem(SYNC_QUEUE_STORAGE_KEY);
  safeRemoveItem(PENDING_SESSION_KEY);
  safeRemoveItem(PENDING_COMPLETION_KEY);
  safeRemoveItem(SYNC_STATUS_KEY);
  currentSyncStatus = 'idle';
  lastSyncedTimestamp = null;
  lastSyncError = null;
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  emitSyncStatus();
}

// ============================================================================
// Online / Offline Global Window Listeners
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[SyncManager] Browser reconnected to internet. Resuming sync queue...');
    currentSyncStatus = 'syncing';
    emitSyncStatus();
    triggerBackgroundDrain();
  });

  window.addEventListener('offline', () => {
    console.warn('[SyncManager] Browser went offline. Buffering responses in localStorage.');
    currentSyncStatus = 'offline';
    emitSyncStatus();
  });
}
