const BASE = "http://localhost:5001/api/v1";

async function j(path, opts) {
  const res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...opts });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const log = (label, r) => console.log(`${label} -> ${r.status} ${r.body.error || r.body.success || r.body.count !== undefined ? "count=" + r.body.count : ""}`);

(async () => {
  // reset
  let r;
  r = await j("/demo/reset", { method: "POST" });
  console.log("reset ->", r.status, r.body.message);

  r = await j("/status");
  console.log("status ->", r.status, JSON.stringify(r.body));

  r = await j("/ambulances");
  console.log("ambulances ->", r.status, r.body.ambulances.map((a) => a.id + ":" + a.status).join(", "));

  r = await j("/hospitals");
  console.log("hospitals ->", r.status, r.body.hospitals.map((h) => h.id + " beds=" + h.availableBeds).join(", "));

  // 1. create emergency (reporter role)
  r = await j("/emergencies", {
    method: "POST",
    body: JSON.stringify({
      kind: "BYSTANDER",
      reporter: { name: "Smoke Test User", via: "bystander" },
      patient: { name: "Jane Doe", age: 31, bloodGroup: "O+", allergies: "None", severity: "critical", condition: "Severe chest pain" },
      location: { lat: 17.384, lng: 78.487, label: "Smoke Test Junction, Banjara Hills" },
    }),
  });
  console.log("create ->", r.status, r.body.emergency?.emergencyId, "->", r.body.emergency?.status, "amb=", r.body.emergency?.ambulance?.id);
  const eid = r.body.emergency?.emergencyId;

  // 2. ambulance accepts
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "ambulance", ambulanceId: r.body.emergency.ambulance?.id, action: "accept" }) });
  console.log("amb accept ->", r.status, r.body.emergency?.status);

  // move ambulance
  r = await j(`/ambulances/${r.body.emergency.ambulance?.id || "AMB-001"}/move`, { method: "POST", body: JSON.stringify({ lat: 17.3852, lng: 78.4875 }) });
  console.log("amb move ->", r.status, JSON.stringify(r.body.payload || r.body));

  // 3. arrived at patient (with location)
  const e0 = (await j(`/emergencies/${eid}`)).body.emergency;
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "ambulance", ambulanceId: e0.ambulance.id, action: "at-patient", location: { lat: 17.3852, lng: 78.4875 } }) });
  console.log("at patient ->", r.status, r.body.emergency?.status);

  // 4. pickup -> hospital offered
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "ambulance", ambulanceId: e0.ambulance.id, action: "pickup" }) });
  console.log("pickup ->", r.status, r.body.emergency?.status, "hospital=", r.body.emergency?.hospital?.id);

  // 5. hospital rejects -> reap = engine reassigns
  const h0 = r.body.emergency.hospital;
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "hospital", hospitalId: h0.id, action: "reject-patient" }) });
  console.log("hospital reject ->", r.status, "new hospital=", r.body.emergency?.hospital?.id, "status=", r.body.emergency?.status);

  // 6. new hospital accepts
  const h1 = r.body.emergency.hospital;
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "hospital", hospitalId: h1.id, action: "accept-patient" }) });
  console.log("hospital accept ->", r.status, r.body.emergency?.status, "->", r.body.emergency?.hospital?.id);

  // 7. arrived at hospital
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "ambulance", ambulanceId: e0.ambulance.id, action: "arrived-hospital", location: { lat: 17.4126, lng: 78.4339 } }) });
  console.log("arrived hospital ->", r.status, r.body.emergency?.status);

  // 8. handover → IN_TREATMENT, then discharge by hospital closes the case
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "hospital", hospitalId: h1.id, action: "handover" }) });
  console.log("handover ->", r.status, r.body.emergency?.status, "(should stay LIVE = IN_TREATMENT)");
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "hospital", hospitalId: h1.id, action: "discharge" }) });
  console.log("discharge ->", r.status, r.body.emergency?.status);

  // 8b. reporter rates the hospital after discharge
  r = await j(`/emergencies/${eid}/actions`, { method: "POST", body: JSON.stringify({ role: "reporter", action: "rate-hospital", rating: 5, ratingComment: "Great" }) });
  console.log("rate-hospital ->", r.status, r.body.emergency?.hospitalRating?.score);

  // 9. role-gated rejection check: ambulance tries hospital-only 'discharge' (from a bogus id)
  r = await j("/emergencies", { method: "POST", body: JSON.stringify({ location: { lat: 17.4, lng: 78.48 }, patient: { name: "Test", severity: "minor" } }) });
  const eid2 = r.body.emergency.emergencyId;
  r = await j(`/emergencies/${eid2}/actions`, { method: "POST", body: JSON.stringify({ role: "hospital", hospitalId: "HOSP-001", action: "accept" }) });
  console.log("gated reject (should be 403/400) ->", r.status, r.body.error);

  // 10. siren toggle (role enforced)
  r = await j(`/emergencies/${eid2}/siren`, { method: "POST", body: JSON.stringify({ role: "ambulance", ambulanceId: r.body.emergency?.ambulance?.id || "AMB-001", on: true }) });
  console.log("siren ->", r.status, JSON.stringify(r.body.payload || r.body));

  process.exit(0);
})().catch((e) => { console.error("SMOKE FAILED", e.message); process.exit(1); });