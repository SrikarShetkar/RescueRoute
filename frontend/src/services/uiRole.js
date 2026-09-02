/**
 * uiRole.js — which screen is currently open. The SoundCenter uses this to
 * decide whether a broadcast sound-plan item is meant for *this* window.
 * Screens set their role on mount (and unset on unmount).
 */

let role = "home";
let trackedEmergencyId = null;

export function setUiRole(next) {
  role = next || "home";
}

export function setTrackedEmergency(id) {
  trackedEmergencyId = id || null;
}

export function getUiState() {
  return { role, trackedEmergencyId };
}