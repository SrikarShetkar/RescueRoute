import { API_URL } from "./config";

/**
 * Tiny fetch wrapper for the v1 API. Returns parsed JSON, throws on network
 * issues, and passes server error codes through so screens can react.
 */
async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.code = body?.code;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Report a new emergency (self, bystander, or crash auto-alert). */
export function createEmergency(data) {
  return request("/emergencies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** List emergencies (active by default). */
export function listEmergencies({ activeOnly = true, status } = {}) {
  const q = new URLSearchParams();
  if (activeOnly) q.set("activeOnly", "true");
  if (status) q.set("status", status);
  return request(`/emergencies?${q.toString()}`);
}

export function getEmergency(id) {
  return request(`/emergencies/${encodeURIComponent(id)}`);
}

/** Apply a role-gated action to an emergency. The server validates the role
 * against the emergency's current state and rejects illegal ones. */
export function applyAction(id, { role, action, ambulanceId, hospitalId, rejectReason, conditions, actor, resources }) {
  return request(`/emergencies/${encodeURIComponent(id)}/actions`, {
    method: "POST",
    body: JSON.stringify({ role, action, ambulanceId, hospitalId, rejectReason, conditions, actor, resources }),
  });
}

/** Toggle the assigned ambulance's siren. */
export function toggleSiren(id, { ambulanceId, on }) {
  return request(`/emergencies/${encodeURIComponent(id)}/siren`, {
    method: "POST",
    body: JSON.stringify({ role: "ambulance", ambulanceId, on }),
  });
}

export function listAmbulances() {
  return request("/ambulances");
}

export function listHospitals() {
  return request("/hospitals");
}

export function statusOverview() {
  return request("/status");
}

/** Live control-room metrics (active cases, response time, siren count). */
export function metrics() {
  return request("/metrics");
}

export function resetDemo() {
  return request("/demo/reset", { method: "POST" });
}

/** Transparent hospital recommendations + scoring breakdown for an emergency. */
export function getRecommendations(id) {
  return request(`/emergencies/${encodeURIComponent(id)}/recommendations`);
}

/** Current green-corridor state for an emergency. */
export function getCorridor(emergencyId) {
  return request(`/green-corridor/${encodeURIComponent(emergencyId)}`);
}

/** Centralised scoring weights + hard constraints (algorithm transparency). */
export function getScoringConfig() {
  return request("/scoring-config");
}

/** Hospital refreshes its own resource data (freshness timestamp updated). */
export function updateResources(id, { hospitalId, resources }) {
  return request(`/emergencies/${encodeURIComponent(id)}/resources`, {
    method: "POST",
    body: JSON.stringify({ role: "hospital", hospitalId, resources }),
  });
}

/** Deterministic full-scenario demo. */
export function runFullScenario() {
  return request("/demo/full-scenario", { method: "POST" });
}

/** Crash-detection demo. */
export function runCrashScenario() {
  return request("/demo/crash-scenario", { method: "POST" });
}

// Normalise an emergency response ({emergency} or raw) -> emergency object.
export function toEmergency(payload) {
  return payload?.emergency || payload;
}

const api = {
  createEmergency,
  listEmergencies,
  getEmergency,
  applyAction,
  toggleSiren,
  listAmbulances,
  listHospitals,
  statusOverview,
  metrics,
  resetDemo,
  getRecommendations,
  getCorridor,
  getScoringConfig,
  updateResources,
  runFullScenario,
  runCrashScenario,
  toEmergency,
};

export default api;