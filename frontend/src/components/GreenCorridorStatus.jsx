import React from "react";
import DataLabel from "./DataLabel";
import Icon from "./Icon";
import "./GreenCorridorStatus.css";

/**
 * GreenCorridorStatus — the ambulance + control-room view of the active green
 * corridor. The feature is a VOLUNTARY citizen-awareness layer, never a
 * traffic-control guarantee: the UI says exactly that.
 */
export default function GreenCorridorStatus({ corridor, emergency }) {
  if (!corridor || !corridor.active) {
    return (
      <div className="gc-card card gc-standby">
        <div className="gc-head">
          <Icon name="road" size={16} />
          <strong>Green Corridor: STANDBY</strong>
        </div>
        <p className="muted">Activates automatically when the hospital accepts and the ambulance begins its journey.</p>
      </div>
    );
  }

  return (
    <div className="gc-card card gc-active">
      <div className="gc-head">
        <Icon name="road" size={16} />
        <div className="gc-title">
          <strong>Green Corridor: <span className="gc-pulse">ACTIVE</span></strong>
          <span className="gc-ambulance">Ambulance {corridor.ambulanceId} · {((corridor.corridorLengthKm || 0).toFixed(1))} km corridor</span>
        </div>
        <DataLabel kind="simulated">SIMULATED</DataLabel>
      </div>

      <div className="gc-grid">
        <div><span className="rr-label">Destination</span><strong>{corridor.destination}</strong></div>
        <div><span className="rr-label">ETA</span><strong>{emergency?.etaToHospital || "—"}</strong></div>
        <div><span className="rr-label">Citizen alerts</span><strong>{corridor.notifiedUsers} users <span className="gc-sub">in corridor</span></strong></div>
        <div><span className="rr-label">Notification status</span><strong>{corridor.notificationStatus}</strong></div>
        <div><span className="rr-label">Corridor length</span><strong>{corridor.corridorLengthKm.toFixed(1)} km</strong></div>
        <div><span className="rr-label">Mode</span><strong>Voluntary awareness</strong></div>
      </div>

      <p className="gc-note">
        <Icon name="bell" size={12} /> Citizen alerts encourage <strong>voluntary route clearance</strong> — this is not
        automatic traffic control. Real traffic control would require government / traffic-police integration.
      </p>
    </div>
  );
}