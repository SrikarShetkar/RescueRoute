/**
 * greenCorridor.js — Geo-fenced citizen awareness around an active ambulance
 * hospital route.
 *
 * The corridor is NOT a traffic control system. It is a voluntary citizen
 * awareness layer: nearby users are told an emergency ambulance is approaching
 * so they can voluntarily keep the route clear. Real traffic control would
 * require government / traffic-police infrastructure (documented limitation).
 *
 * Geo-fencing: only users whose position is within a configurable corridor
 * buffer around the direct ambulance->hospital route receive the alert — NEVER
 * every RescueRoute user in the city.
 */

const config = require("../config/scoringConfig");

function corridorId() {
  return `GC-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
}

/**
 * pointToSegmentDistance — minimum distance (km) from point p to segment [a,b]
 * using a standard 2D projection with lat/lng treated as an equirectangular
 * projection. Good enough at city scale for the demo; a production build would
 * use a geodesic library.
 */
function pointToSegmentDistanceKm(p, a, b) {
  const x1 = a.lng, y1 = a.lat;
  const x2 = b.lng, y2 = b.lat;
  const px = p.lng, py = p.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  let t;
  if (lenSq === 0) {
    t = 0;
  } else {
    t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  }

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  const dLng = px - projX;
  const dLat = py - projY;
  // Convert lng distance to km via cosine of latitude (rough, fine for demo).
  const midLat = (py + projY) / 2;
  const kmLng = dLng * 111.32 * Math.cos((midLat * Math.PI) / 180);
  const kmLat = dLat * 111.32;
  return Math.sqrt(kmLng * kmLng + kmLat * kmLat);
}

/**
 * usersWithinCorridor(routePoints, users, widthKm) — geo-fenced user filter.
 * Returns the subset of users within `widthKm` of the route polyline.
 */
function usersWithinCorridor(routePoints, users, widthKm) {
  const defaults = routePoints.length >= 2
    ? routePoints
    : [
        { lat: routePoints[0]?.lat ?? 0, lng: routePoints[0]?.lng ?? 0 },
        { lat: routePoints[0]?.lat ?? 0, lng: routePoints[0]?.lng ?? 0 },
      ];

  return (users || []).filter((u) => {
    if (!u.location || typeof u.location.lat !== "number") return false;
    for (let i = 0; i < defaults.length - 1; i++) {
      const d = pointToSegmentDistanceKm(u.location, defaults[i], defaults[i + 1]);
      if (d <= widthKm) return true;
    }
    return false;
  });
}

function approximateRouteLengthKm(routePoints) {
  let total = 0;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    const dLat = (b.lat - a.lat) * 111.32;
    const dLng = (b.lng - a.lng) * 111.32 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
    total += Math.sqrt(dLat * dLat + dLng * dLng);
  }
  return Math.round(total * 10) / 10;
}

/**
 * activateCorridor — build and activate the corridor for an emergency that has
 * a locked destination (hospital accepted, ambulance travelling to hospital).
 *
 * Returns currentCorridor state or null (when the engine decides to end it).
 */
function computeCorridor(emergency, users, widthKm) {
  const from = emergency.ambulance?.liveLocation || emergency.location;
  const to = emergency.hospital?.liveLocation;
  if (!to) return null;

  const routePoints = [from, to];
  const corridorLengthKm = approximateRouteLengthKm(routePoints);
  const bufferKm = widthKm || config.CORRIDOR_CONFIG.defaultWidthKm;

  const eligible = usersWithinCorridor(routePoints, users || [], bufferKm);
  const notificationText = buildNotification(emergency);

  return {
    corridorId: corridorId(),
    active: true,
    status: "ACTIVE",
    ambulanceId: emergency.ambulanceId,
    emergencyId: emergency.emergencyId,
    destination: emergency.hospital.name,
    hospitalId: emergency.hospitalId,
    routePoints,
    corridorLengthKm: Math.min(corridorLengthKm, config.CORRIDOR_CONFIG.maxCorridorLengthKm),
    bufferKm,
    notifiedUsers: eligible.length,
    notificationText,
    notifiedAt: new Date().toISOString(),
    notificationStatus: "SENT",
    mode: "VOLUNTARY_AWARENESS",
  };
}

function buildNotification(emergency) {
  const minutes = emergency.etaToHospital ? etaMinutes(emergency.etaToHospital) : null;
  return {
    title: "Emergency Ambulance Nearby",
    body: `An ambulance carrying a critical patient is approaching your area. ETA: ${minutes ? `${minutes} min` : "shortly"}. Please keep the route clear and allow emergency vehicles to pass.`,
    etaMinutes: minutes,
    note: "Voluntary cooperation — no patient information is shared.",
  };
}

function etaMinutes(etaStr) {
  const m = String(etaStr).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function endCorridor() {
  return {
    corridorId: null,
    active: false,
    status: "ENDED",
    routePoints: [],
    corridorLengthKm: 0,
    notifiedUsers: 0,
    notificationStatus: "NONE",
  };
}

module.exports = {
  corridorId,
  pointToSegmentDistanceKm,
  usersWithinCorridor,
  computeCorridor,
  endCorridor,
  buildNotification,
  approximateRouteLengthKm,
};