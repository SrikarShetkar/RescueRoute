/**
 * emergencyEngine.js — The single source of truth for an emergency's lifecycle.
 *
 * This is the "brain" (Person 1 in the plan):
 *   - Every emergency has an immutable lifecycle. Status can only change
 *     through a role-gated action defined here — never by a screen guessing.
 *   - A hospital cannot mark a patient arrived before the ambulance has even
 *     accepted the case. A hospital cannot accept an ambulance request.
 *   - If a hospital declines a patient (with a legitimate operational reason),
 *     the engine records the rejection, removes/deprioritises the hospital,
 *     recalculates recommendations and offers the next-best hospital. After a
 *     configurable number of rejections it escalates to the control room.
 *   - Hospital requests support three responses: ACCEPT, CONDITIONAL ACCEPT
 *     (with a stated limitation) and REJECT (reason-gated, never free text).
 *   - Hospital recommendations come from a transparent two-stage engine
 *     (hard-constraint eligibility filter, then weighted scoring) — the final
 *     destination is still chosen by an authorised human operator.
 *   - Crash detection enters the same state machine via POTENTIAL_CRASH →
 *     USER_CONFIRMATION → CONFIRMED_EMERGENCY | CANCELLED.
 *   - Every transition produces a SOUND PLAN. Sounds are never played because
 *     of a click or a page load — only because a real domain event happened.
 *
 * Pure Node module: no MongoDB required, works fully in-memory for the demo.
 */

const { calculateDistance, calculateETA } = require("../utils/etaCalculator");
const recommender = require("./hospitalRecommender");
const corridor = require("./greenCorridor");
const config = require("../config/scoringConfig");
const bus = require("./bus");

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

const STATUS = {
  REPORTED: "REPORTED",
  AMBULANCE_OFFERED: "AMBULANCE_OFFERED",
  AMBULANCE_ACCEPTED: "AMBULANCE_ACCEPTED",
  AT_PATIENT: "AT_PATIENT",
  PICKED_UP: "PICKED_UP",
  HOSPITAL_OFFERED: "HOSPITAL_OFFERED",
  TO_HOSPITAL: "TO_HOSPITAL",
  ARRIVED_AT_HOSPITAL: "ARRIVED_AT_HOSPITAL",
  IN_TREATMENT: "IN_TREATMENT",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",

  POTENTIAL_CRASH: "POTENTIAL_CRASH",
  USER_CONFIRMATION: "USER_CONFIRMATION",
  CONFIRMED_EMERGENCY: "CONFIRMED_EMERGENCY",
  USER_CONFIRMED_SAFE: "USER_CONFIRMED_SAFE",
  CONTROL_ROOM_ESCALATION: "CONTROL_ROOM_ESCALATION",
  NO_HOSPITAL_AVAILABLE: "NO_HOSPITAL_AVAILABLE",
  NO_AMBULANCE_AVAILABLE: "NO_AMBULANCE_AVAILABLE",
};

const ROLES = {
  REPORTER: "reporter",
  AMBULANCE: "ambulance",
  HOSPITAL: "hospital",
  DISPATCH: "dispatch",
  DRIVER: "driver",
  CITIZEN: "citizen",
};

const SOUND = {
  QUIET: "quiet",
  CONFIRM: "confirm",
  ATTENTION: "attention",
  SIREN: "siren",
};

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

const TRANSITIONS = {
  accept: {
    from: [STATUS.AMBULANCE_OFFERED],
    roles: [ROLES.AMBULANCE],
    label: "Ambulance accepted the case",
    to: STATUS.AMBULANCE_ACCEPTED,
  },
  reject: {
    from: [STATUS.AMBULANCE_OFFERED],
    roles: [ROLES.AMBULANCE],
    label: "Ambulance declined the case",
    reassignAmbulance: true,
  },
  "at-patient": {
    from: [STATUS.AMBULANCE_ACCEPTED],
    roles: [ROLES.AMBULANCE],
    label: "Ambulance arrived at the patient",
    to: STATUS.AT_PATIENT,
  },
  pickup: {
    from: [STATUS.AT_PATIENT],
    roles: [ROLES.AMBULANCE],
    label: "Patient picked up by ambulance",
    assignHospital: true,
  },
  "request-hospital": {
    from: [
      STATUS.PICKED_UP,
      STATUS.HOSPITAL_OFFERED,
      STATUS.TO_HOSPITAL,
      STATUS.CONTROL_ROOM_ESCALATION,
    ],
    roles: [ROLES.AMBULANCE, ROLES.DISPATCH],
    label: "Hospital requested by authorized operator",
    requestHospital: true,
  },
  "accept-patient": {
    from: [STATUS.HOSPITAL_OFFERED, STATUS.TO_HOSPITAL],
    roles: [ROLES.HOSPITAL],
    label: "Hospital accepted the patient",
    hospitalResponse: "accept",
    to: STATUS.TO_HOSPITAL,
  },
  "conditional-accept": {
    from: [STATUS.HOSPITAL_OFFERED],
    roles: [ROLES.HOSPITAL],
    label: "Hospital conditionally accepted the patient",
    hospitalResponse: "conditional-accept",
    to: STATUS.TO_HOSPITAL,
  },
  "reject-patient": {
    from: [STATUS.HOSPITAL_OFFERED, STATUS.TO_HOSPITAL],
    roles: [ROLES.HOSPITAL],
    label: "Hospital declined — rerouting patient",
    hospitalResponse: "reject",
    reassignHospital: true,
  },
  "update-resources": {
    from: [
      STATUS.REPORTED,
      STATUS.AMBULANCE_OFFERED,
      STATUS.AMBULANCE_ACCEPTED,
      STATUS.HOSPITAL_OFFERED,
      STATUS.TO_HOSPITAL,
    ],
    roles: [ROLES.HOSPITAL],
    label: "Hospital resources updated",
    updateResources: true,
  },
  "arrived-hospital": {
    from: [STATUS.TO_HOSPITAL],
    roles: [ROLES.AMBULANCE],
    label: "Ambulance arrived at hospital",
    to: STATUS.ARRIVED_AT_HOSPITAL,
  },
  complete: {
    from: [STATUS.ARRIVED_AT_HOSPITAL],
    roles: [ROLES.AMBULANCE, ROLES.HOSPITAL, ROLES.DISPATCH],
    label: "Patient handed over — case resolved",
    to: STATUS.COMPLETED,
    terminal: true,
    endCorridor: true,
  },
  handover: {
    from: [STATUS.ARRIVED_AT_HOSPITAL],
    roles: [ROLES.AMBULANCE, ROLES.HOSPITAL, ROLES.DISPATCH],
    label: "Patient handed over — admitted for treatment",
    to: STATUS.IN_TREATMENT,
    handover: true,
    endCorridor: true,
  },
  discharge: {
    from: [STATUS.IN_TREATMENT],
    roles: [ROLES.HOSPITAL, ROLES.DISPATCH],
    label: "Patient discharged — case fully resolved",
    to: STATUS.COMPLETED,
    terminal: true,
    discharge: true,
  },
  "rate-hospital": {
    from: [STATUS.IN_TREATMENT, STATUS.COMPLETED],
    roles: [ROLES.REPORTER, ROLES.DRIVER],
    label: "Reporter rated the hospital",
    rateHospital: true,
  },
  cancel: {
    from: [
      STATUS.REPORTED,
      STATUS.AMBULANCE_OFFERED,
      STATUS.AMBULANCE_ACCEPTED,
      STATUS.AT_PATIENT,
      STATUS.PICKED_UP,
      STATUS.HOSPITAL_OFFERED,
      STATUS.TO_HOSPITAL,
      STATUS.USER_CONFIRMATION,
    ],
    roles: [ROLES.DISPATCH, ROLES.REPORTER],
    label: "Emergency cancelled",
    to: STATUS.CANCELLED,
    terminal: true,
  },
  "false-alarm": {
    from: [
      STATUS.REPORTED,
      STATUS.AMBULANCE_OFFERED,
      STATUS.AMBULANCE_ACCEPTED,
      STATUS.AT_PATIENT,
      STATUS.PICKED_UP,
      STATUS.HOSPITAL_OFFERED,
      STATUS.TO_HOSPITAL,
    ],
    roles: [ROLES.DISPATCH],
    label: "Marked as a false alarm",
    to: STATUS.CANCELLED,
    terminal: true,
  },

  /* ---- crash-detection state machine ---- */
  "crash-detect": {
    from: [],
    roles: [ROLES.REPORTER, ROLES.CITIZEN],
    label: "Potential crash detected",
    to: STATUS.POTENTIAL_CRASH,
    crashDetect: true,
  },
  "crash-confirm-safe": {
    from: [STATUS.POTENTIAL_CRASH, STATUS.USER_CONFIRMATION],
    roles: [ROLES.REPORTER, ROLES.CITIZEN, ROLES.DISPATCH],
    label: "User confirmed safe — emergency cancelled",
    to: STATUS.USER_CONFIRMED_SAFE,
    terminal: true,
  },
  "crash-confirm-emergency": {
    from: [STATUS.POTENTIAL_CRASH, STATUS.USER_CONFIRMATION, STATUS.CONFIRMED_EMERGENCY],
    roles: [ROLES.REPORTER, ROLES.CITIZEN],
    label: "Crash confirmed — creating emergency",
    crashConfirm: true,
  },

  /* ---- escalation / override ---- */
  escalate: {
    from: [
      STATUS.HOSPITAL_OFFERED,
      STATUS.PICKED_UP,
      STATUS.TO_HOSPITAL,
      STATUS.CONTROL_ROOM_ESCALATION,
    ],
    roles: [ROLES.DISPATCH],
    label: "Escalated to control room — manual coordination",
    to: STATUS.CONTROL_ROOM_ESCALATION,
  },
  "dispatch-override": {
    from: [STATUS.CONTROL_ROOM_ESCALATION, STATUS.HOSPITAL_OFFERED, STATUS.PICKED_UP],
    roles: [ROLES.DISPATCH],
    label: "Control room selected a hospital",
    dispatchOverride: true,
  },
  "expand-radius": {
    from: [
      STATUS.PICKED_UP,
      STATUS.HOSPITAL_OFFERED,
      STATUS.TO_HOSPITAL,
      STATUS.CONTROL_ROOM_ESCALATION,
      STATUS.NO_HOSPITAL_AVAILABLE,
    ],
    roles: [ROLES.DISPATCH],
    label: "Control room expanded the search radius",
    expandRadius: true,
  },
};

/* ------------------------------------------------------------------ */
/* Demo assets (clearly labelled as simulated in the UI)               */
/* ------------------------------------------------------------------ */

const ambulances = [
  {
    id: "AMB-001",
    driver: "Rajesh Kumar",
    vehicleNumber: "TS-09-AB-1234",
    location: { lat: 17.385, lng: 78.4867 },
    status: "AVAILABLE",
    type: "ALS",
    preferred: true,
  },
  {
    id: "AMB-002",
    driver: "Priya Sharma",
    vehicleNumber: "TS-09-CD-5678",
    location: { lat: 17.44, lng: 78.35 },
    status: "AVAILABLE",
    type: "BLS",
  },
  {
    id: "AMB-003",
    driver: "Imran Khan",
    vehicleNumber: "TS-09-EF-9101",
    location: { lat: 17.4034, lng: 78.4392 },
    status: "AVAILABLE",
    type: "BLS",
  },
];

const hospitals = [
  {
    id: "HOSP-001",
    name: "Apollo Emergency Center",
    location: { lat: 17.4326, lng: 78.4071 },
    availableBeds: 15,
    dedicatedBeds: 6,
    emergencyBeds: 4,
    icuBeds: 6,
    emergencyCapacity: "HIGH",
    currentLoad: 62,
    acceptanceStatus: "OPEN",
    specialties: ["Cardiology", "Neurology", "Trauma"],
    specialists: ["Cardiologist", "Neurologist", "Trauma Surgeon"],
    specialistsSoon: [],
    equipment: ["Cardiac Monitor", "Defibrillator", "Ventilator", "CT Scanner", "Trauma Kit", "Blood Bank", "Oxygen Supply"],
    resourceLastUpdated: new Date().toISOString(),
  },
  {
    id: "HOSP-002",
    name: "CityCare Hospital",
    location: { lat: 17.4239, lng: 78.4738 },
    availableBeds: 8,
    dedicatedBeds: 3,
    emergencyBeds: 3,
    icuBeds: 3,
    emergencyCapacity: "MEDIUM",
    currentLoad: 40,
    acceptanceStatus: "OPEN",
    specialties: ["Trauma", "Orthopedics"],
    specialists: ["Trauma Surgeon", "Orthopedic Surgeon"],
    specialistsSoon: [],
    equipment: ["Trauma Kit", "Ventilator", "X-Ray", "Oxygen Supply"],
    resourceLastUpdated: new Date().toISOString(),
  },
  {
    id: "HOSP-003",
    name: "Gandhi General Hospital",
    location: { lat: 17.4484, lng: 78.4954 },
    availableBeds: 20,
    dedicatedBeds: 10,
    emergencyBeds: 6,
    icuBeds: 10,
    emergencyCapacity: "HIGH",
    currentLoad: 28,
    acceptanceStatus: "OPEN",
    specialties: ["General", "Emergency"],
    specialists: ["Emergency Physician", "General Surgeon"],
    specialistsSoon: ["Cardiologist"],
    equipment: ["Trauma Kit", "Ventilator", "CT Scanner", "Blood Bank", "Oxygen Supply", "Defibrillator"],
    resourceLastUpdated: new Date().toISOString(),
  },
  {
    id: "HOSP-004",
    name: "Sunrise Neuro Center",
    location: { lat: 17.3951, lng: 78.4405 },
    availableBeds: 5,
    dedicatedBeds: 3,
    emergencyBeds: 2,
    icuBeds: 2,
    emergencyCapacity: "MEDIUM",
    currentLoad: 78,
    acceptanceStatus: "BYPASS",
    specialties: ["Neurology"],
    specialists: ["Neurologist", "Neuro Surgeon"],
    specialistsSoon: [],
    equipment: ["CT Scanner", "MRI", "Defibrillator"],
    resourceLastUpdated: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: "HOSP-005",
    name: "Greenfield Multispecialty",
    location: { lat: 17.47, lng: 78.37 },
    availableBeds: 18,
    dedicatedBeds: 8,
    emergencyBeds: 5,
    icuBeds: 8,
    emergencyCapacity: "HIGH",
    currentLoad: 35,
    acceptanceStatus: "OPEN",
    specialties: ["Cardiology", "General", "Trauma"],
    specialists: ["Cardiologist", "General Surgeon", "Trauma Surgeon"],
    specialistsSoon: [],
    equipment: ["Cardiac Monitor", "Defibrillator", "Ventilator", "Trauma Kit", "Blood Bank", "CT Scanner"],
    resourceLastUpdated: new Date(Date.now() - 25 * 60000).toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/* Demo citizen devices (in-memory registry, labelled SIMULATED)      */
/* ------------------------------------------------------------------ */

function seedCitizenDevices() {
  const devices = [];
  const anchors = [
    { lat: 17.428, lng: 78.42 },
    { lat: 17.435, lng: 78.44 },
    { lat: 17.445, lng: 78.47 },
    { lat: 17.415, lng: 78.46 },
    { lat: 17.45, lng: 78.43 },
  ];
  anchors.forEach((anchor, ai) => {
    for (let i = 0; i < 320; i++) {
      const lat = anchor.lat + (Math.random() - 0.5) * 0.05;
      const lng = anchor.lng + (Math.random() - 0.5) * 0.05;
      devices.push({
        id: `DEV-${ai}-${i}`,
        location: { lat, lng },
        simulated: true,
        notificationsEnabled: i % 4 !== 0,
      });
    }
  });
  return devices;
}

const SEVERITY_ORDER = { critical: 3, moderate: 2, minor: 1 };

const SEVERITY_TO_UNIT = { critical: "ALS", moderate: "BLS", minor: "BLS" };
const UNIT_TYPE_PENALTY = 2.5;
const PREFERRED_UNIT_BONUS = 1.2;
const BED_WEIGHT = 0.08;
const DEDICATED_BED_WEIGHT = 0.15;
const NEARLY_FULL_PENALTY = 4;

let CRASH_COUNTDOWN_MS = config.CRASH_DETECTION.countdownSeconds * 1000;
let AUTO_CANCEL_MS = 15000;

/* ------------------------------------------------------------------ */
/* In-memory state                                                    */
/* ------------------------------------------------------------------ */

const state = {
  emergencies: new Map(),
  ambulances,
  hospitals,
  citizenDevices: seedCitizenDevices(),
  serial: 1,
  autoCancelTimers: new Map(),
  crashTimers: new Map(),
  falseAlarms: new Map(),
};

/* ------------------------------------------------------------------ */
/* Sound plans                                                        */
/* ------------------------------------------------------------------ */

function soundPlan(action, em) {
  const base = {
    click: false,
    source: "server",
    reason: TRANSITIONS[action] ? TRANSITIONS[action].label : action,
    emergencyId: em.emergencyId,
  };

  switch (action) {
    case "create":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER], reason: "Emergency registered" },
        { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.DISPATCH], reason: "New emergency reported" },
        em.ambulanceId
          ? { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.AMBULANCE], reason: "New ambulance request", detail: `Assigned ${em.ambulance.name}` }
          : null,
      ].filter(Boolean);

    case "accept":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH], reason: "Ambulance accepted the case" },
      ];

    case "reject":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH], reason: "Ambulance declined — case reassigned" },
      ];

    case "at-patient":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH], reason: "Ambulance has arrived at the patient" },
      ];

    case "pickup":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH, ROLES.HOSPITAL], reason: "Patient picked up — hospital offered" },
      ];

    case "request-hospital":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.AMBULANCE, ROLES.DISPATCH], reason: "Destination confirmed by operator" },
      ];

    case "accept-patient":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.AMBULANCE, ROLES.REPORTER, ROLES.DISPATCH], reason: "Hospital accepted the patient" },
      ];

    case "conditional-accept":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.AMBULANCE, ROLES.REPORTER, ROLES.DISPATCH], reason: "Hospital accepted with conditions" },
      ];

    case "reject-patient":
      return [
        { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.AMBULANCE], reason: "Hospital unavailable — rerouting patient" },
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH, ROLES.HOSPITAL], reason: "Hospital reassigned to next-best" },
      ];

    case "escalate":
      return [
        { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.DISPATCH], reason: "Control room intervention required" },
        { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.AMBULANCE], reason: "No accepting hospital found — control room notified" },
      ];

    case "dispatch-override":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.AMBULANCE, ROLES.DISPATCH, ROLES.HOSPITAL], reason: "Control room selected a destination" },
      ];

    case "arrived-hospital":
      return [
        { ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH, ROLES.HOSPITAL], reason: "Patient has arrived at the hospital" },
      ];

    case "complete":
      return [{ ...base, sound: SOUND.CONFIRM, forRoles: ["all"], reason: "Emergency resolved" }];

    case "handover":
      return [{ ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH, ROLES.HOSPITAL], reason: "Patient handed over — admitted for treatment" }];

    case "discharge":
      return [{ ...base, sound: SOUND.CONFIRM, forRoles: ["all"], reason: "Patient discharged — case fully resolved" }];

    case "rate-hospital":
      return [{ ...base, sound: SOUND.QUIET, forRoles: [ROLES.REPORTER, ROLES.HOSPITAL, ROLES.DISPATCH], reason: "Hospital rated by patient/reporter" }];

    case "cancel":
      return [{ ...base, sound: SOUND.CONFIRM, forRoles: ["all"], reason: "Emergency cancelled" }];

    case "false-alarm":
      return [{ ...base, sound: SOUND.CONFIRM, forRoles: ["all"], reason: "False alarm — case cancelled" }];

    case "crash-detect":
      return [
        { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.REPORTER, ROLES.DISPATCH], reason: `Potential crash detected (confidence ${em.crashConfidence ?? 0}%)` },
      ];

    case "crash-confirm-safe":
      return [{ ...base, sound: SOUND.CONFIRM, forRoles: [ROLES.REPORTER, ROLES.DISPATCH], reason: "User OK — alert dismissed" }];

    case "crash-confirm-emergency":
      return [
        { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.DISPATCH], reason: "Unresponsive — emergency created" },
        em.ambulanceId
          ? { ...base, sound: SOUND.ATTENTION, forRoles: [ROLES.AMBULANCE], reason: "New ambulance request (crash detection)" }
          : null,
      ].filter(Boolean);

    default:
      return [{ ...base, sound: SOUND.QUIET, forRoles: ["all"] }];
  }
}

/* ------------------------------------------------------------------ */
/* Assignment helpers                                                  */
/* ------------------------------------------------------------------ */

function seedHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function trafficMultiplier(emergencyId, ambulanceId) {
  return 1 + (seedHash(emergencyId + ambulanceId) % 50) / 100;
}

function requiredUnit(em) {
  return SEVERITY_TO_UNIT[em.patient?.severity] || "BLS";
}

function ambulanceScore(em, a, distance) {
  const traffic = trafficMultiplier(em.emergencyId, a.id);
  let score = distance * traffic;
  if (a.type !== requiredUnit(em)) score += UNIT_TYPE_PENALTY;
  if (a.preferred) score -= PREFERRED_UNIT_BONUS;
  return { score, traffic };
}

function assignAmbulance(em, opts = {}) {
  const declined = em.declinedAmbulanceIds || [];
  const available = state.ambulances
    .filter((a) => a.status === "AVAILABLE" && !declined.includes(a.id))
    .map((a) => {
      const distance = calculateDistance(em.location.lat, em.location.lng, a.location.lat, a.location.lng);
      return { ambulance: a, distance, ...ambulanceScore(em, a, distance) };
    })
    .sort((x, y) => x.score - y.score);

  if (available.length === 0) {
    em.status = STATUS.NO_AMBULANCE_AVAILABLE;
    return false;
  }

  const { ambulance, distance, traffic } = available[0];
  em.ambulanceId = ambulance.id;
  em.ambulance = {
    id: ambulance.id,
    name: ambulance.driver,
    vehicleNumber: ambulance.vehicleNumber,
    type: ambulance.type,
    liveLocation: { ...ambulance.location },
  };
  em.etaToPatient = calculateETA(distance);
  em.dispatchNote = `Unit ${ambulance.id} (${ambulance.type}) • ${distance.toFixed(1)}km × ${traffic.toFixed(2)} traffic • severity ${em.patient?.severity || "moderate"}`;
  ambulance.status = "DISPATCHED";
  ambulance.assignedEmergency = em.emergencyId;
  if (!opts.keepStatus) em.status = STATUS.AMBULANCE_OFFERED;
  return true;
}

/* ------------------------------------------------------------------ */
/* Hospital recommendations + assignment                              */
/* ------------------------------------------------------------------ */

function generateRecommendations(em) {
  const result = recommender.recommend(em, state.hospitals);
  em.hospitalRecommendations = result.recommendations;
  em.requiredSpecialty = result.requiredSpecialty;
  em.requiredEquipment = result.requiredEquipment;
  return result;
}

function assignHospital(em) {
  const result = generateRecommendations(em);
  const top = result.top;
  if (!top) {
    em.hospitalId = null;
    em.hospital = null;
    em.status = STATUS.NO_HOSPITAL_AVAILABLE;
    pushTimeline(em, ROLES.DISPATCH, "no-hospital", "No eligible hospital available within the current search radius");
    bus.emit("hospital:state", { emergencyId: em.emergencyId, noHospitalAvailable: true });
    return false;
  }

  const hospital = top.hospital;
  em.hospitalId = hospital.id;
  em.hospital = {
    id: hospital.id,
    name: hospital.name,
    specialties: hospital.specialties,
    specialists: hospital.specialists,
    availableBeds: hospital.availableBeds,
    emergencyBeds: hospital.emergencyBeds,
    icuBeds: hospital.icuBeds,
    emergencyCapacity: hospital.emergencyCapacity,
    currentLoad: hospital.currentLoad,
    liveLocation: { ...hospital.location },
    resourceLastUpdated: hospital.resourceLastUpdated,
  };
  em.etaToHospital = calculateETA(top.distance);
  em.recommendation = top;
  em.hospitalRequest = recordHospitalRequest(em, hospital.id, top, null);

  if (em.status !== STATUS.TO_HOSPITAL) {
    em.status = STATUS.HOSPITAL_OFFERED;
  }
  return true;
}

function recordHospitalRequest(em, hospitalId, recommendation, condition) {
  const req = {
    hospitalId,
    requestedAt: new Date().toISOString(),
    respondedAt: null,
    response: null,
    conditions: condition || null,
    score: recommendation ? recommendation.score : null,
    scoreBreakdown: recommendation ? recommendation.scoreBreakdown : null,
    reasons: recommendation ? recommendation.reasons : [],
    eta: recommendation ? recommendation.eta : null,
    distance: recommendation ? recommendation.distance : null,
  };
  if (!em.hospitalRequests) em.hospitalRequests = [];
  em.hospitalRequests.push(req);
  return req;
}

/* -------------------- rejection + rerouting handling -------------------- */

function countRejections(em) {
  return (em.hospitalRequests || []).filter((r) => r.response === "reject").length;
}

function handleReroute(em, previousHospitalId, reasonData) {
  if (!em.rejectedHospitalIds) em.rejectedHospitalIds = [];
  if (previousHospitalId && !em.rejectedHospitalIds.includes(previousHospitalId)) {
    em.rejectedHospitalIds.push(previousHospitalId);
  }
  if (!em.offeredHospitalIds.includes(previousHospitalId)) {
    em.offeredHospitalIds.push(previousHospitalId);
  }

  const reasonLabel = reasonData?.reason ? reasonLabelFor(reasonData.reason) : "Operational reason";
  const detail = previousHospitalId
    ? `Hospital rejected — ${reasonLabel}`
    : "Hospital rejected — rerouting";

  const moved = assignHospital(em);
  const rejections = countRejections(em);

  if (moved && em.hospital) {
    pushTimeline(em, ROLES.HOSPITAL, "hospital-reassign", `Rerouting to next recommendation: ${em.hospital.name}`, { rejectReason: reasonData?.reason, rejectionCount: rejections }, { allowDuplicate: true });
    if (reasonData?.reason) {
      pushTimeline(em, ROLES.HOSPITAL, "hospital-reject", `Hospital unavailable — ${reasonLabel}`, {}, { allowDuplicate: true });
    }
  } else {
    em.status = STATUS.NO_HOSPITAL_AVAILABLE;
    pushTimeline(em, ROLES.DISPATCH, "no-hospital", "No eligible hospital available — control room escalation", { rejectionCount: rejections }, { allowDuplicate: true });
  }

  if (rejections >= config.HARD_CONSTRAINTS.maxRejectionsBeforeEscalation) {
    if (em.status !== STATUS.CONTROL_ROOM_ESCALATION) {
      em.status = STATUS.CONTROL_ROOM_ESCALATION;
      em.controlRoomEscalation = {
        triggeredAt: new Date().toISOString(),
        reason: `No suitable accepting hospital found within current search radius (${rejections} rejections)`,
        hospitalId: previousHospitalId,
      };
      pushTimeline(em, ROLES.DISPATCH, "escalate", "Control Room intervention required — no suitable accepting hospital found within current search radius", { rejectionCount: rejections });
      bus.emit("escalation:triggered", {
        emergencyId: em.emergencyId,
        emergency: snapshot(em),
        message: "No suitable accepting hospital found within current search radius",
      });
    }
  }

  return moved;
}

function reasonLabelFor(id) {
  const r = config.REJECT_REASONS.find((x) => x.id === id);
  return r ? r.label : "Operational reason";
}

/* -------------------- green corridor lifecycle -------------------- */

function activateGreenCorridor(em) {
  const users = state.citizenDevices.filter((d) => d.notificationsEnabled !== false);
  const current = corridor.computeCorridor(em, users, config.CORRIDOR_CONFIG.defaultWidthKm);
  if (!current) return null;
  em.greenCorridor = current;
  pushTimeline(em, "system", "corridor-activate", `Green corridor activated — ${current.notifiedUsers} nearby users notified`, {}, { allowDuplicate: true });
  bus.emit("corridor:updated", { emergencyId: em.emergencyId, corridor: current });
  bus.emit("green-corridor:alert", {
    corridor: current,
    notificationText: current.notificationText,
    emergency: snapshot(em),
  });
  return current;
}

function endGreenCorridor(em) {
  if (em.greenCorridor?.active) {
    em.greenCorridor = corridor.endCorridor();
    pushTimeline(em, "system", "corridor-end", "Green corridor ended", {}, { allowDuplicate: true });
    bus.emit("corridor:updated", { emergencyId: em.emergencyId, corridor: em.greenCorridor });
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function createEmergency({ kind, reporter, patient, location, confidence }) {
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    throw Object.assign(new Error("A valid location (lat/lng) is required"), { code: "BAD_REQUEST" });
  }

  const now = new Date();
  const serialId = String(state.serial++).padStart(4, "0");
  const emergencyId = `EM-${serialId}`;
  const caseRef = `RR-${now.getFullYear()}-${serialId}`;

  const isCrash = kind === "CRASH_DETECTION";

  const em = {
    emergencyId,
    caseRef,
    kind: isCrash ? "CRASH_DETECTION" : kind || "SELF_USE",
    reporter: reporter || { name: "Anonymous", via: "self" },
    patient: {
      name: patient?.name || "Unknown",
      age: patient?.age ?? null,
      bloodGroup: patient?.bloodGroup || "Unknown",
      allergies: patient?.allergies || "None listed",
      condition: patient?.condition || "Emergency reported",
      severity: patient?.severity || "moderate",
    },
    location: { lat: location.lat, lng: location.lng, label: location.label || "Location confirmed" },
    status: isCrash ? STATUS.POTENTIAL_CRASH : STATUS.REPORTED,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ambulanceId: null,
    ambulance: null,
    hospitalId: null,
    hospital: null,
    etaToPatient: null,
    etaToHospital: null,
    offeredHospitalIds: [],
    rejectedHospitalIds: [],
    declinedAmbulanceIds: [],
    hospitalRequests: [],
    hospitalRecommendations: [],
    requiredSpecialty: null,
    requiredEquipment: [],
    recommendation: null,
    greenCorridor: null,
    crashConfidence: isCrash ? confidence ?? 80 : null,
    timeline: [],
    sirenOn: false,
  };

  state.emergencies.set(emergencyId, em);

  if (isCrash) {
    em.status = STATUS.POTENTIAL_CRASH;
    pushTimeline(em, ROLES.REPORTER, "crash-detect", `Potential crash detected — confidence ${em.crashConfidence}%`, { confidence: em.crashConfidence, category: "crash" });
    pushTimeline(em, ROLES.REPORTER, "crash-countdown", `Verification countdown started (${CRASH_COUNTDOWN_MS / 1000}s) — awaiting confirmation`, {}, { allowDuplicate: true });
    scheduleCrashAutoConfirm(emergencyId);
  } else {
    pushTimeline(em, ROLES.REPORTER, "create", "Emergency reported");
    assignAmbulance(em);
    scheduleAutoCancel(emergencyId);
  }

  publish(em);
  bus.emit("sound:event", { sounds: soundPlan(isCrash ? "crash-detect" : "create", em), emergency: snapshot(em) });
  bus.emit("emergency:created", snapshot(em));
  return snapshot(em);
}

function applyAction(emergencyId, action, opts = {}) {
  const em = state.emergencies.get(emergencyId);
  if (!em) throw Object.assign(new Error(`Emergency ${emergencyId} not found`), { code: "NOT_FOUND" });

  const rule = TRANSITIONS[action];
  if (!rule) throw Object.assign(new Error(`Unknown action: ${action}`), { code: "BAD_REQUEST" });

  if (!rule.roles.includes(opts.role)) {
    throw Object.assign(new Error(`Role '${opts.role}' is not allowed to perform '${action}'`), { code: "FORBIDDEN" });
  }

  if (rule.terminal) {
    if (em.status === STATUS.COMPLETED || em.status === STATUS.CANCELLED || em.status === STATUS.USER_CONFIRMED_SAFE) return snapshot(em);
  }

  // crash-detect is special: it is only triggered via createEmergency kind CRASH_DETECTION.
  if (action === "crash-detect") {
    throw Object.assign(new Error("Use CRASH_DETECTION on create to start a crash flow"), { code: "BAD_REQUEST" });
  }

  if (!rule.from.includes(em.status)) {
    throw Object.assign(
      new Error(`Cannot '${action}' while status is '${em.status}' (${rule.label})`),
      { code: "INVALID_STATE", currentStatus: em.status }
    );
  }

  if (rule.roles.includes(ROLES.AMBULANCE) && opts.ambulanceId && opts.ambulanceId !== em.ambulanceId) {
    throw Object.assign(new Error("This ambulance is not assigned to the emergency"), { code: "FORBIDDEN" });
  }

  if (rule.roles.includes(ROLES.HOSPITAL) && opts.hospitalId && opts.hospitalId !== em.hospitalId) {
    throw Object.assign(new Error("This hospital is not the assigned destination"), { code: "FORBIDDEN" });
  }

  // ---------- hospital request validation ----------
  if (rule.requestHospital) {
    if (!opts.hospitalId) {
      throw Object.assign(new Error("A hospitalId is required to request admission"), { code: "BAD_REQUEST" });
    }
    const rec = (em.hospitalRecommendations || []).find((r) => r.hospital.id === opts.hospitalId);
    if (!rec) throw Object.assign(new Error("Hospital is not in the current recommendations"), { code: "BAD_REQUEST" });
    if (!rec.eligible) throw Object.assign(new Error("Requested hospital is ineligible for this emergency"), { code: "FORBIDDEN" });
    em.hospitalRequest = recordHospitalRequest(em, opts.hospitalId, rec, null);
    em.hospitalId = opts.hospitalId;
    const h = state.hospitals.find((x) => x.id === opts.hospitalId);
    em.hospital = hospitalSnapshotOf(h);
    em.etaToHospital = calculateETA(rec.distance);
    em.recommendation = rec;
    if (em.status !== STATUS.TO_HOSPITAL) em.status = STATUS.HOSPITAL_OFFERED;
    pushTimeline(em, opts.role, "hospital-request", `Admission requested at ${h.name} by authorized operator`, {}, { allowDuplicate: true });
  }

  // ---------- reject-patient reason validation ----------
  if (action === "reject-patient") {
    if (!opts.rejectReason) {
      throw Object.assign(new Error("A legitimate operational reject reason is required"), { code: "BAD_REQUEST" });
    }
    const valid = config.REJECT_REASONS.some((r) => r.id === opts.rejectReason);
    if (!valid) {
      throw Object.assign(new Error("Reject reason is not from the authorized list"), { code: "BAD_REQUEST" });
    }
  }

  // ---------- conditional-accept requires conditions ----------
  if (action === "conditional-accept") {
    if (!opts.conditions || !String(opts.conditions).trim()) {
      throw Object.assign(new Error("A condition/limitation is required for a conditional accept"), { code: "BAD_REQUEST" });
    }
  }

  const previousHospitalId = em.hospitalId;
  const previousAmbulanceId = em.ambulanceId;

  if (rule.to) {
    em.status = rule.to;
  }

  em.updatedAt = new Date().toISOString();
  pushTimeline(em, opts.role, action, rule.label, { actor: opts.actor, category: categoryFor(action) });

  /* ---- crash confirmation: convert to a normal emergency ---- */
  if (rule.crashConfirm) {
    clearCrashTimer(emergencyId);
    em.status = STATUS.CONFIRMED_EMERGENCY;
    pushTimeline(em, opts.role, "crash-confirmed", "Crash confirmed — creating emergency case", { category: "crash" }, { allowDuplicate: true });
    em.status = STATUS.REPORTED;
    assignAmbulance(em);
    if (!em.ambulanceId) {
      em.status = STATUS.NO_AMBULANCE_AVAILABLE;
    }
    pushTimeline(em, "system", "create", "Emergency case created from crash detection", { category: "crash" }, { allowDuplicate: true });
    scheduleAutoCancel(emergencyId);
  }

  if (rule.reassignAmbulance) {
    if (!em.declinedAmbulanceIds) em.declinedAmbulanceIds = [];
    if (previousAmbulanceId) em.declinedAmbulanceIds.push(previousAmbulanceId);
    markAmbulanceAvailable(previousAmbulanceId);
    em.ambulanceId = null;
    em.ambulance = null;
    em.etaToPatient = null;
    const reassigned = assignAmbulance(em);
    pushTimeline(em, opts.role, "reassign", reassigned ? `Reassigned to ${em.ambulance.name}` : "No ambulance available — searching", {}, { allowDuplicate: true });
    if (!reassigned) {
      em.status = STATUS.NO_AMBULANCE_AVAILABLE;
      em.updatedAt = new Date().toISOString();
    }
  }

  if (rule.assignHospital) {
    const assigned = assignHospital(em);
    pushTimeline(em, opts.role, "hospital-offer", assigned && em.hospital
      ? `Hospital recommended: ${em.hospital.name} (score ${em.recommendation?.score ?? "?"})`
      : "No eligible hospital available", {}, { allowDuplicate: true });
    bus.emit("recommendations:updated", { emergencyId: em.emergencyId, emergency: snapshot(em) });
  }

  if (rule.hospitalResponse) {
    const req = (em.hospitalRequests || []).slice(-1)[0];
    if (req) {
      req.response = rule.hospitalResponse;
      req.respondedAt = new Date().toISOString();
      if (action === "conditional-accept") req.conditions = opts.conditions;
      if (action === "reject-patient") req.rejectReason = opts.rejectReason;
    }
  }

  if (rule.reassignHospital) {
    handleReroute(em, previousHospitalId, { reason: opts.rejectReason });
    const rerouteDetail = em.recommendation && em.hospital
      ? `Hospital unavailable — rerouting to ${em.hospital.name}`
      : "Hospital unavailable — rerouting patient";
    bus.emit("hospital:rejected", {
      emergencyId: em.emergencyId,
      hospitalId: previousHospitalId,
      reason: opts.rejectReason || null,
      reasonLabel: opts.rejectReason ? reasonLabelFor(opts.rejectReason) : null,
      nextHospitalId: em.hospitalId,
      emergency: snapshot(em),
    });
    bus.emit("recommendations:updated", { emergencyId: em.emergencyId, emergency: snapshot(em) });
  }

  if (rule.dispatchOverride) {
    const h = state.hospitals.find((x) => x.id === opts.hospitalId);
    if (!h) throw Object.assign(new Error("Specified hospital not found"), { code: "NOT_FOUND" });
    em.hospitalId = h.id;
    em.hospital = hospitalSnapshotOf(h);
    em.hospitalRequest = recordHospitalRequest(em, h.id, null, null);
    em.etaToHospital = calculateETA(calculateDistance(em.location.lat, em.location.lng, h.location.lat, h.location.lng));
    em.controlRoomEscalation = null;
    em.status = STATUS.HOSPITAL_OFFERED;
    pushTimeline(em, ROLES.DISPATCH, "dispatch-override", `Control room selected ${h.name}`, { actor: opts.actor }, { allowDuplicate: true });
  }

  if (rule.expandRadius) {
    const previous = em.offeredHospitalIds || [];
    const eligible = state.hospitals.filter((h) => !previous.includes(h.id));
    if (eligible.length > 0) {
      const result = assignHospital(em);
      if (result) {
        pushTimeline(em, ROLES.DISPATCH, "radius-expand", `Search radius expanded — recommended ${em.hospital.name}`, {}, { allowDuplicate: true });
      } else {
        em.status = STATUS.NO_HOSPITAL_AVAILABLE;
      }
    } else {
      em.status = STATUS.NO_HOSPITAL_AVAILABLE;
    }
    if (!em.hospitalId) {
      pushTimeline(em, ROLES.DISPATCH, "no-hospital", "No accepting hospital found — control room monitoring", {}, { allowDuplicate: true });
    }
  }

  if (rule.updateResources) {
    const h = state.hospitals.find((x) => x.id === opts.hospitalId);
    if (!h) throw Object.assign(new Error("Hospital not found"), { code: "NOT_FOUND" });
    const patch = opts.resources || {};
    if (typeof patch.emergencyBeds === "number") h.emergencyBeds = Math.max(0, patch.emergencyBeds);
    if (typeof patch.availableBeds === "number") h.availableBeds = Math.max(0, patch.availableBeds);
    if (typeof patch.currentLoad === "number") h.currentLoad = Math.max(0, Math.min(100, patch.currentLoad));
    if (Array.isArray(patch.equipment)) h.equipment = patch.equipment;
    h.resourceLastUpdated = new Date().toISOString();
    pushTimeline(em, opts.role, "resources-updated", `${h.name} resource data refreshed`, {}, { allowDuplicate: true });
    bus.emit("hospital:resources", { hospitalId: h.id, hospital: h, at: new Date().toISOString() });
  }

  /* ---- green corridor on hospital accept / conditional accept ---- */
  if ((action === "accept-patient" || action === "conditional-accept") && em.status === STATUS.TO_HOSPITAL) {
    activateGreenCorridor(em);
  }

  if (action === "false-alarm") logFalseAlarm(em);

  if (!isUnconfirmed(em) || ["COMPLETED", "CANCELLED", "USER_CONFIRMED_SAFE"].includes(em.status)) {
    clearAutoCancelTimer(emergencyId);
  } else if (rule.reassignAmbulance) {
    scheduleAutoCancel(emergencyId);
  }

  /* ---- reporter/patient rates the hospital (feedback, non-transitional) ---- */
  if (rule.rateHospital) {
    const score = opts.rating != null ? Number(opts.rating) : null;
    if (score != null && (score < 1 || score > 5)) {
      throw Object.assign(new Error("Rating must be a number between 1 and 5"), { code: "BAD_REQUEST" });
    }
    em.hospitalRating = {
      score,
      comment: opts.ratingComment || "",
      categories: opts.ratingCategories || {},
      ratedBy: opts.role || "reporter",
      ratedAt: new Date().toISOString(),
    };
    pushTimeline(em, opts.role, "hospital-rated", `Patient/reporter rated the hospital ${score != null ? `${score}/5` : ""}`, {}, { allowDuplicate: true });
  }

  if (rule.endCorridor) {
    endGreenCorridor(em);
  }

  /* Handing the patient over frees the ambulance for the next case, but the
     case stays LIVE (IN_TREATMENT) until the hospital discharges the patient. */
  if (em.status === STATUS.IN_TREATMENT || (["COMPLETED", "CANCELLED", "USER_CONFIRMED_SAFE"].includes(em.status) && rule.terminal)) {
    if (em.ambulanceId) markAmbulanceAvailable(em.ambulanceId);
    em.sirenOn = false;
  }

  if (em.status === STATUS.ARRIVED_AT_HOSPITAL || em.status === STATUS.IN_TREATMENT) {
    endGreenCorridor(em);
  }

  publish(em);
  bus.emit("sound:event", { sounds: soundPlan(action, em), emergency: snapshot(em) });
  return snapshot(em);
}

function categoryFor(action) {
  if (["crash-detect", "crash-confirm-safe", "crash-confirm-emergency", "crash-confirmed"].includes(action)) return "crash";
  if (["accept-patient", "conditional-accept", "reject-patient", "update-resources", "hospital-reject", "hospital-offer", "discharge", "handover"].includes(action)) return "hospital";
  if (["accept", "reject", "at-patient", "pickup", "arrived-hospital", "request-hospital"].includes(action)) return "ambulance";
  if (["escalate", "dispatch-override", "expand-radius", "false-alarm", "cancel", "complete"].includes(action)) return "control";
  if (["create", "hospital-reassign", "reassign", "corridor-activate", "corridor-end", "no-hospital", "radius-expand", "resources-updated", "auto-cancel", "siren-on", "siren-off", "hospital-rated"].includes(action)) return "system";
  return "system";
}

function hospitalSnapshotOf(h) {
  if (!h) return null;
  return {
    id: h.id,
    name: h.name,
    specialties: h.specialties,
    specialists: h.specialists,
    availableBeds: h.availableBeds,
    emergencyBeds: h.emergencyBeds,
    icuBeds: h.icuBeds,
    emergencyCapacity: h.emergencyCapacity,
    currentLoad: h.currentLoad,
    liveLocation: { ...h.location },
    resourceLastUpdated: h.resourceLastUpdated,
  };
}

function missingEquipmentFor(em) {
  const eq = recommender.requiredEquipment(em);
  return eq.filter((e) => !em.hospital?.equipment?.includes(e));
}

/* ------------------------------------------------------------------ */
/* Siren + simulated ambulance movement                                */
/* ------------------------------------------------------------------ */

function toggleSiren({ ambulanceId, emergencyId, on }) {
  const em = state.emergencies.get(emergencyId) || findEmergencyByAmbulance(ambulanceId);
  if (!em) throw Object.assign(new Error("No active emergency for this ambulance"), { code: "NOT_FOUND" });

  if (em.ambulanceId !== ambulanceId) {
    throw Object.assign(new Error("This ambulance is not assigned to the emergency"), { code: "FORBIDDEN" });
  }

  em.sirenOn = typeof on === "boolean" ? on : !em.sirenOn;
  pushTimeline(em, ROLES.AMBULANCE, em.sirenOn ? "siren-on" : "siren-off", em.sirenOn ? "Siren activated — nearby drivers alerted" : "Siren off");

  const payload = {
    on: em.sirenOn,
    ambulanceId,
    emergencyId: em.emergencyId,
    location: em.ambulance?.liveLocation || em.location,
    at: new Date().toISOString(),
  };

  bus.emit("siren:changed", payload);
  publish(em);
  return payload;
}

function moveAmbulance({ ambulanceId, lat, lng }) {
  const a = state.ambulances.find((x) => x.id === ambulanceId);
  if (!a) throw Object.assign(new Error("Ambulance not found"), { code: "NOT_FOUND" });

  a.location = { lat, lng };
  a.liveLocation = { lat, lng };

  for (const em of state.emergencies.values()) {
    if (em.ambulanceId === ambulanceId && em.ambulance) {
      em.ambulance.liveLocation = { lat, lng };
      em.updatedAt = new Date().toISOString();
      const distance = calculateDistance(em.location.lat, em.location.lng, lat, lng);
      em.etaToPatient = distance > 0.15 ? calculateETA(distance) : null;
    }
  }

  bus.emit("ambulance:moved", { ambulanceId, location: { lat, lng }, at: new Date().toISOString() });
  return { ambulanceId, location: { lat, lng } };
}

/* ------------------------------------------------------------------ */
/* Citizen device registration (green corridor awareness)             */
/* ------------------------------------------------------------------ */

function registerCitizen(citizen) {
  if (!state.citizens) state.citizens = new Map();
  state.citizens.set(citizen.deviceId || citizen.socketId, {
    deviceId: citizen.deviceId || citizen.socketId,
    location: citizen.location || { lat: 17.42, lng: 78.44 },
    notificationsEnabled: citizen.notificationsEnabled !== false,
    registeredAt: new Date().toISOString(),
  });
  return state.citizens.size;
}

function unregisterCitizen(socketId) {
  if (state.citizens) state.citizens.delete(socketId);
}

function listCitizens() {
  return state.citizens ? [...state.citizens.values()] : [];
}

function corridorForEmergency(emergencyId) {
  const em = state.emergencies.get(emergencyId);
  if (!em) throw Object.assign(new Error("Emergency not found"), { code: "NOT_FOUND" });
  return {
    emergencyId: em.emergencyId,
    corridor: em.greenCorridor || null,
    status: em.greenCorridor?.status || "NONE",
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

function listEmergencies(opts = {}) {
  let list = [...state.emergencies.values()];
  if (opts.status) list = list.filter((e) => e.status === opts.status);
  if (opts.activeOnly) list = list.filter((e) => !["COMPLETED", "CANCELLED", "USER_CONFIRMED_SAFE"].includes(e.status));
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(snapshot);
}

function getEmergency(emergencyId) {
  const em = state.emergencies.get(emergencyId);
  return em ? snapshot(em) : null;
}

function getRecommendations(emergencyId) {
  const em = state.emergencies.get(emergencyId);
  if (!em) throw Object.assign(new Error("Emergency not found"), { code: "NOT_FOUND" });
  return {
    emergencyId: em.emergencyId,
    recommendations: (em.hospitalRecommendations || []).map((r) => ({
      rank: r.rank,
      eligible: r.eligible,
      score: r.score,
      scoreBreakdown: r.scoreBreakdown,
      reasons: r.reasons,
      problems: r.problems,
      distance: r.distance,
      eta: r.eta,
      freshness: r.freshness,
      staleMinutes: r.staleMinutes,
      hospital: {
        id: r.hospital.id,
        name: r.hospital.name,
        distance: r.distance,
        eta: r.eta,
        emergencyBeds: r.hospital.emergencyBeds,
        emergencyCapacity: r.hospital.emergencyCapacity,
        currentLoad: r.hospital.currentLoad,
        acceptanceStatus: r.hospital.acceptanceStatus,
        specialties: r.hospital.specialties,
        specialists: r.hospital.specialists,
        equipment: r.hospital.equipment,
        resourceLastUpdated: r.hospital.resourceLastUpdated,
      },
    })),
    requiredSpecialty: em.requiredSpecialty,
    requiredEquipment: em.requiredEquipment,
  };
}

function listAmbulances() {
  return state.ambulances.map((a) => ({
    id: a.id,
    driver: a.driver,
    vehicleNumber: a.vehicleNumber,
    type: a.type,
    location: { ...a.location },
    status: a.status,
    assignedEmergency: a.assignedEmergency || null,
  }));
}

function listHospitals() {
  return state.hospitals.map((h) => ({
    ...h,
    location: { ...h.location },
    freshness: resourceFreshness(h),
  }));
}

function resourceFreshness(h) {
  const minutes = h.resourceLastUpdated
    ? Math.max(0, (Date.now() - new Date(h.resourceLastUpdated).getTime()) / 60000)
    : 0;
  if (minutes <= config.HARD_CONSTRAINTS.staleDataThresholdMinutes) return "LIVE";
  if (minutes <= config.HARD_CONSTRAINTS.veryStaleDataThresholdMinutes) return "RECENT";
  return "STALE";
}

function metrics() {
  const list = [...state.emergencies.values()];
  const activeCases = list.filter((e) => !["COMPLETED", "CANCELLED", "USER_CONFIRMED_SAFE"].includes(e.status)).length;

  let responseMs = 0;
  let samples = 0;
  for (const em of list) {
    const accept = em.timeline.find((t) => t.action === "accept");
    if (accept) {
      responseMs += new Date(accept.at).getTime() - new Date(em.createdAt).getTime();
      samples += 1;
    }
  }

  const sirenActivations = list.reduce(
    (n, em) => n + em.timeline.filter((t) => t.action === "siren-on").length,
    0
  );

  return {
    activeCases,
    avgResponseSeconds: samples ? Math.round(responseMs / samples / 1000) : null,
    responseSamples: samples,
    sirenActivations,
    falseAlarms: [...state.falseAlarms.values()].reduce((n, r) => n + r.count, 0),
  };
}

function listFalseAlarms() {
  return [...state.falseAlarms.entries()]
    .map(([account, rec]) => ({ account, count: rec.count, lastAt: rec.lastAt }))
    .sort((a, b) => b.count - a.count);
}

function registerDriver(driver) {
  if (!state.drivers) state.drivers = new Map();
  state.drivers.set(driver.socketId, {
    name: driver.name || "Nearby driver",
    location: driver.location || { lat: 17.42, lng: 78.44 },
    registeredAt: new Date().toISOString(),
  });
  return state.drivers.size;
}

function unregisterDriver(socketId) {
  if (state.drivers) state.drivers.delete(socketId);
}

function listDrivers() {
  return state.drivers ? [...state.drivers.values()] : [];
}

function listCitizenNotifications() {
  return state.citizens ? [...state.citizens.values()] : [];
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function markAmbulanceAvailable(ambulanceId) {
  const a = state.ambulances.find((x) => x.id === ambulanceId);
  if (a) {
    a.status = "AVAILABLE";
    a.assignedEmergency = null;
  }
}

function findEmergencyByAmbulance(ambulanceId) {
  for (const em of state.emergencies.values()) {
    if (em.ambulanceId === ambulanceId && !["COMPLETED", "CANCELLED", "USER_CONFIRMED_SAFE"].includes(em.status)) {
      return em;
    }
  }
  return null;
}

const UNCONFIRMED_STATUSES = [STATUS.REPORTED, STATUS.AMBULANCE_OFFERED];

function isUnconfirmed(em) {
  return UNCONFIRMED_STATUSES.includes(em.status);
}

function clearAutoCancelTimer(emergencyId) {
  const t = state.autoCancelTimers.get(emergencyId);
  if (t) {
    clearTimeout(t);
    state.autoCancelTimers.delete(emergencyId);
  }
}

function scheduleAutoCancel(emergencyId) {
  clearAutoCancelTimer(emergencyId);
  state.autoCancelTimers.set(
    emergencyId,
    setTimeout(() => autoCancel(emergencyId), AUTO_CANCEL_MS)
  );
}

function autoCancel(emergencyId) {
  state.autoCancelTimers.delete(emergencyId);
  const em = state.emergencies.get(emergencyId);
  if (!em || !isUnconfirmed(em)) return;

  em.status = STATUS.CANCELLED;
  em.updatedAt = new Date().toISOString();
  em.sirenOn = false;
  if (em.ambulanceId) markAmbulanceAvailable(em.ambulanceId);
  pushTimeline(em, ROLES.DISPATCH, "auto-cancel", `Auto-cancelled — no confirmation within ${AUTO_CANCEL_MS / 1000}s`);

  publish(em);
  bus.emit("sound:event", { sounds: soundPlan("cancel", em), emergency: snapshot(em) });
}

/* ---------------- crash countdown auto-confirmation ---------------- */

function scheduleCrashAutoConfirm(emergencyId) {
  clearCrashTimer(emergencyId);
  state.crashTimers.set(
    emergencyId,
    setTimeout(() => {
      state.crashTimers.delete(emergencyId);
      const em = state.emergencies.get(emergencyId);
      if (!em || !["POTENTIAL_CRASH", "USER_CONFIRMATION"].includes(em.status)) return;
      try {
        applyAction(emergencyId, "crash-confirm-emergency", { role: ROLES.REPORTER, actor: "auto (countdown)" });
      } catch {
        /* no-op */
      }
    }, CRASH_COUNTDOWN_MS)
  );
}

function clearCrashTimer(emergencyId) {
  const t = state.crashTimers.get(emergencyId);
  if (t) {
    clearTimeout(t);
    state.crashTimers.delete(emergencyId);
  }
}

function reporterAccountKey(em) {
  return em.reporter?.username || em.reporter?.name || "unknown";
}

function logFalseAlarm(em) {
  const key = reporterAccountKey(em);
  const rec = state.falseAlarms.get(key) || { count: 0, lastAt: null };
  rec.count += 1;
  rec.lastAt = new Date().toISOString();
  state.falseAlarms.set(key, rec);
}

function pushTimeline(em, role, action, detail, meta, opts = {}) {
  if (!opts.allowDuplicate && em.timeline[em.timeline.length - 1]?.action === action) return;
  em.timeline.push({
    at: new Date().toISOString(),
    role,
    action,
    detail,
    category: meta?.category || categoryFor(action),
    ...(meta || {}),
  });
}

function snapshot(em) {
  return {
    ...em,
    ambulance: em.ambulance ? { ...em.ambulance, liveLocation: em.ambulance.liveLocation || em.ambulance.location } : null,
    hospital: em.hospital ? { ...em.hospital } : null,
    location: { ...em.location },
    timeline: [...em.timeline],
    offeredHospitalIds: [...(em.offeredHospitalIds || [])],
    rejectedHospitalIds: [...(em.rejectedHospitalIds || [])],
    declinedAmbulanceIds: [...(em.declinedAmbulanceIds || [])],
    hospitalRequests: [...(em.hospitalRequests || [])],
    hospitalRecommendations: (em.hospitalRecommendations || []).map((r) => ({
      rank: r.rank,
      eligible: r.eligible,
      score: r.score,
      scoreBreakdown: r.scoreBreakdown,
      reasons: r.reasons,
      problems: r.problems,
      distance: r.distance,
      eta: r.eta,
      freshness: r.freshness,
      staleMinutes: r.staleMinutes,
      hospital: hospitalSnapshotOf(r.hospital),
    })),
    greenCorridor: em.greenCorridor ? { ...em.greenCorridor } : null,
    recommendation: em.recommendation ? { ...em.recommendation, hospital: em.recommendation.hospital ? { ...em.recommendation.hospital } : null } : null,
  };
}

function publish(em) {
  bus.emit("emergency:updated", snapshot(em));
}

/* ------------------------------------------------------------------ */
/* Seed / reset                                                        */
/* ------------------------------------------------------------------ */

function reset() {
  state.emergencies.clear();
  state.autoCancelTimers.forEach((t) => clearTimeout(t));
  state.autoCancelTimers.clear();
  state.crashTimers.forEach((t) => clearTimeout(t));
  state.crashTimers.clear();
  state.falseAlarms.clear();
  state.ambulances.forEach((a) => {
    a.status = "AVAILABLE";
    a.assignedEmergency = null;
    a.location = a._originalLocation ? { ...a._originalLocation } : a.location;
  });
  state.hospitals.forEach((h) => {
    h.acceptanceStatus = "OPEN";
    h.currentLoad = h._originalLoad ?? h.currentLoad;
    h.emergencyBeds = h._originalEmergencyBeds ?? h.emergencyBeds;
    h.availableBeds = h._originalBeds ?? h.availableBeds;
  });
  if (state.drivers) state.drivers.clear();
  state.serial = 1;
}

function setAutoCancelWindow(ms) {
  AUTO_CANCEL_MS = Math.max(0, Number(ms) || 0);
  return AUTO_CANCEL_MS;
}

function getAutoCancelWindow() {
  return AUTO_CANCEL_MS;
}

function setCrashCountdown(ms) {
  CRASH_COUNTDOWN_MS = Math.max(50, Number(ms) || config.CRASH_DETECTION.countdownSeconds * 1000);
  return CRASH_COUNTDOWN_MS;
}

function getCrashCountdown() {
  return CRASH_COUNTDOWN_MS;
}

function getScoringConfig() {
  return {
    weights: config.WEIGHTS,
    hardConstraints: config.HARD_CONSTRAINTS,
  };
}

ambulances.forEach((a) => {
  a._originalLocation = { ...a.location };
});
hospitals.forEach((h) => {
  h._originalLoad = h.currentLoad;
  h._originalEmergencyBeds = h.emergencyBeds;
  h._originalBeds = h.availableBeds;
});

module.exports = {
  STATUS,
  ROLES,
  SOUND,
  TRANSITIONS,
  REJECT_REASONS: config.REJECT_REASONS,
  createEmergency,
  applyAction,
  toggleSiren,
  moveAmbulance,
  listEmergencies,
  getEmergency,
  getRecommendations,
  listAmbulances,
  listHospitals,
  metrics,
  listFalseAlarms,
  setAutoCancelWindow,
  getAutoCancelWindow,
  setCrashCountdown,
  getCrashCountdown,
  getScoringConfig,
  registerDriver,
  unregisterDriver,
  listDrivers,
  registerCitizen,
  unregisterCitizen,
  listCitizens,
  corridorForEmergency,
  reset,
  SEVERITY_ORDER,
};