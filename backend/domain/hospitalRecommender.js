/**
 * hospitalRecommender.js — Transparent two-stage hospital selection engine.
 *
 * Stage 1  — ELIGIBILITY FILTERING (hard constraints)
 *   Hospitals that fundamentally cannot handle the emergency are REMOVED
 *   before any scoring happens. A critical missing requirement can never be
 *   out-ranked by proximity.
 *
 * Stage 2  — WEIGHTED RANKING
 *   Every remaining eligible hospital receives a normalised 0..100 score per
 *   dimension (travel time, beds, equipment, specialist, capacity, load) and
 *   the dimensions are combined with the centralised weights from
 *   config/scoringConfig.js — NOT hard-coded in this file.
 *
 * Explainability: every hospital result carries a human-readable reason list
 * so the system can answer "Why did you recommend Hospital A?".
 */

const { calculateDistance, calculateETA } = require("../utils/etaCalculator");
const config = require("../config/scoringConfig");

const CONDITION_SPECIALTY = {
  cardiac: "Cardiology",
  heart: "Cardiology",
  chest: "Cardiology",
  stroke: "Neurology",
  neuro: "Neurology",
  seizure: "Neurology",
  bleed: "Trauma",
  fracture: "Trauma",
  crash: "Trauma",
  accident: "Trauma",
  trauma: "Trauma",
  burn: "Trauma",
  respiratory: "Pulmonology",
  breathing: "Pulmonology",
  poison: "Toxicology",
  burn_injury: "Burn Unit",
};

const CONDITION_EQUIPMENT = {
  cardiac: ["Cardiac Monitor", "Defibrillator"],
  heart: ["Cardiac Monitor", "Defibrillator"],
  stroke: ["CT Scanner"],
  neuro: ["CT Scanner"],
  bleed: ["Blood Bank", "Ventilator"],
  crash: ["Trauma Kit", "Ventilator"],
  accident: ["Trauma Kit"],
  trauma: ["Trauma Kit", "Blood Bank"],
  respiratory: ["Ventilator", "Oxygen Supply"],
  breathing: ["Ventilator", "Oxygen Supply"],
};

function matchSpecialty(em) {
  const condition = String(em.patient?.condition || "").toLowerCase();
  for (const [keyword, specialty] of Object.entries(CONDITION_SPECIALTY)) {
    if (condition.includes(keyword)) return specialty;
  }
  return null;
}

function requiredEquipment(em) {
  const condition = String(em.patient?.condition || "").toLowerCase();
  for (const [keyword, equipment] of Object.entries(CONDITION_EQUIPMENT)) {
    if (condition.includes(keyword)) return equipment;
  }
  return [];
}

/* ----------------------- resource freshness helpers ---------------------- */

function stalenessMinutes(hospital) {
  if (!hospital.resourceLastUpdated) return 0;
  return Math.max(
    0,
    (Date.now() - new Date(hospital.resourceLastUpdated).getTime()) / 60000
  );
}

function freshnessFactor(hospital) {
  const minutes = stalenessMinutes(hospital);
  if (minutes === 0) return 1;
  if (minutes <= config.HARD_CONSTRAINTS.staleDataThresholdMinutes) return 1;
  if (minutes <= config.HARD_CONSTRAINTS.veryStaleDataThresholdMinutes) {
    return config.HARD_CONSTRAINTS.staleDataPenalty;
  }
  return config.HARD_CONSTRAINTS.veryStaleDataPenalty;
}

function resourceStatus(hospital) {
  const minutes = stalenessMinutes(hospital);
  if (minutes === 0) return "LIVE";
  if (minutes <= config.HARD_CONSTRAINTS.staleDataThresholdMinutes) return "FRESH";
  if (minutes <= config.HARD_CONSTRAINTS.veryStaleDataThresholdMinutes) return "RECENT";
  return "STALE";
}

/* ----------------------- STAGE 1: eligibility filter --------------------- */

function hasSpecialist(hospital, specialty) {
  if (!specialty) return true;
  return (hospital.specialists || []).some(
    (s) => s.toLowerCase().includes(specialty.toLowerCase())
  );
}

function stage1Eligibility(hospital, emergency, specialty, equipment) {
  const problems = [];

  if (hospital.acceptanceStatus === "CLOSED") {
    return { eligible: false, problems: [...problems, "Hospital is closed to new admissions"] };
  }
  if (hospital.acceptanceStatus === "BYPASS") {
    return { eligible: false, problems: [...problems, "Hospital is on bypass (overloaded)"] };
  }

  if (hospital.emergencyBeds <= 0) {
    problems.push("No emergency bed available");
  }

  if (
    emergency.patient?.severity === "critical" &&
    (hospital.emergencyCapacity || "LOW") === "LOW" &&
    config.HARD_CONSTRAINTS.emergencyCapacityMinimum !== "LOW"
  ) {
    problems.push("Emergency department not equipped for critical patients");
  }

  if (config.HARD_CONSTRAINTS.criticalEquipmentRequired && equipment.length > 0) {
    const missing = equipment.filter((eq) => !hospital.equipment.includes(eq));
    if (missing.length > 0) {
      problems.push(`Missing required equipment: ${missing.join(", ")}`);
    }
  }

  if (config.HARD_CONSTRAINTS.criticalSpecialtyRequired && specialty) {
    if (!hasSpecialist(hospital, specialty)) {
      problems.push(`Missing required specialist: ${specialty}`);
    }
  }

  return { eligible: problems.length === 0, problems };
}

/* ----------------------- STAGE 2: weighted scoring ----------------------- */

function travelTimeScore(minutes) {
  const norm = config.SCORING_NORMALIZATION.travelTime;
  const score = norm.maxScore - (minutes / norm.maxMinutes) * norm.maxScore;
  return Math.max(norm.minScore, Math.round(score));
}

function bedScore(hospital) {
  const norm = config.SCORING_NORMALIZATION.bedAvailability;
  return Math.min(norm.maxScore, Math.round(hospital.emergencyBeds * 10));
}

function equipmentScore(required, hospital) {
  if (required.length === 0) return 100;
  const have = required.filter((eq) => hospital.equipment.includes(eq));
  return Math.round((have.length / required.length) * 100);
}

function specialistScore(hospital, specialty) {
  if (!specialty) return 100;
  if (hasSpecialist(hospital, specialty)) return 100;
  if (hospital.specialistsSoon?.some((s) => s.toLowerCase().includes(specialty.toLowerCase()))) return 55;
  return 0;
}

function capacityScore(hospital) {
  const map = config.SCORING_NORMALIZATION.emergencyCapacity;
  return map[hospital.emergencyCapacity] || map.LOW;
}

function loadScore(hospital) {
  const load = hospital.currentLoad ?? 0;
  return Math.max(0, Math.round(100 - load));
}

function reasonsFor(hospital, { minutes, distance, specialty, equipment, beds, cap, load, travel, eq, spec, capScore, loadScoreV, scores }) {
  const reasons = [];
  if (travel >= 80) reasons.push(`Short ETA (${minutes} min)`);
  else reasons.push(`ETA ${minutes} min`);
  if (beds) reasons.push("Emergency bed available");
  if (equipment.length === 0) reasons.push("No special equipment required");
  else if (eq === 100) reasons.push("Required equipment available");
  else reasons.push(`Required equipment partially available (${Math.round(eq)}%)`);
  if (!specialty) reasons.push("Specialist match not required");
  else if (spec === 100) reasons.push("Required specialist available");
  else if (spec === 55) reasons.push("Required specialist available soon");
  if (cap >= 60) reasons.push(`High emergency capacity (${hospital.emergencyCapacity})`);
  if (load >= 70) reasons.push(`Low current emergency load (${hospital.currentLoad}%)`);
  else if (load >= 40) reasons.push(`Moderate current emergency load (${hospital.currentLoad}%)`);
  if (stalenessMinutes(hospital) === 0) reasons.push("Resource data live");
  return reasons;
}

function loadLabel(load) {
  if (load < 35) return "Low";
  if (load < 65) return "Moderate";
  if (load < 85) return "High";
  return "Critical";
}

/**
 * recommend(emergency, hospitals) -> { recommendations, top }
 *
 * Returns every eligible hospital (ranked) plus the top candidate. The first
 * eligible hospital is the assigned destination by default — but the final
 * human decision remains with the authorized operator (see the UI treatment).
 */
function recommend(emergency, hospitals) {
  const specialty = matchSpecialty(emergency);
  const equipment = requiredEquipment(emergency);
  const rejectedIds = emergency.rejectedHospitalIds || [];

  const candidates = hospitals
    .filter((h) => !rejectedIds.includes(h.id))
    .map((hospital) => {
      const distance = calculateDistance(
        emergency.location.lat,
        emergency.location.lng,
        hospital.location.lat,
        hospital.location.lng
      );
      const minutes = parseEta(calculateETA(distance));
      const eligibility = stage1Eligibility(hospital, emergency, specialty, equipment);
      return { hospital, distance, minutes, eligibility };
    })
    .map((c) => {
      if (!c.eligibility.eligible) {
        return {
          hospital: c.hospital,
          distance: c.distance,
          eta: etaLabel(c.minutes),
          eligible: false,
          problems: c.eligibility.problems,
          score: 0,
          reasons: c.eligibility.problems,
        };
      }

      const travel = travelTimeScore(c.minutes);
      const beds = bedScore(c.hospital);
      const eq = equipmentScore(equipment, c.hospital);
      const spec = specialistScore(c.hospital, specialty);
      const cap = capacityScore(c.hospital);
      const load = loadScore(c.hospital);

      const raw = travel * config.WEIGHTS.travelTime +
        beds * config.WEIGHTS.bedAvailability +
        eq * config.WEIGHTS.equipmentCapability +
        spec * config.WEIGHTS.specialistAvailability +
        cap * config.WEIGHTS.emergencyCapacity +
        load * config.WEIGHTS.currentLoad;

      const freshness = freshnessFactor(c.hospital);
      const score = Math.round(raw * freshness);

      const reasons = reasonsFor(c.hospital, {
        minutes: c.minutes,
        distance: c.distance,
        specialty,
        equipment,
        beds: c.hospital.emergencyBeds > 0,
        cap,
        load,
        travel,
        eq,
        spec,
        capScore: cap,
        loadScoreV: load,
        scores: { travel, beds, eq, spec, cap, load },
      });

      return {
        hospital: c.hospital,
        distance: c.distance,
        eta: etaLabel(c.minutes),
        minutes: c.minutes,
        eligible: true,
        score,
        reasons,
        scoreBreakdown: { travelTime: travel, beds, equipment: eq, specialist: spec, capacity: cap, load },
        freshness: resourceStatus(c.hospital),
        staleMinutes: Math.round(stalenessMinutes(c.hospital) * 10) / 10,
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.score - a.score;
    });

  candidates.forEach((c, i) => {
    c.rank = i + 1;
    if (c.eligible) {
      c.scoreLabel = labelForScore(c.hospital, c);
    }
  });

  const eligible = candidates.filter((c) => c.eligible);
  return {
    recommendations: candidates,
    top: eligible[0] || null,
    requiredSpecialty: specialty,
    requiredEquipment: equipment,
  };
}

function etaLabel(minutes) {
  if (minutes <= 0) return "Less than 1 minute";
  if (minutes === 1) return "1 minute";
  return `${minutes} minutes`;
}

function parseEta(etaStr) {
  const m = String(etaStr).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 99;
}

function labelForScore(hospital, recommendation) {
  return {
    rank: recommendation.rank,
    score: recommendation.score,
    scoreBreakdown: recommendation.scoreBreakdown,
    reasons: recommendation.reasons,
    eta: recommendation.eta,
    distance: recommendation.distance + " km",
    emergencyBeds: hospital.emergencyBeds,
    load: loadLabel(hospital.currentLoad ?? 0),
  };
}

module.exports = {
  recommend,
  matchSpecialty,
  requiredEquipment,
  CONDITION_SPECIALTY,
  CONDITION_EQUIPMENT,
};