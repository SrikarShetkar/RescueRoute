/**
 * demoMode.js — Deterministic end-to-end demo scenarios for the jury.
 *
 * runFullScenario(): the complete rescue sequence (report → ambulance →
 * pickup → hospital recommendation → rejection → reroute → accept → corridor →
 * arrival → complete).
 *
 * runCrashScenario(): crash-detection flow — a potential crash is simulated
 * and the verification countdown begins; the Reporter screen's "Are you okay?"
 * prompts drive the confirmation.
 *
 * These are demo conveniences only — they drive the exact same engine actions
 * a human operator would trigger, so what the jury sees is the real flow.
 */

const engine = require("./emergencyEngine");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let demoEmergencyId = null;

function demoPatient(severity = "critical", condition = "Crash injury, suspected internal bleeding") {
  return {
    name: "Demo Patient",
    age: 34,
    bloodGroup: "B+",
    allergies: "None",
    condition,
    severity,
  };
}

function demoLocation(label = "Hitech City, Hyderabad") {
  return { lat: 17.4016, lng: 78.4055, label };
}

function runFullScenario() {
  const em = engine.createEmergency({
    kind: "ACCIDENT_REPORT",
    reporter: { name: "Demo Reporter", via: "bystander" },
    patient: demoPatient("critical", "Crash injury, suspected internal bleeding"),
    location: demoLocation(),
  });
  demoEmergencyId = em.emergencyId;
  // Drive the ambulance the engine actually assigned (preference isn't a
  // guarantee — see the seeded dispatcher rules), so the demo never assumes.
  const ambulanceId = em.ambulance ? em.ambulance.id : em.ambulanceId;
  fireAndForget(runFullSequence(demoEmergencyId, ambulanceId));
  return em;
}

async function runFullSequence(emergencyId, ambulanceId) {
  try {
    await delay(1500);
    engine.applyAction(emergencyId, "accept", { role: engine.ROLES.AMBULANCE, ambulanceId });

    await moveAmbulanceAlong(emergencyId, ambulanceId, { lat: 17.385, lng: 78.4867 }, { lat: 17.4016, lng: 78.4055 }, STEPS.PATIENT);

    await delay(1200);
    engine.applyAction(emergencyId, "at-patient", { role: engine.ROLES.AMBULANCE, ambulanceId });
    await delay(1200);
    engine.applyAction(emergencyId, "pickup", { role: engine.ROLES.AMBULANCE, ambulanceId });

    // Hospital A (top recommendation) rejects with a legitimate reason →
    // the engine reroutes and control room sees the rejection live.
    await delay(1500);
    const snapshotA = engine.getEmergency(emergencyId);
    if (snapshotA?.hospitalId) {
      engine.applyAction(emergencyId, "reject-patient", {
        role: engine.ROLES.HOSPITAL,
        hospitalId: snapshotA.hospitalId,
        rejectReason: "NO_EMERGENCY_BED",
      });
    }

    // Accept whatever the engine now recommends (Hospital B) — ambulance
    // travels along from its current position to the hospital.
    await delay(1500);
    const snapshotB = engine.getEmergency(emergencyId);
    if (snapshotB?.hospitalId) {
      engine.applyAction(emergencyId, "accept-patient", {
        role: engine.ROLES.HOSPITAL,
        hospitalId: snapshotB.hospitalId,
      });
      await moveAmbulanceAlong(
        emergencyId,
        ambulanceId,
        snapshotB.ambulance.liveLocation,
        snapshotB.hospital.liveLocation,
        STEPS.HOSPITAL
      );
    }

    await delay(800);
    engine.applyAction(emergencyId, "arrived-hospital", { role: engine.ROLES.AMBULANCE, ambulanceId });
    await delay(1200);
    // Hand the patient over — the case stays LIVE (IN_TREATMENT) until the
    // hospital discharges the patient, so the demo shows the hospital screen.
    engine.applyAction(emergencyId, "handover", { role: engine.ROLES.AMBULANCE, ambulanceId });
    await delay(1500);
    engine.applyAction(emergencyId, "discharge", { role: engine.ROLES.HOSPITAL, hospitalId: engine.getEmergency(emergencyId).hospitalId });
    engine.applyAction(emergencyId, "rate-hospital", {
      role: engine.ROLES.REPORTER,
      rating: 5,
      ratingComment: "Timely response and clean facility",
      ratingCategories: { care: 5, response: 4, facilities: 5 },
    });
  } catch (err) {
    console.error("[demoMode] full-scenario error:", err.message);
  }
}

const STEPS = {
  PATIENT: 14,
  HOSPITAL: 16,
};

async function moveAmbulanceAlong(emergencyId, ambulanceId, from, to, steps) {
  try {
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const lat = from.lat + (to.lat - from.lat) * t;
      const lng = from.lng + (to.lng - from.lng) * t;
      engine.moveAmbulance({ ambulanceId, lat, lng });
      await delay(180);
    }
  } catch (err) {
    console.error("[demoMode] move error:", err.message);
  }
}

function runCrashScenario() {
  const em = engine.createEmergency({
    kind: "CRASH_DETECTION",
    reporter: { name: "Demo Citizen", via: "crash" },
    patient: { name: "Demo Citizen", severity: "critical", condition: "Crash detection — unresponsive" },
    location: demoLocation(),
    confidence: 87,
  });
  demoEmergencyId = em.emergencyId;
  return em;
}

function fireAndForget(promise) {
  promise.catch((err) => console.error("[demoMode]", err));
}

module.exports = {
  runFullScenario,
  runCrashScenario,
  getDemoEmergencyId: () => demoEmergencyId,
  demoPatient,
  demoLocation,
};