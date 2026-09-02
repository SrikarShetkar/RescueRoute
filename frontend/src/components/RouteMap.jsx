import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { iconHtml } from "./Icon";
import "./RouteMap.css";

/**
 * RouteMap — a REAL interactive map (OpenStreetMap via Leaflet).
 *
 * Props:
 *   from      -> ambulance start point            {lat,lng}
 *   to        -> current destination             {lat,lng}
 *   progress  -> 0..1 position along from->to route
 *   patient   -> patient point                   {lat,lng}
 *   hospital  -> hospital point                  {lat,lng}
 *   label     -> caption under the map
 *   live      -> true = "LIVE GPS", else "SIMULATION"
 *   routeState-> one of "to-patient" | "to-hospital" | "rerouting" |
 *               "arrived" (drives polyline colour + status chip)
 *   corridor  -> green corridor object (renders the geo-fence buffer)
 *
 * The ambulance marker moves live as `progress` changes so the journey
 * animates on a real map. Re-fit only happens on geometry change to keep the
 * animation smooth.
 */

export function interpolate(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

function markerIcon(name, color) {
  return L.divIcon({
    className: "rm-leaf-icon",
    html: `<span style="display:inline-flex;color:${color}">${iconHtml(name, { size: 30 })}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

let DEFAULT = { lat: 17.44, lng: 78.44 };

const ROUTE_STATE_LABEL = {
  "to-patient": "Ambulance → Patient",
  "to-hospital": "Ambulance + Patient → Hospital",
  rerouting: "Rerouting — route recalculating",
  arrived: "Arrived at Hospital",
};

export default function RouteMap({ from, to, progress = 0, patient, hospital, label, live, routeState, corridor }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeRef = useRef(null);
  const corridorCircleRef = useRef(null);
  const statusRef = useRef(null);
  const fitKeyRef = useRef("");
  const [tilesFailed, setTilesFailed] = useState(false);

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView([DEFAULT.lat, DEFAULT.lng], 13);
    mapRef.current = map;

    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    tiles.on("tileerror", () => setTilesFailed(true));
    tiles.addTo(map);

    markersRef.current = {
      ambulance: L.marker([DEFAULT.lat, DEFAULT.lng], { icon: markerIcon("ambulance", "#00c2ff") }).addTo(map),
      patient: L.marker([DEFAULT.lat, DEFAULT.lng], { icon: markerIcon("location", "#ff5c5c") }).addTo(map),
      hospital: L.marker([DEFAULT.lat, DEFAULT.lng], { icon: markerIcon("hospital", "#00d9b2") }).addTo(map),
      destination: L.marker([DEFAULT.lat, DEFAULT.lng], { icon: markerIcon("tag", "#ffc24b") }).addTo(map),
    };
    // Destination flag marker — only shown when distinct from source markers.
    markersRef.current.destination.setOpacity(0);

    // Status chip rendered as a Leaflet control overlay in the container.
    const statusEl = document.createElement("div");
    statusEl.className = "rm-route-state";
    statusEl.innerHTML = "&nbsp;";
    statusEl.style.display = "none";
    el.appendChild(statusEl);
    statusRef.current = statusEl;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      routeRef.current = null;
      corridorCircleRef.current = null;
      statusRef.current = null;
    };
  }, []);

  // Update markers / route / bounds / corridor / status chip.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const toLL = (p) => (p && Number.isFinite(p.lat) ? L.latLng(p.lat, p.lng) : null);
    const setMark = (key, p) => {
      const m = markersRef.current[key];
      const ll = toLL(p);
      if (m) {
        m.setLatLng(ll || DEFAULT);
        m.setOpacity(ll ? 1 : 0);
      }
    };

    const ambPos = from && to ? interpolate(from, to, progress) : from || null;
    setMark("ambulance", ambPos);
    setMark("patient", patient);
    setMark("hospital", hospital);
    setMark("destination", to && to !== patient && to !== hospital ? to : null);

    // Route polyline — colour depends on route state.
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    const fromLL = toLL(from);
    const toLLpt = toLL(to);
    if (fromLL && toLLpt) {
      const locked = routeState === "to-hospital" || routeState === "arrived";
      const rerouting = routeState === "rerouting";
      const color = locked ? "#3ef27c" : rerouting ? "#ffc24b" : "#0099ff";
      const dash = rerouting ? "4 6" : locked ? "" : "8 10";
      routeRef.current = L.polyline([fromLL, toLLpt], { color, weight: 4, dashArray: dash, opacity: 0.95 }).addTo(map);
    }

    // Green corridor geo-fence buffer (visual, labelled SIMULATED).
    if (corridorCircleRef.current) {
      corridorCircleRef.current.remove();
      corridorCircleRef.current = null;
    }
    if (corridor?.active && to) {
      const radiusM = Math.max(150, (corridor.bufferKm || 0.5) * 1000);
      corridorCircleRef.current = L.circle(toLL(to), { radius: radiusM, color: "#3ef27c", weight: 1, dashArray: "4 4", fillColor: "#3ef27c", fillOpacity: 0.08, interactive: false }).addTo(map);
      if (corridorCircleRef.current) {
        try { corridorCircleRef.current.bindTooltip("Green corridor buffer", { permanent: false }); } catch { /* no-op */ }
      }
    }

    // Status chip.
    if (statusRef.current) {
      const label = ROUTE_STATE_LABEL[routeState] || (routeState ? String(routeState) : "");
      if (label) {
        statusRef.current.textContent = label;
        statusRef.current.style.display = "block";
        statusRef.current.className = `rm-route-state rs-${routeState || ""}`;
      } else {
        statusRef.current.style.display = "none";
      }
    }

    // Re-fit the view only when geometry changes (not on every progress tick).
    const gkey = [from?.lat, from?.lng, to?.lat, to?.lng, patient?.lat, patient?.lng, hospital?.lat, hospital?.lng].map((v) => (v == null ? "" : v.toFixed(5))).join(",");
    const pts = [ambPos, patient, hospital, from].filter((p) => p && Number.isFinite(p.lat)).map(toLL);
    if (gkey !== fitKeyRef.current && pts.length) {
      fitKeyRef.current = gkey;
      map.fitBounds(L.latLngBounds(pts).pad(0.3));
    }
  }, [from, to, progress, patient, hospital, routeState, corridor]);

  return (
    <div className="routemap">
      <div className="routemap-label">
        <span className={`datalabel ${live ? "live" : "simulated"}`}>{live ? "LIVE GPS" : "SIMULATION"}</span>
        {label && <span className="routemap-caption">{label}</span>}
        {corridor?.active && <span className="datalabel live routemap-corridor">GREEN CORRIDOR</span>}
        {tilesFailed && <span className="routemap-warn">MAP TILES UNAVAILABLE (offline) — markers still live</span>}
      </div>
      <div className="routemap-leaf" ref={containerRef} />
    </div>
  );
}