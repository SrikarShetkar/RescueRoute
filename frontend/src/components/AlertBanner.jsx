import React from "react";
import Icon from "./Icon";
import "./AlertBanner.css";

/**
 * AlertBanner — critical, high-hierarchy alerts shared across dashboards:
 *   - Hospital unavailable / rerouting (after a rejection)
 *   - Control-room intervention required (after too many rejections)
 *   - Crash detection countdown confirmation (reporter side)
 */
export function ReroutingBanner({ rejection, nextHospital }) {
  if (!rejection) return null;
  return (
    <div className="alert-banner banner-reroute">
      <Icon name="alert" size={18} />
      <div className="ab-body">
        <strong>Hospital unavailable — rerouting patient</strong>
        <span>
          {rejection.hospitalName || rejection.hospitalId} declined:{" "}
          <em>{rejection.reasonLabel || "Operational reason"}</em>
          {nextHospital ? <> · now offering <strong>{nextHospital}</strong></> : " · searching alternate hospitals"}
        </span>
      </div>
    </div>
  );
}

export function EscalationBanner({ escalation, emergencyId }) {
  if (!escalation) return null;
  return (
    <div className="alert-banner banner-escalation">
      <Icon name="alert" size={20} />
      <div className="ab-body">
        <strong>Control Room Intervention Required</strong>
        <span>
          {escalation.reason || `No suitable accepting hospital found within current search radius (${emergencyId})`}
        </span>
      </div>
    </div>
  );
}

export function CrashBanner({ emergency }) {
  if (!emergency || !["POTENTIAL_CRASH", "USER_CONFIRMATION", "CONFIRMED_EMERGENCY"].includes(emergency.status)) return null;
  const urgent = emergency.status === "USER_CONFIRMATION" || emergency.status === "POTENTIAL_CRASH";
  return (
    <div className={`alert-banner ${urgent ? "banner-crash" : "banner-reroute"}`}>
      <Icon name="crash" size={18} />
      <div className="ab-body">
        <strong>POSSIBLE CRASH DETECTED</strong>
        <span>
          Confidence <strong>{emergency.crashConfidence ?? 0}%</strong> ·{" "}
          {urgent ? "Waiting for user confirmation — send help if unresponsive." : "Confirmed — case created."}
        </span>
      </div>
    </div>
  );
}