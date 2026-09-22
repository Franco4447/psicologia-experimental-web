'use client';

import React, { useReducer, useEffect, useState, useRef } from 'react';
import {
  experimentReducer,
  getInitialExperimentState,
} from '@/lib/experimentState';
import { preloadStimuliBatch } from '@/lib/assets';
import { captureClientTelemetry } from '@/lib/telemetry';
import {
  saveSessionToStorage,
  loadSessionFromStorage,
} from '@/lib/sessionRecovery';
import {
  registerSession,
  syncTrialResponse,
  completeSession,
  flushPendingSync,
} from '@/lib/sync';

import { WelcomeScreen } from '@/components/WelcomeScreen';
import { ConsentScreen } from '@/components/ConsentScreen';
import { DemographicsScreen } from '@/components/DemographicsScreen';
import { InductionScreen } from '@/components/InductionScreen';
import { StimulusReadingScreen } from '@/components/StimulusReadingScreen';
import { RatingScreen } from '@/components/RatingScreen';
import { ManipulationCheckScreen } from '@/components/ManipulationCheckScreen';
import { DebriefingScreen } from '@/components/DebriefingScreen';
import { ThankYouScreen } from '@/components/ThankYouScreen';

// ============================================================================
// Experiment Flow Orchestrator Component
// ============================================================================

export default function ExperimentPage() {
  const [state, dispatch] = useReducer(experimentReducer, getInitialExperimentState());
  const [isRegisteringSession, setIsRegisteringSession] = useState(false);
  const [isFinalizingSession, setIsFinalizingSession] = useState(false);

  // Ref tracking responses that have already been passed to syncTrialResponse
  const syncedResponsesCountRef = useRef(0);

  // 1. Client Hydration & Session Recovery on Mount
  useEffect(() => {
    const stored = loadSessionFromStorage();
    if (stored) {
      syncedResponsesCountRef.current = stored.responses?.length || 0;
      dispatch({
        type: 'HYDRATE_STORAGE',
        payload: {
          stage: stored.stage,
          participantId: stored.participantId,
          createdAt: stored.createdAt,
          completedAt: stored.completedAt,
          demographics: stored.demographics,
          isIncluded: stored.isIncluded,
          exclusionReason: stored.exclusionReason,
          inductionGroup: stored.inductionGroup,
          fakeNewsSet: stored.fakeNewsSet,
          deck: stored.deck,
          currentTrialIndex: stored.currentTrialIndex,
          currentReadingTimeMs: stored.currentReadingTimeMs,
          responses: stored.responses,
          telemetry: stored.telemetry,
        },
      });
    } else {
      dispatch({ type: 'HYDRATE_STORAGE', payload: {} });
    }
  }, []);

  // 2. Session Persistence to sessionStorage on State Changes
  useEffect(() => {
    if (state.isHydrated && state.stage !== 'welcome' && state.stage !== 'consent') {
      saveSessionToStorage(state);
    }
  }, [state]);

  // 3. Background Non-Blocking Trial Responses Synchronization
  // Runs after paint when state.responses updates. Zero interference with UI or RT capture.
  useEffect(() => {
    if (state.responses && state.responses.length > syncedResponsesCountRef.current) {
      const pendingTrials = state.responses.slice(syncedResponsesCountRef.current);
      syncedResponsesCountRef.current = state.responses.length;
      for (const trial of pendingTrials) {
        syncTrialResponse(trial);
      }
    }
  }, [state.responses]);

  // 4. Preload 20 Stimulus Assets in the Background
  useEffect(() => {
    if (state.deck && state.deck.length === 20) {
      const stimulusIds = state.deck.map((s) => s.id);
      preloadStimuliBatch(stimulusIds).catch((err) => {
        console.warn('Background stimuli preloading caught error:', err);
      });
    }
  }, [state.deck]);

  // 5. BeforeUnload Guard during In-Progress Trials
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isExperimentInProgress =
        state.stage !== 'welcome' &&
        state.stage !== 'consent' &&
        state.stage !== 'thankyou';

      if (isExperimentInProgress) {
        e.preventDefault();
        e.returnValue =
          'El experimento está en progreso. Si sale ahora, sus respuestas no se completarán.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.stage]);

  // Prevent flash of unstyled content during SSR hydration
  if (!state.isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Loading overlay during demographics server registration (max 2500ms)
  if (isRegisteringSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <p className="text-sm font-medium text-slate-600">
          Iniciando sesión y asignando condiciones del experimento...
        </p>
      </div>
    );
  }

  // Loading overlay during debriefing final flush gateway (max 5000ms)
  if (isFinalizingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <p className="text-sm font-medium text-slate-600">
          Guardando y sincronizando sus respuestas con la base de datos...
        </p>
      </div>
    );
  }

  // 6. Stage Dispatcher
  switch (state.stage) {
    case 'welcome':
      return <WelcomeScreen onStart={() => dispatch({ type: 'START_CONSENT' })} />;

    case 'consent':
      return (
        <ConsentScreen
          onAcceptConsent={() => dispatch({ type: 'ACCEPT_CONSENT' })}
          onAccept={() => dispatch({ type: 'ACCEPT_CONSENT' })}
          onBack={() => dispatch({ type: 'RESET_EXPERIMENT' })}
        />
      );

    case 'demographics':
      return (
        <DemographicsScreen
          onSubmit={async (demographics) => {
            const telemetry = captureClientTelemetry();
            setIsRegisteringSession(true);
            try {
              // Asynchronously registers session with /api/session (server balanced RPC).
              // Falls back to local balanced allocation if offline or timeout (>2500ms).
              const sessionResult = await registerSession(demographics, telemetry);
              dispatch({
                type: 'SUBMIT_DEMOGRAPHICS',
                payload: {
                  demographics,
                  telemetry,
                  assignedGroup: sessionResult.inductionGroup,
                  participantId: sessionResult.participantId,
                },
              });
            } catch (err) {
              console.warn('[ExperimentPage] Session registration fallback:', err);
              const fallbackId = crypto.randomUUID();
              dispatch({
                type: 'SUBMIT_DEMOGRAPHICS',
                payload: { demographics, telemetry, participantId: fallbackId },
              });
            } finally {
              setIsRegisteringSession(false);
            }
          }}
        />
      );

    case 'induction':
      return (
        <InductionScreen
          inductionGroup={state.inductionGroup || 'control'}
          onAcknowledge={() => dispatch({ type: 'ACKNOWLEDGE_INDUCTION' })}
        />
      );

    case 'reading': {
      const currentStimulus = state.deck[state.currentTrialIndex];
      if (!currentStimulus) return null;

      return (
        <StimulusReadingScreen
          key={`reading-${state.currentTrialIndex}-${currentStimulus.id}`}
          stimulus={currentStimulus}
          trialNumber={state.currentTrialIndex + 1}
          totalTrials={state.deck.length}
          onExposureComplete={(readingTimeMs) => {
            dispatch({ type: 'FINISH_READING', payload: { readingTimeMs } });
          }}
          onComplete={(readingTimeMs) => {
            dispatch({ type: 'FINISH_READING', payload: { readingTimeMs } });
          }}
        />
      );
    }

    case 'rating': {
      const currentStimulus = state.deck[state.currentTrialIndex];
      if (!currentStimulus) return null;

      return (
        <RatingScreen
          key={`rating-${state.currentTrialIndex}-${currentStimulus.id}`}
          stimulus={currentStimulus}
          trialNumber={state.currentTrialIndex + 1}
          totalTrials={state.deck.length}
          onSubmitResponse={({ responseOption, responseTimeMs }) => {
            // Immediate synchronous state update. Background synchronization
            // is triggered asynchronously via useEffect without touching this thread.
            dispatch({
              type: 'RECORD_TRIAL_RESPONSE',
              payload: { responseOption, responseTimeMs },
            });
          }}
          onSubmitRating={(responseOption, responseTimeMs) => {
            dispatch({
              type: 'RECORD_TRIAL_RESPONSE',
              payload: { responseOption, responseTimeMs },
            });
          }}
        />
      );
    }

    case 'manipulation_check':
      return (
        <ManipulationCheckScreen
          inductionGroup={state.inductionGroup || 'control'}
          onSubmit={(data) => {
            dispatch({ type: 'SUBMIT_MANIPULATION_CHECK', payload: data });
          }}
        />
      );

    case 'debriefing':
      return (
        <DebriefingScreen
          onConfirmDebriefing={async () => {
            setIsFinalizingSession(true);
            try {
              const nowIso = new Date().toISOString();
              completeSession(state.participantId, nowIso, {
                reportedInduction: state.mcReportedInduction,
                emotionUsage: state.mcEmotionUsage,
                reasonUsage: state.mcReasonUsage,
              });
              // Final flush gateway: attempts batch sync of all trials and completion status
              await flushPendingSync(state.participantId, { timeoutMs: 5000 });
            } catch (err) {
              console.warn('[ExperimentPage] Final flush gateway caught warning:', err);
            } finally {
              setIsFinalizingSession(false);
              dispatch({ type: 'COMPLETE_DEBRIEFING' });
            }
          }}
          onComplete={async () => {
            setIsFinalizingSession(true);
            try {
              const nowIso = new Date().toISOString();
              completeSession(state.participantId, nowIso, {
                reportedInduction: state.mcReportedInduction,
                emotionUsage: state.mcEmotionUsage,
                reasonUsage: state.mcReasonUsage,
              });
              await flushPendingSync(state.participantId, { timeoutMs: 5000 });
            } catch (err) {
              console.warn('[ExperimentPage] Final flush gateway caught warning:', err);
            } finally {
              setIsFinalizingSession(false);
              dispatch({ type: 'COMPLETE_DEBRIEFING' });
            }
          }}
        />
      );

      case 'thankyou':
        return (
          <ThankYouScreen
            participantId={state.participantId!}
          />
        );

    default:
      return null;
  }
}
