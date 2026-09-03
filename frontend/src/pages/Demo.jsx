import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, ROLE_META } from "../context/AuthContext";
import Icon from "../components/Icon";
import "./Demo.css";

const STEPS = [
  {
    icon: "alert",
    title: "One-tap SOS & tracking",
    body:
      "A citizen reports a real emergency (self / bystander / crash) and then tracks the ambulance live. Every report is client-side risk-scored to de-prioritise repeated or suspicious calls.",
  },
  {
    icon: "ambulance",
    title: "Smart dispatch",
    body:
      "The control room engine scores and dispatches the nearest available ambulance instantly and shows a Google-Maps-style animated route. Accuracy improves with your live GPS when you allow it.",
  },
  {
    icon: "hospital",
    title: "Hospital admission & green corridor",
    body:
      "Once the patient is picked up, admission is requested to the top hospitals in parallel — the first to accept wins. Inside a 60s window the case can still be cancelled/rerouted. The route ahead of the ambulance is cleared as a green corridor for nearby drivers.",
  },
  {
    icon: "pulse",
    title: "Handover & the whole lifecycle",
    body:
      "The unit is only released as AVAILABLE once the patient is actually in treatment. Audit timeline, live metrics, and a control-room view keep the whole operation transparent.",
  },
];

export default function Demo() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const finish = () => {
    localStorage.setItem("rr_seen_demo", "1");
    navigate(next, { replace: true });
  };

  const s = STEPS[step];
  const roleLabel = user?.role ? ROLE_META[user.role]?.label : "your dashboard";

  return (
    <div className="demo-page">
      <div className="demo-card">
        <div className="demo-header">
          <span className="demo-logo"><Icon name="sos" size={28} /></span>
          <h1>Welcome to RescueRoute</h1>
          <p className="muted">A two-minute guided tour before we open the {roleLabel} dashboard.</p>
        </div>

        <div className="demo-dots">
          {STEPS.map((x, i) => (
            <span key={i} className={`demo-dot ${i <= step ? "on" : ""}`} />
          ))}
        </div>

        <div className="demo-body">
          <div className="demo-step-icon"><Icon name={s.icon} size={34} /></div>
          <h2>{s.title}</h2>
          <p className="muted">{s.body}</p>
        </div>

        <div className="demo-actions">
          <button className="btn btn-ghost" onClick={finish} style={{ background: "transparent" }}>
            Skip tour
          </button>
          <div className="demo-nav">
            <button className="btn btn-ghost" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0} style={{ background: "transparent" }}>
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn btn-blue" onClick={() => setStep((v) => v + 1)}>Next →</button>
            ) : (
              <button className="btn btn-green" onClick={finish}>Start using the app</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}