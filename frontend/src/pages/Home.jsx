import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import "./Home.css";

/**
 * RescueRoute — landing page.
 *
 * A premium, cinematic, scroll-driven showcase of the emergency-response
 * system. Tells the story of one emergency flowing through five screens,
* driven by a single server-side state machine. Pure presentation layer:
* every route link points at the real, working dashboards.
*/

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const HERO_STAGES = [
  { id: "REPORT_RECEIVED", key: "REPORT RECEIVED", crit: true },
  { id: "CRASH_DETECTED", key: "DETECTING", crit: true },
  { id: "DISPATCHING", key: "DISPATCHING", disp: true },
  { id: "AMBULANCE_EN_ROUTE", key: "EN ROUTE", act: true },
  { id: "GREEN_CORRIDOR", key: "CORRIDOR ACTIVE", act: true },
  { id: "HOSPITAL_ALERTED", key: "HOSPITAL ALERTED", act: true },
];

const STATES = [
  { n: "01", name: "REPORTED", d: "A citizen taps SOS, a phone detects a crash, or a bystander files a report.", s: "CITIZEN" },
  { n: "02", name: "TRIAGED", d: "Severity, condition and location are assessed before anything is dispatched.", s: "ENGINE" },
  { n: "03", name: "DISPATCHING", d: "Traffic, vehicle type, hospital capacity and specialty matching influence the assignment.", s: "ENGINE" },
  { n: "04", name: "ASSIGNED", d: "The nearest available unit is offered the case, with a computed ETA.", s: "AMBULANCE" },
  { n: "05", name: "EN ROUTE", d: "The ambulance accepts and begins broadcasting its live position.", s: "AMBULANCE" },
  { n: "06", name: "CORRIDOR ACTIVE", d: "The green corridor lights along the route as the ambulance approaches.", s: "CITY" },
  { n: "07", name: "HOSPITAL READY", d: "The ER sees the incoming patient, condition and needs before arrival.", s: "HOSPITAL" },
  { n: "08", name: "ARRIVED", d: "Hand-over to the ER; the corridor clears and screens reconcile.", s: "HOSPITAL" },
  { n: "09", name: "CLOSED", d: "One source of truth, end to end. Every screen returns to standby.", s: "ALL" },
];

const SCREENS = [
  {
    idx: "01",
    stat: "STATE · REPORTED",
    name: "CITIZEN",
    line:
      "Reports an emergency, receives AI first-aid guidance and watches the response unfold around them.",
    feats: ["one-tap SOS · bystander · crash check-in", "confirm location + severity", "AI first-aid triage", "live tracker with share code"],
    pv: "sos",
  },
  {
    idx: "02",
    stat: "STATE · ASSIGNED → EN ROUTE",
    name: "AMBULANCE",
    line:
      "Accepts dispatch, navigates the route and broadcasts its live GPS position to everyone who needs it.",
    feats: ["offer card — nothing moves until you accept", "real Leaflet + OpenStreetMap map", "camera / mic / GPS sensor inputs", "siren toggle, server-gated"],
    pv: "ambulance",
  },
  {
    idx: "03",
    stat: "STATE · EVERY STAGE",
    name: "CONTROL ROOM",
    line:
      "Sees every active emergency, assignment, ETA and system event from one dispatch console.",
    feats: ["all active cases, one view", "live event feed", "false-alarm guard", "metrics + reset"],
    pv: "control",
  },
  {
    idx: "04",
    stat: "STATE · CORRIDOR ACTIVE",
    name: "THE CITY",
    line:
      "The nearby driver gets a full-screen give-way alert the moment a siren event broadcasts.",
    feats: ["full-screen GIVE WAY alert", "live metre countdown", "siren audio plays here (server-gated)", "mic-based siren detection"],
    pv: "driver",
  },
  {
    idx: "05",
    stat: "STATE · HOSPITAL READY → ARRIVED",
    name: "HOSPITAL",
    line:
      "Sees the incoming patient, condition, ETA and needs before the ambulance arrives.",
    feats: ["incoming-patient preview", "✓ accept — or the engine reassigns", "bed / specialty matching", "corridor greens on accept"],
    pv: "hospital",
  },
];

const TRIGGERS = [
  {
    chip: "SENSOR",
    live: true,
    title: "ACCELEROMETER",
    steps: ["PHONE", "ACCELEROMETER", "CRASH DETECTED"],
    out: "RESCUEROUTE ENGINE",
  },
  {
    chip: "GPS",
    live: true,
    title: "LIVE LOCATION",
    steps: ["PHONE", "GPS", "LIVE POSITION"],
    out: "RESCUEROUTE ENGINE",
  },
  {
    chip: "AUDIO",
    live: true,
    title: "MIC / SIREN",
    steps: ["MIC", "SIREN DETECTED", "LOCAL ALERT"],
    out: "NEARBY DRIVER",
  },
  {
    chip: "VISION",
    live: true,
    title: "WEBCAM",
    steps: ["WEBCAM", "CRASH DETECTED", "EMERGENCY CREATED"],
    out: "RESCUEROUTE ENGINE",
  },
];

const USERS = [
  { role: "Citizen", cred: "citizen", desk: "/citizen" },
  { role: "Ambulance", cred: "driver.amb", desk: "/ambulance" },
  { role: "Hospital", cred: "er.staff", desk: "/hospital" },
  { role: "Control Room", cred: "control", desk: "/control-room" },
  { role: "Nearby Driver", cred: "nearby", desk: "/driver" },
];

const PRINCIPLES = [
  {
    title: "One source of truth",
    body: "emergencyEngine.js holds the entire case lifecycle in memory. Every screen is a live mirror of it over Socket.IO — there is no half-updated UI anywhere.",
    src: "backend/domain/emergencyEngine.js",
  },
  {
    title: "Server-gated sound",
    body: "No screen invents its own audio. A sound plan only fires on a real sound:event emitted by the engine — the siren plays only on the nearby-driver screen.",
    src: "soundManager · SoundCenter",
  },
  {
    title: "Role-locked routing",
    body: "A ProtectedRoute bounces a wrong-role visit straight back to that account's own dashboard. Each laptop genuinely IS one role.",
    src: "ProtectedRoute · AuthContext",
  },
  {
    title: "Real map, real moves",
    body: "Leaflet renders real OpenStreetMap tiles and the ambulance marker animates along actual streets — with real GPS or a clearly-labelled simulation fallback.",
    src: "RouteMap · location.js",
  },
];

/* ================================================================== */
/*  Animation hook — reveals + one-shot handler                       */
/* ================================================================== */

function useReveal() {
  const ref = useRef(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const els = ref.current?.querySelectorAll(".rr-reveal");
    if (!els) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [tick]);
  const reveal = useCallback(() => setTick((t) => t + 1), []);
  return { ref, reveal };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return reduced;
}

/* ================================================================== */
/*  Hero city grid — autonomous emergency loop                        */
/* ================================================================== */

const XS = [70, 190, 320, 450, 570];
const YS = [60, 180, 300, 420];
const V_ROADS = [90, 210, 340, 470, 590];
const H_ROADS = [80, 200, 320, 440];

function SeedRng() {
  let s = 42;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function HeroMap({ stage, reduced }) {
  const wrapRef = useRef(null);
  const [geo, setGeo] = useState(() => ({
    started: false, stage: 0, amb: null, siren: false, state: 0.5, done: false,
  }));
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const [dim, setDim] = useState({ w: 600, h: 480 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDim({ w: Math.round(r.width), h: Math.round((r.width * 480) / 600) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resetCase = useCallback(() => {
    const rnd = SeedRng();
    const pickNode = () => ({ x: XS[Math.floor(rnd() * XS.length)], y: YS[Math.floor(rnd() * YS.length)] });
    let s = { x: 470, y: 440 };
    let p = { x: 190, y: 200 };
    // ensure a decent Manhattan gap so the path is visible
    while (Math.abs(p.x - s.x) + Math.abs(p.y - s.y) < 160) {
      p = pickNode();
      s = pickNode();
    }
    setGeo({ started: true, stage: 0, amb: null, siren: false, state: 0.0, done: false, s, p });
  }, []);

  useEffect(() => {
    resetCase();
  }, [resetCase]);

  // animation loop — autonomous stage progression
  useEffect(() => {
    if (reduced) return;
    const SRC = { x: 470, y: 440 };
    const HOS = { x: 570, y: 60 };
    let raf;
    let t0 = performance.now();
    let lastStage = -1;

    const tick = (now) => {
      const c = geoRef.current;
      if (!c.s || !c.p) { raf = requestAnimationFrame(tick); return; }
      const segLen = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      const move1 = Math.max(2200, segLen(SRC, c.p) * 3.4);
      const move2 = Math.max(2400, segLen(c.p, HOS) * 3.2);

      // reset the stage timer if the stage (or done flag) changed since last frame
      if (c.stage !== lastStage || c.done !== (lastStage === 99)) {
        t0 = now;
      }
      lastStage = c.done ? 99 : c.stage;

      const dt = now - t0;
      const stage = c.stage;
      let next = null;

      if (c.done && dt > 1400) next = { done: false, stage: 0, state: 0, siren: false };
      else if (stage === 0 && dt > 900) next = { stage: 1, state: 0 };        // REPORTED -> DETECT
      else if (stage === 1 && dt > 700) next = { stage: 2, state: 0 };        // DETECT -> DISPATCH
      else if (stage === 2 && dt > 1400) next = { stage: 3, state: 0 };       // DISPATCH -> EN ROUTE
      else if (stage === 3) {
        const pr = Math.min(1, dt / move1);
        if (pr >= 1) next = { stage: 4, state: 0, siren: false };
        else next = { state: pr };
      } else if (stage === 4) {
        if (dt > 1100 && !c.siren) next = { siren: true };
        const pr = Math.min(1, dt / move2);
        if (pr >= 1) next = { ...(next || {}), stage: 5, state: 1 };
        else next = { ...(next || {}), state: pr };
      } else if (stage === 5 && dt > 2200) {
        next = { done: true };
      }

      if (next) {
        setGeo((g) => ({ ...g, ...next }));
        if (next.stage !== undefined) t0 = now; // stage change resets the timer
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="rr-map-wrap" ref={wrapRef}>
      <span className="rr-map-corner tl" />
      <span className="rr-map-corner tr" />
      <span className="rr-map-corner bl" />
      <span className="rr-map-corner br" />
      <svg viewBox={`0 0 ${dim.w} ${dim.h}`} style={{ width: "100%", height: "auto" }} aria-hidden="true">
        <HexMap dim={dim} />
        <Route overlay geo={geo} dim={dim} />
      </svg>
      <HeroHud stage={stage} geo={geo} />
    </div>
  );
}

/* static city base — generated once with a seeded RNG for a stable, designed layout */
function HexMap({ dim }) {
  const W = 600, H = 480;
  const cells = useMemoGrid(W, H);
  return (
    <g>
      <rect width={W} height={H} fill="#0c0c0c" />
      {/* blocks between roads */}
      {cells.map((b, i) => <rect key={"b" + i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.f} />)}
      {/* roads */}
      {V_ROADS.map((x) => <rect key={"vr" + x} x={x - 7} y={0} width={14} height={H} fill="#171717" />)}
      {H_ROADS.map((y) => <rect key={"hr" + y} x={0} y={y - 7} width={W} height={14} fill="#171717" />)}
      {/* road dashed centerlines */}
      {V_ROADS.map((x) => <line key={"vcl" + x} x1={x} y1={0} x2={x} y2={H} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4 9" />)}
      {H_ROADS.map((y) => <line key={"hcl" + y} x1={0} y1={y} x2={W} y2={y} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4 9" />)}
      <text x={V_ROADS[1] + 12} y={H - 50} fill="#4d4d4d" fontSize="10" fontFamily="monospace">MERIDIAN ST</text>
      <text x={38} y={H_ROADS[3] - 16} fill="#4d4d4d" fontSize="10" fontFamily="monospace">1ST AVE</text>
      {/* hospital */}
      <Hospital x={V_ROADS[4]} y={H_ROADS[0]} />
    </g>
  );
}

function useMemoGrid(W, H) {
  return useMemo(() => {
    const rnd = SeedRng();
    const blocks = [];
    const gp = 44; // gap from road center
    for (let i = 0; i < V_ROADS.length - 1; i++) {
      for (let j = 0; j < H_ROADS.length - 1; j++) {
        const x0 = V_ROADS[i] + gp;
        const y0 = H_ROADS[j] + gp;
        const x1 = V_ROADS[i + 1] - gp;
        const y1 = H_ROADS[j + 1] - gp;
        blocks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, f: "#121212" });
      }
    }
    // sprinkle a few darker building footprints inside large cells
    const cells = [];
    blocks.forEach((blk) => {
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const bw = (rnd() * 0.4 + 0.18) * blk.w;
        const bh = (rnd() * 0.4 + 0.18) * blk.h;
        const bx = blk.x + rnd() * (blk.w - bw);
        const by = blk.y + rnd() * (blk.h - bh);
        cells.push({ x: bx, y: by, w: bw, h: bh, f: "rgba(255,255,255,0.02)" });
      }
    });
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Hospital({ x, y }) {
  return (
    <g>
      <rect x={x - 12} y={y - 12} width="24" height="24" rx="2" fill="#0d0d0d" stroke="#3ef27c" strokeWidth="1.2" />
      <rect x={x - 2} y={y - 6} width="4" height="12" fill="#3ef27c" />
      <rect x={x - 6} y={y - 2} width="12" height="4" fill="#3ef27c" />
      <text x={x} y={y + 30} textAnchor="middle" fill="#5b6359" fontSize="9" fontFamily="monospace">HOSPITAL</text>
    </g>
  );
}

/* the moving route + markers, driven by the autonomous geo state */
function Route({ geo, dim }) {
  const p = geo.p || { x: 190, y: 200 };
  const src = { x: 470, y: 440 };
  const hos = { x: 570, y: 60 };
  const stage = geo.stage;

  const leg1pts = manhattan(src, p);
  const leg2pts = manhattan(p, hos);
  const full = [...leg1pts.slice(0, -1), ...leg2pts];

  const ptsToString = (pts) => pts.map((pt) => `${pt.x},${pt.y}`).join(" ");
  const leg1Str = ptsToString(leg1pts);
  const leg2Str = ptsToString(leg2pts);
  const fullStr = ptsToString(full);

  let amb1 = null;
  let amb2 = null;
  let sirenFlash = false;
  let corridor = false;

  if (stage >= 3 && !(stage === 3 && (geo.state || 0) <= 0.005)) {
    amb1 = pointAlong(leg1pts, geo.state || 0);
  }
  if (stage >= 4) {
    amb2 = pointAlong(leg2pts, geo.state || 0);
    corridor = true;
  }
  if (stage === 4 && geo.siren) sirenFlash = true;

  // marker position: on leg1 when moving to patient, else on leg2
  const marker = amb1 || amb2 || { x: src.x, y: src.y };

  return (
    <g>
      {/* dashed offered route (stage>=2) */}
      {(stage >= 2) && (
        <polyline points={leg1Str} fill="none" stroke="#3d3d3d" strokeWidth="1.6" strokeDasharray="3 6" opacity="0.7" />
      )}
      {/* full dim route once en route */}
      {(stage >= 3) && (
        <polyline points={fullStr} fill="none" stroke="#2c372e" strokeWidth="2" opacity="0.9" />
      )}
      {/* green corridor (active during leg2) */}
      {corridor && (
        <polyline points={leg2Str} fill="none" stroke="#3ef27c" strokeWidth="2.6" opacity="0.95"
          style={{ filter: "drop-shadow(0 0 6px rgba(62,242,124,0.5))" }} />
      )}
      {/* corridor node pulses */}
      {corridor && leg2pts.slice(0, -1).map((nd, i) => (
        <circle key={"cn" + i} cx={nd.x} cy={nd.y} r="3.2" fill="none" stroke="#3ef27c" strokeWidth="1"
          opacity={stage === 4 ? "0.9" : "0.3"} className="rrPulseDot" />
      ))}

      {/* patient marker */}
      <g>
        <circle cx={p.x} cy={p.y} r="6.5" fill="none" stroke="#ff4a3d" strokeWidth="1.5" className="rrPulseDot" />
        <circle cx={p.x} cy={p.y} r="2.4" fill="#ff4a3d" />
      </g>
      <text x={p.x + 9} y={p.y - 9} fill="#ff6a5e" fontSize="9.5" fontFamily="monospace" fontWeight="500">EM-2048</text>

      {/* siren flash near driver */}
      {sirenFlash && (
        <g>
          <rect x={midX - 60} y={midY - 18} width="120" height="24" rx="2" fill="#ff4a3d" opacity="0.92" />
          <text x={midX} y={midY - 1} textAnchor="middle" fill="#fff" fontSize="10" fontFamily="monospace" fontWeight="700">GIVE WAY</text>
        </g>
      )}

      {/* ambulance marker */}
      <g transform={`translate(${marker.x},${marker.y})`}>
        <circle r="11" fill="none" stroke="#3ef27c" strokeWidth="1.4" opacity="0.6" className="rrRing" />
        <rect x="-6" y="-7.5" width="12" height="15" rx="2.5" fill="#eef3ec" stroke="#0c0f0c" strokeWidth="1" />
        <rect x="-6" y="-1.8" width="12" height="3" fill="#ff4a3d" />
        <rect x="-3" y="-4.2" width="6" height="1.6" fill="#2a2f2a" />
      </g>
      <text x={marker.x} y={marker.y + 22} textAnchor="middle" fill="#5b6359" fontSize="9" fontFamily="monospace">AMB-001</text>

      {/* depot base */}
      <circle cx={src.x} cy={src.y} r="3.4" fill="#2c372e" />
      <text x={src.x} y={src.y + 16} textAnchor="middle" fill="#4a5349" fontSize="8.5" fontFamily="monospace">BASE</text>
    </g>
  );
}

const midX = 340, midY = 300;

function manhattan(a, b) {
  const pts = [];
  let cx = a.x, cy = a.y;
  pts.push({ x: cx, y: cy });
  const dx = b.x - a.x;
  const xdir = dx >= 0 ? 1 : -1;
  for (let x = a.x + xdir; xdir > 0 ? x <= b.x : x >= b.x; x += xdir) {
    pts.push({ x, y: a.y });
  }
  cx = b.x;
  const dy = b.y - a.y;
  const ydir = dy >= 0 ? 1 : -1;
  for (let y = a.y + ydir; ydir > 0 ? y <= b.y : y >= b.y; y += ydir) {
    pts.push({ x: cx, y });
  }
  return pts;
}

function pointAlong(pts, t) {
  const total = segList(pts);
  const target = t * total;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = manh(pts[i], pts[i + 1]);
    if (acc + d >= target) {
      const f = (target - acc) / (d || 1);
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    acc += d;
  }
  return pts[pts.length - 1];
}
function segList(pts) {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += manh(pts[i], pts[i + 1]);
  return s;
}
function manh(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function HeroHud({ stage, geo }) {
  const s = HERO_STAGES[stage] || HERO_STAGES[0];
  const eta = geo.stage >= 3 ? Math.max(0, Math.round((1 - (geo.state || 0)) * 4.6) - Math.floor(geo.stage === 3 ? 0 : 0)) : 4;
  return (
    <>
      <div className="rr-map-hud">
        <span className="hud-label">
          <span className="rr-live-dot" />
          SECTOR 7
        </span>
        <span className="hud-sim">simulated</span>
      </div>
      <div className="rr-map-status-strip">
        <span className="k">CASE</span>
        <span className="v">RR-2048</span>
        <span className="k">STATUS</span>
        <span className={`v ${s.crit ? "crit" : s.disp ? "disp" : "act"}`}>{s.key}</span>
        <span className="k">AMBULANCE ETA</span>
        <span className="v act">0{Math.max(0, eta)}:32</span>
        <span className="k">HOSPITAL</span>
        <span className="v">READY</span>
      </div>
      <div className="rr-hero-cue">
        <span>Scroll to follow the response</span>
        <span className="rr-cue-line" />
      </div>
    </>
  );
}

/* ================================================================== */
/*  State machine (desktop SVG + mobile accordion)                    */
/* ================================================================== */

function StateMachine() {
  const [active, setActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(null);

  // animate the traveling pulse (SVG SMIL handles moving dot on the line)
  return (
    <div className="rr-states">
      <div className="container">
        <div className="rr-states-head">
          <span className="rr-eyebrow">The engine</span>
          <h2 className="rr-display rr-reveal">ONE CASE.<br />NINE STATES.</h2>
          <p className="rr-reveal">
            A single server-side state machine drives every screen. Each transition is a
            real event — pushed live over Socket.IO — never an optimistic local guess.
          </p>
        </div>

        <div className="rr-pipeline rr-reveal">
          <svg viewBox="0 0 1180 220" className="rr-pipeline-svg" onMouseLeave={() => setActive(cur => cur < 0 ? cur : (cur + 1 - 1))}>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#3a4a3f" />
              </marker>
            </defs>
            {/* connective line */}
            <line x1="70" y1="70" x2="1110" y2="70" stroke="#2c372e" strokeWidth="1.5" />
            {STATES.map((st, i) => {
              const x = 70 + i * 130;
              const lit = i <= active;
              return (
                <g key={st.n}
                  onMouseEnter={() => setActive(i)}
                  style={{ cursor: "pointer" }}>
                  <circle cx={x} cy="70" r="10" className={`ps-node ${lit ? "lit" : ""}`} />
                  <circle cx={x} cy="70" r="3" fill={lit ? "#3ef27c" : "#4a5349"} />
                  <text x={x} y="100" textAnchor="middle" className={`ps-name ${lit ? "active-line" : ""}`}>{st.name}</text>
                  <text x={x} y="116" textAnchor="middle" className="ps-num">{st.s}</text>
                  <text x={x} y="56" textAnchor="middle" className="ps-num">{st.n}</text>
                </g>
              );
            })}
            {/* traveling pulse on the line (SMIL) */}
            <line x1="70" y1="70" x2="1110" y2="70" stroke="#3ef27c" strokeWidth="1.5">
              <animate attributeName="x1" from="70" to="1110" dur="7s" repeatCount="indefinite" />
            </line>
            <circle r="4" fill="#3ef27c" className="ps-core" style={{ filter: "drop-shadow(0 0 6px #3ef27c)" }}>
              <animateMotion dur="7s" repeatCount="indefinite" path="M70,70 L1110,70" />
            </circle>
            {/* decline branch */}
            <path d="M460,70 h20 v40 h150" fill="none" stroke="#3a4a3f" strokeWidth="1.2" strokeDasharray="4 5" markerEnd="url(#arr)" />
            <text x="482" y="128" fill="#8b9389" fontSize="9" fontFamily="monospace">decline → next-best unit</text>
            <path d="M760,70 h20 v40 h110" fill="none" stroke="#3a4a3f" strokeWidth="1.2" strokeDasharray="4 5" markerEnd="url(#arr)" />
            <text x="782" y="128" fill="#8b9389" fontSize="9" fontFamily="monospace">ER can’t take → reassign</text>
          </svg>
        </div>

        <div className="rr-state-caption rr-reveal">
          <span className="tag">{STATES[active].n} — {STATES[active].name}</span> · {STATES[active].s}<br />
          <b>{STATES[active].d}</b>
        </div>

        {/* mobile accordion */}
        <div className="rr-statemobile">
          {STATES.map((st, i) => (
            <div key={st.n} className={`rr-sm-row ${mobileOpen === i ? "open" : ""}`} onClick={() => setMobileOpen(mobileOpen === i ? null : i)}>
              <span className="num">{st.n}</span>
              <div>
                <div className="name">{st.name}</div>
                <span className="rr-mono" style={{ color: "var(--rr-faint)", fontSize: 10 }}>{st.s}</span>
                <div className="desc">{st.d}</div>
              </div>
              <span className="dot" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Cascade section                                                   */
/* ================================================================== */

function Cascade() {
  const [lit, setLit] = useState(-1);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let i = 0;
        const loop = () => {
          i = (i + 1) % 7;
          setLit(i - 1);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        io.unobserve(el);
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const on = (i) => i < lit;
  const nodes = [
    { x: 450, y: 60, label: "SOS PRESSED", evt: "EMERGENCY:CREATED", core: true, r: 26 },
    { x: 110, y: 210, label: "CONTROL ROOM", evt: "EVENT RECEIVED", r: 22 },
    { x: 310, y: 210, label: "AMBULANCE", evt: "EMERGENCY:ASSIGNED", r: 22 },
    { x: 590, y: 210, label: "HOSPITAL", evt: "HOSPITAL:READY", r: 22 },
    { x: 790, y: 210, label: "NEARBY DRIVER", evt: "SIREN:EVENT", r: 22 },
  ];
  const links = [
    [0, 1], [0, 2], [0, 3], [0, 4],
  ];
  return (
    <div className="rr-cascade" ref={ref}>
      <div className="container">
        <span className="rr-eyebrow centered rr-reveal">One alert · many systems</span>
        <h2 className="rr-display rr-reveal">ONE ALERT.<br /><span className="rr-accent-green">FIVE SCREENS.</span></h2>
        <p className="rr-cascade-sub rr-reveal">A single event propagates in real time across every interface.</p>
      </div>
      <div className="rr-cascade-wrap rr-reveal">
        <svg viewBox="0 0 900 300" className="rr-cascade-svg">
          {links.map(([a, b], i) => (
            <line key={"l" + i}
              x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
              className={`cn-dash ${on(b) ? "lit" : ""}`} />
          ))}
          {nodes.map((nd, i) => {
            const boxX = i === 0 ? nd.x - 46 : nd.x - 66;
            return (
              <g key={"n" + i}>
                <rect x={nd.x - nd.r} y={nd.y - nd.r} width={nd.r * 2} height={nd.r * 2}
                  rx={nd.core ? 4 : 22} className={`cn-node ${nd.core ? (lit > 0 ? "core-lit" : "") : on(i) ? "lit" : ""}`} />
                <text x={nd.x} y={nd.y + 3} textAnchor="middle" className="cn-name" fill="#eef0e8">{nd.label}</text>
                {on(i) && <circle cx={nd.x} cy={nd.y} r={nd.r + 4} fill="none" stroke="#3ef27c" strokeWidth="1" className="cn-pulse" />}
                <text x={boxX} y={nd.y + nd.r + 16} textAnchor="middle" className="cn-evt">{nd.evt}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Mini previews for the five screens                               */
/* ================================================================== */

function ScreenPreview({ kind }) {
  return (
    <div className="rr-pv rr-reveal">
      <>
        <div className="rr-pv-bar">
          <span className="dot" />
          <span className="name">{kind === "sos" ? "citizen — track" : kind === "ambulance" ? "ambulance — en route" : kind === "control" ? "control room — dispatch" : kind === "driver" ? "nearby driver" : "hospital — er"}</span>
          <span style={{ color: "var(--rr-green)" }}>LIVE</span>
        </div>
        <div className="rr-pv-body">
          {kind === "sos" && (
            <div className="rr-pv-offer" style={{ borderColor: "var(--rr-red)", alignItems: "center", textAlign: "center" }}>
              <div className="rr-pv-sos">SOS</div>
              <div style={{ font: "700 11px/1.3 var(--font-display)", color: "#eef0e8", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 10 }}>Emergency sent</div>
              <div style={{ font: "500 10px/1.4 var(--font-mono)", color: "var(--rr-muted)" }}>EM-2048 · status REPORTED</div>
            </div>
          )}
          {kind === "ambulance" && (
            <div className="rr-pv-offer">
              <div className="row"><span className="lbl">Case</span><span className="val">EM-2048</span></div>
              <div className="row"><span className="lbl">ETA patient</span><span className="val ok">04:12</span></div>
              <div className="row"><span className="lbl">Status</span><span className="val" style={{ color: "var(--rr-amber)" }}>EN ROUTE</span></div>
              <div className="rr-pv-actions">
                <span className="rr-pv-btn" style={{ borderColor: "rgba(62,242,124,0.4)", color: "var(--rr-green)" }}>siren</span>
                <span className="rr-pv-btn ok">map live</span>
              </div>
            </div>
          )}
          {kind === "control" && (
            <div className="rr-pv-feed">
              <div className="ev crit"><span className="t">RR</span><span>EM-2048 → EN ROUTE</span></div>
              <div className="ev amber"><span className="t">RR</span><span>AMB-001 ETA 04:12</span></div>
              <div className="ev"><span className="t">RR</span><span>corridor armed · 4 nodes</span></div>
              <div className="ev"><span className="t">RR</span><span>HOSP-001 ready</span></div>
            </div>
          )}
          {kind === "driver" && (
            <div className="rr-pv-siren">
              <div className="big">Ambulance approaching</div>
              <div className="sub">PLEASE GIVE WAY — move left</div>
            </div>
          )}
          {kind === "hospital" && (
            <div className="rr-pv-incoming">
              <div className="row"><span className="lbl">Incoming</span><span className="val">EM-2048</span></div>
              <div className="row"><span className="lbl">Condition</span><span className="val">trauma</span></div>
              <div className="row"><span className="lbl">ETA</span><span className="val amber">06:40</span></div>
              <div className="rr-pv-actions" style={{ marginTop: 8 }}>
                <span className="rr-pv-btn ok" style={{ borderColor: "var(--rr-green)" }}>corridor green</span>
              </div>
            </div>
          )}
        </div>
      </>
    </div>
  );
}

/* ================================================================== */
/*  Main component                                                    */
/* ================================================================== */

export default function Home() {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const mainRef = useRef(null);

  // simpler scroll -> stage mapping
  useEffect(() => {
    if (reduced) return;
    const hero = mainRef.current?.querySelector(".rr-hero");
    if (!hero) return;
    const onScroll = () => {
      const rect = hero.getBoundingClientRect();
      const vh = window.innerHeight;
      // how much of the hero has scrolled past the top of the viewport
      const passed = Math.min(1, Math.max(0, (vh - rect.top - 120) / Math.max(1, rect.height)));
      const idx = Math.min(HERO_STAGES.length - 1, Math.floor(passed * HERO_STAGES.length));
      setStage(idx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  // reveal system
  const { ref: revRef } = useReveal();

  // toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const copy = (text, label) => {
    try {
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      showToast(label || "Copied");
    } catch {
      showToast("Copy failed");
    }
  };

  return (
    <div className="ldp" ref={mainRef}>
      <div ref={revRef}>
        {/* ---------- HERO ---------- */}
        <section className="rr-hero">
          <div className="container rr-hero-grid">
            <div>
              <div className="rr-hero-eyebrow-row">
                <span className="rr-eyebrow">LIVE EMERGENCY RESPONSE SYSTEM</span>
              </div>
              <h1 className="rr-display">
                <span className="line">ONE</span>
                <span className="line"><span className="rr-accent-red">EMERGENCY.</span></span>
                <span className="line">EVERYONE</span>
                <span className="line"><span className="rr-accent-green">CONNECTED.</span></span>
              </h1>
              <p className="rr-hero-sub">
                RescueRoute turns a single emergency report into a coordinated real-time response
                across citizens, ambulances, hospitals, dispatchers and nearby drivers.
              </p>
              <div className="rr-hero-ctas">
                <Link to="/login" className="rr-btn solid">Run the live demo <span className="rr-arw">→</span></Link>
                <a href="#system" className="rr-btn ghost">Explore the system</a>
              </div>
              <div className="rr-hero-notes">
                <span className="rr-hero-note"><span className="rl g" />Every number labelled<span className="rr-mono" style={{ color: "var(--rr-muted)" }}> REAL · SIM· DEMO</span></span>
                <span className="rr-hero-note"><span className="rl r" />Sounds only on real system events</span>
              </div>
            </div>

            <HeroMap stage={stage} reduced={reduced} />
          </div>
        </section>

        {/* ---------- THE MOMENT ---------- */}
        <section className="rr-moment">
          <div className="container">
            <span className="rr-eyebrow centered rr-reveal">The moment</span>
            <h2 className="rr-display rr-reveal">
              IT STARTS WITH<br /><span className="rr-accent-green">ONE SIGNAL.</span>
            </h2>
            <p className="rr-reveal">
              A citizen presses SOS.<br />
              A phone detects a crash.<br />
              A bystander reports an emergency.
            </p>
            <div className="rr-moment-turn">
              <p className="rr-reveal" style={{ color: "var(--rr-text)", fontWeight: 500, fontSize: 14, fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>
                THEN THE SYSTEM TAKES OVER.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- STATE MACHINE ---------- */}
        <StateMachine />

        {/* ---------- FIVE SCREENS ---------- */}
        <section className="rr-screens" id="system">
          <div className="container rr-screens-head">
            <span className="rr-eyebrow centered rr-reveal">Five interfaces</span>
            <h2 className="rr-display rr-reveal">ONE EMERGENCY.<br />FIVE SCREENS.</h2>
          </div>
          {SCREENS.map((s) => (
            <div className="container rr-screen-block" key={s.name}>
              <div className="rr-screen-info rr-reveal">
                <div className="rr-screen-index">{s.idx} · {s.stat}</div>
                <h3 className="rr-display">{s.name}</h3>
                <p>{s.line}</p>
                <ul className="rr-screen-feats">
                  {s.feats.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
              <ScreenPreview kind={s.pv} />
            </div>
          ))}
        </section>

        {/* ---------- THE CASCADE ---------- */}
        <Cascade />

        {/* ---------- PHYSICAL TRIGGERS ---------- */}
        <section className="rr-triggers">
          <div className="container rr-triggers-head">
            <span className="rr-eyebrow centered rr-reveal">Physical triggers</span>
            <h2 className="rr-display rr-reveal">NO BUTTON<span className="rr-accent-green"> REQUIRED.</span></h2>
            <p className="rr-reveal">
              RescueRoute doesn't just simulate an emergency — it can receive signals from the
              physical world and feed them into the same engine.
            </p>
          </div>
          <div className="rr-trigger-grid">
            {TRIGGERS.map((t) => (
              <div className="rr-trigger rr-reveal" key={t.title}>
                <span className={`rr-trigger-chip ${t.live ? "live" : ""}`}>{t.chip} {t.live ? "· live" : ""}</span>
                <div className="rr-trigger-title">{t.title}</div>
                <div className="rr-trigger-path">
                  {t.steps.map((s, i) => (
                    <React.Fragment key={s}>
                      {i > 0 && <span className="rr-trigger-arrow">↓</span>}
                      <span className={i === t.steps.length - 1 ? "step" : "step dim"}>{s}</span>
                    </React.Fragment>
                  ))}
                  <span className="rr-trigger-arrow">↓</span>
                  <span className="out">{t.out}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- CONTROL ROOM ---------- */}
        <section className="rr-controlroom" id="controlroom">
          <div className="container rr-cr-head">
            <span className="rr-eyebrow rr-reveal">The control room</span>
            <h2 className="rr-display rr-reveal">WHILE EVERYONE RESPONDS,<br />SOMEONE <span className="rr-accent-green">SEES EVERYTHING.</span></h2>
            <p className="rr-reveal">A live operational console — not a dashboard. Every active emergency, assignment, ETA and system event in one view.</p>
          </div>
          <div className="container">
            <div className="rr-cr-panel rr-reveal">
              <div className="rr-cr-top">
                <span className="t">RescueRoute · dispatch console</span>
                <span className="live"><span className="rr-live-dot" />LIVE · SIMULATED</span>
              </div>
              <div className="rr-cr-stats">
                <div className="rr-cr-stat"><div className="k">Active cases</div><div className="v">3</div><div className="d">-1 / last 10m</div></div>
                <div className="rr-cr-stat"><div className="k">Avg response</div><div className="v a">4:12</div><div className="d">dispatch → assignment</div></div>
                <div className="rr-cr-stat"><div className="k">Siren corridors</div><div className="v g">7</div><div className="d">intersections armed</div></div>
                <div className="rr-cr-stat"><div className="k">False alarms</div><div className="v r">0</div><div className="d">per-account tracked</div></div>
              </div>
              <div className="rr-cr-bottom">
                <div className="rr-cr-case">
                  <div className="head"><span>Active cases</span><span>GMT+05:30</span></div>
                  <div className="row"><span className="id">EM-2048</span><span className="name">En route</span><span className="eta">04:12</span><span className="rr-cr-badge crit">ACTIVE</span></div>
                  <div className="row"><span className="id">EM-2047</span><span className="name">ER handover</span><span className="eta">01:08</span><span className="rr-cr-badge disp">READY</span></div>
                  <div className="row"><span className="id">EM-2049</span><span className="name">Completed</span><span className="eta">—</span><span className="rr-cr-badge ok">CLOSED</span></div>
                </div>
                <div className="rr-cr-feed">
                  <div className="head"><span className="rr-live-dot" /> Event feed</div>
                  <div className="ev"><span className="t">RR</span><span className="m">EMERgency:created EM-2048</span></div>
                  <div className="ev"><span className="t">RR</span><span className="m">ambulance:moved AMB-001</span></div>
                  <div className="ev amber"><span className="t">RR</span><span className="m">siren:event → nearby</span></div>
                  <div className="ev"><span className="t">RR</span><span className="m">hospital:ready HOSP-001</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- UNDER THE HOOD ---------- */}
        <section className="rr-hood" id="hood">
          <div className="container rr-hood-head">
            <span className="rr-eyebrow rr-reveal">Architecture</span>
            <h2 className="rr-display rr-reveal">UNDER<br />THE HOOD.</h2>
          </div>
          <div className="container rr-hood-grid">
            <div className="rr-term rr-reveal">
              <div className="rr-term-top">
                <span className="fake" /><span className="fake" /><span className="fake" />
                <span style={{ marginLeft: 8 }}>rescueroute — stack</span>
              </div>
              <div className="rr-term-body">
                <div className="ln"><span className="cmt"># single-case, multi-screen emergency mesh</span></div>
                <div className="ln"><span className="dir">rescueroute/</span></div>
                <div className="ln">├── <span className="leaf">frontend/</span>   <span className="v">React 18 · :3000</span></div>
                <div className="ln">│   ├── <span className="leaf">maps/</span>      <span className="v">leaflet + osm tiles</span></div>
                <div className="ln">│   ├── <span className="leaf">sensors/</span>   <span className="v">gps · accel · mic · cam</span></div>
                <div className="ln">│   └── <span className="leaf">ai/</span>        <span className="v">gemini first-aid</span></div>
                <div className="ln">├── <span className="leaf">backend/</span>   <span className="v">express 5 · :5001</span></div>
                <div className="ln">│   ├── <span className="leaf">emergencyEngine.js</span> <span className="k">← source of truth</span></div>
                <div className="ln">│   ├── <span className="leaf">socket/</span>     <span className="v">socket.io 4</span></div>
                <div className="ln">│   ├── <span className="leaf">models/</span>    <span className="v">mongoose 9</span></div>
                <div className="ln">│   └── <span className="leaf">routes/</span>    <span className="v">/api/v1</span></div>
                <div className="ln">├── <span className="leaf">rbac/</span>        <span className="v">role-locked dashboards</span></div>
                <div className="ln">└── <span className="leaf">tests/</span>      <span className="v g">16/16 passing</span></div>
              </div>
            </div>
            <div className="rr-principles">
              {PRINCIPLES.map((p) => (
                <div className="rr-principle rr-reveal" key={p.title}>
                  <h4>{p.title}</h4>
                  <p>{p.body}</p>
                  <div className="src">↳ {p.src}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- PROOF ---------- */}
        <section className="rr-proof">
          <div className="container">
            <h2 className="rr-display rr-reveal">PROOF, NOT<br />PROMISES.</h2>
            <div className="rr-proof-stats">
              <div className="rr-proof-stat rr-reveal"><div className="num">5</div><div className="lbl">Screens · one case</div><div className="d">every role, one dashboard</div></div>
              <div className="rr-proof-stat rr-reveal"><div className="num g">1</div><div className="lbl">Emergency engine</div><div className="d">source of truth</div></div>
              <div className="rr-proof-stat rr-reveal"><div className="num a">16</div><div className="lbl">Tests passing</div><div className="d">verified · node:test</div></div>
              <div className="rr-proof-stat rr-reveal"><div className="num g">∞</div><div className="lbl">Real-time sockets</div><div className="d">socket.io everywhere</div></div>
            </div>
          </div>
        </section>

        {/* ---------- RUN THE DEMO ---------- */}
        <section className="rr-run" id="run">
          <div className="container rr-run-head">
            <span className="rr-eyebrow rr-reveal">The demo</span>
            <h2 className="rr-display rr-reveal">SEE IT<br />HAPPEN.</h2>
            <p className="rr-reveal">Trigger an emergency. Watch five screens respond.</p>
          </div>
          <div className="container rr-run-grid">
            <div className="rr-steps">
              {[
                { t: "Open the citizen screen", d: "Sign in as a role and you only ever see that role's dashboard." },
                { t: "Trigger a real or simulated emergency", d: "One-tap SOS, bystander, or the accelerator crash sensor." },
                { t: "Watch dispatch assign an ambulance", d: "The engine offers the nearest unit — nothing moves until it accepts." },
                { t: "Follow the ambulance on the live map", d: "Real GPS or a clearly-labelled simulation fallback." },
                { t: "Watch the hospital prepare", d: "It sees the incoming patient, condition and ETA before arrival." },
                { t: "See nearby drivers get the give-way alert", d: "A full-screen siren alert with a live metre countdown." },
              ].map((s, i) => (
                <div className="rr-step rr-reveal" key={i}>
                  <span className="n">0{i + 1}</span>
                  <div>
                    <div className="t">{s.t}</div>
                    <div className="d">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rr-accounts rr-reveal">
              <div className="rr-accounts-head">
                <span className="t">Demo accounts</span>
                <span className="np">password: password</span>
              </div>
              {USERS.map((u) => (
                <div className="rr-account" key={u.role}>
                  <span className="role">{u.role}</span>
                  <span className="cred">login: <b>{u.cred}</b> · {u.desk}</span>
                  <button className="rr-copybtn" onClick={() => copy(`${u.cred} / password`, `Copied ${u.cred}`)}>copy</button>
                </div>
              ))}
              <div className="rr-account" style={{ borderTop: "1px solid var(--rr-hairline)" }}>
                <span className="role">Routes</span>
                <span className="cred">
                  <Link to="/citizen" style={{ color: "var(--rr-green)", textDecoration: "none" }}>/citizen</Link> ·{" "}
                  <Link to="/ambulance" style={{ color: "var(--rr-green)", textDecoration: "none" }}>/ambulance</Link> ·{" "}
                  <Link to="/hospital" style={{ color: "var(--rr-green)", textDecoration: "none" }}>/hospital</Link> ·{" "}
                  <Link to="/control-room" style={{ color: "var(--rr-green)", textDecoration: "none" }}>/control-room</Link> ·{" "}
                  <Link to="/driver" style={{ color: "var(--rr-green)", textDecoration: "none" }}>/driver</Link>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FINAL CTA ---------- */}
        <section className="rr-final">
          <span className="rr-eyebrow centered rr-reveal">One event · many systems</span>
          <h2 className="rr-display rr-reveal">
            ONE EMERGENCY.
            <span className="gap" />
            ONE <span className="rr-accent-green">ENGINE.</span>
            <span className="gap" />
            EVERYONE MOVES.
          </h2>
          <Link to="/login" className="rr-btn solid rr-reveal">Run RescueRoute <span className="rr-arw">→</span></Link>
        </section>
      </div>

      {/* toast */}
      <div className={`rr-toast ${toast ? "show" : ""}`}><span className="t-dot" />{toast}</div>
    </div>
  );
}
