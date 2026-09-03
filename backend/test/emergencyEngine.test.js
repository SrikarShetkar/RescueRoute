/**
 * emergencyEngine.test.js — verifies the state machine rules with Node's
 * built-in test runner. Run with: npm test (server).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../domain/emergencyEngine");

const { STATUS, ROLES } = engine;

function makeEmergency(overrides = {}) {
  return engine.createEmergency({
    kind: "SELF_USE",
    reporter: { name: "Test One", via: "self" },
    patient: { name: "Patient A", severity: "critical" },
    location: { lat: 17.4065, lng: 78.4772, label: "Test Junction" },
    ...overrides,
  });
}

function expectError(fn, code) {
  let threw = null;
  try {
    fn();
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, "expected the call to throw");
  assert.equal(threw.code, code, `expected code ${code}, got ${threw.message}`);
}

test.beforeEach(() => {
  engine.reset();
  engine.setAcceptanceWindow(60000);
  engine.setHospitalRequestTimeout(60000);
});

test("a new emergency is offered to the nearest available ambulance", () => {
  const em = engine.getEmergency(makeEmergency().emergencyId);
  assert.equal(em.status, STATUS.AMBULANCE_OFFERED);
  assert.ok(em.ambulanceId, "an ambulance must be proposed");
  assert.ok(em.ambulance.name);
  assert.ok(em.timeline.length >= 1);
});

test("a hospital CANNOT perform an ambulance action (accept)", () => {
  const em = makeEmergency();
  expectError(
    () => engine.applyAction(em.emergencyId, "accept", { role: ROLES.HOSPITAL, hospitalId: "HOSP-001" }),
    "FORBIDDEN"
  );
});

test("a reporter CANNOT accept the ambulance request", () => {
  const em = makeEmergency();
  expectError(
    () => engine.applyAction(em.emergencyId, "accept", { role: ROLES.REPORTER }),
    "FORBIDDEN"
  );
});

test("cannot mark arrived-at-hospital before the ambulance accepted the case", () => {
  const em = makeEmergency(); // status = AMBULANCE_OFFERED
  expectError(
    () => engine.applyAction(em.emergencyId, "arrived-hospital", { role: ROLES.AMBULANCE, ambulanceId: em.ambulanceId }),
    "INVALID_STATE"
  );
});

test("cannot mark patient arrived before pickup", () => {
  const em = makeEmergency();
  engine.applyAction(em.emergencyId, "accept", { role: ROLES.AMBULANCE, ambulanceId: em.ambulanceId });
  // status = AMBULANCE_ACCEPTED; arrived-hospital invalid
  expectError(
    () => engine.applyAction(em.emergencyId, "arrived-hospital", { role: ROLES.AMBULANCE, ambulanceId: em.ambulanceId }),
    "INVALID_STATE"
  );
});

test("full happy path completes in order", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;

  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  assert.equal(em.status, STATUS.HOSPITAL_OFFERED);
  assert.ok(em.hospital, "a hospital must be offered after pickup");
  const hospId = em.hospitalId;

  em = engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(em.status, STATUS.HOSPITAL_ACCEPTED);
  em = engine.applyAction(id, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: hospId });
  assert.equal(em.status, STATUS.TO_HOSPITAL);

  em = engine.applyAction(id, "arrived-hospital", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  assert.equal(em.status, STATUS.ARRIVED_AT_HOSPITAL);

  // Handing the patient over leads to IN_TREATMENT (still LIVE on hospital
  // dashboards) — the case only closes once the hospital discharges.
  em = engine.applyAction(id, "handover", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(em.status, STATUS.IN_TREATMENT);

  em = engine.applyAction(id, "discharge", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(em.status, STATUS.COMPLETED);
});

test("a hospital can decline and the next-best hospital is offered", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;

  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  const firstHospital = em.hospitalId;
  em = engine.applyAction(id, "reject-patient", {
    role: ROLES.HOSPITAL,
    hospitalId: firstHospital,
    rejectReason: "NO_EMERGENCY_BED",
  });

  assert.notEqual(em.hospitalId, firstHospital, "a different hospital must be offered");
  assert.equal(em.status, STATUS.HOSPITAL_OFFERED);

  const reassignEvent = em.timeline.find((t) => t.action === "hospital-reassign");
  assert.ok(reassignEvent, "the reassignment must be recorded in the timeline");
});

test("a hospital cannot decline if it was NOT the assigned destination", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  expectError(
    () => engine.applyAction(id, "reject-patient", {
      role: ROLES.HOSPITAL,
      hospitalId: "HOSP-999",
      rejectReason: "NO_EMERGENCY_BED",
    }),
    "FORBIDDEN"
  );
});

test("an ambulance can decline and the case is reassigned to another ambulance", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const firstAmbulance = created.ambulanceId;

  const em = engine.applyAction(id, "reject", { role: ROLES.AMBULANCE, ambulanceId: firstAmbulance });
  assert.notEqual(em.ambulanceId, firstAmbulance, "must be reassigned to a different ambulance");
  assert.equal(em.status, STATUS.AMBULANCE_OFFERED);
});

test("reporter can cancel an active emergency", () => {
  const created = makeEmergency();
  const em = engine.applyAction(created.emergencyId, "cancel", { role: ROLES.REPORTER });
  assert.equal(em.status, STATUS.CANCELLED);
});

test("only the assigned ambulance may act on an emergency", () => {
  const created = makeEmergency();
  expectError(
    () => engine.applyAction(created.emergencyId, "accept", { role: ROLES.AMBULANCE, ambulanceId: "AMB-999" }),
    "FORBIDDEN"
  );
});

test("siren toggles only for the assigned ambulance", () => {
  const created = makeEmergency();
  const payload = engine.toggleSiren({ ambulanceId: created.ambulanceId, emergencyId: created.emergencyId, on: true });
  assert.equal(payload.on, true);
  expectError(
    () => engine.toggleSiren({ ambulanceId: "AMB-999", emergencyId: created.emergencyId, on: true }),
    "FORBIDDEN"
  );
});

test("completed emergencies free the ambulance", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  const list = () => engine.listAmbulances().find((a) => a.id === ambId);

  assert.equal(list().status, "DISPATCHED");
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const afterPickup = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: afterPickup.hospitalId });
  engine.applyAction(id, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: afterPickup.hospitalId });
  engine.applyAction(id, "arrived-hospital", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "handover", { role: ROLES.DISPATCH });

  assert.equal(list().status, "AVAILABLE");
});

test("an unconfirmed emergency auto-cancels after the configured window", async () => {
  engine.setAutoCancelWindow(60);
  try {
    const created = makeEmergency();
    const ambId = created.ambulanceId;
    await new Promise((r) => setTimeout(r, 120));
    const em = engine.getEmergency(created.emergencyId);
    assert.equal(em.status, STATUS.CANCELLED);
    assert.ok(
      em.timeline.some((t) => t.action === "auto-cancel"),
      "the auto-cancel must be recorded in the timeline"
    );
    assert.equal(engine.listAmbulances().find((a) => a.id === ambId).status, "AVAILABLE");
  } finally {
    engine.setAutoCancelWindow(15000);
  }
});

test("dispatch can mark a case as a false alarm, logged against the reporter account", () => {
  const created = makeEmergency(); // reporter name "Test One"
  const em = engine.applyAction(created.emergencyId, "false-alarm", { role: ROLES.DISPATCH });

  assert.equal(em.status, STATUS.CANCELLED);
  assert.ok(em.timeline.some((t) => t.action === "false-alarm"));

  const logged = engine.listFalseAlarms();
  assert.ok(
    logged.some((f) => f.account === "Test One" && f.count === 1),
    "the reporting account must be counted"
  );

  // An accepted case can also be marked false (misuse still discovered late).
  const second = makeEmergency();
  engine.applyAction(second.emergencyId, "accept", { role: ROLES.AMBULANCE, ambulanceId: second.ambulanceId });
  const again = engine.applyAction(second.emergencyId, "false-alarm", { role: ROLES.DISPATCH });
  assert.equal(again.status, STATUS.CANCELLED);
});

test("metrics computes active cases, response time and siren activations", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;

  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.toggleSiren({ ambulanceId: ambId, emergencyId: id, on: true });
  engine.toggleSiren({ ambulanceId: ambId, emergencyId: id, on: false });
  engine.toggleSiren({ ambulanceId: ambId, emergencyId: id, on: true });

  const m = engine.metrics();
  assert.equal(m.activeCases, 1);
  assert.equal(m.sirenActivations, 2);
  assert.ok(m.responseSamples >= 1);
  assert.ok(typeof m.avgResponseSeconds === "number");
});

/* ================== Feature 1 + 2: hospital recommendations ================== */

test("a hospital rejection REQUIRES a legitimate operational reason", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  // no reason → rejected
  expectError(
    () => engine.applyAction(id, "reject-patient", { role: ROLES.HOSPITAL, hospitalId: em.hospitalId }),
    "BAD_REQUEST"
  );
  // reason not on the authorised list → rejected
  expectError(
    () => engine.applyAction(id, "reject-patient", { role: ROLES.HOSPITAL, hospitalId: em.hospitalId, rejectReason: "WE_DONT_LIKE_YOU" }),
    "BAD_REQUEST"
  );
  // the engine stays on the SAME hospital after a failed rejection
  assert.equal(engine.getEmergency(id).hospitalId, em.hospitalId);
});

test("recommendations explain why a hospital was chosen (transparent reasons)", () => {
  const created = makeEmergency({
    patient: { name: "Patient A", severity: "critical", condition: "Crash injury" },
  });
  const id = created.emergencyId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: created.ambulanceId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: created.ambulanceId });
  const em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: created.ambulanceId });

  assert.ok(Array.isArray(em.hospitalRecommendations), "recommendations must exist after pickup");
  const top = em.hospitalRecommendations.find((r) => r.eligible);
  assert.ok(top, "at least one eligible hospital must exist");
  assert.equal(top.hospital.id, em.hospitalId, "the top eligible recommendation is assigned");
  assert.ok(typeof top.score === "number" && top.score > 0);
  assert.ok(Array.isArray(top.reasons) && top.reasons.length >= 1, "reasons must be human-readable");
  assert.ok(top.scoreBreakdown, "score breakdown must be available for transparency");
  assert.ok(top.hospital.emergencyBeds > 0, "hospital exposes emergency bed count");
});

test("a hospital with a critical missing specialty is excluded, not merely deprioritised", () => {
  const created = makeEmergency({
    patient: { name: "Patient B", severity: "critical", condition: "Neurological stroke emergency" },
  });
  const id = created.emergencyId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: created.ambulanceId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: created.ambulanceId });
  const em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: created.ambulanceId });

  const ineligible = em.hospitalRecommendations.filter((r) => !r.eligible);
  assert.ok(ineligible.length > 0, "some hospitals must be filtered out by hard constraints");
  const neuro = ineligible.find((r) => r.problems.some((p) => /specialist/i.test(p)));
  assert.ok(neuro, "a missing neurologist/specialist must be a hard-constraint exclusion");
});

test("a conditional accept is recorded with its limitation and activates the corridor", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const pickup = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  const em0 = engine.applyAction(id, "conditional-accept", {
    role: ROLES.HOSPITAL,
    hospitalId: pickup.hospitalId,
    conditions: "Emergency bed available but specialist arriving in 10 minutes",
  });

  assert.equal(em0.status, STATUS.HOSPITAL_ACCEPTED);
  const reqBefore = em0.hospitalRequests[em0.hospitalRequests.length - 1];
  assert.equal(reqBefore.response, "conditional-accept");
  assert.ok(reqBefore.conditions.includes("specialist arriving in 10 minutes"));

  // Corridor activates only when the DRIVER starts navigation.
  const em = engine.applyAction(id, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: pickup.hospitalId });
  assert.equal(em.status, STATUS.TO_HOSPITAL);
  assert.ok(em.greenCorridor && em.greenCorridor.active, "corridor should activate after driver starts navigation");
  assert.ok(em.greenCorridor.notificationStatus === "SENT");
});

test("three hospital rejections escalate to the control room", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  let em = engine.getEmergency(id);
  const used = new Set();
  let rejections = 0;
  while (em.hospitalId && em.status !== STATUS.CONTROL_ROOM_ESCALATION && rejections < 6) {
    const hid = em.hospitalId;
    if (used.has(hid)) break;
    used.add(hid);
    em = engine.applyAction(id, "reject-patient", {
      role: ROLES.HOSPITAL,
      hospitalId: hid,
      rejectReason: "EMERGENCY_DEPT_FULL",
    });
    rejections += 1;
  }

  assert.ok(rejections >= 3, `expected >= 3 rejections, got ${rejections}`);
  assert.equal(em.status, STATUS.CONTROL_ROOM_ESCALATION, "escalation state must be entered");
  assert.ok(em.controlRoomEscalation, "escalation reason must be recorded");
  assert.ok(em.timeline.some((t) => t.action === "escalate"));
});

test("dispatch override resolves a control-room escalation", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  let em = engine.getEmergency(id);
  const used = new Set();
  while (em.status !== STATUS.CONTROL_ROOM_ESCALATION && em.hospitalId && used.size < 5) {
    if (used.has(em.hospitalId)) break;
    used.add(em.hospitalId);
    em = engine.applyAction(id, "reject-patient", {
      role: ROLES.HOSPITAL,
      hospitalId: em.hospitalId,
      rejectReason: "EMERGENCY_DEPT_FULL",
    });
  }

  const overrideHospital = engine.listHospitals().find((h) => !used.has(h.id));
  assert.ok(overrideHospital, "a hospital outside the rejected set must exist");

  em = engine.applyAction(id, "dispatch-override", {
    role: ROLES.DISPATCH,
    hospitalId: overrideHospital.id,
    actor: "Control Operator",
  });
  assert.equal(em.status, STATUS.HOSPITAL_OFFERED, "override returns to offered state");
  assert.equal(em.hospitalId, overrideHospital.id);
  assert.ok(em.timeline.some((t) => t.action === "dispatch-override"));
});

/* ================== Feature 4/5/9: crash detection ================== */

test("crash detection enters the emergency workflow after countdown confirmation", () => {
  engine.setCrashCountdown(2500);
  try {
    const created = engine.createEmergency({
      kind: "CRASH_DETECTION",
      reporter: { name: "Crash User", via: "crash" },
      patient: { name: "Crash User", severity: "critical", condition: "Crash detection" },
      location: { lat: 17.42, lng: 78.44 },
      confidence: 87,
    });

    assert.equal(created.status, STATUS.POTENTIAL_CRASH, "starts in potential-crash");
    assert.equal(created.kind, "CRASH_DETECTION");
    assert.equal(created.crashConfidence, 87);
    assert.ok(created.timeline.some((t) => t.action === "crash-detect"));

    // user confirms the emergency → it becomes a real case
    const confirmed = engine.applyAction(created.emergencyId, "crash-confirm-emergency", { role: ROLES.REPORTER });
    assert.equal(confirmed.status, STATUS.AMBULANCE_OFFERED, "converges into the normal workflow");
    assert.ok(confirmed.ambulanceId, "an ambulance is dispatched like any manual report");
    assert.ok(confirmed.timeline.some((t) => t.action === "crash-confirmed"));
  } finally {
    engine.setCrashCountdown(10000);
  }
});

test("crash detection can be dismissed if the user is OK", () => {
  const created = engine.createEmergency({
    kind: "CRASH_DETECTION",
    reporter: { name: "Crash User", via: "crash" },
    patient: { name: "Crash User", severity: "critical", condition: "Crash detection" },
    location: { lat: 17.42, lng: 78.44 },
    confidence: 61,
  });

  const safe = engine.applyAction(created.emergencyId, "crash-confirm-safe", { role: ROLES.REPORTER });
  assert.equal(safe.status, STATUS.USER_CONFIRMED_SAFE);
  assert.ok(safe.timeline.some((t) => t.action === "crash-confirm-safe"));
  assert.equal(engine.listEmergencies({ activeOnly: true }).some((e) => e.emergencyId === created.emergencyId), false);
});

test("crash detection auto-confirms an emergency when the countdown expires unresponded", async () => {
  engine.setCrashCountdown(200);
  try {
    const created = engine.createEmergency({
      kind: "CRASH_DETECTION",
      reporter: { name: "Crash User", via: "crash" },
      patient: { name: "Crash User", severity: "critical", condition: "Crash detection" },
      location: { lat: 17.42, lng: 78.44 },
      confidence: 90,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const after = engine.getEmergency(created.emergencyId);
    assert.notEqual(after.status, STATUS.POTENTIAL_CRASH);
    assert.ok(
      ["AMBULANCE_OFFERED", "REPORTED", "CONFIRMED_EMERGENCY"].includes(after.status),
      `countdown expiry must create a real emergency, got ${after.status}`
    );
    assert.ok(
      after.ambulanceId || after.status === "NO_AMBULANCE_AVAILABLE",
      "ambulance dispatch must begin automatically"
    );
  } finally {
    engine.setCrashCountdown(10000);
  }
});

test("scoring config is centralised, mutable and exposed for transparency", () => {
  const cfg = engine.getScoringConfig();
  const w = Object.values(cfg.weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(w - 1.0) < 0.001, "weights must sum to 1");
  assert.equal(cfg.weights.travelTime, 0.30);
  assert.ok(Array.isArray(engine.REJECT_REASONS) && engine.REJECT_REASONS.length >= 6);
});

test("handover keeps the case LIVE; discharge + reporter rating close it", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;

  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const hospId = em.hospitalId;
  engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: hospId });
  engine.applyAction(id, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: hospId });
  engine.applyAction(id, "arrived-hospital", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  // Handover → IN_TREATMENT: NOT closed. It is still listed as active and the
  // ambulance is free to take the next case.
  em = engine.applyAction(id, "handover", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(em.status, STATUS.IN_TREATMENT);
  assert.ok(
    engine.listEmergencies().some((e) => e.emergencyId === id),
    "an in-treatment case must still appear as an active emergency"
  );
  assert.equal(
    engine.listAmbulances().find((a) => a.id === ambId).status,
    "AVAILABLE",
    "ambulance should be free right after handover"
  );

  // Only discharge fully closes the case.
  em = engine.applyAction(id, "discharge", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(em.status, STATUS.COMPLETED);

  // Reporter/patient rates the hospital after discharge (optional, non-blocking).
  em = engine.applyAction(id, "rate-hospital", {
    role: ROLES.REPORTER,
    rating: 4,
    ratingComment: "Good care",
    ratingCategories: { care: 4, response: 4, facilities: 5 },
  });
  assert.equal(em.status, STATUS.COMPLETED, "rating must not change the status");
  assert.equal(em.hospitalRating.score, 4);
  assert.equal(em.hospitalRating.ratedBy, "reporter");
  assert.ok(em.hospitalRating.ratedAt);
});

test("parallel hospital requests wait, multiple hospitals can accept, driver picks via navigate", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;

  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });

  // Send parallel admission requests to top hospitals.
  em = engine.applyAction(id, "send-hospital-requests", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const requests = em.hospitalRequests;
  assert.ok(requests.length >= 2, "should send requests to 2+ hospitals");
  assert.ok(requests.every((r) => r.state === "waiting"), "all requests should be WAITING");
  assert.ok(em.hospitalId, "a tentative destination should be set while waiting");

  const [hA, hB] = [requests[0].hospitalId, requests[1].hospitalId];

  // Two different hospitals accept → both stay 'accepted' (multi-accept, not first-wins).
  em = engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: hA });
  assert.equal(em.status, STATUS.HOSPITAL_ACCEPTED, "case waits for the driver to acknowledge");
  assert.equal(em.hospitalId, null, "destination not locked until the driver navigates");
  assert.ok(em.acceptanceWindowUntil, "acceptance opens a 60s confirmation window");
  assert.equal(em.admissionLocked, false);

  em = engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: hB });
  const acceptedNow = em.hospitalRequests.filter((r) => r.state === "accepted");
  assert.equal(acceptedNow.length, 2, "both hospitals may stay accepted at the same time");
  assert.ok(
    em.hospitalRequests.every((r) => r.state === "accepted" || r.state === "waiting"),
    "accepting one hospital must not cancel the other while waiting"
  );

  // Driver cannot navigate to a hospital that did NOT accept.
  const nonAccepted = em.hospitalRequests.find((r) => r.state === "waiting");
  if (nonAccepted) {
    expectError(
      () => engine.applyAction(id, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: nonAccepted.hospitalId }),
      "FORBIDDEN"
    );
  }

  // Driver acknowledges hA and starts navigation → that hospital becomes destination.
  em = engine.applyAction(id, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: hA });
  assert.equal(em.status, STATUS.TO_HOSPITAL);
  assert.equal(em.hospitalId, hA, "navigated hospital becomes the destination");
  assert.equal(em.driverStarted, true, "driver-started flag set");
  assert.equal(em.admissionLocked, true, "admission locks once the driver starts");
  const cancelledOthers = em.hospitalRequests.filter((r) => r.hospitalId !== hA && r.state === "accepted");
  assert.equal(cancelledOthers.length, 0, "non-chosen accepts are cancelled after navigate");
});

test("hospital can cancel its acceptance within the 60s window, then reroute", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const acceptedHosp = em.hospitalId;
  engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: acceptedHosp });
  em = engine.applyAction(id, "cancel-accept", { role: ROLES.HOSPITAL, hospitalId: acceptedHosp });
  // Reroutes to next-best hospital; case never ends.
  assert.notEqual(em.status, STATUS.COMPLETED);
  assert.notEqual(em.status, STATUS.CANCELLED);
  assert.ok(em.hospitalId && em.hospitalId !== acceptedHosp || em.status === STATUS.CONTROL_ROOM_ESCALATION,
    "should reroute to another hospital or escalate");
});

test("hospital cannot cancel after the acceptance window has locked (control-room override only)", async () => {
  engine.setAcceptanceWindow(60);
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const hospId = em.hospitalId;
  em = engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(em.admissionLocked, false);

  // Wait for the 60ms window to expire → admission is effectively locked.
  await new Promise((resolve) => setTimeout(resolve, 120));
  expectError(
    () => engine.applyAction(id, "cancel-accept", { role: ROLES.HOSPITAL, hospitalId: hospId }),
    "INVALID_STATE"
  );
  // Control-room override still works (escalate then pick a different hospital).
  em = engine.applyAction(id, "escalate", { role: ROLES.DISPATCH });
  assert.equal(em.status, STATUS.CONTROL_ROOM_ESCALATION);
  em = engine.applyAction(id, "dispatch-override", { role: ROLES.DISPATCH, hospitalId: "HOSP-002" });
  assert.equal(em.status, STATUS.HOSPITAL_OFFERED);
  engine.setAcceptanceWindow(60000);
});

test("confirm-patient-received transitions to IN_TREATMENT and frees the ambulance", () => {
  const created = makeEmergency();
  const id = created.emergencyId;
  const ambId = created.ambulanceId;
  engine.applyAction(id, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const hospId = em.hospitalId;
  engine.applyAction(id, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: hospId });
  engine.applyAction(id, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: hospId });
  em = engine.applyAction(id, "arrived-hospital", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  em = engine.applyAction(id, "confirm-patient-received", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(em.status, STATUS.IN_TREATMENT);
  assert.equal(em.handover, true);
  assert.equal(engine.listAmbulances().find((a) => a.id === ambId).status, "AVAILABLE");
});

test("new emergency reuses an ambulance freed after handover", () => {
  const one = makeEmergency();
  const id1 = one.emergencyId;
  const ambId = one.ambulanceId;
  engine.applyAction(id1, "accept", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id1, "at-patient", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  let em = engine.applyAction(id1, "pickup", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  const hospId = em.hospitalId;
  engine.applyAction(id1, "accept-patient", { role: ROLES.HOSPITAL, hospitalId: hospId });
  engine.applyAction(id1, "navigate", { role: ROLES.AMBULANCE, ambulanceId: ambId, hospitalId: hospId });
  engine.applyAction(id1, "arrived-hospital", { role: ROLES.AMBULANCE, ambulanceId: ambId });
  engine.applyAction(id1, "confirm-patient-received", { role: ROLES.HOSPITAL, hospitalId: hospId });
  assert.equal(engine.listAmbulances().find((a) => a.id === ambId).status, "AVAILABLE");

  const two = makeEmergency();
  assert.equal(two.ambulanceId, ambId, "the freed ambulance should be assigned to a new case");
});

test("report-risk scoring flags repeated cancellations without blocking emergencies", () => {
  // Simulate cancellation history for the same reporter account.
  engine.applyAction(makeEmergency({ reporter: { name: "RepeatCallee", via: "self" } }).emergencyId, "cancel", { role: ROLES.REPORTER });
  engine.applyAction(makeEmergency({ reporter: { name: "RepeatCallee", via: "self" } }).emergencyId, "cancel", { role: ROLES.REPORTER });
  engine.applyAction(makeEmergency({ reporter: { name: "RepeatCallee", via: "self" } }).emergencyId, "cancel", { role: ROLES.REPORTER });
  const flagged = makeEmergency({ reporter: { name: "RepeatCallee", via: "self" } });
  assert.ok(flagged.emergencyId, "emergency is STILL created despite risk history");
  const em = engine.getEmergency(flagged.emergencyId);
  assert.ok(em.reportFlags.length >= 1, "case should carry a risk flag");
  assert.ok(em.reportFlags.includes("Repeated cancellation history"));
});