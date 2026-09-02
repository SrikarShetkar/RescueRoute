import "./shared.css";

const LABELS = {
  REPORTED: ["REPORTED — FINDING AMBULANCE", "action"],
  AMBULANCE_OFFERED: ["REQUEST FOR AMBULANCE", "action"],
  AMBULANCE_ACCEPTED: ["AMBULANCE EN ROUTE", "blue"],
  AT_PATIENT: ["AT PATIENT", "blue"],
  PICKED_UP: ["PATIENT ONBOARD", "action"],
  HOSPITAL_OFFERED: ["OFFERING HOSPITAL", "action"],
  TO_HOSPITAL: ["EN ROUTE TO HOSPITAL", "blue"],
  ARRIVED_AT_HOSPITAL: ["ARRIVED AT HOSPITAL", "ok"],
  IN_TREATMENT: ["IN TREATMENT", "ok"],
  COMPLETED: ["RESOLVED", "ok"],
  CANCELLED: ["CANCELLED", "neutral"],
};

export const statusInfo = (status) => {
  if (["REPORTED", "AMBULANCE_OFFERED", "HOSPITAL_OFFERED"].includes(status)) return { tone: "action" };
  if (["ARRIVED_AT_HOSPITAL", "IN_TREATMENT", "COMPLETED"].includes(status)) return { tone: "ok" };
  if (status === "CANCELLED") return { tone: "neutral" };
  return { tone: "blue" };
};

export default function StatusBadge({ status }) {
  const [label, tone] = LABELS[status] || [status || "UNKNOWN", "neutral"];
  return <span className={`status-badge ${tone}`}>{label}</span>;
}