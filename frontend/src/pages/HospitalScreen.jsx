import React, { useState, useEffect, useCallback } from "react";
import "./HospitalScreen.css";
import api from "../services/api";
import socketService, { EVENTS } from "../services/socket";
import { setUiRole } from "../services/uiRole";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import DataLabel from "../components/DataLabel";
import Icon from "../components/Icon";
import { formatClock } from "../utils/time";

const RESOURCES = [
  { name: "ICU Beds", available: 3, total: 8 },
  { name: "Operation Theatres", available: 1, total: 4 },
  { name: "Ventilators", available: 5, total: 12 },
  { name: "ER Doctors", available: 4, total: 6 },
];

// Must match backend scoringConfig.REJECT_REASONS — the server rejects free text.
const REJECT_REASONS = [
  { id: "NO_EMERGENCY_BED", label: "No emergency bed available" },
  { id: "EQUIPMENT_UNAVAILABLE", label: "Required equipment unavailable" },
  { id: "SPECIALIST_UNAVAILABLE", label: "Required specialist unavailable" },
  { id: "EMERGENCY_DEPT_FULL", label: "Emergency department at capacity" },
  { id: "CAPABILITY_INSUFFICIENT", label: "Hospital capability insufficient for this emergency" },
  { id: "TEMPORARY_OPERATIONAL", label: "Temporary operational issue" },
  { id: "OTHER", label: "Other authorized reason" },
];

/**
 * HospitalScreen — staff see an incoming patient before arrival (severity,
 * ETA, needs) and can accept or decline. If they decline, the engine offers
 * the next-best hospital and EVERYONE sees the destination change live.
 */
export default function HospitalScreen() {
  const { user } = useAuth();
  // RBAC: the account is bound to ONE station, so this screen always shows it.
  const accountHospitalId = user?.role === "hospital" && user.hospitalId ? user.hospitalId : null;
  const [hospitals, setHospitals] = useState([]);
  const [myHospital, setMyHospital] = useState(accountHospitalId || localStorage.getItem("rr_hospital") || "HOSP-001");
  const [allEmergencies, setAllEmergencies] = useState([]);
  const [overview, setOverview] = useState(null);
  const [resources, setResources] = useState(RESOURCES);
  const [error, setError] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  // Cases where this hospital has a WAITING admission request (may not yet be
  // the assigned destination) — parallel request flow.
  const [admissionRequests, setAdmissionRequests] = useState([]);
  const [nowMs, setNowMs] = useState(Date.now());

  // 60s cancellation-window countdown ticker.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Conditional-accept + reject-reason UI state.
  const [conditions, setConditions] = useState({
    open: false,
    text: "",
  });
  const [rejecting, setRejecting] = useState(false);
  const [rejectPick, setRejectPick] = useState("");

  // Resource-update UI (live demo of the "resource freshness" story).
  const [resourceUpdate, setResourceUpdate] = useState({
    open: false,
    emergencyBeds: null,
    currentLoad: null,
    note: "",
  });

  // RBAC sync: force the account's station and persist it.
  useEffect(() => {
    if (accountHospitalId) {
      setMyHospital(accountHospitalId);
      localStorage.setItem("rr_hospital", accountHospitalId);
    }
  }, [accountHospitalId]);

  const myHospitalInfo = hospitals.find((h) => h.id === myHospital) || null;
  const incoming = allEmergencies
    .filter((e) => !["COMPLETED", "CANCELLED"].includes(e.status) && (
      e.hospitalId === myHospital ||
      e.hospitalRequests?.some((r) => r.hospitalId === myHospital && (r.state === "waiting" || r.state === "accepted"))
    ))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const current = incoming[0] || null;

  // Cases awaiting this hospital's admission decision (WAITING requests),
  // including ones where the ambulance is still travelling / another hospital
  // is only tentatively assigned.
  const pendingRequests = admissionRequests.filter(
    (e) => e.emergencyId !== current?.emergencyId && e.hospitalRequests?.some((r) => r.hospitalId === myHospital && r.state === "waiting")
  );

  // 60s window to cancel/confirm after accepting — seconds remaining.
  const acceptCountdown = (() => {
    if (!current?.acceptanceWindowUntil) return null;
    const ms = new Date(current.acceptanceWindowUntil).getTime() - nowMs;
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  })();

  useEffect(() => {
    setUiRole("hospital");
    socketService.registerRole("hospital");

    api.listHospitals().then(({ hospitals }) => setHospitals(hospitals));
    const refresh = () => {
      api.listEmergencies().then(({ emergencies }) => setAllEmergencies(emergencies)).catch((e) => setError(e.message));
      api.listAdmissionRequests(myHospital)
        .then(({ emergencies }) => setAdmissionRequests(emergencies))
        .catch(() => setAdmissionRequests([]));
      api.statusOverview().then(setOverview).catch(() => {});
    };
    refresh();
    const poll = setInterval(refresh, 5000);
    const key = socketService.on(EVENTS.EMERGENCY_UPDATE, (data) => {
      setAllEmergencies((list) => {
        const exists = list.find((e) => e.emergencyId === data.emergencyId);
        if (exists) return list.map((e) => (e.emergencyId === data.emergencyId ? data : e));
        return [data, ...list];
      });
      api.listAdmissionRequests(myHospital)
        .then(({ emergencies }) => setAdmissionRequests(emergencies))
        .catch(() => {});
      if (data.hospitalId === myHospital && ["HOSPITAL_OFFERED", "HOSPITAL_ACCEPTED", "TO_HOSPITAL", "ARRIVED_AT_HOSPITAL", "IN_TREATMENT"].includes(data.status)) {
        setLastAlert(new Date());
      }
    });
    const driverKey = socketService.on(socketService.EVENTS.DRIVER_STARTED, (data) => {
      if (data.hospitalId === myHospital) {
        setLastAlert(new Date());
        setError(null);
      }
    });

    return () => {
      clearInterval(poll);
      socketService.off(EVENTS.EMERGENCY_UPDATE, key);
      socketService.off(socketService.EVENTS.DRIVER_STARTED, driverKey);
      setUiRole("home");
    };
  }, [myHospital]);

  const respond = useCallback(
    async (id, action, extra = {}) => {
      try {
        const res = await api.applyAction(id, {
          role: "hospital",
          hospitalId: myHospital,
          action,
          ...extra,
        });
        setAllEmergencies((list) => list.map((e) => (e.emergencyId === res.emergency.emergencyId ? res.emergency : e)));
        if (action === "accept-patient") setResources((r) => r.map((x) => (x.name === "ICU Beds" ? { ...x, available: Math.max(0, x.available - 1) } : x)));
        if (action === "conditional-accept") setConditions({ open: false, text: "" });
        if (action === "reject-patient") { setRejectPick(""); setRejecting(false); }
        return res.emergency;
      } catch (e) {
        setError(e.message);
        return null;
      }
    },
    [myHospital]
  );

  // Rejection is now REQUIRED to carry an authorized reason.
  const rejectWithReason = async () => {
    if (!rejectPick) {
      setError("Pick an authorized rejection reason — the server refuses free-text rejections.");
      return;
    }
    const e = await respond(current.emergencyId, "reject-patient", { rejectReason: rejectPick });
    if (e) setError(null);
  };

  const submitConditionalAccept = async () => {
    const text = conditions.text.trim();
    if (!text) {
      setError("Describe the condition the ER team must pre-arrange (e.g. surg-on-call, ICU wait freed…).");
      return;
    }
    const e = await respond(current.emergencyId, "conditional-accept", { conditions: text });
    if (e) setError(null);
  };

  const submitResourceUpdate = async () => {
    const resources = {};
    if (resourceUpdate.emergencyBeds != null && resourceUpdate.emergencyBeds !== "") resources.emergencyBeds = Number(resourceUpdate.emergencyBeds);
    if (resourceUpdate.currentLoad != null && resourceUpdate.currentLoad !== "") resources.currentLoad = Number(resourceUpdate.currentLoad);
    if (resourceUpdate.note) resources.note = resourceUpdate.note;
    try {
      await api.updateResources(current.emergencyId, { hospitalId: myHospital, resources });
      setResourceUpdate({ open: false, emergencyBeds: null, currentLoad: null, note: "" });
      setError(null);
      api.listEmergencies().then(({ emergencies }) => setAllEmergencies(emergencies)).catch(() => {});
      api.listHospitals().then(({ hospitals }) => setHospitals(hospitals)).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  };

  // The checklist answers the plan bug: never show "done" unless a real
  // patient is actually incoming. Every item is derived from real status.
  const checklist = {
    "Patient assigned to this hospital": ["HOSPITAL_OFFERED", "TO_HOSPITAL", "ARRIVED_AT_HOSPITAL", "IN_TREATMENT"].includes(current?.status),
    "ER team notified & ready": ["TO_HOSPITAL", "ARRIVED_AT_HOSPITAL", "IN_TREATMENT"].includes(current?.status),
    "Patient has arrived": ["ARRIVED_AT_HOSPITAL", "IN_TREATMENT"].includes(current?.status),
    "Handover complete": ["IN_TREATMENT", "COMPLETED"].includes(current?.status),
  };

  return (
    <div className="rr-page">
      <header className="page-hero">
        <div className="container page-hero-inner">
          <div>
            <h1>Hospital ER</h1>
            <p className="muted">
              Incoming patient preview — accept, or the system offers the next-best hospital.{lastAlert && <span className="last-alert"> · last alert {formatClock(lastAlert)}</span>}
            </p>
          </div>
          {accountHospitalId ? (
            <div className="amb-select amb-fixed">
              <span className="rr-label">This station is</span>
              <div className="amb-fixed-unit">
                <span className="amb-fixed-id">{myHospitalInfo?.name || myHospital}</span>
                <span className="muted">locked to this account</span>
              </div>
            </div>
          ) : (
            <label className="amb-select">
              <span className="rr-label">This station is</span>
              <select value={myHospital} onChange={(e) => { setMyHospital(e.target.value); localStorage.setItem("rr_hospital", e.target.value); }}>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name} · {h.availableBeds} beds</option>
                ))}
              </select>
            </label>
          )}
          {myHospitalInfo?.emergencyContact && (
            <a className="btn btn-ghost amb-call amb-call-station" href={`tel:${myHospitalInfo.emergencyContact}`}>
              <Icon name="phone" size={13} /> CALL {myHospitalInfo.emergencyContact}
            </a>
          )}
        </div>
      </header>

      <div className="container hosp-body">
        {error && <div className="error-box">{error}<button className="btn btn-ghost" onClick={() => setError(null)}>dismiss</button></div>}

        {current ? (
          <div className={`hosp-incoming ${current.patient.severity === "critical" ? "crit" : ""}`}>
            <div className="hosp-card-main card">
              <div className="hosp-card-head">
                <StatusBadge status={current.status} />
                <span className="mono muted">{current.emergencyId}</span>
              </div>

              <div className="hosp-patient">
                <div className="hosp-patient-name">
                  <h3>{current.patient.name}</h3>
                  <span className="hosp-sev">{current.patient.severity.toUpperCase()}</span>
                </div>
                <p className="muted">
                  {current.patient.age || "?"} years · Blood {current.patient.bloodGroup} · Allergies: {current.patient.allergies}
                </p>
                <p><strong>Needs:</strong> {current.patient.condition}</p>
                {current.requiredSpecialty && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Capability requested: <strong>{current.requiredSpecialty}</strong>
                    {current.requiredEquipment?.length > 0 && <> · {current.requiredEquipment.join(", ")}</>}
                  </p>
                )}
                <p className="muted mono" style={{ fontSize: 12 }}><Icon name="location" size={12} /> {current.location.label}</p>
              </div>

              <div className="hosp-meta">
                <div className="hosp-meta-item">
                  <span className="rr-label">ETA (ambulance)</span>
                  <strong>{current.etaToHospital || "Calculating…"}</strong>
                  {current.etaToHospital && <DataLabel kind="simulated" />}
                </div>
                <div className="hosp-meta-item">
                  <span className="rr-label">Ambulance</span>
                  <strong>{current.ambulance ? `${current.ambulance.name} (${current.ambulance.vehicleNumber})` : "—"}</strong>
                  {current.ambulance?.contact && (
                    <a className="btn btn-ghost amb-call" href={`tel:${current.ambulance.contact}`}>
                      <Icon name="phone" size={13} /> CALL {current.ambulance.contact}
                    </a>
                  )}
                </div>
                <div className="hosp-meta-item">
                  <span className="rr-label">On the way from</span>
                  <strong>{current.ambulance?.vehicleNumber && current.ambulance.name}</strong>
                </div>
              </div>

              {current.status === "HOSPITAL_OFFERED" && (
                <div className="hosp-actions">
                  <button className="btn btn-green" onClick={() => respond(current.emergencyId, "accept-patient")}>
                    ✓ Accept patient
                  </button>
                  <button className="btn btn-amber" onClick={() => { setConditions((c) => ({ ...c, open: !c.open })); setRejecting(false); }}>
                    ⚠ Accept with conditions
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setRejecting((r) => !r); setConditions((c) => ({ ...c, open: false })); }}>
                    ✕ Declined — offer next hospital
                  </button>
                </div>
              )}
              {current.status === "HOSPITAL_ACCEPTED" && (
                <div className="hosp-actions">
                  <span className="badge badge-live" style={{ alignSelf: "flex-start" }}>
                    <Icon name="ok" size={11} /> You've accepted — the driver is choosing the destination
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Ambulance crew will pick one of the accepting hospitals and start navigation.
                    {acceptCountdown != null && (
                      <span className="hosp-countdown"> · you may re-route within <strong>{acceptCountdown}s</strong> of accepting</span>
                    )}
                  </span>
                  <button className="btn btn-ghost" onClick={() => respond(current.emergencyId, "cancel-accept")}>
                    ✕ Cancel my acceptance — re-route patient
                  </button>
                </div>
              )}
              {current.status === "TO_HOSPITAL" && current.driverStarted && (
                <div className="hosp-driver-notice">
                  <Icon name="car" size={16} />
                  <div>
                    <strong>Ambulance on the way to you</strong>
                    <span className="muted">The driver confirmed this destination and has started moving toward your hospital.</span>
                  </div>
                </div>
              )}
              {current.status === "TO_HOSPITAL" && (
                <div className="hosp-actions">
                  <span className="muted" style={{ fontSize: 13 }}>Patient accepted — ambulance en route.
                    {acceptCountdown != null && (
                      <span className="hosp-countdown"> · confirm within <strong>{acceptCountdown}s</strong> or admission locks</span>
                    )}
                  </span>
                  <button className="btn btn-ghost" onClick={() => { setRejecting((r) => !r); }}>
                    ✕ Cannot proceed — re-route patient
                  </button>
                </div>
              )}
              {current.status === "ARRIVED_AT_HOSPITAL" && (
                <div className="hosp-actions">
                  <span className="muted" style={{ fontSize: 13 }}>Ambulance on-site. Confirm the patient has been received to hand over and free the unit.</span>
                  <button className="btn btn-green" onClick={() => respond(current.emergencyId, "confirm-patient-received")}>
                    ✓ Confirm patient received — begin treatment
                  </button>
                </div>
              )}
              {current.status === "IN_TREATMENT" && (
                <div className="hosp-actions">
                  <span className="badge badge-live" style={{ alignSelf: "flex-start" }}>
                    <Icon name="pulse" size={11} /> Patient admitted — treatment in progress
                  </span>
                  <button className="btn btn-green" onClick={() => respond(current.emergencyId, "discharge")}>
                    ✓ Discharge patient — close case
                  </button>
                </div>
              )}

              {conditions.open && (
                <div className="hosp-panel">
                  <div className="hosp-panel-head">
                    <strong>Conditional acceptance</strong>
                    <span className="muted" style={{ fontSize: 13 }}>
                      Accept the case, but with a pre-arrangement the crew will see in real time.
                    </span>
                  </div>
                  <textarea
                    rows="2"
                    value={conditions.text}
                    onChange={(e) => setConditions((c) => ({ ...c, text: e.target.value }))}
                    placeholder="e.g. On-call surgeon notified — will be in theatre when you arrive. ICU bed freeing up now."
                  />
                  <div className="hosp-actions">
                    <button className="btn btn-ghost" onClick={() => setConditions((c) => ({ ...c, open: false }))}>Cancel</button>
                    <button className="btn btn-green" onClick={submitConditionalAccept}>Accept with conditions</button>
                  </div>
                </div>
              )}

              {rejecting && (
                <div className="hosp-panel">
                  <div className="hosp-panel-head">
                    <strong>Decline — authorized reason required</strong>
                    <span className="muted" style={{ fontSize: 13 }}>
                      The rejection reason is logged and drives the rerouting decision server-side.
                    </span>
                  </div>
                  <select value={rejectPick} onChange={(e) => setRejectPick(e.target.value)}>
                    <option value="">Select an authorized reason…</option>
                    {REJECT_REASONS.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  <div className="hosp-actions">
                    <button className="btn btn-ghost" onClick={() => setRejecting(false)}>Cancel</button>
                    <button className="btn btn-red" onClick={rejectWithReason}>Decline &amp; re-route patient</button>
                  </div>
                </div>
              )}
            </div>

            <div className="hosp-side card">
              <div className="section-title" style={{ fontSize: 16 }}>Preparation checklist</div>
              <p className="section-sub">Items only tick when a real event happened.</p>
              <div className="hosp-checklist">
                {Object.entries(checklist).map(([label, done]) => (
                  <div key={label} className={`check-item ${done ? "done" : ""}`}>
                    <span className="check-icon">{done ? "✓" : "○"}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              <div className="section-title" style={{ fontSize: 16, marginTop: 20 }}>Resources</div>
              <p className="section-sub">
                <DataLabel kind="demo">DEMO DATA</DataLabel> live bed count: <strong>{myHospitalInfo?.emergencyBeds ?? "—"}</strong> · load{" "}
                {myHospitalInfo?.currentLoad != null ? `${myHospitalInfo.currentLoad}%` : "—"}
              </p>
              <div className="hosp-resources">
                {resources.map((r) => (
                  <div key={r.name} className="hosp-res">
                    <div className="hosp-res-head">
                      <span>{r.name}</span>
                      <span className="mono">{r.available}/{r.total}</span>
                    </div>
                    <div className="bar"><i style={{ width: `${(r.available / r.total) * 100}%`, background: r.available / r.total < 0.3 ? "#ffb800" : "#0099ff" }} /></div>
                  </div>
                ))}
              </div>

              <button className="btn btn-ghost" style={{ marginTop: 10, width: "100%" }} onClick={() => setResourceUpdate((c) => ({ ...c, open: !c.open }))}>
                {resourceUpdate.open ? "Close" : "✎ Update live resources"}
              </button>
              {resourceUpdate.open && (
                <div className="hosp-res-update">
                  <label>
                    <span>Emergency beds</span>
                    <input type="number" min="0" value={resourceUpdate.emergencyBeds ?? ""} placeholder={String(myHospitalInfo?.emergencyBeds ?? "")} onChange={(e) => setResourceUpdate((c) => ({ ...c, emergencyBeds: e.target.value }))} />
                  </label>
                  <label>
                    <span>Current load %</span>
                    <input type="number" min="0" max="100" value={resourceUpdate.currentLoad ?? ""} placeholder={String(myHospitalInfo?.currentLoad ?? "")} onChange={(e) => setResourceUpdate((c) => ({ ...c, currentLoad: e.target.value }))} />
                  </label>
                  <label>
                    <span>Note (optional)</span>
                    <input value={resourceUpdate.note} placeholder="e.g. ICU expansion done" onChange={(e) => setResourceUpdate((c) => ({ ...c, note: e.target.value }))} />
                  </label>
                  <button className="btn btn-blue" onClick={submitResourceUpdate}>Push update</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hosp-idle-grid">
            <div className="card">
              <div className="hosp-idle-head">
                <span className="hosp-idle-logo"><Icon name="hospital" size={22} /></span>
                <div>
                  <div className="section-title" style={{ fontSize: 17 }}>{myHospitalInfo?.name || myHospital}</div>
                  <span className="section-sub"><DataLabel kind="live">THIS STATION</DataLabel> · monitoring live</span>
                </div>
              </div>

              <div className="hosp-res-head" style={{ marginTop: 6 }}>
                <span className="rr-label">Free beds now</span>
                <span className="mono">{myHospitalInfo?.availableBeds ?? "—"}</span>
              </div>

              <div className="hosp-resources">
                {resources.map((r) => (
                  <div key={r.name} className="hosp-res">
                    <div className="hosp-res-head">
                      <span>{r.name}</span>
                      <span className="mono">{r.available}/{r.total}</span>
                    </div>
                    <div className="bar"><i style={{ width: `${(r.available / r.total) * 100}%`, background: r.available / r.total < 0.3 ? "#ffb800" : "#0099ff" }} /></div>
                  </div>
                ))}
              </div>

              <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                No patient is currently assigned to this station. When a nearby emergency is routed here, the
                incoming preview will appear with a soft sound.
              </p>
            </div>

            <div className="card">
              <div className="section-title" style={{ fontSize: 17 }}>System status</div>
              <p className="section-sub">Numbers update live from the server.</p>
              <div className="hosp-idle-stats">
                <div className="hosp-idle-stat">
                  <span className="rr-label">Active emergencies</span>
                  <strong>{overview?.activeEmergencies ?? <span className="spin" />}</strong>
                  <DataLabel kind="live">LIVE</DataLabel>
                </div>
                <div className="hosp-idle-stat">
                  <span className="rr-label">Ambulances free</span>
                  <strong>{overview?.ambulancesAvailable ?? "—"} / {overview?.ambulanceCount ?? "—"}</strong>
                  <DataLabel kind="simulated" />
                </div>
                <div className="hosp-idle-stat">
                  <span className="rr-label">Beds free (all stations)</span>
                  <strong>{overview?.hospitalCapacity ?? "—"}</strong>
                  <DataLabel kind="demo" />
                </div>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                This station is ready. Leave this screen open during the demo — the ER team will see the patient
                before the ambulance arrives.
              </p>
            </div>
          </div>
        )}

        {pendingRequests.length > 0 && (
          <section>
            <div className="section-title" style={{ fontSize: 18 }}>
              Incoming admission requests <DataLabel kind="simulated">PARALLEL</DataLabel>
            </div>
            <p className="section-sub">These cases requested admission in parallel — the first hospital to accept wins the patient.</p>
            <div className="amb-offers">
              {pendingRequests.map((e) => {
                const req = e.hospitalRequests?.find((r) => r.hospitalId === myHospital);
                const deadlineMs = req?.deadlineAt ? new Date(req.deadlineAt).getTime() - nowMs : null;
                return (
                  <div key={e.emergencyId} className="card amb-offer">
                    <div className="amb-offer-top">
                      <StatusBadge status={e.status} />
                      <span className="mono muted">{e.emergencyId}</span>
                    </div>
                    <p><strong>{e.patient.condition || e.patient.severity}</strong></p>
                    <p className="muted">{e.patient.name} · {e.patient.age || "?"}y · {e.patient.bloodGroup} — {e.location.label}</p>
                    <p className="muted">
                      <DataLabel kind="simulated">Request {deadlineMs != null && deadlineMs > 0 ? `expires in ${Math.ceil(deadlineMs / 1000)}s` : "expired"}</DataLabel>
                      {e.etaToHospital && <> · ETA {e.etaToHospital}</>}
                    </p>
                    <div className="amb-offer-actions">
                      <button className="btn btn-green" onClick={() => respond(e.emergencyId, "accept-patient")}>✓ Accept patient</button>
                      <button className="btn btn-ghost" onClick={() => respond(e.emergencyId, "reject-patient", { rejectReason: "deficient-equipment" })}>✕ Decline</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="hosp-log card">
            {allEmergencies
              .filter((e) => e.timeline.some((t) => t.action === "hospital-reassign" || t.action === "hospital-offer"))
              .flatMap((e) => e.timeline.filter((t) => t.action === "hospital-offer" || t.action === "hospital-reassign"))
              .slice(0, 8)
              .map((t, i) => (
                <div key={i} className="hosp-log-item">
                  <span className="mono muted">{formatClock(t.at)}</span>
                  <span>{t.detail}</span>
                </div>
              )).length === 0 && <p className="muted">No reassignments yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}