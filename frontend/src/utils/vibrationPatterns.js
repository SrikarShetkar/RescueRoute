// Unique vibration patterns for RescueRoute

export const VIBRATION_PATTERNS = {
  AMBULANCE_APPROACH: [500, 300, 500, 300, 700],
  EMERGENCY_TRIGGERED: [800, 400, 800],
  WARNING: [300, 200, 300],
};

export function vibrate(patternName) {
  if (!navigator.vibrate) return;

  const pattern = VIBRATION_PATTERNS[patternName];
  if (pattern) {
    navigator.vibrate(pattern);
  }
}
