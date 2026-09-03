/**
 * scoringConfig.js — Centralised, easily-modifiable weights and thresholds
 * for the hospital recommendation algorithm.
 *
 * All weights must sum to 1.0. The engine enforces this at startup.
 * Thresholds are separate from weights and control hard-constraint behaviour.
 */

const WEIGHTS = {
  travelTime: 0.30,
  bedAvailability: 0.20,
  equipmentCapability: 0.20,
  specialistAvailability: 0.15,
  emergencyCapacity: 0.10,
  currentLoad: 0.05,
};

const HARD_CONSTRAINTS = {
  criticalEquipmentRequired: true,
  criticalSpecialtyRequired: true,
  emergencyCapacityMinimum: "LOW",
  maxRejectionsBeforeEscalation: 3,
  staleDataThresholdMinutes: 5,
  veryStaleDataThresholdMinutes: 10,
  staleDataPenalty: 0.85,
  veryStaleDataPenalty: 0.70,
};

const REJECT_REASONS = [
  { id: "NO_EMERGENCY_BED", label: "No emergency bed available" },
  { id: "EQUIPMENT_UNAVAILABLE", label: "Required equipment unavailable" },
  { id: "SPECIALIST_UNAVAILABLE", label: "Required specialist unavailable" },
  { id: "EMERGENCY_DEPT_FULL", label: "Emergency department at capacity" },
  { id: "CAPABILITY_INSUFFICIENT", label: "Hospital capability insufficient for this emergency" },
  { id: "TEMPORARY_OPERATIONAL", label: "Temporary operational issue" },
  { id: "OTHER", label: "Other authorized reason" },
];

const SCORING_NORMALIZATION = {
  travelTime: {
    maxMinutes: 20,
    minScore: 0,
    maxScore: 100,
  },
  bedAvailability: {
    maxBeds: 10,
    minScore: 0,
    maxScore: 100,
  },
  emergencyCapacity: {
    HIGH: 100,
    MEDIUM: 60,
    LOW: 20,
  },
  loadScale: {
    minScore: 0,
    maxScore: 100,
  },
};

const CORRIDOR_CONFIG = {
  defaultWidthKm: 0.5,
  defaultRadiusUsers: 2000,
  maxCorridorLengthKm: 20,
  notificationAdvanceMinutes: 3,
};

const CRASH_DETECTION = {
  defaultThreshold: 5,
  confidenceMultiplierSpike: 0.4,
  confidenceMultiplierInactivity: 0.3,
  confidenceMultiplierOrientation: 0.3,
  inactivityWindowMs: 2000,
  countdownSeconds: 10,
  minConfidenceToTrigger: 50,
};

/**
 * TIMEOUTS — all waiting/confirmation windows are centralised here so they can
 * be tuned for a demo without hunting through the codebase.
 */
const TIMEOUTS = {
  // How long a pending (WAITING) hospital admission request stays open before
  // it is expired and the search re-routes / escalates.
  hospitalRequestMs: 60000,
  // How long a hospital has, after accepting, to cancel the acceptance before
  // it is "admission locked" (only control-room override can then reroute).
  acceptanceWindowMs: 60000,
  // How many repeated cancelled emergencies before an account is flagged as
  // suspicious (fake-case mitigation).
  cancelHistoryThreshold: 3,
  // Min interval (ms) between emergency creations from the same reporter id to
  // consider it non-suspicious.
  minReportIntervalMs: 30000,
};

function validateWeights() {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    console.warn(`[scoringConfig] Weights sum to ${sum}, expected 1.0`);
  }
}

validateWeights();

module.exports = {
  WEIGHTS,
  HARD_CONSTRAINTS,
  REJECT_REASONS,
  SCORING_NORMALIZATION,
  CORRIDOR_CONFIG,
  CRASH_DETECTION,
  TIMEOUTS,
};
