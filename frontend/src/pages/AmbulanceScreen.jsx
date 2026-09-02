import React, { useState, useEffect, useRef, useCallback } from "react";
import "./AmbulanceScreen.css";
import api from "../services/api";
import socketService, { EVENTS } from "../services/socket";
import { setUiRole } from "../services/uiRole";
import { useAuth } from "../context/AuthContext";
import { watchLocation, clearLocationWatch, calculateDistance } from "../services/location";
import RouteMap, { interpolate } from "../components/RouteMap";
import StatusBadge from "../components/StatusBadge";
import DataLabel from "../components/DataLabel";
import Icon from "../components/Icon";
import HospitalRecommendations from "../components/HospitalRecommendations";
import GreenCorridorStatus from "../components/GreenCorridorStatus";
import { ReroutingBanner, EscalationBanner } from "../components/AlertBanner";
import { formatClock } from "../utils/time";

const TRAVEL_MS = 5000;

/**
 * AmbulanceScreen — the driver's tool. Accept/reject requests, then walk the
 * case through patient pickup to hospital hand-over. Includes a simulated
 * movement control (room-based demo) plus the siren.
 *
 * RBAC: the driver's account is bound to ONE ambulance unit, so the "I'm
 * driving" selector shows only that unit (it was listing all three before).
 */
export default function AmbulanceScreen() {
  const { user } = useAuth();
  // Account decides the unit. Fall backs keep the room-demo flow usable if an
  // old account (no ambulanceId) is ever present.
  const accountAmbulanceId = user?.role === "ambulance" && user.ambulanceId ? user.ambulanceId : null;
  const [ambulances, setAmbulances] = useState([]);
  const [myAmbulance, setMyAmbulance] = useState(accountAmbulanceId || localStorage.getItem("rr_ambulance") || "AMB-001");
  const [allEmergencies, setAllEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // RBAC: the unit is fixed by the account — sync it and persist.
  useEffect(() => {
    if (accountAmbulanceId) {
      setMyAmbulance(accountAmbulanceId);
      localStorage.setItem("rr_ambulance", accountAmbulanceId);
    }
  }, [accountAmbulanceId]);

  // travel animation state
  const [travel, setTravel] = useState(null); // {from, to, progress, target:'patient'|'hospital'}
  const travelTimer = useRef(null);
  const [sirenActive, setSirenActive] = useState(false);

  // live GPS tracking state
  const [liveGps, setLiveGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | requesting | active | denied
  const [gpsReadout, setGpsReadout] = useState(null); // {lat, lng, accuracy} | null
  const gpsWatchRef = useRef(null);
  const gpsLastEmitRef = useRef({ at: null, lat: null, lng: null });

  const active = allEmergencies
    .filter((e) => e.ambulanceId === myAmbulance && !["COMPLETED", "CANCELLED"].includes(e.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // An AMBULANCE_OFFERED case is NOT accepted yet — it is shown as an
  // offer card (Accept/Decline), never as the active journey. Only once the
  // driver accepts does it become the "current" case.
  const current = active.find((e) => e.status !== "AMBULANCE_OFFERED") || null;
  const offers = active.filter((e) => e.status === "AMBULANCE_OFFERED");

  useEffect(() => {
    setUiRole("ambulance");
    socketService.registerRole("ambulance", { ambulanceId: myAmbulance });

    socketService.connectSocket();

    api.listAmbulances().then(({ ambulances }) => setAmbulances(ambulances));
    api.statusOverview().then(() => setLoading(false)).catch(() => setLoading(false));

    const refresh = () => api.listEmergencies().then(({ emergencies }) => setAllEmergencies(emergencies)).catch((e) => setError(e.message));
    refresh();

    const poll = setInterval(refresh, 5000);
    const key = socketService.on(EVENTS.EMERGENCY_UPDATE, (data) => {
      setAllEmergencies((list) => {
        const exists = list.find((e) => e.emergencyId === data.emergencyId);
        if (exists) return list.map((e) => (e.emergencyId === data.emergencyId ? data : e));
        return [data, ...list];
      });
      if (data.ambulanceId === myAmbulance) setSirenActive(!!data.sirenOn);
    });

    return () => {
      clearInterval(poll);
      socketService.off(EVENTS.EMERGENCY_UPDATE, key);
      clearTimeout(travelTimer.current);
      stopLiveGps();
      setUiRole("home");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopLiveGps is stable via useCallback([])
  }, [myAmbulance]);

  const act = useCallback(
    async (id, action, extra = {}) => {
      try {
        const res = await api.applyAction(id, {
          role: "ambulance",
          ambulanceId: myAmbulance,
          action,
          ...extra,
        });
        setAllEmergencies((list) => list.map((e) => (e.emergencyId === res.emergency.emergencyId ? res.emergency : e)));
        return res.emergency;
      } catch (e) {
        setError(e.message);
        return null;
      }
    },
    [myAmbulance]
  );

  const toggleSiren = async () => {
    if (!current) return;
    try {
      await api.toggleSiren(current.emergencyId, { ambulanceId: myAmbulance, on: !sirenActive });
    } catch (e) {
      setError(e.message);
    }
  };

  /* ---- Live GPS tracking ---- */
  const stopLiveGps = useCallback(() => {
    if (gpsWatchRef.current != null) {
      clearLocationWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    gpsLastEmitRef.current = { at: null, lat: null, lng: null };
    setLiveGps(false);
    setGpsStatus("idle");
    setGpsReadout(null);
  }, []);

  const startLiveGps = useCallback(() => {
    if (!("geolocation" in navigator)) { setGpsStatus("denied"); return; }
    setGpsStatus("requesting");
    gpsWatchRef.current = watchLocation(
      ({ lat, lng, accuracy }) => {
        const now = Date.now();
        const last = gpsLastEmitRef.current;
        const moved = last.lat == null ? Infinity : calculateDistance(last.lat, last.lng, lat, lng) * 1000;
        if (last.lat == null || moved >= 7 || now - (last.at || 0) >= 5000) {
          socketService.emitAmbulanceMove({ ambulanceId: myAmbulance, lat, lng });
          gpsLastEmitRef.current = { at: now, lat, lng };
        }
        setGpsReadout({ lat, lng, accuracy: accuracy == null ? null : Math.round(accuracy) });
        setGpsStatus("active");
        setLiveGps(true);
      },
      () => {
        setGpsStatus("denied");
        setLiveGps(false);
      }
    );
  }, [myAmbulance]);

  const runTravel = useCallback(
    async ({ target }) => {
      if (!current || travel) return;
      const from = { ...current.ambulance.liveLocation };
      const to = target === "patient" ? current.location : current.hospital.liveLocation;
      setTravel({ from, to, progress: 0, target });

      const steps = 12;
      const emitStep = (i) => {
        const t = i / steps;
        const eased = t;
        const pos = interpolate(from, to, eased);
        socketService.emitAmbulanceMove({ ambulanceId: myAmbulance, lat: pos.lat, lng: pos.lng });
        setTravel({ from, to, progress: eased, target });
        if (i < steps) {
          travelTimer.current = setTimeout(() => emitStep(i + 1), TRAVEL_MS / steps);
        } else {
          setTimeout(() => setTravel(null), 400);
        }
      };
      emitStep(0);
    },
    [current, travel, myAmbulance]
  );

  const canArrivePatient = current?.status === "AMBULANCE_ACCEPTED";
  const canPickup = current?.status === "AT_PATIENT";
  const canArriveHospital = current?.status === "TO_HOSPITAL";
  const canHandover = current?.status === "ARRIVED_AT_HOSPITAL";

  // ---- Progressive routing / hospital workflow state ----
  const lastRejection = current?.hospitalRequests?.findLast?.((r) => r.response === "reject")
    || [...(current?.hospitalRequests || [])].reverse().find((r) => r.response === "reject")
    || null;
  const escalating = ["CONTROL_ROOM_ESCALATION", "NO_HOSPITAL_AVAILABLE"].includes(current?.status);
  // The driver can pick a destination whenever the case is still at the
  // "choose a hospital" stage. The engine auto-offers the top recommendation
  // (a PENDING request), so the driver may CONFIRM that one or pick a
  // different eligible recommendation via "Request Admission".
  const canPickHospital =
    !!current &&
    !escalating &&
    ["PICKED_UP", "HOSPITAL_OFFERED", "TO_HOSPITAL"].includes(current.status);

  // Route map state — colour changes only when the corridor is locked in.
  let routeState = "to-patient";
  if (current?.status === "TO_HOSPITAL") routeState = "to-hospital";
  else if (current?.status === "ARRIVED_AT_HOSPITAL" || current?.status === "IN_TREATMENT" || current?.status === "COMPLETED") routeState = "arrived";
  else if (escalating) routeState = "rerouting";

  const requestHospital = async (hospitalId) => {
    const e = await act(current.emergencyId, "request-hospital", { hospitalId });
    return e;
  };

  const switchAmbulance = (id) => {
    setMyAmbulance(id);
    localStorage.setItem("rr_ambulance", id);
  };

  return (
    <div className="rr-page">
      <header className="page-hero">
        <div className="container page-hero-inner">
          <div>
            <h1>Ambulance Driver</h1>
            <p className="muted">Accept cases, follow the journey, hand over the patient.</p>
          </div>
          {accountAmbulanceId ? (
            <div className="amb-select amb-fixed">
              <span className="rr-label">I'm driving</span>
              <div className="amb-fixed-unit">
                <span className="amb-fixed-id">{myAmbulance}</span>
                <span className="muted">locked to this account</span>
              </div>
            </div>
          ) : (
            <label className="amb-select">
              <span className="rr-label">I'm driving</span>
              <select value={myAmbulance} onChange={(e) => switchAmbulance(e.target.value)}>
                {ambulances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.driver} · {a.status}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="amb-gps">
            <button
              className={`btn ${liveGps ? "btn-green" : "btn-ghost"} amb-gps-btn`}
              onClick={liveGps ? stopLiveGps : startLiveGps}
              disabled={gpsStatus === "requesting"}
            >
              <Icon name="location" size={13} />
              {liveGps ? "Live GPS ON" : gpsStatus === "requesting" ? "Requesting…" : "Use live GPS"}
            </button>
            {gpsStatus === "active" && gpsReadout && (
              <span className="amb-gps-readout mono">{gpsReadout.lat.toFixed(5)}, {gpsReadout.lng.toFixed(5)}{gpsReadout.accuracy != null ? ` ±${gpsReadout.accuracy}m` : ""}</span>
            )}
            {gpsStatus === "denied" && <span className="amb-gps-note">blocked — Simulate travel still works</span>}
          </div>
        </div>
      </header>

      <div className="container amb-body">
        {error && <div className="error-box">{error}<button className="btn btn-ghost" onClick={() => setError(null)}>dismiss</button></div>}
        {loading && !current && (
          <div className="empty-state"><span className="spin" /> Connecting to control…</div>
        )}

        {offers.length > 0 && !current && (
          <section>
            <div className="section-title" style={{ fontSize: 18 }}>New requests</div>
            <div className="amb-offers">
              {offers.map((e) => (
                <div key={e.emergencyId} className="card amb-offer">
                  <div className="amb-offer-top">
                    <StatusBadge status={e.status} />
                    <span className="mono muted">{e.emergencyId}</span>
                  </div>
                  <p><strong>{e.patient.condition || e.patient.severity}</strong></p>
                  <p className="muted">{e.patient.name} · {e.patient.age || "?"}y · {e.patient.bloodGroup} — {e.location.label}</p>
                  {e.etaToPatient && <p className="muted"><DataLabel kind="simulated">ETA to patient: {e.etaToPatient}</DataLabel></p>}
                  <div className="amb-offer-actions">
                    <button className="btn btn-green" onClick={() => act(e.emergencyId, "accept")}>✓ Accept</button>
                    <button className="btn btn-ghost" onClick={() => act(e.emergencyId, "reject")}>✕ Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {current && (
          <section className="amb-active">
            <div className="amb-active-head">
              <div>
                <div className="section-title" style={{ fontSize: 18 }}>Active case</div>
                <span className="mono muted">{current.emergencyId}</span>
              </div>
              <StatusBadge status={current.status} />
            </div>

            <ReroutingBanner
              rejection={lastRejection}
              nextHospital={escalating ? null : current.hospital?.name}
            />
            <EscalationBanner
              escalation={escalating ? current.controlRoomEscalation : null}
              emergencyId={current.emergencyId}
            />

            <div className="amb-journey-grid">
              <div className="amb-map-col">
                <RouteMap
                  from={current.ambulance.liveLocation}
                  to={
                    travel?.target === "patient"
                      ? current.location
                      : travel?.target === "hospital"
                        ? current.hospital?.liveLocation
                        : canArriveHospital || canHandover || current.status === "TO_HOSPITAL"
                          ? current.hospital?.liveLocation
                          : current.location
                  }
                  progress={liveGps ? 0 : (travel?.progress ?? (canArriveHospital || canHandover ? 1 : 0))}
                  patient={current.location}
                  hospital={current.hospital?.liveLocation}
                  routeState={routeState}
                  corridor={current.greenCorridor}
                  label={current.ambulance.name + " — route"}
                  live={liveGps}
                />
                <div className="amb-controls">
                  {liveGps && <span className="amb-gps-hint muted">Using live GPS instead of simulation</span>}
                  {current.status === "AMBULANCE_ACCEPTED" && (
                    <button className="btn btn-blue" onClick={() => runTravel({ target: "patient" })} disabled={liveGps}>
                      <Icon name="play" size={13} /> Simulate travel to patient
                    </button>
                  )}
                  {(current.status === "PICKED_UP" || current.status === "HOSPITAL_OFFERED" || current.status === "TO_HOSPITAL") && (
                    <button className="btn btn-blue" onClick={() => runTravel({ target: "hospital" })} disabled={liveGps}>
                      <Icon name="play" size={13} /> Simulate travel to hospital
                    </button>
                  )}
                  <button
                    className={`btn ${sirenActive ? "btn-red" : "btn-amber"}`}
                    onClick={toggleSiren}
                    disabled={!["AMBULANCE_ACCEPTED", "AT_PATIENT", "PICKED_UP", "HOSPITAL_OFFERED", "TO_HOSPITAL"].includes(current.status)}
                  >
                    {sirenActive ? <><Icon name="siren" size={14} /> SIREN ON</> : <><Icon name="bell" size={14} /> Sound siren</>}
                  </button>
                </div>
              </div>

              <div className="amb-journey">
                <div className="amb-step-row">
                  {[
                    { ok: ["AMBULANCE_ACCEPTED", "AT_PATIENT", "PICKED_UP", "HOSPITAL_OFFERED", "TO_HOSPITAL", "ARRIVED_AT_HOSPITAL"].includes(current.status), label: "Accepted case" },
                    { ok: ["AMBULANCE_ACCEPTED", "AT_PATIENT", "PICKED_UP", "HOSPITAL_OFFERED", "TO_HOSPITAL", "ARRIVED_AT_HOSPITAL"].includes(current.status), label: "En route to patient", action: canArrivePatient, btn: "Arrived at patient", act: "at-patient" },
                    { ok: ["AT_PATIENT", "PICKED_UP", "HOSPITAL_OFFERED", "TO_HOSPITAL", "ARRIVED_AT_HOSPITAL"].includes(current.status), label: "At patient", action: canPickup, btn: "Patient picked up", act: "pickup" },
                    { ok: ["TO_HOSPITAL", "ARRIVED_AT_HOSPITAL"].includes(current.status), label: "Hospital accepted", hint: current.status === "HOSPITAL_OFFERED" || current.status === "PICKED_UP" ? "Waiting for hospital to accept…" : null },
                    { ok: ["TO_HOSPITAL", "ARRIVED_AT_HOSPITAL"].includes(current.status), label: "En route to hospital", action: canArriveHospital, btn: "Arrived at hospital", act: "arrived-hospital" },
                    { ok: ["ARRIVED_AT_HOSPITAL"].includes(current.status), label: "Hospital hand-over", action: canHandover, btn: "Patient handed over", act: "handover" },
                  ].map((s, i) => (
                    <div key={i} className={`amb-step ${s.ok ? "done" : ""}`}>
                      <span className="amb-step-dot">{s.ok ? "✓" : i + 1}</span>
                      <div className="amb-step-body">
                        <strong>{s.label}</strong>
                        {s.hint && <small className="muted">{s.hint}</small>}
                        {s.action && (
                          <button
                            className="btn btn-green"
                            onClick={() => act(current.emergencyId, s.act)}
                            disabled={!!travel}
                          >
                            {s.btn}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="amb-live">
                  <div>
                    <span className="rr-label">Hospital</span>
                    <strong>{current.hospital ? current.hospital.name : "not offered yet — patient will be assigned at pickup"}</strong>
                    {current.etaToHospital && <small className="muted">ETA <DataLabel kind="simulated">{current.etaToHospital}</DataLabel></small>}
                  </div>
                  <div>
                    <span className="rr-label">Siren</span>
                    <strong>{sirenActive ? "ACTIVE — alerting nearby drivers" : "off"}</strong>
                  </div>
                </div>

                <GreenCorridorStatus corridor={current.greenCorridor} emergency={current} />
              </div>
            </div>

            <HospitalRecommendations
              recommendations={current.hospitalRecommendations}
              requiredSpecialty={current.requiredSpecialty}
              requiredEquipment={current.requiredEquipment || []}
              currentHospitalId={current.hospital?.id}
              onRequest={canPickHospital ? requestHospital : null}
              requestingId={null}
              lastRejectionDetail={lastRejection}
            />
          </section>
        )}

        {!current && offers.length === 0 && !loading && (
          <div className="empty-state">No active cases. New requests will appear here with an alert sound.</div>
        )}

        {allEmergencies.some((e) => e.ambulanceId === myAmbulance && ["COMPLETED", "CANCELLED"].includes(e.status)) && (
          <section>
            <div className="section-title" style={{ fontSize: 18 }}>Completed / cancelled</div>
            {allEmergencies
              .filter((e) => e.ambulanceId === myAmbulance && ["COMPLETED", "CANCELLED"].includes(e.status))
              .slice(0, 3)
              .map((e) => (
                <div key={e.emergencyId} className="amb-history">
                  <StatusBadge status={e.status} />
                  <span className="muted">{e.emergencyId}</span>
                  <span className="muted mono">{formatClock(e.updatedAt)}</span>
                </div>
              ))}
          </section>
        )}
      </div>
    </div>
  );
}