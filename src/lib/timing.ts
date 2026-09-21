/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Centralized Experiment Timing Configuration
 * Target: src/lib/timing.ts
 */

// Stimulus Reading Window (R1 - 15.0-second mandatory reading exposure)
export const STIMULUS_EXPOSURE_DURATION_SECONDS = 15;
export const STIMULUS_EXPOSURE_DURATION_MS = STIMULUS_EXPOSURE_DURATION_SECONDS * 1000; // 15,000 ms

// Admin and Network Timeouts
export const SESSION_REGISTRATION_TIMEOUT_MS = 2500;
export const FINAL_SYNC_GATEWAY_TIMEOUT_MS = 5000;
