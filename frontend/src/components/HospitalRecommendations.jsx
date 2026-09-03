import React from "react";
import Icon from "./Icon";
import "./HospitalRecommendations.css";

const CAPACITY_TONE = { HIGH: "cap-high", MEDIUM: "cap-med", LOW: "cap-low" };

function loadLabel(load) {
  if (load == null) return "Unknown";
  if (load < 35) return { text: "Low", tone: "load-low" };
  if (load < 65) return { text: "Moderate", tone: "load-med" };
  if (load < 85) return { text: "High", tone: "load-high" };
  return { text: "Critical", tone: "load-crit" };
}

function freshnessLabel(rec) {
  switch (rec.freshness) {
    case "LIVE":
      return <span className="rec-fresh live">Live</span>;
    case "FRESH":
      return <span className="rec-fresh fresh">Recently updated</span>;
    case "RECENT":
      return <span className="rec-fresh recent">Data may be outdated</span>;
    default:
      return <span className="rec-fresh stale">Data may be outdated</span>;
  }
}

/**
 * HospitalRecommendations — the "Recommended Hospitals" section shown on the
 * ambulance dashboard after patient pickup. Every card is explainable: score,
 * individual score breakdown, and human-readable reasons. Ineligible hospitals
 * remain visible (dimmed) with the hard-constraint reason they were excluded,
 * proving that closeness cannot out-rank a critical missing requirement.
 *
 * Decision note: the system RECOMMENDS — the final destination is selected by
 * an authorized emergency operator.
 */
export default function HospitalRecommendations({
  recommendations = [],
  requiredSpecialty,
  requiredEquipment,
  currentHospitalId,
  onRequest,
  requestingId,
  lastRejectionDetail,
  hospitalRequests = [],
  onNavigate,
}) {
  if (!recommendations || recommendations.length === 0) return null;

  const eligible = recommendations.filter((r) => r.eligible);
  const ineligible = recommendations.filter((r) => !r.eligible);
  return (
    <section className="rec-section card">
      <div className="rec-head">
        <div>
          <div className="section-title" style={{ fontSize: 18 }}>Recommended Hospitals</div>
          <p className="section-sub">
            Most suitable reachable hospital — not merely the nearest.
            {requiredSpecialty && <><br /><strong>Required:</strong> {requiredSpecialty} specialist
              {requiredEquipment.length > 0 && <span> · {requiredEquipment.join(", ")}</span>}</>}
          </p>
        </div>
        {eligible.length > 0 && (
          <span className="rec-count"><strong>{eligible.length}</strong> eligible</span>
        )}
      </div>

      <div className="rec-operator-note">
        System recommendation — final destination selected by authorized emergency operator.
      </div>

      {eligible.length > 0 ? (
        <div className="rec-list">
          {eligible.map((r) => {
            const req = hospitalRequests.find((x) => x.hospitalId === r.hospital.id);
            return (
              <EligibleCard
                key={r.hospital.id}
                r={r}
                rank={r.rank}
                active={r.hospital.id === currentHospitalId}
                requesting={requestingId === r.hospital.id}
                onRequest={onRequest}
                req={req}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      ) : (
        <div className="rec-none">
          <Icon name="alert" size={18} /> No eligible hospital found within the current search radius.
        </div>
      )}

      {ineligible.length > 0 && (
        <div className="rec-ineligible">
          <div className="rec-ineligible-title">Excluded hospitals (hard constraints)</div>
          {ineligible.map((r) => (
            <div key={r.hospital.id} className="rec-ineligible-card">
              <span className="rec-ex-name">{r.hospital.name}</span>
              <span className="rec-ex-distance">{(r.distance || 0).toFixed(1)} km · {(r.eta || "—")}</span>
              <span className="rec-ex-reason">{r.problems?.join(" · ")}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EligibleCard({ r, rank, active, requesting, onRequest, req, onNavigate }) {
  const load = loadLabel(r.hospital.currentLoad);
  const isAccepted = req?.state === "accepted";
  const isWaiting = req?.state === "waiting" || req?.state === "pending";
  return (
    <div className={`rec-card ${active ? "active" : ""} ${isAccepted ? "accepted" : ""}`}>
      <div className="rec-card-top">
        <span className={`rec-rank ${rank === 1 ? "top" : ""}`}>#{rank}</span>
        <div className="rec-name-row">
          <h3>{r.hospital.name}</h3>
          {isAccepted && <span className="rec-active-tag">✓ Accepted — awaiting you</span>}
          {!isAccepted && active && <span className="rec-active-tag">Currently offered</span>}
        </div>
        <div className="rec-score">
          <strong>{r.score}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="rec-meta">
        <div><span className="rr-label">Distance</span><strong>{r.distance ? `${r.distance.toFixed(1)} km` : "—"}</strong></div>
        <div><span className="rr-label">ETA</span><strong>{r.eta || "—"}</strong></div>
        <div><span className="rr-label">Emergency beds</span><strong>{r.hospital.emergencyBeds}</strong>
          {freshnessLabel(r)}</div>
        <div><span className="rr-label">ER capacity</span><strong><span className={`rec-cap ${CAPACITY_TONE[r.hospital.emergencyCapacity] || ""}`}>{r.hospital.emergencyCapacity}</span></strong></div>
        <div><span className="rr-label">Current load</span><strong><span className={`rec-load ${load.tone}`}>{load.text}{r.hospital.currentLoad != null ? ` (${r.hospital.currentLoad}%)` : ""}</span></strong></div>
      </div>

      <div className="rec-checks">
        <span className={`rec-check ${activeRecAttr(r, "equipment")}`}>Equipment: {equipmentText(r)}</span>
        <span className={`rec-check ${activeRecAttr(r, "specialist")}`}>Specialist: {specialistText(r)}</span>
      </div>

      <div className="rec-score-bars">
        {dimensions(r).map((d) => (
          <div key={d.key} className="rec-dim" title={`${d.label}: ${d.value}/100`}>
            <span className="rec-dim-label">{d.label}</span>
            <div className="rec-dim-bar"><i style={{ width: `${d.value}%` }} /></div>
            <span className="rec-dim-val mono">{d.value}</span>
          </div>
        ))}
      </div>

      <div className="rec-why">
        <span className="rec-why-title">Why recommended</span>
        <ul>
          {r.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="rec-actions">
        {isAccepted ? (
          <button
            className="btn btn-green"
            onClick={() => onNavigate && onNavigate(r.hospital.id)}
            disabled={!onNavigate}
          >
            <Icon name="map" size={13} /> Navigate → Start travel
          </button>
        ) : isWaiting ? (
          <>
            <button className="btn btn-blue" disabled>
              <span className="spin" /> Waiting for hospital to accept…
            </button>
          </>
        ) : (
          <button
            className={`btn ${active ? "btn-green" : "btn-blue"}`}
            onClick={() => onRequest && onRequest(r.hospital.id)}
            disabled={requesting}
          >
            {requesting ? (
              <><span className="spin" /> Requesting…</>
            ) : active ? (
              "✓ Confirm admission"
            ) : (
              "Request Admission"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function activeRecAttr(r, kind) {
  return r.scoreBreakdown && (kind === "equipment" ? (r.scoreBreakdown.equipment >= 50 ? "ok" : "warn") : r.scoreBreakdown.specialist >= 50 ? "ok" : "warn");
}

function equipmentText(r) {
  const rb = r.scoreBreakdown;
  if (!rb) return "Unknown";
  if (rb.equipment === 100) return "Available";
  if (rb.equipment >= 50) return "Partially available";
  return "Not available";
}

function specialistText(r) {
  const rb = r.scoreBreakdown;
  if (!rb) return "Unknown";
  if (rb.specialist === 100) return "Available";
  if (rb.specialist === 55) return "Available soon";
  return "Not available";
}

function dimensions(r) {
  if (!r.scoreBreakdown) return [];
  const map = {
    travelTime: "Travel time",
    beds: "Bed availability",
    equipment: "Equipment",
    specialist: "Specialist",
    capacity: "ER capacity",
    load: "Current load",
  };
  return Object.entries(map).map(([key, label]) => ({
    key,
    label,
    value: Math.round(r.scoreBreakdown[key] || 0),
  }));
}