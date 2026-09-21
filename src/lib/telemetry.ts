/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Telemetry Capture Utility
 * Target: src/lib/telemetry.ts
 */

import type { DeviceType } from '../types/experiment';

export interface ClientTelemetry {
  deviceType: DeviceType;
  screenResolution: string;
  userAgent: string;
}

export function captureClientTelemetry(): ClientTelemetry {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'desktop',
      screenResolution: '1920x1080',
      userAgent: 'Server-Side Rendering',
    };
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const screenWidth = window.screen?.width || window.innerWidth || 1920;
  const screenHeight = window.screen?.height || window.innerHeight || 1080;
  const screenResolution = `${screenWidth}x${screenHeight}`;

  // Multi-attribute device classification
  const isTabletRegex = /iPad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i;
  const isMobileRegex = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i;

  let deviceType: DeviceType = 'desktop';

  if (isTabletRegex.test(ua)) {
    deviceType = 'tablet';
  } else if (isMobileRegex.test(ua)) {
    deviceType = 'mobile';
  } else {
    // Secondary heuristic: touchscreen and viewport aspect ratio
    const hasTouch = ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    const minDimension = Math.min(window.innerWidth || 1920, window.innerHeight || 1080);

    if (hasTouch && minDimension < 640) {
      deviceType = 'mobile';
    } else if (hasTouch && minDimension >= 640 && minDimension <= 1024) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }
  }

  return {
    deviceType,
    screenResolution,
    userAgent: ua,
  };
}
